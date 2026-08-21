import { Stack } from "expo-router";
import { useThemeColors } from "@/constants/theme";
import { OnboardingProvider } from "@/lib/onboarding";

export default function OnboardingLayout() {
  const colors = useThemeColors();

  return (
    // Provider sits on the layout so the three screens share one draft; it is torn down
    // when the user leaves the flow.
    <OnboardingProvider>
      <Stack
        screenOptions={{
          // Back arrow only — the step counter on each screen already says where you are,
          // so a header title would just repeat it.
          headerTitle: "",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.primary,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        {/* Redirect target and step 1: nothing to go back to, so no header. */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="purpose" options={{ headerShown: false }} />
        <Stack.Screen name="visa" />
        <Stack.Screen name="move-date" />
      </Stack>
    </OnboardingProvider>
  );
}
