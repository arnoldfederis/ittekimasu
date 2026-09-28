import {
  type QueryKey,
  queryOptions,
  useQueryClient,
} from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { api, type VisaPurpose } from "@/lib/api";

/**
 * Every cache key in the app, in one place.
 *
 * Shared keys are the point: the learn tab, the profile tab and the notifications provider
 * all want GET /users/me, and with one key that is one request instead of three. It is also
 * what lets a mutation say "the checklist changed" without knowing who is reading it.
 */
export const queryKeys = {
  me: ["me"] as const,
  entitlement: ["entitlement"] as const,
  checklist: ["checklist"] as const,
  courses: ["courses"] as const,
  studyDays: ["study-days"] as const,
  seenCards: ["seen-cards"] as const,
  kanaProgress: ["kana-progress"] as const,
  templates: (purpose?: VisaPurpose) =>
    ["templates", purpose ?? "all"] as const,
  due: (courseId: string) => ["due", courseId] as const,
};

export const meQuery = () =>
  queryOptions({
    queryKey: queryKeys.me,
    queryFn: () => api.getMe(),
    meta: { errorMessage: "Couldn't load your profile." },
  });

export const entitlementQuery = () =>
  queryOptions({
    queryKey: queryKeys.entitlement,
    queryFn: () => api.getEntitlement(),
    // Every gate is enforced server-side anyway, so a failure here is not worth a toast —
    // it would fire on the paywall, mid-purchase, where it reads as "your payment broke".
    meta: { silent: true },
  });

export const studyDaysQuery = () =>
  queryOptions({
    queryKey: queryKeys.studyDays,
    queryFn: () => api.getStudyDays(),
    // The grid is decoration on a screen that already works; a failure here is not worth
    // interrupting someone's profile over.
    meta: { silent: true },
  });

/**
 * The Pro backup of the kana quiz, read so a new install can restore it. Silent: the device
 * copy is what the chart shows, so a failed restore costs nothing the learner can act on.
 */
export const kanaProgressQuery = () =>
  queryOptions({
    queryKey: queryKeys.kanaProgress,
    queryFn: () => api.getKanaProgress(),
    meta: { silent: true },
  });

export const seenCardsQuery = () =>
  queryOptions({
    queryKey: queryKeys.seenCards,
    queryFn: () => api.getSeenCards(),
    meta: { errorMessage: "Couldn't load your cards." },
  });

export const checklistQuery = () =>
  queryOptions({
    queryKey: queryKeys.checklist,
    queryFn: () => api.getChecklist(),
    meta: { errorMessage: "Couldn't load your checklist." },
  });

export const coursesQuery = () =>
  queryOptions({
    queryKey: queryKeys.courses,
    queryFn: () => api.getCourses(),
    meta: { errorMessage: "Couldn't load your courses." },
  });

export const templatesQuery = (purpose?: VisaPurpose) =>
  queryOptions({
    queryKey: queryKeys.templates(purpose),
    queryFn: () => api.getTemplates(purpose),
    // Templates change only when a migration adds a visa route, so re-asking during one
    // walk through onboarding is pure latency.
    staleTime: 60 * 60_000,
    meta: { errorMessage: "Couldn't load visa routes." },
  });

export const dueQuery = (courseId: string) =>
  queryOptions({
    queryKey: queryKeys.due(courseId),
    queryFn: () => api.getDueCards(courseId),
    meta: { errorMessage: "Couldn't load your review session." },
  });

/**
 * Marks queries stale when a screen regains focus, so the refetch happens on the way back
 * from a review session rather than leaving a stale "Review 12 cards" button behind.
 *
 * `refetchType: "active"` keeps this to what is actually mounted — invalidating the whole
 * cache on every focus would refetch decks nobody is looking at.
 */
export function useInvalidateOnFocus(keys: QueryKey[]) {
  const queryClient = useQueryClient();
  const serialized = JSON.stringify(keys);

  useFocusEffect(
    useCallback(() => {
      for (const queryKey of JSON.parse(serialized) as QueryKey[]) {
        queryClient.invalidateQueries({ queryKey, refetchType: "active" });
      }
      // Serialized so a caller can pass an inline array without re-firing every render.
    }, [queryClient, serialized]),
  );
}
