import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { useThemeColors } from "@/constants/theme";

type ListRowProps = {
  title: string;
  /** Secondary line under the title — a due-date hint, a category, a reading. */
  subtitle?: string;
  /** Right-aligned value, e.g. a setting's current selection. */
  value?: string;
  /** SF Symbol name, rendered via expo-image's `sf:` source. */
  icon?: string;
  onPress?: () => void;
  showChevron?: boolean;
  /** Amber treatment for deadline-critical rows. Never red — see the design principle. */
  emphasis?: "none" | "attention";
  disabled?: boolean;
};

export function ListRow({
  title,
  subtitle,
  value,
  icon,
  onPress,
  showChevron = false,
  emphasis = "none",
  disabled = false,
}: ListRowProps) {
  const colors = useThemeColors();
  const content = (
    <View
      className={`min-h-14 flex-row items-center gap-3 px-4 py-3 ${disabled ? "opacity-50" : ""}`}
    >
      {icon ? (
        <Image
          source={`sf:${icon}`}
          style={{ width: 22, height: 22 }}
          tintColor={emphasis === "attention" ? colors.accent : colors.inkMuted}
        />
      ) : null}

      <View className="flex-1 gap-0.5">
        <Text className="text-body text-ink">{title}</Text>
        {subtitle ? (
          <Text
            className={`text-caption ${emphasis === "attention" ? "text-accent" : "text-ink-muted"}`}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {value ? (
        <Text className="text-callout text-ink-muted">{value}</Text>
      ) : null}

      {showChevron ? (
        <Image
          source="sf:chevron.right"
          style={{ width: 14, height: 14 }}
          tintColor={colors.inkSubtle}
        />
      ) : null}
    </View>
  );

  if (!onPress || disabled) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      className="active:bg-surface-sunken"
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}
