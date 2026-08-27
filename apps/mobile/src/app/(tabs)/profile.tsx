import { useQueries, useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import { Button } from "@/components/button";
import { Card, CardCaption, CardTitle } from "@/components/card";
import { ListRow } from "@/components/list-row";
import { ScreenHeader } from "@/components/screen-header";
import { TAB_BAR_CLEARANCE } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { useChecklist } from "@/lib/checklist";
import { formatReminderHour, useNotifications } from "@/lib/notifications";
import { usePurchases } from "@/lib/purchases";
import {
  coursesQuery,
  dueQuery,
  meQuery,
  queryKeys,
  useInvalidateOnFocus,
} from "@/lib/queries";

export default function ProfileScreen() {
  const { user } = useAuth();
  const { checklist } = useChecklist();
  const { entitlement, isPremium, refresh } = usePurchases();
  const { reminderHour } = useNotifications();

  // Same keys the learn tab uses, so switching tabs renders from cache instead of
  // re-fetching the identical three responses.
  const { data: me = null } = useQuery(meQuery());
  const { data: courses } = useQuery(coursesQuery());

  // "Cards learned" spans decks, and only the due endpoint knows how many of each the user
  // has actually seen. One request per unlocked deck is fine at two or three decks.
  const sessionQueries = useQueries({
    queries: (courses ?? [])
      .filter((course) => !course.isPremium || isPremium)
      .map((course) => ({ ...dueQuery(course.id), meta: { silent: true } })),
  });

  const cardsLearned = sessionQueries.some((result) => result.data)
    ? sessionQueries.reduce(
        (total, result) => total + (result.data?.reviewedCardCount ?? 0),
        0,
      )
    : null;

  useInvalidateOnFocus([queryKeys.me, queryKeys.courses, ["due"]]);

  // RevenueCat's own state, not a query — the SDK owns it.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // The server is the source of truth for the plan; the SDK flag only covers the seconds
  // between paying and the webhook landing.
  const premium = entitlement?.premium || isPremium;

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
                <CardCaption>
                  {entitlement?.dailyReviewLimit ?? 20} cards a day · N5 only
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
          <StatTile
            label="Day streak"
            value={me === null ? "—" : String(me.currentStreakDays)}
          />
          <StatTile
            label="Cards learned"
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
          <ListRow
            icon="calendar"
            onPress={() => router.push("/move-date")}
            showChevron
            title="Move date"
            value={
              checklist?.targetMoveDate
                ? formatDate(checklist.targetMoveDate)
                : "Not set"
            }
          />
          <ListRow
            icon="bell"
            onPress={() => router.push("/reminder-time")}
            showChevron
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

/** One number, one label. Three across the row. */
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center gap-1 rounded-card bg-surface px-2 py-4">
      <Text
        className="font-semibold text-ink text-title"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
      <Text className="text-center text-caption text-ink-muted">{label}</Text>
    </View>
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
