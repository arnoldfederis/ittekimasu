import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Button } from "@/components/button";
import { Card, CardCaption, CardTitle } from "@/components/card";
import { ListRow } from "@/components/list-row";
import { ScreenHeader } from "@/components/screen-header";
import { api, type UserResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useChecklist } from "@/lib/checklist";
import { usePurchases } from "@/lib/purchases";
import { toast } from "@/lib/toast";

export default function ProfileScreen() {
  const { user } = useAuth();
  const { checklist } = useChecklist();
  const { entitlement, isPremium, refresh } = usePurchases();
  const [me, setMe] = useState<UserResponse | null>(null);
  const [cardsLearned, setCardsLearned] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [profile, courses] = await Promise.all([
        api.getMe(),
        api.getCourses(),
      ]);
      setMe(profile);

      // "Cards learned" spans decks, and only the due endpoint knows how many of each the
      // user has actually seen. One call per unlocked deck is fine at two or three decks.
      const sessions = await Promise.all(
        courses
          .filter((course) => !course.isPremium || isPremium)
          .map((course) => api.getDueCards(course.id).catch(() => null)),
      );
      setCardsLearned(
        sessions.reduce(
          (total, session) => total + (session?.reviewedCardCount ?? 0),
          0,
        ),
      );
    } catch (error) {
      toast.fromError(error, "Couldn't load your profile.");
    }
  }, [isPremium]);

  useFocusEffect(
    useCallback(() => {
      load();
      refresh();
    }, [load, refresh]),
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
      contentContainerStyle={{ paddingBottom: 32, gap: 16 }}
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
            title="Move date"
            value={
              checklist?.targetMoveDate
                ? formatDate(checklist.targetMoveDate)
                : "Not set"
            }
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
