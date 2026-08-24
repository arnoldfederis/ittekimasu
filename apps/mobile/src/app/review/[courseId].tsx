import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { Card, CardCaption } from "@/components/card";
import { useThemeColors } from "@/constants/theme";
import {
  ApiError,
  api,
  type CardDue,
  type DueCardsResponse,
  type ReviewRating,
} from "@/lib/api";
import { toast } from "@/lib/toast";

/**
 * The four ratings, in the order the buttons appear.
 *
 * "Again" is deliberately NOT red. It is a neutral scheduling signal — the learner asked to
 * see the card sooner, not failed a test — and the palette has no red for exactly this
 * reason. Amber, green and teal carry the other three.
 */
const RATINGS: {
  rating: ReviewRating;
  label: string;
  border: string;
  text: string;
}[] = [
  {
    rating: "AGAIN",
    label: "Again",
    border: "border-line",
    text: "text-ink-muted",
  },
  {
    rating: "HARD",
    label: "Hard",
    border: "border-accent",
    text: "text-accent",
  },
  {
    rating: "GOOD",
    label: "Good",
    border: "border-positive",
    text: "text-positive",
  },
  {
    rating: "EASY",
    label: "Easy",
    border: "border-primary",
    text: "text-primary",
  },
];

/** "1 day" / "6 days" — the interval preview under each rating. */
function formatInterval(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

export default function ReviewScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState<DueCardsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [streak, setStreak] = useState(0);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const next = await api.getDueCards(courseId);
      setSession(next);
      setStreak(next.studyStreakDays);
    } catch (error) {
      setFailed(true);
      toast.fromError(error, "Couldn't load your review session.");
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = session?.cards ?? [];
  const card: CardDue | undefined = cards[index];
  const finished = session !== null && index >= cards.length;

  const close = useCallback(() => router.back(), []);

  const rate = useCallback(
    async (rating: ReviewRating) => {
      if (!card || submitting) return;
      setSubmitting(true);

      try {
        const result = await api.submitReview(card.id, rating);
        setStreak(result.studyStreakDays);
        setReviewed((count) => count + 1);
        setRevealed(false);
        setIndex((current) => current + 1);
      } catch (error) {
        if (error instanceof ApiError && error.requiresPremium) {
          // Step 6 opens the paywall here. Ending the session is the honest fallback —
          // leaving the card on screen would invite a tap that can only fail again.
          toast.info("That's today's reviews", error.message);
          setIndex(cards.length);
          return;
        }
        toast.fromError(error, "Couldn't save that answer.");
      } finally {
        setSubmitting(false);
      }
    },
    [card, cards.length, submitting],
  );

  const header = (
    <View className="flex-row items-center justify-between px-4 pb-2">
      <Pressable
        accessibilityLabel="Close review"
        accessibilityRole="button"
        className="h-10 w-10 items-center justify-center rounded-pill active:bg-surface-sunken"
        onPress={close}
      >
        <Image
          source="sf:xmark"
          style={{ width: 18, height: 18 }}
          tintColor={colors.inkMuted}
        />
      </Pressable>

      <View className="flex-row items-center gap-1.5">
        <Image
          source="sf:flame.fill"
          style={{ width: 18, height: 18 }}
          tintColor={colors.accent}
        />
        <Text
          className="font-semibold text-callout text-ink"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {streak}
        </Text>
      </View>
    </View>
  );

  if (session === null || failed) {
    return (
      <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top + 8 }}>
        {header}
        {failed ? (
          <View className="gap-3 px-4 pt-8">
            <Card tone="sunken">
              <Text className="text-body text-ink">
                Couldn&apos;t reach the server.
              </Text>
              <View className="pt-3">
                <Button onPress={load} title="Try again" variant="secondary" />
              </View>
            </Card>
          </View>
        ) : (
          <ActivityIndicator className="py-12" />
        )}
      </View>
    );
  }

  if (finished) {
    return (
      <SessionComplete
        courseTitle={session.courseTitle}
        header={header}
        insetTop={insets.top + 8}
        limitReached={session.reviewsRemainingToday === 0}
        onClose={close}
        reviewed={reviewed}
        streak={streak}
        wasEmpty={cards.length === 0}
      />
    );
  }

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top + 8 }}>
      {header}

      <SegmentedProgress current={index} total={cards.length} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
      >
        <Pressable
          accessibilityHint={revealed ? undefined : "Shows the answer"}
          accessibilityRole="button"
          className="mx-4 items-center gap-5 rounded-card bg-surface px-5 py-10"
          disabled={revealed}
          onPress={() => setRevealed(true)}
          style={{ borderCurve: "continuous" }}
        >
          {card?.seen === false ? (
            <View className="rounded-pill bg-primary-tint px-2 py-0.5">
              <Text className="font-semibold text-caption text-primary">
                NEW
              </Text>
            </View>
          ) : null}

          <Text className="text-center font-semibold text-display text-ink">
            {card?.frontText}
          </Text>

          {revealed ? (
            <Animated.View
              className="w-full items-center gap-5"
              entering={FadeIn.duration(160)}
            >
              <View className="h-px w-16 bg-line" />
              <Text className="text-center text-heading text-ink">
                {card?.backText}
              </Text>
            </Animated.View>
          ) : (
            <CardCaption>Tap to reveal</CardCaption>
          )}
        </Pressable>
      </ScrollView>

      <View
        className="gap-3 px-4 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        {revealed ? (
          <Animated.View
            className="flex-row gap-2"
            entering={FadeIn.duration(160)}
          >
            {RATINGS.map(({ rating, label, border, text }) => (
              <RatingButton
                border={border}
                disabled={submitting}
                interval={
                  card?.intervals[
                    rating.toLowerCase() as Lowercase<ReviewRating>
                  ]
                }
                key={rating}
                label={label}
                onPress={() => rate(rating)}
                text={text}
              />
            ))}
          </Animated.View>
        ) : (
          // Reserves the row's height so revealing the answer doesn't shift the card upward.
          <View className="h-16" />
        )}

        <Text className="text-center text-caption text-ink-subtle">
          Card {Math.min(index + 1, cards.length)} of {cards.length} ·{" "}
          {session.courseTitle}
        </Text>
      </View>
    </View>
  );
}

