import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  api,
  type UserChecklistResponse,
  type UserChecklistTaskResponse,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";

type ChecklistState = {
  checklist: UserChecklistResponse | null;
  loading: boolean;
  failed: boolean;
  refresh: () => Promise<void>;
  /** Optimistic: flips locally, rolls back if the PATCH fails. */
  toggleTask: (taskId: string, completed: boolean) => Promise<void>;
};

const ChecklistContext = createContext<ChecklistState | null>(null);

/** Applies a completion change to the cached response without refetching. */
function withTaskCompletion(
  current: UserChecklistResponse,
  taskId: string,
  completed: boolean,
): UserChecklistResponse {
  let changed = false;
  const tasksByCategory: Record<string, UserChecklistTaskResponse[]> = {};

  for (const [category, tasks] of Object.entries(current.tasksByCategory)) {
    tasksByCategory[category] = tasks.map((task) => {
      if (task.id !== taskId || task.completed === completed) return task;
      changed = true;
      return { ...task, completed };
    });
  }

  if (!changed) return current;

  return {
    ...current,
    tasksByCategory,
    completedCount: current.completedCount + (completed ? 1 : -1),
  };
}

export function ChecklistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [checklist, setChecklist] = useState<UserChecklistResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Mounted at the root so /move-date shares this state with the tabs, which means it also
  // mounts on the sign-in and onboarding screens — where there is no checklist to fetch and
  // the call would only produce a spurious error toast.
  const refresh = useCallback(async () => {
    if (!user) {
      setChecklist(null);
      setLoading(false);
      return;
    }
    setFailed(false);
    try {
      setChecklist(await api.getChecklist());
    } catch (error) {
      setFailed(true);
      toast.fromError(error, "Couldn't load your checklist.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleTask = useCallback(
    async (taskId: string, completed: boolean) => {
      const previous = checklist;
      if (!previous) return;

      // Flip immediately — a checkbox that waits on the network feels broken.
      setChecklist(withTaskCompletion(previous, taskId, completed));

      try {
        await api.setTaskCompleted(taskId, completed);
      } catch (error) {
        setChecklist(previous);
        toast.fromError(error, "Couldn't save that. Try again.");
      }
    },
    [checklist],
  );

  const value = useMemo(
    () => ({ checklist, loading, failed, refresh, toggleTask }),
    [checklist, loading, failed, refresh, toggleTask],
  );

  return <ChecklistContext value={value}>{children}</ChecklistContext>;
}

export function useChecklist(): ChecklistState {
  const context = use(ChecklistContext);
  if (!context) {
    throw new Error("useChecklist must be used inside a ChecklistProvider");
  }
  return context;
}

/** Human-readable section heading, e.g. VISA_IMMIGRATION → "Visa & immigration". */
export function categoryLabel(category: string): string {
  const words = category.toLowerCase().replace(/_/g, " ");
  const sentence = words.charAt(0).toUpperCase() + words.slice(1);
  return sentence
    .replace("Banking money", "Banking & money")
    .replace("Visa immigration", "Visa & immigration");
}

/** Days from today to the due date. Negative means overdue. */
export function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${isoDate}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

/** Short hint under a task title: "Overdue", "Due today", "In 12 days". */
export function dueHint(task: UserChecklistTaskResponse): string | null {
  const days = daysUntil(task.dueDate);
  if (days === null) return null;
  if (days < 0)
    return `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} ago`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 30) return `In ${days} days`;
  const months = Math.round(days / 30);
  return `In about ${months} ${months === 1 ? "month" : "months"}`;
}

/**
 * Amber treatment. Post-arrival tasks are the legally timed ones (ward office is +14), and
 * an overdue task needs attention — but neither is ever red, per the design principle.
 */
export function needsAttention(task: UserChecklistTaskResponse): boolean {
  if (task.completed) return false;
  const days = daysUntil(task.dueDate);
  return task.defaultDueOffsetDays > 0 || (days !== null && days < 0);
}
