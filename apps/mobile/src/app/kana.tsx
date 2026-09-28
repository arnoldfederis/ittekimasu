import { Image } from "expo-image";
import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Button } from "@/components/button";
import { KanaQuiz } from "@/components/kana-quiz";
import { KanaSheet } from "@/components/kana-sheet";
import { useOfflineBannerClearance } from "@/components/offline-banner";
import {
  glyphOf,
  KANA_COUNT,
  KANA_ORDER,
  KANA_SECTIONS,
  type KanaCard,
  type KanaCell,
  type KanaEntry,
  type KanaScript,
  shuffleKana,
  toKanaCards,
} from "@/constants/kana";
import { useThemeColors } from "@/constants/theme";
import { useKanaProgress, useKanaProgressRestore } from "@/lib/kana-progress";
import type { QuizMode } from "@/lib/kana-quiz";

const SCRIPTS: { key: KanaScript; label: string }[] = [
  { key: "hiragana", label: "Hiragana" },
  { key: "katakana", label: "Katakana" },
];

/**
 * Identity of a picked character. The script is in it because the two grids are two
 * different questions — ticking あ does not tick ア, and a deck can hold both.
 */
function pickKey(entry: KanaEntry, script: KanaScript): string {
  return `${script}:${entry.romaji}:${entry.hiragana}`;
}

/**
 * The kana chart: both syllabaries as tables, with a sheet behind every character.
 *
 * Not a deck and not a review session. Kana is the one part of the app that is a reference
 * rather than something to be scheduled — SM-2 on a syllabary spaces あ six days out for
 * being answered correctly, which is the algorithm fighting the material. It reads from
 * constants/kana.ts, so it costs no request and works offline from a cold start.
 *
 * The quiz does keep a record — how often each character was answered right — but on the
 * DEVICE (lib/kana-progress.ts), never as a schedule, and it spends none of the daily review
 * allowance. Pro also backs it up. The chart shows it as a small mark on each cell.
 *
 * Hiragana first because the N5 deck writes its readings in it.
 */