/** One segment per card, filled as the session moves through them. */
function SegmentedProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const segments = useMemo(
    () => Array.from({ length: total }, (_, i) => i),
    [total],
  );

  return (
    <View className="flex-row gap-1 px-4 pb-2">
      {segments.map((segment) => (
        <View
          className={`h-1 flex-1 rounded-pill ${
            segment < current ? "bg-primary" : "bg-surface-sunken"
          }`}
          key={segment}
        />
      ))}
    </View>
  );
}

/**
 * Two lines: the rating, and what it schedules. Showing the interval on every button rather
 * than only the highlighted one is the touch equivalent of the same idea — there is no hover
 * state to reveal it, and seeing all four is what makes honest self-rating feel safe.
 */
function RatingButton({
  label,
  interval,
  border,
  text,
  disabled,
  onPress,
}: {
  label: string;
  interval: number | undefined;
  border: string;
  text: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={
        interval === undefined
          ? label
          : `${label}, next review in ${formatInterval(interval)}`
      }
      accessibilityRole="button"
      className={`h-16 flex-1 items-center justify-center gap-0.5 rounded-button border bg-surface ${border} ${
        disabled ? "opacity-50" : "active:bg-surface-sunken"
      }`}
      disabled={disabled}
      onPress={onPress}
      style={{ borderCurve: "continuous" }}
    >
      <Text className={`font-semibold text-callout ${text}`}>{label}</Text>
      {interval === undefined ? null : (
        <Text className="text-caption text-ink-subtle">
          {formatInterval(interval)}
        </Text>
      )}
    </Pressable>
  );
}

function SessionComplete({
  header,
  insetTop,
  courseTitle,
  reviewed,
  streak,
  wasEmpty,
  limitReached,
  onClose,
}: {
  header: React.ReactNode;
  insetTop: number;
  courseTitle: string;
  reviewed: number;
  streak: number;
  wasEmpty: boolean;
  limitReached: boolean;
  onClose: () => void;
}) {
  const colors = useThemeColors();

  // Three different endings, and they are not interchangeable: nothing due is a win, the
  // daily cap is an upsell, and a finished session is a celebration.
  const title = wasEmpty
    ? limitReached
      ? "That's today's reviews"
      : "Nothing due right now"
    : "Session complete";

  const body = wasEmpty
    ? limitReached
      ? "You've used today's free reviews. They reset tomorrow."
      : `Every ${courseTitle} card is scheduled ahead. Come back when the next batch is due.`
    : `${reviewed} ${reviewed === 1 ? "card" : "cards"} reviewed. Every one of them is scheduled to come back at the right moment.`;

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insetTop }}>
      {header}

      <View className="flex-1 justify-center gap-6 px-4">
        <View className="items-center gap-4">
          <Image
            source="sf:flame.fill"
            style={{ width: 56, height: 56 }}
            tintColor={colors.accent}
          />
          <Text className="text-center font-semibold text-ink text-title">
            {title}
          </Text>
          <Text className="text-center text-body text-ink-muted">{body}</Text>
        </View>

        <Card tone="accent">
          <View className="flex-row items-center justify-between">
            <Text className="text-body text-ink">Day streak</Text>
            <Text
              className="font-semibold text-heading text-ink"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {streak}
            </Text>
          </View>
        </Card>

        <Button onPress={onClose} title="Done" variant="primary" />
      </View>
    </View>
  );
}
