import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import {
  focusManager,
  MutationCache,
  type Query,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";
import { AppState, type AppStateStatus } from "react-native";
import { ApiError, api, NotSignedInError, type ReviewRating } from "@/lib/api";
import { toast } from "@/lib/toast";

declare module "@tanstack/react-query" {
  interface Register {
    /** Per-query error copy, so the toast keeps saying what the screen used to say. */
    queryMeta: { errorMessage?: string; silent?: boolean };
    mutationMeta: { errorMessage?: string; silent?: boolean };
  }
}

/**
 * Errors the user must never see as a toast.
 *
 * - 402 is the paywall trigger, not a failure: the caller navigates to /paywall and a
 *   "couldn't reach the server" toast on top of it would be a lie.
 * - NotSignedInError means the session ended mid-request; the router has already moved
 *   the user to sign-in.
 */
function isSilent(error: unknown): boolean {
  if (error instanceof NotSignedInError) return true;
  return error instanceof ApiError && error.requiresPremium;
}

/**
 * Persisted for a week. The cache is what makes the app work on a plane, and a checklist
 * or a deck is still worth showing days later — every one of them carries the date it was
 * generated against, so nothing here goes silently wrong when it is stale.
 */
const PERSIST_MAX_AGE = 7 * 24 * 60 * 60_000;

/** Bump to throw away every persisted cache — after a shape change to any response type. */
const PERSIST_BUSTER = "v1";

export const REVIEW_MUTATION_KEY = ["review"] as const;

/** One notice per replayed batch, not one per rejected card. */
const CAP_NOTICE_INTERVAL = 10_000;
let lastCapNoticeAt = 0;

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    // One place for "a failed fetch tells the user". Screens still render their own inline
    // "Try again" state off `isError`; this is the toast half, which was previously copied
    // into every catch block.
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (isSilent(error) || query.meta?.silent) return;
        toast.fromError(error, query.meta?.errorMessage);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (isSilent(error) || mutation.meta?.silent) return;
        toast.fromError(error, mutation.meta?.errorMessage);
      },
    }),
    defaultOptions: {
      queries: {
        // Long enough that moving between the tabs is instant, short enough that a streak
        // or a due count is never visibly wrong.
        staleTime: 30_000,
        // Must not be shorter than the persisted maxAge, or a restored entry would be
        // collected moments after hydration and the offline screens would empty out.
        gcTime: PERSIST_MAX_AGE,
        retry: (failureCount, error) => {
          // A 4xx is an answer, not a hiccup. Retrying a 402 in particular would delay the
          // paywall by seconds for no reason.
          if (error instanceof NotSignedInError) return false;
          if (error instanceof ApiError && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });

  /*
   * Defaults for the review mutation, keyed rather than inline, because a paused review has
   * to outlive the screen that started it.
   *
   * A rating submitted on a plane is restored from storage on the next launch, when no
   * component has re-registered a mutationFn — without these defaults React Query would
   * have a queued mutation it cannot execute, and the answer would be silently dropped.
   */
  client.setMutationDefaults(REVIEW_MUTATION_KEY, {
    mutationFn: ({
      cardId,
      rating,
    }: {
      cardId: string;
      rating: ReviewRating;
    }) => api.submitReview(cardId, rating),

    // Queue instead of fail. This is the whole offline-study feature: the rating is kept
    // and replayed when there is a connection again.
    networkMode: "offlineFirst",

    onSuccess: () => {
      // The streak, the due counts and the deck progress all moved server-side.
      for (const queryKey of [["due"], ["courses"], ["me"]]) {
        client.invalidateQueries({ queryKey });
      }
    },

    /*
     * Only reached by a REPLAYED rating — while the review screen is open its own onError
     * handles this and opens the paywall.
     *
     * Someone can answer 40 cards on a plane on the free plan; the server takes the first
     * 20 of that day and 402s the rest. 402 is silent everywhere else because it means "go
     * to the paywall", but here it means work quietly disappeared, so say so once. Throttled
     * because a queue of twenty rejections is twenty identical toasts.
     */
    onError: (error) => {
      if (!(error instanceof ApiError && error.requiresPremium)) return;

      const now = Date.now();
      if (now - lastCapNoticeAt < CAP_NOTICE_INTERVAL) return;
      lastCapNoticeAt = now;

      toast.info(
        "Some answers didn't sync",
        "You had already used today's free reviews. Those cards will come round again.",
      );
    },

    meta: { errorMessage: "Couldn't save that answer." },
  });

  return client;
}

/**
 * Writes the cache to AsyncStorage so a cold start with no connection still has a
 * checklist, a deck and a review session to show.
 */
export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "ittekimasu.query-cache",
  // Batches the writes: a review session would otherwise serialise the whole cache on
  // every single card.
  throttleTime: 1000,
});

export const persistOptions = {
  persister,
  maxAge: PERSIST_MAX_AGE,
  buster: PERSIST_BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) => {
      // Premium status is re-read from the server on every launch and gates nothing on its
      // own; a stale copy on disk is the one thing here worth not keeping.
      if (query.queryKey[0] === "entitlement") return false;
      return query.state.status === "success";
    },
  },
};

/**
 * Deletes the persisted cache. Sign-out and account deletion only — the in-memory clear
 * does nothing about the copy sitting on disk, which on a shared phone is the next
 * person's view of someone else's checklist and streak.
 */
export async function clearPersistedCache(): Promise<void> {
  await persister.removeClient();
}

/**
 * React Query's "window focus" is a browser concept. On a phone the equivalent is the app
 * coming back to the foreground — which is exactly when a streak or a due count is most
 * likely to be a day out of date.
 */
export function startAppStateFocusSync(): () => void {
  const subscription = AppState.addEventListener(
    "change",
    (status: AppStateStatus) => {
      focusManager.setFocused(status === "active");
    },
  );
  return () => subscription.remove();
}
