import { useMutation, useQueryClient } from "@tanstack/react-query";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChecklistWizard } from "@/components/onboarding/checklist-wizard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { queryKeys } from "@/lib/queries";
import { toast } from "@/lib/toast";

/**
 * Onboarding: the checklist wizard, plus the one thing only this screen offers — the way
 * past it.
 *
 * Not everyone who opens this app is moving to Japan. Someone who only wants the kana and
 * vocabulary decks has no visa route to pick, and making them invent one is a wall on the
 * very first screen. They can build a checklist later from the dashboard.
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { markOnboarded } = useAuth();
  const queryClient = useQueryClient();

  const studyOnly = useMutation({
    mutationFn: () => api.completeOnboarding(),

    onSuccess: async (me) => {
      // The server is what decides this now — `onboarded` on the user row, not a count of
      // checklist tasks. Seeding it here keeps the profile and learn tabs consistent.
      queryClient.setQueryData(queryKeys.me, me);
      await markOnboarded();
      toast.success(
        "You're all set",
        "Start with Hiragana. Your checklist is on the dashboard whenever you want it.",
      );
    },

    meta: { errorMessage: "Couldn't save that. Try again." },
  });

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <ChecklistWizard
        onCompleted={markOnboarded}
        onJustLearning={() => studyOnly.mutate()}
      />
    </View>
  );
}
