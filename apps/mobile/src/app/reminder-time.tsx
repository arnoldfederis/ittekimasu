import { Stack } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useThemeColors } from "@/constants/theme";
import { formatReminderHour, useNotifications } from "@/lib/notifications";

/**
 * Every hour of the day.
 *
 * This was briefly cut to four slots, back when delivery came from OneSignal dashboard
 * campaigns and each offered hour needed its own segment and recurring campaign. The
 * server-side scheduler (ReminderService) removed that ceiling — it reads the hour straight
 * from the database — so there is no longer any cost to offering the whole day. Someone on
 * a night shift in Japan has as much right to 3am as anyone.
 */
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** Where the toggle lands someone who has never set a time. */
const DEFAULT_HOUR = 20;

/** "12am", "8am", "1pm" — short enough for a grid cell, unambiguous at a glance. */
function shortHour(hour: number): string {
  const period = hour < 12 ? "am" : "pm";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}${period}`;
}

export default function ReminderTimeScreen() {
  const colors = useThemeColors();
  const { reminderHour, setReminderHour } = useNotifications();

  // Remembered so toggling off and back on returns to the hour they picked, rather than
  // silently resetting to the default.
  const [lastHour, setLastHour] = useState(reminderHour ?? DEFAULT_HOUR);
  const enabled = reminderHour !== null;

  async function toggle(on: boolean) {
    if (on) {
      await setReminderHour(lastHour);
    } else {
      setLastHour(reminderHour ?? DEFAULT_HOUR);
      await setReminderHour(null);
    }
  }

  async function choose(hour: number) {
    setLastHour(hour);
    await setReminderHour(hour);
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Daily reminder" }} />

      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 16, gap: 16 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="mx-4 overflow-hidden rounded-card bg-surface">
          <View className="min-h-14 flex-row items-center gap-3 px-4 py-3">
            <View className="flex-1 gap-0.5">
              <Text className="text-body text-ink">Daily reminder</Text>
              <Text className="text-caption text-ink-muted">
                {enabled
                  ? `Every day at ${formatReminderHour(reminderHour)}`
                  : "A short nudge to keep your streak going"}
              </Text>
            </View>
            <Switch
              onValueChange={toggle}
              thumbColor={colors.surface}
              trackColor={{ false: colors.line, true: colors.primary }}
              value={enabled}
            />
          </View>
        </View>

        {enabled ? (
          <Animated.View entering={FadeIn.duration(160)}>
            <Text className="px-5 pb-2 font-semibold text-caption text-ink-subtle">
              TIME
            </Text>
            {/*
              A grid, not a 24-row list. Picking one value out of a full day should be a
              single tap against something you can see all of — a scrolling list hides most
              of the options and makes "is 3am even here?" a question.
            */}
            <View className="mx-4 flex-row flex-wrap gap-2 rounded-card bg-surface p-3">
              {HOURS.map((hour) => {
                const isSelected = reminderHour === hour;
                return (
                  <Pressable
                    accessibilityLabel={formatReminderHour(hour)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    className={`h-12 items-center justify-center rounded-button ${
                      isSelected
                        ? "bg-primary"
                        : "bg-surface-sunken active:opacity-70"
                    }`}
                    key={hour}
                    onPress={() => choose(hour)}
                    style={{ width: "22.5%", borderCurve: "continuous" }}
                  >
                    <Text
                      className={`text-callout ${
                        isSelected
                          ? "font-semibold text-ink-inverse"
                          : "text-ink"
                      }`}
                      style={{ fontVariant: ["tabular-nums"] }}
                    >
                      {shortHour(hour)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>
    </>
  );
}
