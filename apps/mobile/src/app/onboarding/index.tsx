import { useRef, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { MoveDateStep } from "@/components/onboarding/move-date-step";
import { PurposeStep } from "@/components/onboarding/purpose-step";
import { VisaStep } from "@/components/onboarding/visa-step";
import { StepProgress } from "@/components/step-progress";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toLocalIsoDate } from "@/lib/dates";
import { useOnboarding } from "@/lib/onboarding";
import { toast } from "@/lib/toast";

const STEPS = 3;

/**
 * All three onboarding questions on one screen, as horizontal panes.
 *
 * Previously these were three pushed routes, which meant a navigation animation and a
 * header back button for what is really one form. A pager keeps the answers on screen and
 * makes going back instant.
 *
 * A plain paging ScrollView rather than react-native-pager-view: the native module would
 * cost a prebuild and a rebuild, and for three panes there is nothing to gain.
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { purpose, template, targetMoveDate } = useOnboarding();
  const { markOnboarded } = useAuth();

  const pager = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [saving, setSaving] = useState(false);

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(STEPS - 1, next));
    setPage(clamped);
    pager.current?.scrollTo({ x: clamped * width, animated: true });
  }

  // Each step gates the next one, so the final submit can never be reached with a missing
  // answer — which is also why the pager itself does not scroll by swipe.
  const canContinue = [
    Boolean(purpose),
    Boolean(template),
    Boolean(targetMoveDate),
  ][page];

  async function finish() {
    if (!template || !targetMoveDate) return;
    setSaving(true);
    try {
      const checklist = await api.createChecklist(
        template.id,
        toLocalIsoDate(targetMoveDate),
      );

      // Only flip the guard once the server actually has the checklist, otherwise the user
      // lands on an empty dashboard with no way back into onboarding.
      await markOnboarded();
      toast.success(
        "Your checklist is ready",
        `${checklist.totalCount} tasks, starting ${checklist.totalCount > 0 ? "now" : "soon"}.`,
      );
    } catch (error) {
      toast.fromError(error, "Couldn't build your checklist. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="px-6 pt-2">
        <StepProgress step={page + 1} total={STEPS} />
      </View>

      <ScrollView
        className="flex-1"
        horizontal
        pagingEnabled
        ref={pager}
        // Driven by the buttons only. Free swiping would let someone reach the move-date
        // step without a visa, and the submit would be dead on arrival.
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
      >
        <View style={{ width }}>
          <PurposeStep />
        </View>
        <View style={{ width }}>
          <VisaStep />
        </View>
        <View style={{ width }}>
          <MoveDateStep />
        </View>
      </ScrollView>

      <View className="gap-2 px-6 pt-3 pb-8">
        <Button
          disabled={!canContinue}
          loading={saving}
          onPress={() => (page === STEPS - 1 ? finish() : goTo(page + 1))}
          size="large"
          title={page === STEPS - 1 ? "Build my checklist" : "Continue"}
        />
        {page > 0 ? (
          <Button
            disabled={saving}
            onPress={() => goTo(page - 1)}
            title="Back"
            variant="ghost"
          />
        ) : (
          // Holds the footer height steady so the Continue button does not jump between
          // the first step and the rest.
          <View className="h-12" />
        )}
      </View>
    </View>
  );
}
