import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useThemeColors } from "@/constants/theme";
import { formatReminderHour, useNotifications } from "@/lib/notifications";

/**
 * Waking hours only. A 3am reminder is not a feature anyone wants, and a full 24-hour list
 * makes the sensible choices harder to find.
 */
const HOURS = [7, 8, 9, 12, 17, 18, 19, 20, 21, 22];

export default function ReminderTimeScreen() {
  const colors = useThemeColors();
  const { reminderHour, setReminderHour } = useNotifications();

  async function choose(hour: number | null) {
    await setReminderHour(hour);
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Daily reminder" }} />

      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 16, gap: 16 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Text className="px-5 text-callout text-ink-muted">
          A short nudge to keep the streak going. Change it or switch it off
          whenever.
        </Text>

        <View className="mx-4 overflow-hidden rounded-card bg-surface">
          <Option
            checked={reminderHour === null}
            label="Off"
            onPress={() => choose(null)}
            tint={colors.primary}
          />
          {HOURS.map((hour) => (
            <Option
              checked={reminderHour === hour}
              key={hour}
              label={formatReminderHour(hour)}
              onPress={() => choose(hour)}
              tint={colors.primary}
            />
          ))}
        </View>
      </ScrollView>
    </>
  );
}

function Option({
  label,
  checked,
  tint,
  onPress,
}: {
  label: string;
  checked: boolean;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      className="min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-surface-sunken"
      onPress={onPress}
    >
      <Text className="flex-1 text-body text-ink">{label}</Text>
      {checked ? (
        <Image
          source="sf:checkmark"
          style={{ width: 16, height: 16 }}
          tintColor={tint}
        />
      ) : null}
    </Pressable>
  );
}
