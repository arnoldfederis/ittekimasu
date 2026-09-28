import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Button } from "@/components/button";
import { KanaQuiz } from "@/components/kana-quiz";
import { KanaScriptToggle } from "@/components/kana-script-toggle";
import { useOfflineBannerClearance } from "@/components/offline-banner";
import {
  glyphOf,
  KANA_COUNT,
  KANA_ORDER,
  KANA_SECTIONS,
  type KanaCard,
  type KanaCell,
  type KanaScript,
  shuffleKana,
} from "@/constants/kana";
import {
  type Mastery,
  masteryOf,
  useKanaProgress,
  useKanaProgressRestore,
} from "@/lib/kana-progress";
import { formatSeconds, type QuizMode } from "@/lib/kana-quiz";

/** How many characters "Worth another look" offers — a quiz-sized handful, not a backlog. */
const REVISIT_LIMIT = 12;

const MASTERY_STYLE: Record<
  Mastery,
  { cell: string; glyph: string; romaji: string; label: string }
> = {
  new: {
    cell: "bg-surface",
    glyph: "text-ink-subtle",
    romaji: "text-ink-subtle",
    label: "New",
  },
  practising: {
    cell: "bg-accent-tint",
    glyph: "text-ink",
    romaji: "text-ink-muted",
    label: "Practising",
  },
  learning: {
    cell: "bg-primary-tint",
    glyph: "text-ink",
    romaji: "text-ink-muted",
    label: "Learning",
  },
  mastered: {
    cell: "bg-primary",
    glyph: "text-ink-inverse",
    romaji: "text-ink-inverse",
    label: "Mastered",
  },
};

const LEGEND: Mastery[] = ["new", "practising", "learning", "mastered"];

/**
 * How well each kana is known, laid out as the chart itself.
 *
 * The chart already is the map of what there is to learn, so progress is shown ON it rather
 * than as a list: a cell's colour says how far along it is, and a glance shows which rows are
 * solid and which are still patchy. Colours go amber → teal → solid teal, never red: a
 * character you have missed is still one you are "practising", which is the truth of it.
 *
 * Reads the device copy of the quiz progress (lib/kana-progress.ts), so it works offline and
 * on the free plan. Pro also pulls the account backup in, the same as the chart does.
 */
