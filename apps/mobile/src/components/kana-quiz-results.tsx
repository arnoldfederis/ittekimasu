import { Image } from "expo-image";
import { ScrollView, Text, View } from "react-native";
import Svg, { Circle, Line, Rect } from "react-native-svg";
import { Button } from "@/components/button";
import { glyphOf } from "@/constants/kana";
import { useThemeColors } from "@/constants/theme";
import type { BackupStatus } from "@/lib/kana-progress";
import {
  formatDuration,
  formatSeconds,
  type QuizAnswer,
  summariseQuiz,
} from "@/lib/kana-quiz";

/**
 * The end of a kana quiz: the score, how fast it went, and every character with its answer.
 *
 * Green for right and AMBER for not yet — never red, the same rule as the review screen's
 * "Again" and every validation message in the app. A learner drilling kana gets most of them
 * wrong at first; a results screen that looked like a marked exam paper would make the second
 * session less likely than the first.
 */
export function KanaQuizResults({
  answers,
  status,
  onDone,
  bottomInset,
}: {
  answers: QuizAnswer[];
  status: BackupStatus;
  onDone: () => void;
  bottomInset: number;
}) {
  const summary = summariseQuiz(answers);

  return (
    <View className="flex-1">
      <ScrollView
        contentContainerStyle={{
          gap: 24,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ScoreDonut correct={summary.correct} total={summary.total} />

        <View className="flex-row gap-3">
          <Stat label="Total time" value={formatDuration(summary.totalMs)} />
          <Stat
            label="Average per kana"
            value={formatSeconds(summary.averageMs)}
          />
        </View>

        <SpeedChart answers={answers} averageMs={summary.averageMs} />

        <View className="gap-2">
          <Text className="font-semibold text-heading text-ink">Answers</Text>
          {answers.map((answer, index) => (
            <AnswerRow
              answer={answer}
              // The order they were asked in, which is also a stable identity here: a deck
              // never asks the same card twice.
              key={`${index}-${answer.card.script}-${answer.card.entry.hiragana}`}
            />
          ))}
        </View>
      </ScrollView>

      <View
        className="gap-3 border-line border-t bg-surface px-4 pt-3"
        style={{ paddingBottom: 16 + bottomInset }}
      >
        <Text className="text-center text-caption text-ink-subtle">
          {STATUS_COPY[status]}
        </Text>
        <Button onPress={onDone} title="Done" />
      </View>
    </View>
  );
}

/**
 * Says where the progress went, because "saved" means something different on each plan and
 * a Pro learner offline should not be told it is backed up when it is not.
 */
const STATUS_COPY: Record<BackupStatus, string> = {
  device: "Progress saved on this phone.",
  pending: "Saved on this phone. Backing up to your account…",
  waiting: "Saved on this phone. It backs up when you're online.",
  saved: "Saved, and backed up to your account.",
  failed: "Saved on this phone. The backup will try again next time.",
};

function ScoreDonut({ correct, total }: { correct: number; total: number }) {
  const colors = useThemeColors();
  const size = 168;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total ? correct / total : 0;

  return (
    <View
      accessibilityLabel={`${correct} of ${total} correct`}
      accessible
      className="items-center pt-2"
    >
      <View style={{ width: size, height: size }}>
        <Svg height={size} width={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            fill="none"
            r={radius}
            stroke={colors.accentTint}
            strokeWidth={stroke}
          />
          {ratio > 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              fill="none"
              r={radius}
              stroke={colors.positive}
              strokeDasharray={`${circumference * ratio} ${circumference}`}
              strokeLinecap="round"
              strokeWidth={stroke}
              // Starts at twelve o'clock, the way a score dial reads.
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ) : null}
        </Svg>
        <View className="absolute inset-0 items-center justify-center">
          <Text className="font-semibold text-ink" style={{ fontSize: 40 }}>
            {correct}/{total}
          </Text>
          <Text className="text-caption text-ink-muted">correct</Text>
        </View>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="flex-1 gap-1 rounded-card bg-surface px-4 py-3"
      style={{ borderCurve: "continuous" }}
    >
      <Text className="text-caption text-ink-muted">{label}</Text>
      <Text className="font-semibold text-heading text-ink">{value}</Text>
    </View>
  );
}

/**
 * One bar per question, in the order asked, with the average as a dashed line.
 *
 * Scrolls sideways rather than squeezing: a full-chart session is over two hundred questions,
 * and bars thinner than a hairline stop saying anything about any one of them.
 */
function SpeedChart({
  answers,
  averageMs,
}: {
  answers: QuizAnswer[];
  averageMs: number;
}) {
  const colors = useThemeColors();
  const height = 120;
  const barWidth = 10;
  const gap = 6;
  const width = Math.max(answers.length * (barWidth + gap) - gap, 1);
  const slowest = Math.max(...answers.map((answer) => answer.ms), 1);
  const barHeight = (ms: number) => Math.max((ms / slowest) * height, 2);
  const averageY = height - barHeight(averageMs);

  return (
    <View
      className="gap-2 rounded-card bg-surface px-4 py-4"
      style={{ borderCurve: "continuous" }}
    >
      <View className="flex-row items-baseline justify-between">
        <Text className="font-semibold text-heading text-ink">Speed</Text>
        <Text className="text-caption text-ink-muted">
          Average {formatSeconds(averageMs)} per question
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg height={height} width={width}>
          {answers.map((answer, index) => (
            <Rect
              fill={answer.correct ? colors.positive : colors.accent}
              height={barHeight(answer.ms)}
              // Index is the identity here: bar N is question N, and the list never reorders.
              key={index}
              rx={3}
              width={barWidth}
              x={index * (barWidth + gap)}
              y={height - barHeight(answer.ms)}
            />
          ))}
          <Line
            stroke={colors.inkSubtle}
            strokeDasharray="4 4"
            strokeWidth={1.5}
            x1={0}
            x2={width}
            y1={averageY}
            y2={averageY}
          />
        </Svg>
      </ScrollView>
    </View>
  );
}

function AnswerRow({ answer }: { answer: QuizAnswer }) {
  const colors = useThemeColors();
  const { entry, script } = answer.card;
  const tone = answer.correct ? colors.positive : colors.accent;
  const toneClass = answer.correct ? "text-positive" : "text-accent";

  return (
    <View
      accessibilityLabel={`${glyphOf(entry, script)}, ${entry.romaji}, ${
        answer.correct
          ? "correct"
          : `not yet, you answered ${answer.given || "nothing"}`
      }, ${formatSeconds(answer.ms)}`}
      accessible
      className="flex-row items-center gap-3 rounded-button bg-surface px-4 py-3"
      style={{ borderCurve: "continuous" }}
    >
      <Image
        source={
          answer.correct ? "sf:checkmark.circle.fill" : "sf:xmark.circle.fill"
        }
        style={{ width: 20, height: 20 }}
        tintColor={tone}
      />
      <Text className="text-ink" style={{ fontSize: 22 }}>
        {glyphOf(entry, script)}
      </Text>
      <Image
        source="sf:chevron.right"
        style={{ width: 10, height: 10 }}
        tintColor={tone}
      />
      <Text className={`font-semibold text-body ${toneClass}`}>
        {entry.romaji}
      </Text>
      {/* What they gave instead, so "not yet" teaches something rather than just scoring. */}
      {!answer.correct && answer.given ? (
        <Text className="text-caption text-ink-subtle" numberOfLines={1}>
          you: {answer.given}
        </Text>
      ) : null}
      <View className="flex-1" />
      <Text className="text-caption text-ink-muted">
        {formatSeconds(answer.ms)}
      </Text>
    </View>
  );
}
