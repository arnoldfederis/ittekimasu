import { useMemo } from "react";
import { View } from "react-native";

/**
 * One thin segment per card in the session, filled as you go.
 *
 * A bar rather than "3 of 20": the length of what is left is the useful part, and a session
 * is short enough that the segments stay legible.
 *
 * `current` is HOW MANY segments are lit, so a caller tracking a zero-based cursor passes
 * `index + 1` to light the card being answered. Passing the bare cursor lights the cards
 * already behind you, which leaves the final segment grey for the whole of the last
 * question — and on a screen that swaps to a summary the moment it is answered, that
 * segment never fills and reads as a step that was skipped.
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
