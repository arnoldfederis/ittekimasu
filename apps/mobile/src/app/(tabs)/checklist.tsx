import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Button } from "@/components/button";
import { Card, CardCaption, CardTitle } from "@/components/card";
import { ScreenHeader } from "@/components/screen-header";
import { TaskRow } from "@/components/task-row";
import { TAB_BAR_CLEARANCE, useThemeColors } from "@/constants/theme";
import { categoryLabel, useChecklist } from "@/lib/checklist";

const DISCLAIMER_KEY = "ittekimasu.checklistDisclaimerDismissed";

export default function ChecklistScreen() {
  const colors = useThemeColors();
  const { checklist, loading, failed, refresh, toggleTask } = useChecklist();
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DISCLAIMER_KEY).then((dismissed) =>
      setShowDisclaimer(dismissed !== "true"),
    );
  }, []);

  async function dismissDisclaimer() {
    setShowDisclaimer(false);
    await AsyncStorage.setItem(DISCLAIMER_KEY, "true");
  }

  const total = checklist?.totalCount ?? 0;
  const done = checklist?.completedCount ?? 0;
  const progress = total === 0 ? 0 : done / total;

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE, gap: 16 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <ScreenHeader
        subtitle={
          total
            ? `${done} of ${total} done`
            : "Grouped by category, due against your move date"
        }
        title="Checklist"
      />

      {/* Thin overall bar, directly under the header. */}
      {total > 0 ? (
        <View className="px-4">
          <View className="h-1.5 overflow-hidden rounded-pill bg-surface-sunken">
            <View
              className="h-full rounded-pill bg-primary"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </View>
        </View>
      ) : null}

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

        {showDisclaimer ? (
          <Card tone="sunken">
            <View className="flex-row items-start gap-3">
              <View className="flex-1 gap-1">
                <CardTitle>Guidance only</CardTitle>
                <CardCaption>
                  This checklist is a starting point, not immigration advice.
                  Confirm anything legally binding with the Immigration Services
                  Agency and your employer&apos;s HR.
                </CardCaption>
              </View>
              <Pressable
                accessibilityLabel="Dismiss"
                accessibilityRole="button"
                className="h-9 w-9 items-center justify-center rounded-pill active:bg-surface"
                onPress={dismissDisclaimer}
              >
                <Image
                  source="sf:xmark"
                  style={{ width: 14, height: 14 }}
                  tintColor={colors.inkMuted}
                />
              </Pressable>
            </View>
          </Card>
        ) : null}

        {checklist && total === 0 && !loading ? (
          <Card>
            <CardTitle>No checklist yet</CardTitle>
            <CardCaption>
              Finish onboarding to generate your tasks from your move date.
            </CardCaption>
          </Card>
        ) : null}

        {Object.entries(checklist?.tasksByCategory ?? {}).map(
          ([category, tasks]) => {
            const sectionDone = tasks.filter((task) => task.completed).length;
            return (
              <View className="gap-2" key={category}>
                <View className="flex-row items-center justify-between px-1">
                  <Text className="font-semibold text-caption text-ink-subtle">
                    {categoryLabel(category).toUpperCase()}
                  </Text>
                  <Text
                    className="text-caption text-ink-subtle"
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {sectionDone}/{tasks.length}
                  </Text>
                </View>

                <View className="overflow-hidden rounded-card bg-surface">
                  {tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      onToggle={(completed) => toggleTask(task.id, completed)}
                      task={task}
                    />
                  ))}
                </View>
              </View>
            );
          },
        )}
      </View>
    </ScrollView>
  );
}
