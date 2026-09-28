import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { DisplayPrefsSheet } from "@/components/display-prefs-sheet";
import { KanaStrokes } from "@/components/kana-strokes";
import {
  glyphOf,
  type KanaCard,
  type KanaEntry,
  type KanaScript,
} from "@/constants/kana";
import { useThemeColors } from "@/constants/theme";
import { TEXT_SCALE_FACTOR, useKanaDisplayPrefs } from "@/lib/display-prefs";
import {
  applyAudioMode,
  getSelectedVoice,
  isSoundEnabled,
  speakReading,
  stopSpeaking,
} from "@/lib/speech";
import { STROKE_NUMBER_POINTS } from "@/lib/stroke-font";

/** The glyph at the default text size. The display setting multiplies it. */
const BASE_GLYPH_POINTS = 120;

/**
 * A page's identity: the syllable, deliberately WITHOUT the script.
 *
 * The list key decides whether flipping hiragana→katakana UPDATES the pages or throws them
 * away: a key that moves unmounts the cell and mounts a new one, which with stroke order on
 * means tearing down and rebuilding a whole SVG per page — the reason the toggle stalled. The
 * syllable is what the page is actually about, so keyed on that, ア simply replaces the glyph
 * in the page あ was already in.
 *
 * Safe because the sheet only ever holds one script at a time. It used to host practice too,
 * where a mixed deck held あ AND ア and needed the script in the key; practice is the quiz in
 * kana-quiz.tsx now.
 */
function browseKeyOf(card: KanaCard): string {
  return card.entry.romaji + card.entry.hiragana;
}

/**
 * Yōon are two characters wide (きゃ), so at the same point size they are roughly twice the
 * width of a gojūon and wrap onto a second line at the larger settings. Sized down to fit on
 * one line instead: a syllable broken across two lines is not the same thing to read.
 */
const DIGRAPH_SIZE_RATIO = 0.62;

/**
 * Horizontal padding between the page edge and the inside of the card: `px-6` on the page
 * and `px-6` again on the card. Text shrinks itself to fit; an SVG has to be told how much
 * room it has.
 */
const CARD_INSET = 96;

type KanaSheetProps = {
  /** Index into `order`, or null when the sheet is closed. */
  index: number | null;
  onClose: () => void;
  /** The whole chart in the script being read, in reading order. */
  order: KanaCard[];
  /**
   * Flips hiragana/katakana for the sheet AND the chart underneath it.
   *
   * Owned by the chart, not held here: the segmented control at the top of the chart shows
   * the same state, and a sheet with its own idea of which script it was on would leave the
   * two disagreeing the moment it closed.
   */
  onToggleScript: () => void;
};

/**
 * One kana, big, in a sheet you swipe through.
 *
 * Deliberately NOT the review screen, and no longer the practice screen either. There is no
 * rating row, no streak, no undo, no "card 3 of 20" and no session to finish — this is a
 * chart you look things up in, and every one of those controls would imply the app is keeping
 * score. The reading is always shown: someone opening the chart cannot read kana yet, which
 * is the whole reason they are there. Testing yourself is the quiz (kana-quiz.tsx), which
 * checks the answer instead of trusting a tap-to-reveal. Nothing here writes anything.
 *
 * The swipe is a horizontally paged list over the whole syllabary rather than a gesture that
 * changes state: paging is native, so it has the right rubber-banding at both ends and the
 * right feel under the thumb, for free.
 */