export default function KanaProgressScreen() {
  const bannerClearance = useOfflineBannerClearance();
  const [script, setScript] = useState<KanaScript>("hiragana");
  const [quiz, setQuiz] = useState<{ deck: KanaCard[]; mode: QuizMode } | null>(
    null,
  );

  const progress = useKanaProgress();
  useKanaProgressRestore();

  const stats = useMemo(() => {
    let mastered = 0;
    let practised = 0;
    let correct = 0;
    let attempts = 0;
    let totalMs = 0;
    for (const entry of KANA_ORDER) {
      const record = progress[glyphOf(entry, script)];
      const mastery = masteryOf(record);
      if (mastery === "mastered") mastered++;
      if (mastery !== "new") practised++;
      if (record) {
        correct += record.correct;
        attempts += record.attempts;
        totalMs += record.totalMs;
      }
    }
    return {
      mastered,
      practised,
      accuracy: attempts ? correct / attempts : null,
      averageMs: attempts ? totalMs / attempts : null,
    };
  }, [progress, script]);

  /**
   * Practised but not mastered yet, least accurate first. Never called mistakes: these are
   * the characters closest to clicking, which is exactly why they are worth another look.
   */
  const revisit = useMemo(
    () =>
      KANA_ORDER.map((entry) => ({
        entry,
        record: progress[glyphOf(entry, script)],
      }))
        .filter(
          ({ record }) =>
            record !== undefined &&
            record.attempts > 0 &&
            masteryOf(record) !== "mastered",
        )
        .sort((a, b) => {
          const accuracy = (x: typeof a) =>
            x.record ? x.record.correct / x.record.attempts : 1;
          return (
            accuracy(a) - accuracy(b) ||
            (b.record?.attempts ?? 0) - (a.record?.attempts ?? 0)
          );
        })
        .slice(0, REVISIT_LIMIT)
        .map(({ entry }): KanaCard => ({ entry, script })),
    [progress, script],
  );

  function renderCell(cell: KanaCell, key: string) {
    if (!cell) return <View className="flex-1" key={key} />;

    const glyph = glyphOf(cell, script);
    const style = MASTERY_STYLE[masteryOf(progress[glyph])];

    return (
      <View
        accessibilityLabel={`${glyph}, ${cell.romaji}, ${style.label}`}
        accessible
        className={`min-h-14 flex-1 items-center justify-center gap-0.5 rounded-button py-1.5 ${style.cell}`}
        key={key}
        style={{ borderCurve: "continuous" }}
      >
        <Text className={style.glyph} style={{ fontSize: 22, lineHeight: 28 }}>
          {glyph}
        </Text>
        <Text className={`text-caption ${style.romaji}`}>{cell.romaji}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Kana progress" }} />

      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{
          gap: 20,
          padding: 16,
          paddingBottom: 40 + bannerClearance,
        }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <KanaScriptToggle onChange={setScript} script={script} />

        <View className="flex-row gap-3">
          <Stat label="Mastered" value={`${stats.mastered}/${KANA_COUNT}`} />
          <Stat
            label="Accuracy"
            value={
              stats.accuracy === null
                ? "–"
                : `${Math.round(stats.accuracy * 100)}%`
            }
          />
          <Stat
            label="Average"
            value={
              stats.averageMs === null ? "–" : formatSeconds(stats.averageMs)
            }
          />
        </View>

        {/* The key to the colours below, in the order a character moves through them. */}
        <View className="flex-row flex-wrap gap-x-4 gap-y-2">
          {LEGEND.map((mastery) => (
            <View className="flex-row items-center gap-1.5" key={mastery}>
              <View
                className={`h-3.5 w-3.5 rounded ${MASTERY_STYLE[mastery].cell} ${
                  mastery === "new" ? "border border-line" : ""
                }`}
              />
              <Text className="text-caption text-ink-muted">
                {MASTERY_STYLE[mastery].label}
              </Text>
            </View>
          ))}
        </View>

        {stats.practised === 0 ? (
          <View
            className="items-center gap-3 rounded-card bg-surface px-5 py-6"
            style={{ borderCurve: "continuous" }}
          >
            <Text className="text-center text-body text-ink-muted">
              Nothing practised in {script} yet. Take a quiz from the chart and
              this fills in as you go.
            </Text>
            <Button
              onPress={() => router.back()}
              title="Go to the chart"
              variant="secondary"
            />
          </View>
        ) : revisit.length > 0 ? (
          <View
            className="gap-3 rounded-card bg-surface px-4 py-4"
            style={{ borderCurve: "continuous" }}
          >
            <View className="gap-1">
              <Text className="font-semibold text-heading text-ink">
                Worth another look
              </Text>
              <Text className="text-caption text-ink-muted">
                Practised, not mastered yet. The ones closest to clicking.
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {revisit.map(({ entry }) => (
                <View
                  className="min-w-12 items-center rounded-button bg-accent-tint px-3 py-2"
                  key={entry.hiragana}
                  style={{ borderCurve: "continuous" }}
                >
                  <Text className="text-ink" style={{ fontSize: 20 }}>
                    {glyphOf(entry, script)}
                  </Text>
                </View>
              ))}
            </View>
            <View className="flex-row gap-3">
              <Button
                className="flex-1"
                onPress={() =>
                  setQuiz({ deck: shuffleKana(revisit), mode: "easy" })
                }
                title="Easy"
              />
              <Button
                className="flex-1"
                onPress={() =>
                  setQuiz({ deck: shuffleKana(revisit), mode: "hard" })
                }
                title="Hard"
                variant="secondary"
              />
            </View>
          </View>
        ) : null}

        {KANA_SECTIONS.map((section) => (
          <View className="gap-2" key={section.id}>
            <Text className="font-semibold text-heading text-ink">
              {section.title}
            </Text>
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
        ))}
      </ScrollView>

      <KanaQuiz
        deck={quiz?.deck ?? null}
        mode={quiz?.mode ?? "easy"}
        onClose={() => setQuiz(null)}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="flex-1 gap-1 rounded-card bg-surface px-3 py-3"
      style={{ borderCurve: "continuous" }}
    >
      <Text className="text-caption text-ink-muted">{label}</Text>
      <Text className="font-semibold text-heading text-ink">{value}</Text>
    </View>
  );
}
