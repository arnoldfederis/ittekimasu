import { router, Stack } from "expo-router";
import { View } from "react-native";
import { ChecklistWizard } from "@/components/onboarding/checklist-wizard";
import { OnboardingProvider } from "@/lib/onboarding";

/**
 * The checklist wizard, reached from the dashboard after onboarding.
 *
 * This is the other half of the study-only path: someone who skipped the checklist to get
 * to the decks, and has now been offered a job or booked a flight, needs a way back to it.
 * Without this screen that choice would be permanent.
 *
 * Its own OnboardingProvider — the draft lives and dies with this modal, so backing out
 * halfway leaves nothing behind.
 */
export default function ChecklistSetupScreen() {
  return (
    <OnboardingProvider>
      <Stack.Screen
        options={{ headerShown: true, title: "Build your checklist" }}
      />
      <View className="flex-1 bg-canvas pt-3">
        {/*
          Our own grabber. The iOS one belongs to a formSheet; this is a page-sheet modal,
          so without a handle there is nothing on screen saying it can be pulled down.
        */}
        <View className="items-center pb-2">
          <View className="h-1 w-9 rounded-pill bg-line" />
        </View>

        <ChecklistWizard onCompleted={() => router.back()} />
      </View>
    </OnboardingProvider>
  );
}
