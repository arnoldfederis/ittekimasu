import { Image } from "expo-image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useThemeColors } from "@/constants/theme";
import {
  glyphOf,
  KANA_ORDER,
  type KanaEntry,
  type KanaScript,
} from "@/constants/kana";
import {
  applyAudioMode,
  getSelectedVoice,
  isSoundEnabled,
  speakReading,
  stopSpeaking,
} from "@/lib/speech";

/** The glyph at the default text size. The display setting multiplies it. */
const BASE_GLYPH_POINTS = 120;

/**
 * Yōon are two characters wide (きゃ), so at the same point size they are roughly twice the
 * width of a gojūon and wrap onto a second line at the larger settings. Sized down to fit on
 * one line instead: a syllable broken across two lines is not the same thing to read.
 */
const DIGRAPH_SIZE_RATIO = 0.62;

type KanaSheetProps = {
  /** Index into KANA_ORDER, or null when the sheet is closed. */
  index: number | null;
  script: KanaScript;
  onClose: () => void;
  /** Off hides the reading, which turns the sheet into a self-test. */
  showRomaji: boolean;
  /** Multiplier from the shared text-size setting. */
  scale: number;
};

/**
 * One kana, big, in a sheet you swipe through.
 *
 * Deliberately NOT the review screen. There is no rating row, no streak, no undo, no "card 3
 * of 20" and no session to finish — this is a chart you look things up in, and every one of
 * those controls would imply the app is keeping score. Nothing here writes anything, to the
 * server or to the device.
 *
 * The swipe is a horizontally paged list over the whole syllabary rather than a gesture that
 * changes state: paging is native, so it has the right rubber-banding at both ends and the
 * right feel under the thumb, for free.
 */
export function KanaSheet({
  index,
  script,
  onClose,
  showRomaji,
  scale,
}: KanaSheetProps) {
  const colors = useThemeColors();
  const { width: windowWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<KanaEntry>>(null);

  // Measured rather than assumed: a pageSheet is inset from the screen on iPad and in
  // landscape, and a page sized to the window would leave every card off-centre.
  const [pageWidth, setPageWidth] = useState(windowWidth);

  const open = index !== null;

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

  const speak = useCallback(
    async (entry: KanaEntry) => {
      if (!(await isSoundEnabled())) return;
      // The character IS the sound, so the glyph is what gets spoken — never the romaji,
      // which a Japanese voice would read as English.
      speakReading(glyphOf(entry, script), await getSelectedVoice());
    },
    [script],
  );

  function renderPage({ item }: { item: KanaEntry }) {
    const other = script === "hiragana" ? item.katakana : item.hiragana;
    const otherLabel = script === "hiragana" ? "Katakana" : "Hiragana";
    const glyph = glyphOf(item, script);
    const glyphSize =
      BASE_GLYPH_POINTS * scale * (glyph.length > 1 ? DIGRAPH_SIZE_RATIO : 1);

    return (
      <View
        className="items-center justify-center px-6"
        style={{ width: pageWidth }}
      >
        <Pressable
          accessibilityHint="Plays the sound"
          // The reading stays in the label even when it is hidden on screen: VoiceOver users
          // are not the ones self-testing by sight.
          accessibilityLabel={`${glyphOf(item, script)}, ${item.romaji}`}
          accessibilityRole="button"
          className="w-full items-center gap-4 rounded-card border-2 border-transparent bg-surface px-6 py-10 active:opacity-80"
          onPress={() => speak(item)}
          style={{ borderCurve: "continuous" }}
        >
          {/*
            One line, always. The row keeps the height of a full-size glyph whatever it holds,
            so paging from あ to きゃ does not resize the card under the thumb.
          */}
          <View
            className="w-full items-center justify-center"
            style={{ height: BASE_GLYPH_POINTS * scale * 1.24 }}
          >
            <Text
              // The guarantee, rather than the arithmetic above: iOS shrinks the glyph until
              // it fits one line, whatever the width works out to. The digraph ratio only
              // decides where that shrinking STARTS, so きゃ does not end up microscopic.
              adjustsFontSizeToFit
              className="text-ink"
              minimumFontScale={0.4}
              numberOfLines={1}
              /*
               * No lineHeight here on purpose. adjustsFontSizeToFit scales the font but NOT a
               * lineHeight set alongside it, so the shrunk glyph gets laid out in a box sized
               * for the original and is clipped — which looks exactly like the text breaking.
               * The wrapper's fixed height does the vertical centring instead.
               */
              style={{
                fontSize: glyphSize,
                textAlign: "center",
                width: "100%",
              }}
            >
              {glyph}
            </Text>
          </View>

          {/*
            An empty box rather than a placeholder character: a middle dot sitting where the
            reading was reads as content — as though the answer were "·" — which is the
            opposite of what hiding it is for. This just holds the space.
          */}
          <View className="h-6 justify-center">
            {showRomaji ? (
              <Text className="font-semibold text-heading text-primary">
                {item.romaji}
              </Text>
            ) : null}
          </View>

          <View className="flex-row items-center gap-2">
            <Image
              source="sf:speaker.wave.2"
              style={{ width: 15, height: 15 }}
              tintColor={colors.inkSubtle}
            />
            <Text className="text-caption text-ink-subtle">
              {showRomaji ? "Tap to hear it" : "Tap to hear the answer"}
            </Text>
          </View>
        </Pressable>

        {showRomaji ? (
          <Text className="mt-5 text-callout text-ink-muted">
            {otherLabel} {other}
          </Text>
        ) : null}

        {item.note ? (
          <Text className="mt-2 px-4 text-center text-caption text-ink-subtle">
            {item.note}
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
          {/* No progress counter on purpose: nothing here is a session to get through. */}
          <Text className="text-callout text-ink-muted">
            {script === "hiragana" ? "Hiragana" : "Katakana"}
          </Text>

          {/*
            No controls in here. Romaji and text size live behind the settings button in the
            chart's navigation bar — a sheet you swipe through wants nothing in it but the
            character.
          */}
          <Pressable
            accessibilityRole="button"
            className="min-h-11 justify-center px-2 active:opacity-60"
            onPress={onClose}
          >
            <Text className="font-semibold text-body text-primary">Done</Text>
          </Pressable>
        </View>

        <FlatList
          data={KANA_ORDER}
          getItemLayout={(_, i) => ({
            length: pageWidth,
            offset: pageWidth * i,
            index: i,
          })}
          horizontal
          // A closed Modal renders nothing, so this is read fresh every time the sheet opens
          // and there is no scroll position to keep in sync with the tapped cell.
          initialScrollIndex={index ?? 0}
          keyExtractor={(entry) => entry.romaji + entry.hiragana}
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
        />

        <Text className="px-6 pb-8 text-center text-caption text-ink-subtle">
          Swipe for the next one.
        </Text>
      </View>
    </Modal>
  );
}
