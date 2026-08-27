import { request } from "@/lib/api/client";
import type {
  ChecklistTemplateDetail,
  ChecklistTemplateSummary,
  CourseSummary,
  DueCardsResponse,
  EntitlementResponse,
  ReviewRating,
  ReviewResult,
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

  setTaskCompleted: (taskId: string, completed: boolean) =>
    request<UserChecklistTaskResponse>(`/checklist-tasks/${taskId}`, {
      method: "PATCH",
      body: { completed },
    }),
};