export default function KanaScreen() {
  const bannerClearance = useOfflineBannerClearance();
  const colors = useThemeColors();
  const [script, setScript] = useState<KanaScript>("hiragana");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const progress = useKanaProgress();
  // Pro: fold the server backup into this device's marks. No-op on the free plan.
  useKanaProgressRestore();

  /*
   * Practice picks its characters on the chart itself.
   *
   * It used to be a screen of its own listing the same 27 rows again. That was a second copy
   * of the table to maintain and a worse place to choose from — the chart is already the map
   * of what there is, and "the ones I keep getting wrong" is a thought you have while looking
   * at them, not while reading a list of row labels. Turning the grid into the picker also
   * makes crossing the scripts free: switch the segmented control mid-selection and the
   * hiragana you already ticked stay ticked.
   */
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  /** The running quiz: its shuffled deck and mode, or null. Built once, on Easy or Hard. */
  const [quiz, setQuiz] = useState<{
    deck: KanaCard[];
    mode: QuizMode;
  } | null>(null);

  /**
   * The whole chart as cards, memoised on the script so the sheet's FlatList is not handed a
   * new `data` array on every render.
   */
  const browseDeck = useMemo(() => toKanaCards(KANA_ORDER, script), [script]);

  /** In chart order, so the deck reads the way the picking looked before it was shuffled. */
  const pickedCards = useMemo(() => {
    const cards: KanaCard[] = [];
    for (const entry of KANA_ORDER) {
      for (const candidate of SCRIPTS) {
        if (picked.has(pickKey(entry, candidate.key))) {
          cards.push({ entry, script: candidate.key });
        }
      }
    }
    return cards;
  }, [picked]);

  /**
   * Pick or clear a whole group — a row, or a section.
   *
   * Tapping 46 cells to drill the gojūon is the kind of chore that makes a feature go unused.
   * The rule is "if any of them is missing, add them all; otherwise take them all away", which
   * is what a half-selected row makes you expect a group tap to do.
   */
  function toggleGroup(entries: KanaEntry[]) {
    const keys = entries.map((entry) => pickKey(entry, script));
    const allOn = keys.every((key) => picked.has(key));

    setPicked((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (allOn) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  const allPicked = KANA_ORDER.every((entry) =>
    picked.has(pickKey(entry, script)),
  );

  function startQuiz(mode: QuizMode) {
    setQuiz({ deck: shuffleKana(pickedCards), mode });
  }

  function entriesOf(rows: KanaCell[][]): KanaEntry[] {
    return rows.flat().filter((cell): cell is KanaEntry => cell !== null);
  }

  function togglePick(entry: KanaEntry) {
    const key = pickKey(entry, script);
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  function startPicking() {
    setPicking(true);
    setPicked(new Set());
  }

  function cancelPicking() {
    setPicking(false);
    setPicked(new Set());
  }

  function renderCell(cell: KanaCell, key: string) {
    // An empty slot in the grid — や has no い column. Rendered as a hole rather than
    // skipped, so the columns below it still line up.
    if (!cell) {
      return <View className="flex-1" key={key} />;
    }

    const isPicked = picking && picked.has(pickKey(cell, script));
    const correct = progress[glyphOf(cell, script)]?.correct ?? 0;

    return (
      <Pressable
        accessibilityHint={picking ? undefined : "Opens the character"}
        accessibilityLabel={`${glyphOf(cell, script)}, ${cell.romaji}${
          correct > 0 ? `, answered correctly ${correct} times` : ""
        }`}
        accessibilityRole={picking ? "checkbox" : "button"}
        accessibilityState={picking ? { checked: isPicked } : undefined}
        className={`min-h-16 flex-1 items-center justify-center gap-0.5 rounded-button border py-2 active:bg-surface-sunken ${
          isPicked
            ? "border-primary bg-primary-tint"
            : "border-transparent bg-surface"
        }`}
        key={key}
        onPress={() =>
          picking ? togglePick(cell) : setOpenIndex(KANA_ORDER.indexOf(cell))
        }
        style={{ borderCurve: "continuous" }}
      >
        <Text
          className={isPicked ? "text-primary" : "text-ink"}
          style={{ fontSize: 26, lineHeight: 34 }}
        >
          {glyphOf(cell, script)}
        </Text>
        {/*
          Always shown. Someone opening the chart cannot read kana yet — that is the whole
          reason they are here — so the reading is the point of the cell, not an optional
          extra. Practice is where they get hidden, and there it is the mode doing it rather
          than a preference that could be left in the wrong position.
        */}
        <Text className="text-caption text-ink-subtle">{cell.romaji}</Text>

        {/*
          The quiz's streak mark: how many times this one has been answered right. Only ever
          counts up — a miss does not take one away — so the chart fills in as the learner
          goes, and a blank cell means "not practised yet", never "failed".
        */}
        {correct > 0 ? (
          <View className="absolute top-1 right-1 min-w-4 items-center rounded-pill bg-primary-tint px-1">
            <Text
              className="text-primary"
              style={{ fontSize: 10, lineHeight: 14 }}
            >
              {correct > 99 ? "99+" : correct}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: picking ? "Pick characters" : "Kana",
          /*
            The one thing up here, because it is the one thing on this screen that is not
            "look something up". While picking it becomes Cancel — there has to be a way out
            of a mode that changes what tapping a cell does.
          */
          headerRight: () =>
            picking ? (
              <Pressable
                accessibilityRole="button"
                className="min-h-11 justify-center px-2 active:opacity-60"
                onPress={cancelPicking}
              >
                <Text className="text-callout text-primary">Cancel</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityHint="Pick characters and drill them in random order"
                accessibilityLabel="Practice"
                accessibilityRole="button"
                className="min-h-11 flex-row items-center gap-1.5 px-2 active:opacity-60"
                onPress={startPicking}
              >
                <Image
                  source="sf:rectangle.stack"
                  style={{ width: 17, height: 17 }}
                  tintColor={colors.primary}
                />
                <Text className="text-callout text-primary">Practice</Text>
              </Pressable>
            ),
        }}
      />

      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{ paddingBottom: 40 + bannerClearance }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="flex-row gap-2 px-4 pt-4 pb-2">
          {SCRIPTS.map((entry) => {
            const selected = script === entry.key;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`flex-1 items-center rounded-pill border py-2 ${
                  selected
                    ? "border-primary bg-primary-tint"
                    : "border-line bg-surface"
                }`}
                key={entry.key}
                onPress={() => setScript(entry.key)}
              >
                <Text
                  className={`text-callout ${
                    selected ? "font-semibold text-primary" : "text-ink-muted"
                  }`}
                >
                  {entry.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="flex-row items-center gap-3 px-4 pb-4">
          <Text className="flex-1 text-caption text-ink-subtle">
            {picking ? (
              <>
                Tap the ones to practise. Both scripts count — switch above and
                keep picking.
              </>
            ) : (
              <>{KANA_COUNT} characters. Tap one to hear it.</>
            )}
          </Text>

          {/*
            The whole script in one tap, beside the section and row toggles. Names the script
            it acts on, because it only takes the grid on screen: the other script's picks are
            left alone, the same as every other group toggle here.
          */}
          {picking ? (
            <Pressable
              accessibilityRole="button"
              className="min-h-11 justify-center active:opacity-60"
              onPress={() => toggleGroup(KANA_ORDER)}
            >
              <Text className="text-callout text-primary">
                {allPicked ? "Clear" : "Select all"} {script}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {KANA_SECTIONS.map((section) => {
          const sectionEntries = entriesOf(section.rows);
          const sectionOn =
            sectionEntries.length > 0 &&
            sectionEntries.every((entry) => picked.has(pickKey(entry, script)));

          return (
            <View className="px-4 pb-6" key={section.id}>
              <View className="flex-row items-center justify-between pb-1">
                <Text className="font-semibold text-heading text-ink">
                  {section.title}
                </Text>
                {picking ? (
                  <Pressable
                    accessibilityRole="button"
                    className="min-h-11 justify-center px-1 active:opacity-60"
                    onPress={() => toggleGroup(sectionEntries)}
                  >
                    <Text className="text-callout text-primary">
                      {sectionOn ? "Clear" : "Select all"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <Text className="pb-3 text-caption text-ink-muted">
                {section.caption}
              </Text>

              <View className="gap-2">
                {section.rows.map((row, rowIndex) => {
                  const rowEntries = entriesOf([row]);
                  const rowOn =
                    rowEntries.length > 0 &&
                    rowEntries.every((entry) =>
                      picked.has(pickKey(entry, script)),
                    );

                  return (
                    <View
                      className="flex-row items-center gap-2"
                      // Rows are fixed table positions, not a reorderable list.
                      key={`${section.id}-${rowIndex}`}
                    >
                      {/*
                        The row handle, only while picking. あ行 is the unit a learner thinks
                        in, so it gets one tap — and it only costs the grid its width in the
                        mode where the grid is a picker rather than a table.
                      */}
                      {picking ? (
                        <Pressable
                          accessibilityLabel={`${rowEntries
                            .map((entry) => glyphOf(entry, script))
                            .join(", ")} row`}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: rowOn }}
                          className="h-11 w-7 items-center justify-center active:opacity-60"
                          onPress={() => toggleGroup(rowEntries)}
                        >
                          <Image
                            source={
                              rowOn ? "sf:checkmark.circle.fill" : "sf:circle"
                            }
                            style={{ width: 20, height: 20 }}
                            tintColor={
                              rowOn ? colors.primary : colors.inkSubtle
                            }
                          />
                        </Pressable>
                      ) : null}

                      {row.map((cell, cellIndex) =>
                        renderCell(
                          cell,
                          `${section.id}-${rowIndex}-${cellIndex}`,
                        ),
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/*
        Pinned over the grid rather than at the end of it: the count is what is being decided,
        and a Start button below a hundred cells is somewhere nobody scrolls back to.

        Two starts, one per mode, rather than a mode picker and then a Start: choosing the
        mode IS starting, and a separate step would be a screen that exists to be tapped
        through.
      */}
      {picking ? (
        <View
          className="gap-2 border-line border-t bg-surface px-4 pt-3"
          style={{ paddingBottom: 16 + bannerClearance }}
        >
          <Text className="text-center text-caption text-ink-subtle">
            {pickedCards.length === 0
              ? "Pick at least one to start."
              : `${pickedCards.length} picked · Easy: choose from four · Hard: type it`}
          </Text>
          <View className="flex-row gap-3">
            <Button
              className="flex-1"
              disabled={pickedCards.length === 0}
              onPress={() => startQuiz("easy")}
              title="Easy"
            />
            <Button
              className="flex-1"
              disabled={pickedCards.length === 0}
              onPress={() => startQuiz("hard")}
              title="Hard"
              variant="secondary"
            />
          </View>
        </View>
      ) : null}

      <KanaSheet
        index={openIndex}
        onClose={() => setOpenIndex(null)}
        onToggleScript={() =>
          setScript((current) =>
            current === "hiragana" ? "katakana" : "hiragana",
          )
        }
        order={browseDeck}
      />

      <KanaQuiz
        deck={quiz?.deck ?? null}
        mode={quiz?.mode ?? "easy"}
        onClose={() => setQuiz(null)}
      />
    </>
  );
}
