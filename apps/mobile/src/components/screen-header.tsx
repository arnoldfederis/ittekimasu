import type { ReactNode } from "react";
import { Text, View } from "react-native";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Right-aligned control — a notification bell, a filter icon. */
  trailing?: ReactNode;
};

/**
 * In-content header for greetings and section intros.
 *
 * Not a replacement for the navigation stack title: set that in `Stack.Screen options`.
 * This is for the cases where the copy is dynamic ("Good morning, Arnold").
 */
export function ScreenHeader({ title, subtitle, trailing }: ScreenHeaderProps) {
  return (
    <View className="flex-row items-start gap-3 px-4 pt-2 pb-4">
      <View className="flex-1 gap-1">
        <Text className="font-semibold text-ink text-title">{title}</Text>
        {subtitle ? (
          <Text className="text-callout text-ink-muted">{subtitle}</Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}
