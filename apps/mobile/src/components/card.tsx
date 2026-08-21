import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

type CardProps = {
  children: ReactNode;
  /** Amber treatment, used for the streak card. */
  tone?: "surface" | "accent" | "sunken";
  onPress?: () => void;
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
  className = "",
}: CardProps) {
  const classes = `rounded-card p-4 ${tones[tone]} ${className}`;
  const style = {
    borderCurve: "continuous" as const,
    boxShadow:
      tone === "surface" ? "0 1px 3px rgba(28, 27, 23, 0.06)" : undefined,
  };

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
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
