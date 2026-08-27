import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { Button } from "@/components/button";
import { MoveDateStep } from "@/components/onboarding/move-date-step";
import { PurposeStep } from "@/components/onboarding/purpose-step";
import { VisaStep } from "@/components/onboarding/visa-step";
import { StepProgress } from "@/components/step-progress";
import { api } from "@/lib/api";
import { useChecklist } from "@/lib/checklist";
import { toLocalIsoDate } from "@/lib/dates";
import { useOnboarding } from "@/lib/onboarding";
import { toast } from "@/lib/toast";

const STEPS = 3;

/**
 * The three checklist questions as horizontal panes: purpose, visa route, move date.
 *
 * A component rather than a screen because it is reached two ways — during onboarding, and
 * later from the dashboard by someone who chose the study-only path and changed their mind.
 * Both need the identical flow, and a second copy of it would drift.
 *
 * A plain paging ScrollView rather than react-native-pager-view: the native module would
 * cost a prebuild and a rebuild, and for three panes there is nothing to gain.
 */
export function ChecklistWizard({
  onCompleted,
  onJustLearning,
}: {
  /** Runs after the checklist exists on the server and is in the cache. */
  onCompleted: () => void | Promise<void>;
  /** Offered on step 1 during onboarding only. Omit it and the escape hatch is hidden. */
  onJustLearning?: () => void;
}) {
  const { width } = useWindowDimensions();
  const { purpose, template, targetMoveDate } = useOnboarding();
  const { replace } = useChecklist();

  const pager = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const build = useMutation({
    mutationFn: ({
      templateId,
      moveDate,
    }: {
      templateId: string;
      moveDate: Date;
    }) => api.createChecklist(templateId, toLocalIsoDate(moveDate)),

    onSuccess: async (checklist) => {
      // The response is the whole checklist, so the dashboard and the checklist tab are
      // correct before this even unmounts. Without it they would show the empty state the
      // provider fetched while this screen was open.
      replace(checklist);
      toast.success(
        "Your checklist is ready",
        `${checklist.totalCount} tasks, starting ${checklist.totalCount > 0 ? "now" : "soon"}.`,
      );
      await onCompleted();
    },

    meta: { errorMessage: "Couldn't build your checklist. Try again." },
  });

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

  function finish() {
    if (!template || !targetMoveDate) return;
    build.mutate({ templateId: template.id, moveDate: targetMoveDate });
  }

  return (
    <View className="flex-1">
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
          <PurposeStep onJustLearning={onJustLearning} />
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
          loading={build.isPending}
          onPress={() => (page === STEPS - 1 ? finish() : goTo(page + 1))}
          size="large"
          title={page === STEPS - 1 ? "Build my checklist" : "Continue"}
        />
        {page > 0 ? (
          <Button
            disabled={build.isPending}
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
