import { request } from "@/lib/api/client";
import type {
  ChecklistTemplateDetail,
  ChecklistTemplateSummary,
  CourseSummary,
  DueCardsResponse,
  EntitlementResponse,
  KanaProgressItem,
  ReviewRating,
  ReviewResult,
  SeenCard,
  StudyDay,
  UserChecklistResponse,
  UserChecklistTaskResponse,
  UserResponse,
  VisaPurpose,
} from "@/lib/api/types";

/**
 * One function per backend route, and nothing else — no caching, no error copy, no state.
 * React Query owns all of that (see lib/queries.ts), which is what keeps these callable
 * from a queryFn, a mutationFn and a plain imperative path alike.
 */
export const api = {
  /**
   * Also the account-creation call: the backend creates the user row on first
   * authenticated request, so this must run once after every fresh sign-in.
   */
  getMe: () => request<UserResponse>("/users/me"),

  /**
   * Finishes onboarding without adopting a checklist. Building one does this too, so this
   * is only for the "just here for the language" path.
   */
  completeOnboarding: () =>
    request<UserResponse>("/users/me/onboarding", { method: "POST" }),

  /** The days behind the profile's study grid — roughly the last twenty weeks. */
  getStudyDays: () => request<StudyDay[]>("/users/me/study-days"),

  /** Every card the learner has answered, for the seen-cards browser. */
  getSeenCards: () => request<SeenCard[]>("/users/me/cards"),

  /** The kana quiz backup, to restore onto a new install. Pro only; 402 otherwise. */
  getKanaProgress: () => request<KanaProgressItem[]>("/users/me/kana-progress"),

  /**
   * Backs up the device's kana progress. Sends running totals, and the server keeps the
   * larger of each, so sending the same snapshot twice — a retry, or a replay after the app
   * comes back online — changes nothing. Returns the merged whole. Pro only; 402 otherwise.
   */
  syncKanaProgress: (items: KanaProgressItem[]) =>
    request<KanaProgressItem[]>("/users/me/kana-progress", {
      method: "PATCH",
      body: { items },
    }),

  /**
   * Changes the answer already recorded for one card. A correction, not a review: it spends
   * no daily allowance, and pressing the same button twice lands on the same schedule.
   */
  correctCardRating: (cardId: string, rating: ReviewRating) =>
    request<SeenCard>(`/users/me/cards/${cardId}`, {
      method: "PATCH",
      body: { rating },
    }),

  /**
   * Forgets a card: back to unseen, taught again from scratch. Distinct from undoReview,
   * which takes back one answer.
   */
  forgetCard: (cardId: string) =>
    request<void>(`/users/me/cards/${cardId}`, { method: "DELETE" }),

  /**
   * Re-rates every seen card, optionally within one deck. Maintenance, not study: it spends
   * no daily allowance and moves no streak.
   */
  rateAllCards: (rating: ReviewRating, courseId?: string) =>
    request<{ affected: number }>("/users/me/cards", {
      method: "PATCH",
      body: { rating, courseId: courseId ?? null },
    }),

  /** Forgets every seen card, optionally within one deck. */
  forgetAllCards: (courseId?: string) =>
    request<{ affected: number }>(
      courseId ? `/users/me/cards?courseId=${courseId}` : "/users/me/cards",
      { method: "DELETE" },
    ),

  /**
   * Starts learning over: every card unseen, streak zeroed, study grid cleared. Distinct
   * from forgetAllCards, which is deck maintenance and leaves the record of days studied.
   */
  resetProgress: () =>
    request<{ affected: number }>("/users/me/progress", { method: "DELETE" }),

  /** Required by App Store review guideline 5.1.1(v). */
  deleteMe: () => request<void>("/users/me", { method: "DELETE" }),

  /**
   * The authoritative premium check. The RevenueCat SDK answers faster locally, but only
   * this one matches what the API will actually let the user do.
   */
  getEntitlement: () => request<EntitlementResponse>("/users/me/entitlement"),

  /** A null hour switches the daily reminder off. */
  updateReminders: (
    reminderHour: number | null,
    reminderTimezone: string | null,
  ) =>
    request<UserResponse>("/users/me/reminders", {
      method: "PATCH",
      body: { reminderHour, reminderTimezone },
    }),

  /** Includes unavailable templates — the picker greys them out rather than hiding them. */
  getTemplates: (purpose?: VisaPurpose) =>
    request<ChecklistTemplateSummary[]>(
      purpose ? `/templates?purpose=${purpose}` : "/templates",
    ),

  getTemplate: (visaType: string) =>
    request<ChecklistTemplateDetail>(`/templates/${visaType}`),

  /** Adopts a template. Re-running replaces any existing checklist. */
  createChecklist: (templateId: string, targetMoveDate: string) =>
    request<UserChecklistResponse>("/users/me/checklist", {
      method: "POST",
      body: { templateId, targetMoveDate },
    }),

  getChecklist: (category?: string) =>
    request<UserChecklistResponse>(
      category
        ? `/users/me/checklist?category=${category}`
        : "/users/me/checklist",
    ),

  /** Includes premium courses — the learn tab dims them rather than hiding them. */
  getCourses: (topic?: string) =>
    request<CourseSummary[]>(topic ? `/courses?topic=${topic}` : "/courses"),

  /** A review session for one deck: due cards first, then new ones, capped for free users. */
  getDueCards: (courseId: string) =>
    request<DueCardsResponse>(`/courses/${courseId}/due`),

  /** Throws an ApiError with `requiresPremium` once the daily allowance is spent. */
  submitReview: (cardId: string, rating: ReviewRating) =>
    request<ReviewResult>(`/reviews/${cardId}`, {
      method: "POST",
      body: { rating },
    }),

  /**
   * Takes back the last answer for one card. 404 when there is nothing to undo, which the
   * review screen treats as "the moment has passed" rather than an error worth a toast.
   */
  undoReview: (cardId: string) =>
    request<void>(`/reviews/${cardId}`, { method: "DELETE" }),

  setTaskCompleted: (taskId: string, completed: boolean) =>
    request<UserChecklistTaskResponse>(`/checklist-tasks/${taskId}`, {
      method: "PATCH",
      body: { completed },
    }),
};
