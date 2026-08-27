import { router } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Button } from "@/components/button";
import { Card, CardCaption, CardTitle } from "@/components/card";
import { ProgressRing } from "@/components/progress-ring";
import { ScreenHeader } from "@/components/screen-header";
import { TaskRow } from "@/components/task-row";
import { TAB_BAR_CLEARANCE } from "@/constants/theme";
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
  const { user } = useAuth();
  const { checklist, loading, failed, refresh, toggleTask } = useChecklist();

  const firstName = user?.displayName?.split(" ")[0];

  // The server sorts by due date, but the response is GROUPED BY CATEGORY — flattening it
  // concatenates category after category and throws that order away. Without re-sorting,
  // "next up" showed the first three visa tasks, which for a soon-ish move date are the
  // ones that came due months ago, while genuinely imminent tasks sat further down.
  //
  // Overdue still belongs here: it needs doing, and hiding it would be worse.
  const dueSoon = Object.values(checklist?.tasksByCategory ?? {})
    .flat()
    .filter((task) => {
      if (task.completed) return false;
      const days = daysUntil(task.dueDate);
      return days !== null && days <= DUE_SOON_DAYS;
    })
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, MAX_DUE_SOON);

  const total = checklist?.totalCount ?? 0;
  const done = checklist?.completedCount ?? 0;

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE, gap: 16 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      {/*
        No bell here. It had no onPress and there is no notification centre to open — an
        affordance that does nothing is worse than no affordance. Reminders are configured
        on the profile tab.
      */}
      <ScreenHeader
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
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
              {/*
                "Next up", not "Due this week": this list deliberately includes tasks whose
                date has already passed, and calling a 114-day-old task "due this week" is
                just wrong.
              */}
              <Text className="px-1 font-semibold text-caption text-ink-subtle">
                NEXT UP
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

        {/*
          The study-only path lands here with no checklist at all. Offering it plainly beats
          an empty progress ring — and this is the only route back to the wizard, so someone
          who skipped it and then got a job offer is not stuck.
        */}
        {checklist && total === 0 && !loading ? (
          <Card>
            <CardTitle>No checklist yet</CardTitle>
            <CardCaption>
              Moving to Japan? Answer three questions and every deadline — COE,
              ward office, residence card — gets dated from your move.
            </CardCaption>
            <View className="pt-3">
              <Button
                onPress={() => router.push("/checklist-setup")}
                title="Build my checklist"
                variant="secondary"
              />
            </View>
          </Card>
        ) : null}

        <Card tone="accent">
          <CardTitle>Daily practice</CardTitle>
          <CardCaption>
            A few minutes of Japanese keeps the streak alive
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
