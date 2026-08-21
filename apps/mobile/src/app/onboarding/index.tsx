import { ScrollView, Text, View } from "react-native";
import { Button } from "@/components/button";
import { useAuth } from "@/lib/auth";

/**
 * Placeholder. Step 2 replaces this with the three-screen flow:
 * purpose.tsx → visa.tsx → move-date.tsx, submitting once at the end.
 */
export default function OnboardingScreen() {
  const { markOnboarded } = useAuth();

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        padding: 24,
        gap: 24,
      }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View className="gap-2">
        <Text className="font-semibold text-ink text-title">
          Let&apos;s set up your checklist
        </Text>
        <Text className="text-body text-ink-muted">
          You&apos;ll pick why you&apos;re moving, your visa route, and a target
          move date. Due dates are generated from that date.
        </Text>
      </View>

      <Button onPress={markOnboarded} size="large" title="Skip for now" />
    </ScrollView>
  );
}
