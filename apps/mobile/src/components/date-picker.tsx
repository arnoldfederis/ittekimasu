import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useThemeColors } from "@/constants/theme";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** Midnight today, so "is this day in the past" never depends on the time of day. */
function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

type DatePickerProps = {
  value: Date | null;
  onChange: (date: Date) => void;
  /** Days before this are unselectable. Defaults to today — no moving into the past. */
  minimumDate?: Date;
};

/**
 * A calendar day picker built in plain React Native.
 *
 * Deliberately not @react-native-community/datetimepicker: that is a native module, and
 * adding one costs a prebuild plus a fresh build before anything can be tested again. For
 * picking one future date a grid is just as clear.
 */
export function DatePicker({ value, onChange, minimumDate }: DatePickerProps) {
  const colors = useThemeColors();
  const floor = minimumDate ?? startOfToday();

  // Which month the grid is showing, which is not the same as which day is selected.
  const [cursor, setCursor] = useState(() => {
    const base = value ?? floor;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = new Date(year, month, 1).getDay();

  // Stepping back past the floor's month would only ever show unselectable days.
  const canGoBack =
    year > floor.getFullYear() ||
    (year === floor.getFullYear() && month > floor.getMonth());

  function step(delta: number) {
    setCursor(new Date(year, month + delta, 1));
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityLabel="Previous month"
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center rounded-pill active:bg-surface-sunken"
          disabled={!canGoBack}
          onPress={() => step(-1)}
        >
          <Image
            source="sf:chevron.left"
            style={{ width: 16, height: 16, opacity: canGoBack ? 1 : 0.3 }}
            tintColor={colors.ink}
          />
        </Pressable>

        <Text className="font-semibold text-heading text-ink">
          {MONTHS[month]} {year}
        </Text>

        <Pressable
          accessibilityLabel="Next month"
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center rounded-pill active:bg-surface-sunken"
          onPress={() => step(1)}
        >
          <Image
            source="sf:chevron.right"
            style={{ width: 16, height: 16 }}
            tintColor={colors.ink}
          />
        </Pressable>
      </View>

      <View className="flex-row">
        {WEEKDAYS.map((label, index) => (
          <View
            className="items-center"
            // Weekday initials repeat (S, T), so the index is the only stable key.
            key={`${label}-${index}`}
            style={{ width: `${100 / 7}%` }}
          >
            <Text className="font-semibold text-caption text-ink-subtle">
              {label}
            </Text>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <View
            key={`blank-${i}`}
            style={{ width: `${100 / 7}%`, height: 44 }}
          />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const date = new Date(year, month, day);
          const disabled = date < floor;
          const isSelected = value !== null && sameDay(date, value);

          return (
            <View key={day} style={{ width: `${100 / 7}%`, height: 44 }}>
              <Pressable
                accessibilityLabel={`${day} ${MONTHS[month]} ${year}`}
                accessibilityRole="button"
                accessibilityState={{ disabled, selected: isSelected }}
                className={`m-0.5 flex-1 items-center justify-center rounded-pill ${
                  isSelected ? "bg-primary" : ""
                } ${disabled ? "opacity-25" : "active:bg-surface-sunken"}`}
                disabled={disabled}
                onPress={() => onChange(date)}
              >
                <Text
                  className={`text-body ${
                    isSelected
                      ? "font-semibold text-ink-inverse"
                      : disabled
                        ? "text-ink-subtle"
                        : "text-ink"
                  }`}
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {day}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
