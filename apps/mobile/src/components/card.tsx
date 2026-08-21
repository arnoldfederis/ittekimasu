import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

type CardProps = {
  children: ReactNode;
  /** Amber treatment, used for the streak card. */
  tone?: "surface" | "accent" | "sunken";
  onPress?: () => void;
  /** Teal border and tinted fill — the picked option in a chooser. */
  selected?: boolean;
  /** Dimmed and unpressable, for "coming soon" rows. */
  disabled?: boolean;
  className?: string;
};

const tones = {
  surface: "bg-surface",
  accent: "bg-accent-tint",
  sunken: "bg-surface-sunken",
} as const;

export function Card({
  children,
  tone = "surface",
  onPress,
  selected = false,
  disabled = false,
  className = "",
}: CardProps) {
  // Selection reads as a 2px teal ring; unselected keeps a same-width transparent border so
  // the card does not shift by 2px when it is picked.
  const selection = selected
    ? "border-2 border-primary bg-primary-tint"
    : "border-2 border-transparent";

  const classes = `rounded-card border p-4 ${tones[tone]} ${selection} ${
    disabled ? "opacity-50" : ""
  } ${className}`;

  const style = {
    borderCurve: "continuous" as const,
    boxShadow:
      tone === "surface" && !selected
        ? "0 1px 3px rgba(28, 27, 23, 0.06)"
        : undefined,
  };

  if (onPress && !disabled) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        className={`${classes} active:opacity-80`}
        onPress={onPress}
        style={style}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View className={classes} style={style}>
      {children}
    </View>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <Text className="font-semibold text-heading text-ink">{children}</Text>
  );
}

export function CardCaption({ children }: { children: ReactNode }) {
  return <Text className="text-caption text-ink-muted">{children}</Text>;
}
