import { Pressable, Text, View } from "react-native";
import type { KanaScript } from "@/constants/kana";

const SCRIPTS: { key: KanaScript; label: string }[] = [
  { key: "hiragana", label: "Hiragana" },
  { key: "katakana", label: "Katakana" },
];

/**
 * The Hiragana / Katakana switch, shared by the chart and the progress page so the two look
 * and behave as one control. Hiragana first, because the N5 deck writes its readings in it.
 */
export function KanaScriptToggle({
  script,
  onChange,
}: {
  script: KanaScript;
  onChange: (script: KanaScript) => void;
}) {
  return (
    <View className="flex-row gap-2">
      {SCRIPTS.map((entry) => {
        const selected = script === entry.key;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`flex-1 items-center rounded-pill border py-2 ${
              selected
                ? "border-primary bg-primary-tint"
                : "border-line bg-surface"
            }`}
            key={entry.key}
            onPress={() => onChange(entry.key)}
          >
            <Text
              className={`text-callout ${
                selected ? "font-semibold text-primary" : "text-ink-muted"
              }`}
            >
              {entry.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
