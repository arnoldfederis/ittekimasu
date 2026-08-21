import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useThemeColors } from "@/constants/theme";

type ProgressRingProps = {
  /** 0–1. Values outside the range are clamped rather than drawn wrong. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  /** Rendered in the middle. Defaults to the rounded percentage. */
  label?: string;
  sublabel?: string;
};

export function ProgressRing({
  progress,
  size = 96,
  strokeWidth = 10,
  label,
  sublabel,
}: ProgressRingProps) {
  const colors = useThemeColors();
  const clamped = Math.min(Math.max(progress, 0), 1);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.round(clamped * 100);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      className="items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Svg height={size} style={{ position: "absolute" }} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={colors.surfaceSunken}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={colors.primary}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          // Start the arc at 12 o'clock instead of 3 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <Text
        className="font-semibold text-heading text-ink"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {label ?? `${percent}%`}
      </Text>
      {sublabel ? (
        <Text className="text-caption text-ink-muted">{sublabel}</Text>
      ) : null}
    </View>
  );
}
