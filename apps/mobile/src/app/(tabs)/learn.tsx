import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Button } from "@/components/button";
import { Card, CardCaption, CardTitle } from "@/components/card";
import { ScreenHeader } from "@/components/screen-header";
import { TAB_BAR_CLEARANCE, useThemeColors } from "@/constants/theme";
import { ApiError, type CourseSummary, type DueCardsResponse } from "@/lib/api";
import { daysUntil } from "@/lib/checklist";
import { useIsOnline } from "@/lib/network";
import { usePurchases } from "@/lib/purchases";
import {
  coursesQuery,
  dueQuery,
  queryKeys,
  useInvalidateOnFocus,
} from "@/lib/queries";

/** "tomorrow" / "in 6 days" — the tail of "back …". */
function formatReturn(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export default function LearnScreen() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const { hasPremium } = usePurchases();
  const online = useIsOnline();

  // Derived in the provider so no screen can disagree with another about the same account.
  const premium = hasPremium;

  const {
    data: courses = null,
    isError: failed,
    isPending,
    fetchStatus,
  } = useQuery(coursesQuery());

  /** Offline on a device that has never loaded the deck list. The spinner would never end. */
  const waitingOffline = isPending && fetchStatus === "paused";

  /*
   * A failure only gets to say so while there IS a connection. Offline, the banner has
   * already explained it, and "Try again" is a button that cannot work — the request would
   * pause, the spinner would spin, and nothing would change.
   */
  const showFailure = failed && online;

  const unlocked =
    courses?.filter((course) => !course.isPremium || premium) ?? [];
  const locked = premium
    ? []
    : (courses?.filter((course) => course.isPremium) ?? []);

  /*
   * The session summary carries the due count, the deck progress and the daily allowance —
   * none of which the course list knows about, so it is one request per unlocked deck.
   *
   * Silent: a deck that fails here costs its progress line, not the screen, and the
   * profile tab reads the very same cache entries.
   */
  const sessionQueries = useQueries({
    queries: unlocked.map((course) => ({
      ...dueQuery(course.id),
      meta: { silent: true },
    })),
  });

  // Zipped by index — useQueries answers in the order it was asked. Keeping the whole
  // result, not just the data, is what lets a deck say it failed instead of quietly
  // rendering as "All caught up".
  const sessionByCourse = new Map(
    unlocked.map((course, index) => [course.id, sessionQueries[index]]),
  );

  // Finishing a session changes the streak and the due count. Without this the way back
  // leaves a stale "Review 12 cards" button behind.
  useInvalidateOnFocus([queryKeys.me, queryKeys.courses, ["due"]]);

  function retry() {
    for (const queryKey of [queryKeys.me, queryKeys.courses, ["due"]]) {
      queryClient.invalidateQueries({ queryKey });
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE, gap: 16 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <ScreenHeader
        subtitle="A few minutes a day beats an hour once a week"
        title="Learn"
      />

      <View className="gap-4 px-4">
        {/*
          Kana sits above the decks and outside all of this: it is a chart, not a course, so
          it has no due count, no progress line and nothing to load. It stays reachable when
          the deck list is still loading or failed outright, because it is the one thing here
          that works with no server at all.
        */}
        <Card onPress={() => router.push("/kana")}>
          <View className="flex-row items-center gap-3">
            <View className="rounded-button bg-primary-tint px-3 py-2">
              <Text className="text-heading text-primary">あ</Text>
            </View>
            <View className="flex-1 gap-1">
              <CardTitle>Kana chart</CardTitle>
              <CardCaption>
                Hiragana and katakana, tap any character to hear it.
              </CardCaption>
            </View>
            <Image
              source="sf:chevron.right"
              style={{ width: 12, height: 12 }}
              tintColor={colors.inkSubtle}
            />
          </View>
        </Card>

        {isPending && !failed && !waitingOffline ? (
          <ActivityIndicator className="py-8" />
        ) : null}

        {waitingOffline ? (
          <Card tone="sunken">
            <Text className="text-body text-ink">
              Your decks aren&apos;t saved on this device yet.
            </Text>
            <CardCaption>
              Open the app once with a connection and they will be here offline.
            </CardCaption>
          </Card>
        ) : null}

        {showFailure ? (
          <Card tone="sunken">
            <Text className="text-body text-ink">
              Couldn&apos;t reach the server.
            </Text>
            <View className="pt-3">
              <Button onPress={retry} title="Try again" variant="secondary" />
            </View>
          </Card>
        ) : null}

        {unlocked.map((course) => {
          const result = sessionByCourse.get(course.id);
          /*
           * A 402 here is NOT a failure to reach the server — it is the server saying this
           * deck is not unlocked for this account yet. It happens in the window between
           * paying (RevenueCat says premium instantly, so the deck moves out of `locked`)
           * and the webhook reaching our database. "Try again" is the wrong offer: retrying
           * cannot help, and the retry flickered the card through "All caught up" on the way.
           */
          const activating =
            result?.error instanceof ApiError && result.error.requiresPremium;

          // Read as separate statements: chaining these inline narrows the query result
          // union down to `never` on the second access.
          const isPending = result?.isPending === true;
          const isFetching = result?.isFetching === true;
          const isError = result?.isError === true;

          return (
            <ActiveCourseCard
              activating={activating}
              course={course}
              failed={isError && !activating && online}
              key={course.id}
              // Never claim "All caught up" off a request that has not answered yet.
              loading={isPending || isFetching}
              onRetry={() => result?.refetch()}
              session={result?.data ?? null}
            />
          );
        })}

        {locked.length ? (
          <Text className="px-1 pt-2 font-semibold text-caption text-ink-subtle">
            PREMIUM
          </Text>
        ) : null}

        {/*
          Locked decks stay visible and dimmed. Seeing what exists is what makes the paywall
          read as an unlock rather than a wall.
        */}
        {locked.map((course) => (
          <Card
            className="opacity-65"
            key={course.id}
            onPress={() => router.push("/paywall")}
            tone="sunken"
          >
            <View className="flex-row items-start gap-3">
              <Image
                source="sf:lock.fill"
                style={{ width: 20, height: 20, marginTop: 2 }}
                tintColor={colors.inkSubtle}
              />
              <View className="flex-1 gap-1">
                <CardTitle>{course.title}</CardTitle>
                {course.description ? (
                  <CardCaption>{course.description}</CardCaption>
                ) : null}
              </View>
              <View className="rounded-pill bg-accent-tint px-2 py-0.5">
                <Text className="font-semibold text-accent text-caption">
                  Premium
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

function ActiveCourseCard({
  course,
  session,
  failed,
  activating,
  loading,
  onRetry,
}: {
  course: CourseSummary;
  session: DueCardsResponse | null;
  /** This deck's session request failed. Without it the card claims "All caught up". */
  failed: boolean;
  /**
   * The server returned 402: paid for, but our database has not been told yet. Distinct
   * from `failed`, because retrying is not the answer — waiting is.
   */
  activating: boolean;
  /**
   * The request has not answered yet. Without this, a card with no data falls through every
   * branch below and lands on "All caught up" — so tapping "Try again" flashed a deck as
   * finished mid-refetch, then back to failed.
   */
  loading: boolean;
  onRetry: () => void;
}) {
  const dueCount = session?.cards.length ?? 0;
  const reviewed = session?.reviewedCardCount ?? 0;
  const total = session?.totalCardCount ?? course.cardCount;
  const percent = total === 0 ? 0 : Math.round((reviewed / total) * 100);
  const limitReached = session?.reviewsRemainingToday === 0;
  // "All caught up" reads as "this deck is over" without it. Spaced repetition is the whole
  // product, so the day the cards return is information, not a detail.
  const returnsIn = daysUntil(session?.nextDueDate ?? null);
  // Nothing to do today, but the deck is nowhere near finished — today's intake of new
  // cards is simply spent. Saying "All caught up" here would be a plain lie.
  const pacedOut =
    dueCount === 0 &&
    !limitReached &&
    (session?.unseenCardCount ?? 0) > 0 &&
    session?.newCardsRemainingToday === 0;

  // "All caught up", "hit the daily cap" and "this request failed" all arrive as zero cards.
  // Telling them apart is the difference between reassurance, a reason to consider premium,
  // and a deck that looks finished when it never loaded at all.
  const buttonTitle = failed
    ? "Try again"
    : activating
      ? "Unlocking…"
      : loading && !session
        ? "Loading…"
        : dueCount > 0
          ? `Review ${dueCount} card${dueCount === 1 ? "" : "s"}`
          : limitReached
            ? "Today's reviews are done"
            : pacedOut
              ? "Today's new cards are done"
              : "All caught up";

  return (
    <Card>
      <View className="gap-3">
        <View className="flex-row items-start gap-2">
          <View className="flex-1 gap-1">
            <CardTitle>{course.title}</CardTitle>
            {course.description ? (
              <CardCaption>{course.description}</CardCaption>
            ) : null}
          </View>
          <View className="rounded-pill bg-primary-tint px-2 py-0.5">
            <Text className="font-semibold text-caption text-primary">
              ACTIVE
            </Text>
          </View>
        </View>

        <View className="h-1.5 overflow-hidden rounded-pill bg-surface-sunken">
          <View
            className="h-full rounded-pill bg-primary"
            style={{ width: `${percent}%` }}
          />
        </View>

        <Text
          className="text-caption text-ink-muted"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {failed
            ? "Couldn't load this deck."
            : pacedOut
              ? `${reviewed} of ${total} cards · ${session?.unseenCardCount} still to learn`
              : dueCount === 0 && !limitReached && returnsIn !== null
                ? `${reviewed} of ${total} cards · back ${formatReturn(returnsIn)}`
                : `${reviewed} of ${total} cards · ${dueCount} due today`}
        </Text>

        {/*
          "Unlocking…" and "Loading…" are both dead buttons on purpose: there is nothing to
          open and nothing retrying would fix. Only `failed` offers an action.
        */}
        <Button
          disabled={activating || loading || (!failed && dueCount === 0)}
          onPress={() =>
            failed ? onRetry() : router.push(`/review/${course.id}`)
          }
          title={buttonTitle}
          variant="primary"
        />
      </View>
    </Card>
  );
}
