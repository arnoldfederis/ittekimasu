import { ScrollView, Text, View } from "react-native";
import { Card, CardCaption, CardTitle } from "@/components/card";
import { ProgressRing } from "@/components/progress-ring";
import { ScreenHeader } from "@/components/screen-header";
import { useAuth } from "@/lib/auth";

export default function DashboardScreen() {
  const { user } = useAuth();
  const firstName = user?.displayName?.split(" ")[0];

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingBottom: 32, gap: 16 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <ScreenHeader
        subtitle="Your move to Japan, one step at a time"
        title={firstName ? `Good morning, ${firstName}` : "Good morning"}
      />

      <View className="gap-4 px-4">
        <Card>
          <View className="flex-row items-center gap-4">
            <ProgressRing progress={0} sublabel="done" />
            <View className="flex-1 gap-1">
              <CardTitle>Your checklist</CardTitle>
              <CardCaption>Set up in onboarding — wired in step 3</CardCaption>
            </View>
          </View>
        </Card>

        <Card tone="accent">
          <CardTitle>Daily practice</CardTitle>
          <CardCaption>
            Streaks and reviews arrive with the learn tab in step 5
          </CardCaption>
        </Card>

        <Text className="px-1 text-caption text-ink-subtle">
          Placeholder dashboard. Real data lands once the checklist and review
          endpoints exist.
        </Text>
      </View>
    </ScrollView>
  );
}
