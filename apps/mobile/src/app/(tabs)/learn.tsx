import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Button } from "@/components/button";
import { Card, CardCaption, CardTitle } from "@/components/card";
import { ScreenHeader } from "@/components/screen-header";
import { useThemeColors } from "@/constants/theme";
import { api, type CourseSummary } from "@/lib/api";
import { toast } from "@/lib/toast";

export default function LearnScreen() {
  const colors = useThemeColors();
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setCourses(await api.getCourses());
    } catch (error) {
      setFailed(true);
      toast.fromError(error, "Couldn't load your courses.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
        {/*
          Streak numbers come from UserCardProgress, which step 5 adds. Showing the card now
          with honest zeros rather than inventing a streak the engine cannot yet track.
        */}
        <Card tone="accent">
          <View className="flex-row items-center gap-4">
            <Image
              source="sf:flame.fill"
              style={{ width: 32, height: 32 }}
              tintColor={colors.accent}
            />
            <View className="flex-1 gap-1">
              <CardTitle>No streak yet</CardTitle>
              <CardCaption>
                Reviews start counting once the practice screen lands in step 5.
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
          <Card key={course.id}>
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

              {/* Progress is 0 until step 5 records reviews; the bar is the real shape. */}
              <View className="h-1.5 overflow-hidden rounded-pill bg-surface-sunken">
                <View className="h-full w-0 rounded-pill bg-primary" />
              </View>

              <Text
                className="text-caption text-ink-muted"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                0 of {course.cardCount} cards · reviews arrive in step 5
              </Text>

              <Button
                disabled
                onPress={() => {}}
                title="Review cards"
                variant="primary"
              />
            </View>
          </Card>
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
                "The paywall arrives with RevenueCat in step 6.",
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
