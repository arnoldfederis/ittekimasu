import { Stack } from "expo-router";
import { useThemeColors } from "@/constants/theme";
import { OnboardingProvider } from "@/lib/onboarding";

export default function OnboardingLayout() {
  const colors = useThemeColors();

  return (
    // Provider sits on the layout so the single paged screen keeps one draft; it is torn
    // down when the user leaves the flow.
    <OnboardingProvider>
      <Stack
        screenOptions={{
          // One screen, three panes. No header: the step counter says where you are and
          // each step carries its own Back button within thumb reach.
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="index" />
      </Stack>
    </OnboardingProvider>
  );
}
