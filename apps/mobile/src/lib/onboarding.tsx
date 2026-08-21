import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from "react";
import type { ChecklistTemplateSummary, VisaPurpose } from "@/lib/api";

type OnboardingDraft = {
  purpose: VisaPurpose | null;
  template: ChecklistTemplateSummary | null;
  targetMoveDate: Date | null;
};

type OnboardingState = OnboardingDraft & {
  setPurpose: (purpose: VisaPurpose) => void;
  setTemplate: (template: ChecklistTemplateSummary) => void;
  setTargetMoveDate: (date: Date) => void;
};

const OnboardingContext = createContext<OnboardingState | null>(null);

/**
 * Holds the three onboarding answers in memory while the user walks the flow. Nothing is
 * sent until the last screen — a half-finished checklist on the server would be worse than
 * no checklist, and the user can still back out at any point.
 *
 * Step 3 replaces the final submit with POST /users/me/checklist.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<OnboardingDraft>({
    purpose: null,
    template: null,
    targetMoveDate: null,
  });

  const setPurpose = useCallback((purpose: VisaPurpose) => {
    // Changing purpose invalidates a template picked under the old one.
    setDraft((current) =>
      current.purpose === purpose
        ? current
        : { ...current, purpose, template: null },
    );
  }, []);

  const setTemplate = useCallback((template: ChecklistTemplateSummary) => {
    setDraft((current) => ({ ...current, template }));
  }, []);

  const setTargetMoveDate = useCallback((targetMoveDate: Date) => {
    setDraft((current) => ({ ...current, targetMoveDate }));
  }, []);

  const value = useMemo(
    () => ({ ...draft, setPurpose, setTemplate, setTargetMoveDate }),
    [draft, setPurpose, setTemplate, setTargetMoveDate],
  );

  return <OnboardingContext value={value}>{children}</OnboardingContext>;
}

export function useOnboarding(): OnboardingState {
  const context = use(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used inside an OnboardingProvider");
  }
  return context;
}
