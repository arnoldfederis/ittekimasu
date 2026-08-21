import { Image } from "expo-image";
import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { StepProgress } from "@/components/step-progress";
import { useThemeColors } from "@/constants/theme";
import type { VisaPurpose } from "@/lib/api";
import { useOnboarding } from "@/lib/onboarding";

const OPTIONS: Array<{
  purpose: VisaPurpose;
  title: string;
  description: string;
  icon: string;
}> = [
  {
    purpose: "WORK",
    title: "Work",
    description: "A job offer, transfer, or working holiday",
    icon: "briefcase",
  },
  {
    purpose: "STUDY",
    title: "Study",
    description: "University, language school, or an exchange",
    icon: "graduationcap",
  },
  {
    purpose: "FAMILY",
    title: "Family",
    description: "Joining a partner, parent, or child",
    icon: "heart",
  },
  {
    purpose: "OTHER",
    title: "Something else",
    description: "Remote work, long stay, or still deciding",
    icon: "sparkles",
  },
];

export default function PurposeScreen() {
  const colors = useThemeColors();
  const { purpose, setPurpose } = useOnboarding();

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 40 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <StepProgress step={1} total={3} />

      <View className="gap-2">
        <Text className="font-semibold text-ink text-title">
          Why are you moving?
        </Text>
        <Text className="text-body text-ink-muted">
          This decides which visa routes we show you next.
        </Text>
      </View>

      <View className="gap-3">
        {OPTIONS.map((option) => {
          const isSelected = purpose === option.purpose;
          return (
            <Card
              key={option.purpose}
              onPress={() => setPurpose(option.purpose)}
              selected={isSelected}
            >
              <View className="flex-row items-center gap-4">
                <Image
                  source={`sf:${option.icon}`}
                  style={{ width: 28, height: 28 }}
                  tintColor={isSelected ? colors.primary : colors.inkMuted}
                />
                <View className="flex-1 gap-1">
                  <Text className="font-semibold text-heading text-ink">
                    {option.title}
                  </Text>
                  <Text className="text-caption text-ink-muted">
                    {option.description}
                  </Text>
                </View>
              </View>
            </Card>
          );
        })}
      </View>

      <Button
        disabled={!purpose}
        onPress={() => router.push("/onboarding/visa")}
        size="large"
        title="Continue"
      />
    </ScrollView>
  );
}
