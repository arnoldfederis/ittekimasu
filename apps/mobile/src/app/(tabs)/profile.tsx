import { useQueries, useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Button } from "@/components/button";
import { Card, CardCaption, CardTitle } from "@/components/card";
import { ListRow } from "@/components/list-row";
import { ScreenHeader } from "@/components/screen-header";
import { StudyGrid, StudyGridLegend } from "@/components/study-grid";
import { TAB_BAR_CLEARANCE } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { useChecklist } from "@/lib/checklist";
import { useIsOnline } from "@/lib/network";
import { formatReminderHour, useNotifications } from "@/lib/notifications";
import { usePurchases } from "@/lib/purchases";
import {
  coursesQuery,
  dueQuery,
  meQuery,
  queryKeys,
  studyDaysQuery,
  useInvalidateOnFocus,
} from "@/lib/queries";

export default function ProfileScreen() {
  const { user } = useAuth();
  const { checklist } = useChecklist();
  const { entitlement, hasPremium, refresh } = usePurchases();
  const { reminderHour } = useNotifications();
  const online = useIsOnline();
  // No template adopted means nothing to recalculate against.
  const hasChecklist = Boolean(checklist?.templateId);

  // Same keys the learn tab uses, so switching tabs renders from cache instead of
  // re-fetching the identical three responses.
  const { data: me = null } = useQuery(meQuery());
  const { data: courses } = useQuery(coursesQuery());
  const { data: studyDays = [] } = useQuery(studyDaysQuery());

  const streak = me?.currentStreakDays ?? 0;
  const longest = me?.longestStreakDays ?? 0;

  // "Cards learned" spans decks, and only the due endpoint knows how many of each the user
  // has actually seen. One request per unlocked deck is fine at two or three decks.
  const sessionQueries = useQueries({
    queries: (courses ?? [])
      // hasPremium, not the SDK flag: a deck unlocked by the webhook was being left out of
      // the count entirely, so N4, N3 and Ward Office never showed up in "Cards learned".
      .filter((course) => !course.isPremium || hasPremium)
      .map((course) => ({ ...dueQuery(course.id), meta: { silent: true } })),
  });

  const cardsLearned = sessionQueries.some((result) => result.data)
    ? sessionQueries.reduce(
        (total, result) => total + (result.data?.reviewedCardCount ?? 0),
        0,
      )
    : null;

  useInvalidateOnFocus([
    queryKeys.me,
    queryKeys.courses,
    queryKeys.studyDays,
    ["due"],
  ]);

  // RevenueCat's own state, not a query — the SDK owns it.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // One derivation, in the provider. Two screens computing this separately is what let the
  // profile and the learn tab disagree about the same account.
  const premium = hasPremium;

  const checklistPercent =
    checklist && checklist.totalCount > 0
      ? Math.round((checklist.completedCount / checklist.totalCount) * 100)
      : 0;

  const initial = (user?.displayName ?? user?.email ?? "?")
    .charAt(0)
    .toUpperCase();

  const providerLabel = user?.providerData?.[0]?.providerId?.includes("apple")
    ? "Signed in with Apple"
    : "Signed in with Google";

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE, gap: 16 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <ScreenHeader title="Profile" />

      <View className="gap-4 px-4">
        <Card>
          <View className="flex-row items-center gap-4">
            <View className="h-14 w-14 items-center justify-center rounded-pill bg-primary-tint">
              <Text className="font-semibold text-heading text-primary">
                {initial}
              </Text>
            </View>
            <View className="flex-1 gap-1">
              <CardTitle>{user?.displayName ?? "Signed in"}</CardTitle>
              <CardCaption>{providerLabel}</CardCaption>
            </View>
          </View>
        </Card>

        {/*
          The habit, at the top, where the streak number used to sit in a row of three tiles.
          The grid says what the number cannot — the good fortnight, the week off — and the
          number still leads in the caption, because a grid takes a moment to read.
        */}
        <Card>
          <View className="gap-3">
            <View className="gap-1">
              <CardTitle>
                {streak === 0
                  ? "No streak yet"
                  : `${streak} day${streak === 1 ? "" : "s"} in a row`}
              </CardTitle>
              <CardCaption>
                {streak === 0
                  ? "Review a few cards to start one."
                  : `Longest run so far: ${longest} day${longest === 1 ? "" : "s"}.`}
              </CardCaption>
            </View>

            <ScrollView
              horizontal
              // Twenty weeks fits most phones, but not the smallest ones — scrolling beats
              // squares too small to read.
              showsHorizontalScrollIndicator={false}
            >
              <StudyGrid days={studyDays} />
            </ScrollView>

            <StudyGridLegend />
          </View>
        </Card>

        {premium ? (
          <Card tone="accent">
            <View className="gap-1">
              <CardTitle>Ittekimasu Pro</CardTitle>
              <CardCaption>
                {entitlement?.expiresAt
                  ? `Renews ${formatDate(entitlement.expiresAt)}`
                  : "Active"}
              </CardCaption>
            </View>
          </Card>
        ) : (
          <Card>
            <View className="gap-3">
              <View className="gap-1">
                <CardTitle>Free plan</CardTitle>
                {/*
                  The kana chart is no longer named as a deck here: it is unmetered, so
                  listing it beside a daily card limit implies it spends one.
                */}
                <CardCaption>
                  {entitlement?.dailyReviewLimit ?? 20} cards a day · JLPT N5 ·
                  Kana chart free
                </CardCaption>
              </View>
              <Button
                onPress={() => router.push("/paywall")}
                title="Upgrade"
                variant="primary"
              />
            </View>
          </Card>
        )}

        <View className="flex-row gap-3">
          {/* The one tile that leads somewhere: the number is a door, not a fact. */}
          <StatTile
            label="Cards learned"
            onPress={() => router.push("/cards")}
            value={cardsLearned === null ? "—" : String(cardsLearned)}
          />
          <StatTile label="Checklist" value={`${checklistPercent}%`} />
        </View>

        <View className="overflow-hidden rounded-card bg-surface">
          <Text className="px-4 pt-4 pb-1 font-semibold text-caption text-ink-subtle">
            ACCOUNT
          </Text>
          <ListRow
            icon="doc.text"
            title="Visa type"
            value={checklist?.visaType ?? "Not set"}
          />
          {/*
            Both of these screens exist only to write to the server, so offline they are a
            dead end. Closing the door here beats opening a page whose every control is
            greyed out.

            Move date also needs a template: the screen rebuilds the checklist FROM one, so
            with no visa route adopted its only button can never be pressed.
          */}
          <ListRow
            disabled={!online || !hasChecklist}
            icon="calendar"
            onPress={() => router.push("/move-date")}
            showChevron
            subtitle={
              hasChecklist
                ? online
                  ? undefined
                  : "Needs a connection"
                : "Build a checklist first"
            }
            title="Move date"
            value={
              checklist?.targetMoveDate
                ? formatDate(checklist.targetMoveDate)
                : "Not set"
            }
          />
          <ListRow
            disabled={!online}
            icon="bell"
            onPress={() => router.push("/reminder-time")}
            showChevron
            subtitle={online ? undefined : "Needs a connection"}
            title="Reminder time"
            value={formatReminderHour(reminderHour)}
          />
          <ListRow
            icon="gearshape"
            onPress={() => router.push("/settings")}
            showChevron
            title="Account settings"
          />
        </View>
      </View>
    </ScrollView>
  );
}

/** One number, one label. Pressable when there is somewhere to go. */
function StatTile({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const Container = onPress ? Pressable : View;
  return (
    <Container
      accessibilityRole={onPress ? "button" : undefined}
      className={`flex-1 items-center gap-1 rounded-card bg-surface px-2 py-4 ${onPress ? "active:bg-surface-sunken" : ""}`}
      onPress={onPress}
    >
      <Text
        className="font-semibold text-ink text-title"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
      <Text className="text-center text-caption text-ink-muted">{label}</Text>
    </Container>
  );
}

/** "15 Oct 2026" — an ISO date or instant, whichever the API sent. */
function formatDate(iso: string): string {
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
