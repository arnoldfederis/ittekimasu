import { Image } from "expo-image";
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
            <View className="mx-4 overflow-hidden rounded-card bg-surface">
              {HOURS.map((hour) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: reminderHour === hour }}
                  className="min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-surface-sunken"
                  key={hour}
                  onPress={() => choose(hour)}
                >
                  <Text className="flex-1 text-body text-ink">
                    {formatReminderHour(hour)}
                  </Text>
                  {reminderHour === hour ? (
                    <Image
                      source="sf:checkmark"
                      style={{ width: 16, height: 16 }}
                      tintColor={colors.primary}
                    />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>
    </>
  );
}
