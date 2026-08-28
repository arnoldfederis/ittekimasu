import { useMemo } from "react";
import { View } from "react-native";

/**
 * One thin segment per card in the session, filled as you go.
 *
 * A bar rather than "3 of 20": the length of what is left is the useful part, and a session
 * is short enough that the segments stay legible.
 */
export function SegmentedProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const segments = useMemo(
    () => Array.from({ length: total }, (_, i) => i),
    [total],
  );

  return (
    <View className="flex-row gap-1 px-4 pb-2">
      {segments.map((segment) => (
        <View
          className={`h-1 flex-1 rounded-pill ${
            segment < current ? "bg-primary" : "bg-surface-sunken"
          }`}
          key={segment}
        />
      ))}
    </View>
  );
}
