import { Image } from "expo-image";
import { Stack } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { KanaSheet } from "@/components/kana-sheet";
import { useOfflineBannerClearance } from "@/components/offline-banner";
import {
  glyphOf,
  KANA_COUNT,
  KANA_ORDER,
  KANA_SECTIONS,
  type KanaCell,
  type KanaEntry,
  type KanaScript,
  shuffledKanaOrder,
} from "@/constants/kana";
import { useThemeColors } from "@/constants/theme";
import { TEXT_SCALE_FACTOR, useDisplayPrefs } from "@/lib/display-prefs";

const SCRIPTS: { key: KanaScript; label: string }[] = [
  { key: "hiragana", label: "Hiragana" },
  { key: "katakana", label: "Katakana" },
];

/**
 * The kana chart: both syllabaries as tables, with a sheet behind every character.
 *
 * Not a deck and not a review session. Kana is the one part of the app that is a reference
 * rather than something to be scheduled — SM-2 on a syllabary spaces あ six days out for
 * being answered correctly, which is the algorithm fighting the material. It reads from
 * constants/kana.ts, so it costs no request, works offline from a cold start, and records
 * nothing against the learner.
 *
 * Hiragana first because the N5 deck writes its readings in it.
 */
export default function KanaScreen() {
  const bannerClearance = useOfflineBannerClearance();
  const colors = useThemeColors();
  const [script, setScript] = useState<KanaScript>("hiragana");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const prefs = useDisplayPrefs();

  /*
   * Flashcard mode: the same sheet, over a shuffled sequence.
   *
   * Held as the ORDER rather than a boolean, and regenerated only when shuffle is tapped.
   * Deriving it from a flag would reshuffle on every re-render — a text-size change mid-swipe
   * would silently deal a new deck under the thumb.
   *
   * Null means reading order, which is what tapping a cell in the chart gives you. The two
   * entry points are deliberately separate: tapping あ means "show me あ", and that should
   * never be answered with a random character.
   */
  const [shuffledOrder, setShuffledOrder] = useState<KanaEntry[] | null>(null);

  function startShuffle() {
    setShuffledOrder(shuffledKanaOrder());
    setOpenIndex(0);
  }

  function openAt(cell: KanaEntry) {
    setShuffledOrder(null);
    setOpenIndex(KANA_ORDER.indexOf(cell));
  }

  function renderCell(cell: KanaCell, key: string) {
    // An empty slot in the grid — や has no い column. Rendered as a hole rather than
    // skipped, so the columns below it still line up.
    if (!cell) {
      return <View className="flex-1" key={key} />;
    }

    return (
      <Pressable
        accessibilityHint="Opens the character"
        accessibilityLabel={`${glyphOf(cell, script)}, ${cell.romaji}`}
        accessibilityRole="button"
        className="min-h-16 flex-1 items-center justify-center gap-0.5 rounded-button bg-surface py-2 active:bg-surface-sunken"
        key={key}
        onPress={() => openAt(cell)}
        style={{ borderCurve: "continuous" }}
      >
        <Text className="text-ink" style={{ fontSize: 26, lineHeight: 34 }}>
          {glyphOf(cell, script)}
        </Text>
        {/*
          Hidden readings turn the whole chart into a self-test. The cell keeps its height
          either way — a grid that reflows when you flip a switch is disorienting on a table
          you are meant to be memorising the shape of.
        */}
        <Text className="text-caption text-ink-subtle">
          {prefs.showRomaji ? cell.romaji : " "}
        </Text>
      </Pressable>
    );
  }

  return (
    <>
      {/*
        No display control in this navigation bar either. Romaji and text size are one
        preference pair for the whole app, so they live in Settings ▸ Display where they can
        be previewed — not duplicated on every screen they happen to affect.
      */}
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Kana",
          /*
            Shuffle lives up here, not in the sheet: it decides what the sheet IS before it
            opens, and a control that reshuffles mid-swipe would move the ground under the
            thumb. It is also the one thing on this screen that is not "look something up",
            which is why it gets a button of its own rather than a mode switch over the chart.
          */
          headerRight: () => (
            <Pressable
              accessibilityHint="Swipes through every character in random order"
              accessibilityLabel="Shuffle"
              accessibilityRole="button"
              className="min-h-11 flex-row items-center gap-1.5 px-2 active:opacity-60"
              onPress={startShuffle}
            >
              <Image
                source="sf:shuffle"
                style={{ width: 16, height: 16 }}
                tintColor={colors.primary}
              />
              <Text className="text-callout text-primary">Shuffle</Text>
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

        <Text className="px-4 pb-4 text-caption text-ink-subtle">
          {KANA_COUNT} characters. Tap one to hear it
          {prefs.showRomaji ? "." : ", readings hidden."}
        </Text>

        {KANA_SECTIONS.map((section) => (
          <View className="px-4 pb-6" key={section.id}>
            <Text className="pb-1 font-semibold text-heading text-ink">
              {section.title}
            </Text>
            <Text className="pb-3 text-caption text-ink-muted">
              {section.caption}
            </Text>

            <View className="gap-2">
              {section.rows.map((row, rowIndex) => (
                <View
                  className="flex-row gap-2"
                  // Rows are fixed table positions, not a reorderable list.
                  key={`${section.id}-${rowIndex}`}
                >
                  {row.map((cell, cellIndex) =>
                    renderCell(cell, `${section.id}-${rowIndex}-${cellIndex}`),
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <KanaSheet
        index={openIndex}
        onClose={() => setOpenIndex(null)}
        order={shuffledOrder ?? KANA_ORDER}
        scale={TEXT_SCALE_FACTOR[prefs.textScale]}
        script={script}
        showRomaji={prefs.showRomaji}
        shuffled={shuffledOrder !== null}
      />
    </>
  );
}
