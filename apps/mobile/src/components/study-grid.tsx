import { useMemo } from "react";
import { Text, View } from "react-native";
import type { StudyDay } from "@/lib/api";

/** Twenty weeks, which is what fits across a phone at a legible square size. */
const WEEKS = 20;
const DAYS_IN_WEEK = 7;
const SQUARE = 12;
const GAP = 4;

/**
 * Four filled shades plus empty. Opacity rather than five palette entries: the tokens carry
 * light and dark values, so deriving the steps keeps the grid correct in both themes.
 */
function fillFor(reviewCount: number): { className: string; opacity: number } {
  if (reviewCount === 0) return { className: "bg-surface-sunken", opacity: 1 };
  if (reviewCount < 5) return { className: "bg-primary", opacity: 0.35 };
  if (reviewCount < 15) return { className: "bg-primary", opacity: 0.6 };
  if (reviewCount < 30) return { className: "bg-primary", opacity: 0.8 };
  return { className: "bg-primary", opacity: 1 };
}

/** Local YYYY-MM-DD. `toISOString` would shift the day for anyone west of UTC. */
function isoDay(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The study habit as a contribution grid: one column per week, one square per day, today in
 * the bottom right.
 *
 * A grid rather than the streak number alone because it shows the shape of the habit — the
 * good fortnight, the week off — which a single figure cannot. The number still leads,
 * in the caption, since a grid needs a moment's reading and "12 days" does not.
 */
export function StudyGrid({ days }: { days: StudyDay[] }) {
  const columns = useMemo(() => {
    const counts = new Map(days.map((day) => [day.date, day.reviewCount]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Walk back to the start of the earliest week so every column holds seven days and the
    // rows line up as weekdays.
    const start = new Date(today);
    start.setDate(start.getDate() - (WEEKS * DAYS_IN_WEEK - 1));

    return Array.from({ length: WEEKS }, (_, week) =>
      Array.from({ length: DAYS_IN_WEEK }, (_, dayOfWeek) => {
        const date = new Date(start);
        date.setDate(start.getDate() + week * DAYS_IN_WEEK + dayOfWeek);
        const key = isoDay(date);
        return { key, count: counts.get(key) ?? 0 };
      }),
    );
  }, [days]);

  return (
    <View className="flex-row" style={{ gap: GAP }}>
      {columns.map((week) => (
        <View key={week[0].key} style={{ gap: GAP }}>
          {week.map((day) => {
            const { className, opacity } = fillFor(day.count);
            return (
              <View
                className={className}
                key={day.key}
                // borderRadius here rather than a class: global.css defines card/button/pill
                // radii only, so a `rounded-sm` would depend on a token that may not exist.
                style={{
                  width: SQUARE,
                  height: SQUARE,
                  opacity,
                  borderRadius: 3,
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** "Less ▢▢▢▢ More" — the same key GitHub uses, because the shading needs explaining once. */
export function StudyGridLegend() {
  return (
    <View className="flex-row items-center gap-1.5">
      <Text className="text-caption text-ink-subtle">Less</Text>
      {[0, 3, 10, 20, 40].map((count) => {
        const { className, opacity } = fillFor(count);
        return (
          <View
            className={className}
            key={count}
            style={{ width: 10, height: 10, opacity, borderRadius: 3 }}
          />
        );
      })}
      <Text className="text-caption text-ink-subtle">More</Text>
    </View>
  );
}
