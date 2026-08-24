import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Button } from "@/components/button";
import { Card, CardCaption, CardTitle } from "@/components/card";
import { ScreenHeader } from "@/components/screen-header";
import { useThemeColors } from "@/constants/theme";
import { api, type CourseSummary, type DueCardsResponse } from "@/lib/api";
import { toast } from "@/lib/toast";

type Streaks = { current: number; longest: number };

export default function LearnScreen() {
  const colors = useThemeColors();
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [session, setSession] = useState<DueCardsResponse | null>(null);
  const [streaks, setStreaks] = useState<Streaks>({ current: 0, longest: 0 });
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [me, list] = await Promise.all([api.getMe(), api.getCourses()]);
      setStreaks({
        current: me.currentStreakDays,
        longest: me.longestStreakDays,
      });
      setCourses(list);

      // The session summary carries the due count, the deck progress and the daily
      // allowance — none of which the course list knows about.
      const active = list.find((course) => !course.isPremium);
      setSession(active ? await api.getDueCards(active.id) : null);
    } catch (error) {
      setFailed(true);
      toast.fromError(error, "Couldn't load your courses.");
    }
  }, []);

  // Refetch on focus so finishing a session updates the streak and the due count on the way
  // back, rather than leaving a stale "Review 12 cards" button behind.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const free = courses?.filter((course) => !course.isPremium) ?? [];
  const locked = courses?.filter((course) => course.isPremium) ?? [];

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingBottom: 32, gap: 16 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <ScreenHeader
        subtitle="A few minutes a day beats an hour once a week"
        title="Learn"
      />

      <View className="gap-4 px-4">
        <Card tone="accent">
          <View className="flex-row items-center gap-4">
            <Image
              source="sf:flame.fill"
              style={{ width: 32, height: 32 }}
              tintColor={colors.accent}
            />
            <View className="flex-1 gap-1">
              <CardTitle>
                {streaks.current === 0
                  ? "No streak yet"
                  : `${streaks.current} day${streaks.current === 1 ? "" : "s"} in a row`}
              </CardTitle>
              <CardCaption>
                {streaks.current === 0
                  ? "Review a few cards today to start one."
                  : `Longest run so far: ${streaks.longest} day${streaks.longest === 1 ? "" : "s"}.`}
              </CardCaption>
            </View>
          </View>
        </Card>

        {courses === null && !failed ? (
          <ActivityIndicator className="py-8" />
        ) : null}

        {failed ? (
          <Card tone="sunken">
            <Text className="text-body text-ink">
              Couldn&apos;t reach the server.
            </Text>
            <View className="pt-3">
              <Button onPress={load} title="Try again" variant="secondary" />
            </View>
          </Card>
        ) : null}

        {free.map((course) => (
          <ActiveCourseCard
            course={course}
            key={course.id}
            session={session?.courseId === course.id ? session : null}
          />
        ))}

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
            onPress={() =>
              toast.info(
                "Premium deck",
                `${course.title} unlocks with premium, along with unlimited daily reviews.`,
              )
            }
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
}: {
  course: CourseSummary;
  session: DueCardsResponse | null;
}) {
  const dueCount = session?.cards.length ?? 0;
  const reviewed = session?.reviewedCardCount ?? 0;
  const total = session?.totalCardCount ?? course.cardCount;
  const percent = total === 0 ? 0 : Math.round((reviewed / total) * 100);
  const limitReached = session?.reviewsRemainingToday === 0;

  // "All caught up" and "hit the daily cap" both mean zero cards to review, and telling
  // them apart is the difference between reassurance and a reason to consider premium.
  const buttonTitle =
    dueCount > 0
      ? `Review ${dueCount} card${dueCount === 1 ? "" : "s"}`
      : limitReached
        ? "Today's reviews are done"
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
          {reviewed} of {total} cards · {dueCount} due today
        </Text>

        <Button
          disabled={dueCount === 0}
          onPress={() => router.push(`/review/${course.id}`)}
          title={buttonTitle}
          variant="primary"
        />
      </View>
    </Card>
  );
}
