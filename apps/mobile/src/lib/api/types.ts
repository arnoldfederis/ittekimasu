/**
 * The wire shapes of the Spring backend's DTOs. One type per `*Response` record on the
 * server — when a controller's DTO changes, this file is the other half of that change.
 *
 * Kept next to the client that returns them rather than in a global types folder: a
 * response shape and the call that produces it are one thing, and splitting them means
 * every DTO change touches two unrelated directories.
 */

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
  /**
   * Whether onboarding is finished. NOT the same as having a checklist — someone on the
   * study-only path is onboarded with no tasks at all, which is exactly why this exists.
   */
  onboarded: boolean;
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
