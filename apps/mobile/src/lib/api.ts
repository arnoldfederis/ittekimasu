import { getIdToken } from "@/lib/firebase";

/**
 * Every route on the Spring backend is served under /api (see WebMvcConfig), except the
 * Scalar docs. Point EXPO_PUBLIC_API_URL at a LAN IP when running on a physical device —
 * localhost resolves to the phone itself, not your Mac.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api";

/** Thrown for any non-2xx response, so callers can branch on `status`. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ErrorResponse | null;

  constructor(status: number, body: ErrorResponse | null) {
    super(body?.message ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  /** The backend returns 402 when a route needs premium — the paywall trigger. */
  get requiresPremium(): boolean {
    return this.status === 402;
  }
}

export type ErrorResponse = {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  fieldErrors: Record<string, string> | null;
};

export type UserResponse = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  /** Consecutive days with at least one review. Drives the flame on the learn tab. */
  currentStreakDays: number;
  longestStreakDays: number;
  /** 0-23, or null when the daily reminder is off. */
  reminderHour: number | null;
  /** IANA zone the hour is expressed in, e.g. Asia/Tokyo. */
  reminderTimezone: string | null;
};

export type VisaPurpose = "WORK" | "STUDY" | "FAMILY" | "OTHER";

export type ChecklistTemplateSummary = {
  id: string;
  visaType: string;
  country: string;
  purpose: VisaPurpose;
  displayName: string;
  japaneseName: string | null;
  description: string | null;
  /** False for "coming soon" routes: shown in the picker but not selectable. */
  available: boolean;
};

export type ChecklistTaskResponse = {
  id: string;
  category: string;
  title: string;
  /** Days relative to the move date; negative is before, positive is after arrival. */
  defaultDueOffsetDays: number;
};

export type ChecklistTemplateDetail = ChecklistTemplateSummary & {
  tasks: ChecklistTaskResponse[];
};

export type UserChecklistTaskResponse = {
  id: string;
  title: string;
  category: string;
  completed: boolean;
  /** ISO date, e.g. "2026-10-15". */
  dueDate: string | null;
  /** Negative is before the move. Used to flag hard deadlines like the +14 ward office one. */
  defaultDueOffsetDays: number;
};

export type UserChecklistResponse = {
  /** Keyed by category, already in display order — do not re-sort. */
  tasksByCategory: Record<string, UserChecklistTaskResponse[]>;
  completedCount: number;
  totalCount: number;
  /** The template this was generated from — needed to regenerate against a new move date. */
  templateId: string | null;
  visaType: string | null;
  templateDisplayName: string | null;
  targetMoveDate: string | null;
};

export type CourseSummary = {
  id: string;
  title: string;
  topic: string;
  level: string | null;
  description: string | null;
  isPremium: boolean;
  cardCount: number;
};

export type EntitlementResponse = {
  premium: boolean;
  /** ISO instant, or null on the free plan. */
  expiresAt: string | null;
  /** Null means unlimited — never render it as a number without checking. */
  dailyReviewLimit: number | null;
};

export type ReviewRating = "AGAIN" | "HARD" | "GOOD" | "EASY";

/** What each button would schedule, in days. Computed server-side — never recomputed here. */
export type IntervalPreview = Record<Lowercase<ReviewRating>, number>;

export type CardDue = {
  id: string;
  frontText: string;
  /** Already the full answer string, `reading · meaning`. Reveal it, don't assemble it. */
  backText: string;
  cardType: string;
  /** False for a card never shown before — the session labels it "New". */
  seen: boolean;
  intervals: IntervalPreview;
};

export type DueCardsResponse = {
  courseId: string;
  courseTitle: string;
  cards: CardDue[];
  reviewedCardCount: number;
  totalCardCount: number;
  /** Cards reviewed today across every deck. Premium has no cap, so this is the only
   * count the client can show — reviewsRemainingToday is null for them. */
  reviewedToday: number;
  /** Null for premium: unlimited. */
  dailyLimit: number | null;
  /**
   * Zero with an empty `cards` means the free allowance is spent; above zero with an empty
   * `cards` means nothing is due yet. The two need different copy. Null means unlimited.
   */
  reviewsRemainingToday: number | null;
  studyStreakDays: number;
};

export type ReviewResult = {
  cardId: string;
  rating: ReviewRating;
  intervalDays: number;
  nextReviewDate: string;
  easeFactor: number;
  cardStreakCount: number;
  studyStreakDays: number;
  longestStreakDays: number;
  /** Cards reviewed today across every deck, including the one just answered. */
  reviewedToday: number;
  /** Null for premium: unlimited. */
  reviewsRemainingToday: number | null;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Skip the Authorization header. Only the RevenueCat webhook is unauthenticated. */
  anonymous?: boolean;
};

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, anonymous = false } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (!anonymous) {
    const token = await getIdToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      await readJson<ErrorResponse>(response),
    );
  }

  // 204 No Content, as returned by DELETE /users/me.
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export const api = {
  /**
   * Also the account-creation call: the backend creates the user row on first
   * authenticated request, so this must run once after every fresh sign-in.
   */
  getMe: () => request<UserResponse>("/users/me"),

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