export function KanaSheet({
  index,
  onClose,
  order,
  onToggleScript,
}: KanaSheetProps) {
  const colors = useThemeColors();
  const displayPrefs = useKanaDisplayPrefs();
  const scale = TEXT_SCALE_FACTOR[displayPrefs.textScale];
  const { width: windowWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<KanaCard>>(null);

  // Measured rather than assumed: a pageSheet is inset from the screen on iPad and in
  // landscape, and a page sized to the window would leave every card off-centre.
  const [pageWidth, setPageWidth] = useState(windowWidth);

  /*
   * Stroke order lives HERE, not in the chart's navigation bar, and is REMEMBERED.
   *
   * It used to be a mode set before the sheet opened, on the theory that a sheet you swipe
   * through should hold nothing but the character. In practice that meant backing out to the
   * chart and re-opening the card every time you wanted to check how one was written — the
   * question "how do I write this?" arrives while you are looking AT it. It is about the
   * character rather than about the app, which is what earns it a place in here.
   *
   * The state is in the display store rather than this component: closing the sheet or
   * stepping out to the Learn tab unmounts this, and losing the toggle to either is the same
   * round trip all over again.
   */
  const strokeOrder = displayPrefs.strokeOrder;

  /** Text size and romaji, over the card they change. See display-prefs-sheet.tsx. */
  const [showDisplayPrefs, setShowDisplayPrefs] = useState(false);

  const open = index !== null;

  /*
   * What the sheet is actually rendering, held still while it closes.
   *
   * A pageSheet takes a few hundred milliseconds to animate out, and it keeps rendering the
   * whole time. When the sheet also hosted practice, clearing the deck on close swapped
   * `order` under it mid-animation, so the card visibly flicked back to the first character
   * of the chart on the way down. Freezing the props at the moment of closing means the sheet
   * dismisses showing exactly what it was showing — still worth it for the script toggle,
   * which also replaces `order`.
   */
  const [shown, setShown] = useState({ order, index: index ?? 0 });

  useEffect(() => {
    if (index !== null) setShown({ order, index });
  }, [index, order]);

  /*
   * AVAudioSession is process-wide and only written by setPlaysInSilentMode, so a screen
   * that speaks has to claim it on mount. Without this the first kana tapped after a cold
   * launch is silent under the ring switch, on the one screen whose whole point is hearing
   * the sound.
   */
  useEffect(() => {
    if (open) applyAudioMode();
  }, [open]);

  useEffect(() => {
    if (!open) stopSpeaking();
  }, [open]);

  /**
   * What the pages depend on besides `data`, so the list re-renders them when it moves.
   *
   * The script is not here: it rides on each card, so changing it replaces `order` and the
   * list re-renders on `data` alone.
   */
  const cellState = useMemo(() => ({ strokeOrder }), [strokeOrder]);

  /** What the header calls this deck: the script being read. */
  const deckLabel = useMemo(() => {
    const first = shown.order[0]?.script;
    if (!first) return "Kana";
    return first === "hiragana" ? "Hiragana" : "Katakana";
  }, [shown]);

  const speak = useCallback(async (entry: KanaEntry, script: KanaScript) => {
    if (!(await isSoundEnabled())) return;
    // The character IS the sound, so the glyph is what gets spoken — never the romaji,
    // which a Japanese voice would read as English.
    speakReading(glyphOf(entry, script), await getSelectedVoice());
  }, []);

  function renderPage({ item }: { item: KanaCard }) {
    const { entry, script } = item;
    const other = script === "hiragana" ? entry.katakana : entry.hiragana;
    const otherLabel = script === "hiragana" ? "Katakana" : "Hiragana";
    const glyph = glyphOf(entry, script);
    const glyphSize =
      BASE_GLYPH_POINTS * scale * (glyph.length > 1 ? DIGRAPH_SIZE_RATIO : 1);
    const glyphBoxHeight = BASE_GLYPH_POINTS * scale * 1.24;

    return (
      <View
        className="items-center justify-center px-6"
        style={{ width: pageWidth }}
      >
        <Pressable
          accessibilityHint="Plays the sound"
          accessibilityLabel={`${glyph}, ${entry.romaji}`}
          accessibilityRole="button"
          className="w-full items-center gap-4 rounded-card border-2 border-transparent bg-surface px-6 py-10 active:opacity-80"
          onPress={() => speak(entry, script)}
          style={{ borderCurve: "continuous" }}
        >
          {/*
            One line, always. The row keeps the height of a full-size glyph whatever it holds,
            so paging from あ to きゃ does not resize the card under the thumb.
          */}
          <View
            className="w-full items-center justify-center"
            style={{ height: glyphBoxHeight }}
          >
            {strokeOrder ? (
              <KanaStrokes
                glyph={glyph}
                height={glyphBoxHeight}
                // The card's own horizontal padding plus the page's, so a two-character
                // yōon shrinks to fit instead of running under the rounded corners.
                maxWidth={Math.max(pageWidth - CARD_INSET, 0)}
                numberPoints={STROKE_NUMBER_POINTS * scale}
              />
            ) : (
              <Text
                // The guarantee, rather than the arithmetic above: iOS shrinks the glyph
                // until it fits one line, whatever the width works out to. The digraph ratio
                // only decides where that shrinking STARTS, so きゃ is not microscopic.
                adjustsFontSizeToFit
                className="text-ink"
                minimumFontScale={0.4}
                numberOfLines={1}
                /*
                 * No lineHeight here on purpose. adjustsFontSizeToFit scales the font but NOT
                 * a lineHeight set alongside it, so the shrunk glyph gets laid out in a box
                 * sized for the original and is clipped — which looks exactly like the text
                 * breaking. The wrapper's fixed height does the vertical centring instead.
                 */
                style={{
                  fontSize: glyphSize,
                  textAlign: "center",
                  width: "100%",
                }}
              >
                {glyph}
              </Text>
            )}
          </View>

          <View className="h-6 justify-center">
            <Text className="font-semibold text-heading text-primary">
              {entry.romaji}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Image
              source="sf:speaker.wave.2"
              style={{ width: 15, height: 15 }}
              tintColor={colors.inkSubtle}
            />
            <Text className="text-caption text-ink-subtle">Tap to hear it</Text>
          </View>
        </Pressable>

        {/*
          The same syllable in the other script, and a way into it. Tapping turns the sheet
          AND the chart behind it, landing on the same syllable.
        */}
        <Pressable
          accessibilityHint={`Switches to ${otherLabel.toLowerCase()}`}
          accessibilityLabel={`${otherLabel} ${other}`}
          accessibilityRole="button"
          className="mt-5 flex-row items-center gap-2 rounded-pill border border-line bg-surface px-4 py-2 active:bg-surface-sunken"
          onPress={onToggleScript}
          style={{ borderCurve: "continuous" }}
        >
          <Text className="text-callout text-ink-muted">{otherLabel}</Text>
          <Text className="text-body text-ink">{other}</Text>
          <Image
            source="sf:arrow.left.arrow.right"
            style={{ width: 13, height: 13 }}
            tintColor={colors.primary}
          />
        </Pressable>

        {entry.note ? (
          <Text className="mt-2 px-4 text-center text-caption text-ink-subtle">
            {entry.note}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={open}
    >
      <View
        className="flex-1 bg-canvas"
        onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}
      >
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          {/* No progress counter on purpose: the chart is not a session to get through. */}
          <Text className="text-callout text-ink-muted">
            {deckLabel}
            {strokeOrder ? " · Stroke order" : ""}
          </Text>

          {/*
            No controls in here. Romaji and text size live behind the settings button in the
            chart's navigation bar — a sheet you swipe through wants nothing in it but the
            character.
          */}
          <View className="flex-row items-center gap-1">
            {/*
              Display settings, on the card rather than four taps away in Settings. The
              moment you want bigger type is the moment a character is in front of you.
            */}
            <Pressable
              accessibilityHint="Text size and romaji readings"
              accessibilityLabel="Display settings"
              accessibilityRole="button"
              className="min-h-11 justify-center px-2 active:opacity-60"
              onPress={() => setShowDisplayPrefs(true)}
            >
              <Image
                source="sf:textformat.size"
                style={{ width: 20, height: 20 }}
                tintColor={colors.inkSubtle}
              />
            </Pressable>

            {/*
              The one mode that belongs on the card rather than before it. Icon only: the
              header already carries the words "Stroke order" once it is on, and a second
              label beside Done crowds a row that is mostly there to get out of.
            */}
            <Pressable
              accessibilityHint="Shows how the character is written, stroke by stroke"
              accessibilityLabel="Stroke order"
              accessibilityRole="button"
              accessibilityState={{ selected: strokeOrder }}
              className="min-h-11 justify-center px-2 active:opacity-60"
              onPress={() => displayPrefs.setStrokeOrder(!strokeOrder)}
            >
              <Image
                source={strokeOrder ? "sf:hand.draw.fill" : "sf:hand.draw"}
                style={{ width: 20, height: 20 }}
                tintColor={strokeOrder ? colors.primary : colors.inkSubtle}
              />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              className="min-h-11 justify-center px-2 active:opacity-60"
              onPress={onClose}
            >
              <Text className="font-semibold text-body text-primary">Done</Text>
            </Pressable>
          </View>
        </View>

        <FlatList
          data={shown.order}
          /*
           * Everything a visible page depends on that is NOT `data`.
           *
           * VirtualizedList memoises its cells on `data` and re-renders them for nothing
           * else, so `renderPage` closing over these is not enough: the first version of the
           * script toggle flipped the state, changed the header, and left every visible card
           * still showing あ. The same trap catches the stroke toggle, which changes while the
           * sheet is open.
           *
           * Text size and romaji are absent on purpose — they are set on a screen that
           * cannot be open at the same time as this one.
           */
          extraData={cellState}
          getItemLayout={(_, i) => ({
            length: pageWidth,
            offset: pageWidth * i,
            index: i,
          })}
          horizontal
          /*
           * How many pages exist off-screen, and it matters far more here than on an ordinary
           * list: every one of them is a glyph, and with stroke order on it is an SVG of a
           * couple of dozen nodes. The default window is ten screens either side, so flipping
           * the script rebuilt about twenty of those in one synchronous pass while the thumb
           * waited. Paging moves one card at a time, so a card either side is all a swipe can
           * reach before the next batch renders.
           */
          initialNumToRender={1}
          // A closed Modal renders nothing, so this is read fresh every time the sheet opens
          // and there is no scroll position to keep in sync with the tapped cell.
          initialScrollIndex={shown.index}
          keyExtractor={browseKeyOf}
          maxToRenderPerBatch={2}
          onMomentumScrollEnd={() => {
            // Speaking on every swipe would turn a flick through the chart into noise. The
            // card is tappable; hearing it stays a choice.
            stopSpeaking();
          }}
          pagingEnabled
          ref={listRef}
          renderItem={renderPage}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          windowSize={5}
        />

        <DisplayPrefsSheet
          onClose={() => setShowDisplayPrefs(false)}
          scope="kana"
          visible={showDisplayPrefs}
        />

        <Text className="px-6 pb-8 text-center text-caption text-ink-subtle">
          Swipe for the next one.
        </Text>
      </View>
    </Modal>
  );
}
