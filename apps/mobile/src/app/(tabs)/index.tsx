import { Image } from "expo-image";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Button } from "@/components/button";
import { Card, CardCaption, CardTitle } from "@/components/card";
import { ProgressRing } from "@/components/progress-ring";
import { ScreenHeader } from "@/components/screen-header";
import { TaskRow } from "@/components/task-row";
import { useThemeColors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { daysUntil, useChecklist } from "@/lib/checklist";

const DUE_SOON_DAYS = 7;
const MAX_DUE_SOON = 3;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { checklist, loading, failed, refresh, toggleTask } = useChecklist();

  const firstName = user?.displayName?.split(" ")[0];

  // Overdue counts as "this week" — it still needs doing, and hiding it would be worse.
  const dueSoon = Object.values(checklist?.tasksByCategory ?? {})
    .flat()
    .filter((task) => {
      if (task.completed) return false;
      const days = daysUntil(task.dueDate);
      return days !== null && days <= DUE_SOON_DAYS;
    })
    .slice(0, MAX_DUE_SOON);

  const total = checklist?.totalCount ?? 0;
  const done = checklist?.completedCount ?? 0;

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingBottom: 32, gap: 16 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <ScreenHeader
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        trailing={
          <Pressable
            accessibilityLabel="Notifications"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center rounded-pill active:bg-surface-sunken"
          >
            <Image
              source="sf:bell"
              style={{ width: 22, height: 22 }}
              tintColor={colors.inkMuted}
            />
          </Pressable>
        }
      />

      <View className="gap-4 px-4">
        {loading ? <ActivityIndicator className="py-8" /> : null}

        {failed && !checklist ? (
          <Card tone="sunken">
            <Text className="text-body text-ink">
              Couldn&apos;t reach the server.
            </Text>
            <View className="pt-3">
              <Button onPress={refresh} title="Try again" variant="secondary" />
            </View>
          </Card>
        ) : null}

        {checklist && total > 0 ? (
          <>
            <Card>
              <View className="flex-row items-center gap-4">
                <ProgressRing
                  progress={total === 0 ? 0 : done / total}
                  sublabel="done"
                />
                <View className="flex-1 gap-1">
                  <CardTitle>Your checklist</CardTitle>
                  {checklist.templateDisplayName ? (
                    <CardCaption>{checklist.templateDisplayName}</CardCaption>
                  ) : null}
                  <Text
                    className="text-callout text-ink-muted"
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {done} of {total} done
                  </Text>
                </View>
              </View>
            </Card>

            <View className="gap-2">
              <Text className="px-1 font-semibold text-caption text-ink-subtle">
                DUE THIS WEEK
              </Text>
              {dueSoon.length ? (
                <View className="overflow-hidden rounded-card bg-surface">
                  {dueSoon.map((task) => (
                    <TaskRow
                      key={task.id}
                      onToggle={(completed) => toggleTask(task.id, completed)}
                      task={task}
                    />
                  ))}
                </View>
              ) : (
                <Card>
                  <CardCaption>
                    Nothing due in the next week. Enjoy the breather.
                  </CardCaption>
                </Card>
              )}
            </View>
          </>
        ) : null}

        <Card tone="accent">
          <CardTitle>Daily practice</CardTitle>
          <CardCaption>
            Streaks and reviews arrive with the learn tab in step 5
          </CardCaption>
          <View className="pt-3">
            <Button
              onPress={() => router.push("/learn")}
              title="Go to Learn"
              variant="secondary"
            />
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
