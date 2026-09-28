import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Line, Rect } from "react-native-svg";
import { Button } from "@/components/button";
import { Confetti } from "@/components/confetti";
import { glyphOf } from "@/constants/kana";
import { useThemeColors } from "@/constants/theme";
import type { BackupStatus } from "@/lib/kana-progress";
import {
  formatDuration,
  formatSeconds,
  type QuizAnswer,
  type QuizSummary,
  summariseQuiz,
} from "@/lib/kana-quiz";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** How long the score takes to fill in, and how long it waits before starting. */
const SCORE_DURATION_MS = 900;
const SCORE_DELAY_MS = 150;

/**
 * The end of a kana quiz: the score, how fast it went, and every character with its answer.
 *
 * Green for right and AMBER for not yet — never red, the same rule as the review screen's
 * "Again" and every validation message in the app. A learner drilling kana gets most of them
 * wrong at first; a results screen that looked like a marked exam paper would make the second
 * session less likely than the first.
 *
 * It ARRIVES rather than appearing: the ring fills and the score counts up while the rest
 * slides in beneath it, one section after another, and a perfect score gets confetti. The
 * finish of a quiz is the one moment worth marking. All of it respects Reduce Motion — with
 * it on, the screen is simply there, complete, with no confetti at all.
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
  const reduced = useReducedMotion();
  const perfect = summary.total > 0 && summary.correct === summary.total;

  /** Each section slides in after the one above it; long answer lists stop staggering at 10. */
  const enter = (step: number) =>
    reduced ? undefined : FadeInDown.delay(250 + step * 90).duration(380);

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
        <ScoreDonut
          correct={summary.correct}
          reduced={reduced}
          total={summary.total}
        />

        <Animated.View entering={enter(0)}>
          <Headline summary={summary} />
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <View className="flex-row gap-3">
            <Stat label="Total time" value={formatDuration(summary.totalMs)} />
            <Stat
              label="Average per kana"
              value={formatSeconds(summary.averageMs)}
            />
          </View>
        </Animated.View>

        <Animated.View entering={enter(2)}>
          <SpeedChart answers={answers} averageMs={summary.averageMs} />
        </Animated.View>

        <View className="gap-2">
          <Animated.View entering={enter(3)}>
            <Text className="font-semibold text-heading text-ink">Answers</Text>
          </Animated.View>
          {answers.map((answer, index) => (
            <Animated.View
              entering={enter(4 + Math.min(index, 10))}
              // The order they were asked in, which is also a stable identity here: a deck
              // never asks the same card twice.
              key={`${index}-${answer.card.script}-${answer.card.entry.hiragana}`}
            >
              <AnswerRow answer={answer} />
            </Animated.View>
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

      {/* Over everything, touch-transparent. Not rendered at all with Reduce Motion on. */}
      {perfect && !reduced ? <Confetti /> : null}
    </View>
  );
}

/**
 * One line that reads the score back in words, always encouraging. Never "you failed" or a
 * count of misses: the misses are listed below, where they are useful rather than a verdict.
 */
function Headline({ summary }: { summary: QuizSummary }) {
  const ratio = summary.total ? summary.correct / summary.total : 0;
  const [title, detail] =
    ratio === 1
      ? ["Perfect score!", "Every single one, right."]
      : ratio >= 0.8
        ? ["Great run", "You knew almost all of them."]
        : ratio >= 0.5
          ? ["Good progress", "More than half of them already stick."]
          : [
              "Every answer counts",
              "The ones you missed will come easier next time.",
            ];

  return (
    <View className="items-center gap-1">
      <Text className="font-semibold text-ink" style={{ fontSize: 24 }}>
        {title}
      </Text>
      <Text className="text-center text-body text-ink-muted">{detail}</Text>
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

/**
 * The score ring: fills from twelve o'clock while the number in the middle counts up to
 * match, so the two finish on the same frame.
 */
function ScoreDonut({
  correct,
  total,
  reduced,
}: {
  correct: number;
  total: number;
  reduced: boolean;
}) {
  const colors = useThemeColors();
  const size = 168;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total ? correct / total : 0;

  // The ring: a dash the full length of the circle, offset back until only `ratio` shows.
  const fill = useSharedValue(reduced ? ratio : 0);
  useEffect(() => {
    fill.value = reduced
      ? ratio
      : withDelay(
          SCORE_DELAY_MS,
          withTiming(ratio, {
            duration: SCORE_DURATION_MS,
            easing: Easing.out(Easing.cubic),
          }),
        );
  }, [fill, ratio, reduced]);
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - fill.value),
  }));

  // The number, on the same curve and clock as the ring.
  const [shown, setShown] = useState(reduced ? correct : 0);
  useEffect(() => {
    if (reduced || correct === 0) {
      setShown(correct);
      return;
    }
    const start = Date.now() + SCORE_DELAY_MS;
    let frame = 0;
    const tick = () => {
      const t = Math.min(
        Math.max((Date.now() - start) / SCORE_DURATION_MS, 0),
        1,
      );
      setShown(Math.round((1 - (1 - t) ** 3) * correct));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [correct, reduced]);

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
          {/*
            Not rendered at all for a zero score: a round line cap draws its half-disc even
            when none of the dash is visible, which would leave a green dot on 0/10.
          */}
          {ratio > 0 ? (
            <AnimatedCircle
              animatedProps={ringProps}
              cx={size / 2}
              cy={size / 2}
              fill="none"
              r={radius}
              stroke={colors.positive}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeLinecap="round"
              strokeWidth={stroke}
              // Starts at twelve o'clock, the way a score dial reads.
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ) : null}
        </Svg>
        <View className="absolute inset-0 items-center justify-center">
          <Text className="font-semibold text-ink" style={{ fontSize: 40 }}>
            {shown}/{total}
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
