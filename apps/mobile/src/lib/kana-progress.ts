import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { glyphOf } from "@/constants/kana";
import { api, type KanaProgressItem } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { QuizAnswer } from "@/lib/kana-quiz";
import { usePurchases } from "@/lib/purchases";
import { kanaProgressQuery, queryKeys } from "@/lib/queries";

/**
 * What the kana quiz remembers about each character: how often it was answered, how often
 * correctly, and how long it took.
 *
 * ON THE DEVICE, for everyone. Kana is free — the paywall, the site and the demo all say so —
 * so the thing that makes the quiz worth repeating cannot be a paid feature. It costs the
 * server nothing, and it works on a plane.
 *
 * Pro additionally backs it up (useKanaProgressBackup), so it survives a reinstall or a new
 * phone. The device copy stays the source of truth either way: the chart reads it, and the
 * backup is only ever merged INTO it.
 *
 * Keyed by Firebase uid, like the onboarding cache in lib/auth.tsx, so a second account on a
 * shared phone starts clean instead of inheriting someone else's streak marks.
 */

export type KanaRecord = {
  /** Answers it was right. The chart's streak mark. A wrong answer never takes one away. */
  correct: number;
  attempts: number;
  totalMs: number;
};

/** By glyph — ぢゃ and ヂャ are separate records, because they are separate things to read. */
export type KanaProgress = Readonly<Record<string, KanaRecord>>;

/**
 * How well a character is known, for the progress page.
 *
 * Every step is reached by getting it RIGHT, and none is ever taken away by getting it wrong:
 * the counts only grow, so a character can move up a level and never down. A miss just means
 * it takes longer to climb, which is the same no-punishment rule as the rest of the app.
 *
 * Mastered needs both a run of right answers AND a good ratio, so ten lucky guesses spread
 * over thirty attempts reads as still learning.
 */
export type Mastery = "new" | "practising" | "learning" | "mastered";

export const MASTERED_CORRECT = 5;
export const MASTERED_ACCURACY = 0.8;
export const LEARNING_CORRECT = 2;

export function masteryOf(record: KanaRecord | undefined): Mastery {
  if (!record || record.attempts === 0) return "new";
  const accuracy = record.correct / record.attempts;
  if (record.correct >= MASTERED_CORRECT && accuracy >= MASTERED_ACCURACY) {
    return "mastered";
  }
  if (record.correct >= LEARNING_CORRECT) return "learning";
  return "practising";
}

const EMPTY: KanaProgress = Object.freeze({});

const storageKey = (uid: string) => `ittekimasu.kanaProgress.${uid}`;

type Snapshot = { uid: string | null; progress: KanaProgress };

let snapshot: Snapshot = { uid: null, progress: EMPTY };
/** Resolves once the current uid's stored progress has been read. */
let loaded: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function commit(next: Snapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function isRecord(value: unknown): value is KanaRecord {
  if (typeof value !== "object" || value === null) return false;
  const { correct, attempts, totalMs } = value as Record<string, unknown>;
  return [correct, attempts, totalMs].every(
    (field) =>
      typeof field === "number" && Number.isFinite(field) && field >= 0,
  );
}

/** Anything unreadable is dropped rather than trusted — this is a cache the app wrote. */
function parse(raw: string | null): KanaProgress {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EMPTY;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, record]) => isRecord(record)),
    ) as KanaProgress;
  } catch {
    return EMPTY;
  }
}

/**
 * Starts reading this uid's progress, once per uid.
 *
 * Writes await `loaded` rather than racing it: answers recorded before the stored totals
 * arrive would otherwise be merged against an empty store, and the session's handful of
 * answers would replace the learner's whole history.
 */
function load(uid: string) {
  if (snapshot.uid === uid) return;
  commit({ uid, progress: EMPTY });
  loaded = AsyncStorage.getItem(storageKey(uid))
    .then((raw) => {
      if (snapshot.uid === uid) commit({ uid, progress: parse(raw) });
    })
    .catch(() => {
      // An unreadable store starts empty. Nothing to tell the learner they could act on.
    });
}

function persist(uid: string, progress: KanaProgress) {
  AsyncStorage.setItem(storageKey(uid), JSON.stringify(progress)).catch(() => {
    // The in-memory copy still holds it for this launch; the next save writes it again.
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

/** Adds a session's answers onto the running totals. */
export function applyAnswers(
  progress: KanaProgress,
  answers: QuizAnswer[],
): KanaProgress {
  const next: Record<string, KanaRecord> = { ...progress };
  for (const answer of answers) {
    const glyph = glyphOf(answer.card.entry, answer.card.script);
    const current = next[glyph] ?? { correct: 0, attempts: 0, totalMs: 0 };
    next[glyph] = {
      correct: current.correct + (answer.correct ? 1 : 0),
      attempts: current.attempts + 1,
      totalMs: current.totalMs + Math.round(answer.ms),
    };
  }
  return next;
}

/**
 * The larger of each field, per glyph — the same rule the server applies.
 *
 * Every field only ever grows on a device, so the larger value is always the more complete
 * one, and taking it is safe to repeat: restoring the same backup twice changes nothing.
 * Two phones practising separately keep the better of the two rather than the sum, which is
 * the right trade for a backup whose job is to never lose anything.
 */
export function mergeLargest(a: KanaProgress, b: KanaProgress): KanaProgress {
  const next: Record<string, KanaRecord> = { ...a };
  for (const [glyph, theirs] of Object.entries(b)) {
    const ours = next[glyph];
    next[glyph] = ours
      ? {
          correct: Math.max(ours.correct, theirs.correct),
          attempts: Math.max(ours.attempts, theirs.attempts),
          totalMs: Math.max(ours.totalMs, theirs.totalMs),
        }
      : theirs;
  }
  return next;
}

export function toItems(progress: KanaProgress): KanaProgressItem[] {
  return Object.entries(progress).map(([glyph, record]) => ({
    glyph,
    ...record,
  }));
}

export function fromItems(items: KanaProgressItem[]): KanaProgress {
  return Object.fromEntries(
    items
      .filter((item) => isRecord(item))
      .map(({ glyph, correct, attempts, totalMs }) => [
        glyph,
        { correct, attempts, totalMs },
      ]),
  );
}

async function update(
  uid: string,
  change: (current: KanaProgress) => KanaProgress,
) {
  load(uid);
  await loaded;
  if (snapshot.uid !== uid) return snapshot.progress;
  const next = change(snapshot.progress);
  commit({ uid, progress: next });
  persist(uid, next);
  return next;
}

/**
 * Forgets this device's kana progress for one account.
 *
 * For "Start learning over" and account deletion. Sign-out does NOT call it: the store is
 * per-uid, so signing back in should find the learner's marks where they left them.
 */
export async function clearKanaProgress(uid: string) {
  await AsyncStorage.removeItem(storageKey(uid)).catch(() => {});
  if (snapshot.uid === uid) commit({ uid, progress: EMPTY });
}

/** The signed-in learner's kana progress, from the device. Empty until it has loaded. */
export function useKanaProgress(): KanaProgress {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  useEffect(() => {
    if (uid) load(uid);
  }, [uid]);

  const current = useSyncExternalStore(subscribe, getSnapshot);
  return uid && current.uid === uid ? current.progress : EMPTY;
}

/**
 * Pulls the Pro backup down and folds it into the device copy — what makes a reinstall or a
 * new phone pick up where the last one left off. Mounted by the kana chart, which is where
 * the marks are shown. Does nothing on the free plan.
 */
export function useKanaProgressRestore() {
  const { user } = useAuth();
  const { hasPremium } = usePurchases();
  const uid = user?.uid ?? null;

  const { data } = useQuery({
    ...kanaProgressQuery(),
    enabled: hasPremium && uid !== null,
  });

  useEffect(() => {
    if (uid && data) {
      update(uid, (current) => mergeLargest(current, fromItems(data)));
    }
  }, [uid, data]);
}

/** Where a finished session's progress ended up — shown under the quiz results. */
export type BackupStatus =
  /** Free plan: saved on this phone, which is the whole promise. */
  | "device"
  | "pending"
  /** Pro, offline: saved on the phone, and the backup is waiting for a connection. */
  | "waiting"
  | "saved"
  | "failed";

/**
 * Saves a quiz session: always to the device, and for Pro, once, to the server as well.
 *
 * Once per SESSION rather than once per answer — a quiz of forty kana is one request, not
 * forty. And the whole device snapshot goes up, not just this session's glyphs: the server
 * keeps the larger of each value, so an earlier backup that failed is simply repaired by the
 * next one, with nothing to track in between.
 */
export function useKanaProgressBackup() {
  const { user } = useAuth();
  const { hasPremium } = usePurchases();
  const queryClient = useQueryClient();
  const uid = user?.uid ?? null;

  const backup = useMutation({
    mutationFn: (items: KanaProgressItem[]) => api.syncKanaProgress(items),
    onSuccess: (merged) => {
      queryClient.setQueryData(queryKeys.kanaProgress, merged);
      if (uid)
        update(uid, (current) => mergeLargest(current, fromItems(merged)));
    },
    // Reported as the status line under the results, where it belongs; a toast on top of a
    // results screen reads as the quiz having failed.
    meta: { silent: true },
  });

  // `mutate` is stable across renders; the mutation object around it is not.
  const { mutate: sendBackup } = backup;

  const save = useCallback(
    async (answers: QuizAnswer[]) => {
      if (!uid || answers.length === 0) return;
      const next = await update(uid, (current) =>
        applyAnswers(current, answers),
      );
      if (hasPremium) sendBackup(toItems(next));
    },
    [uid, hasPremium, sendBackup],
  );

  const status: BackupStatus = !hasPremium
    ? "device"
    : backup.isPaused
      ? "waiting"
      : backup.isPending
        ? "pending"
        : backup.isError
          ? "failed"
          : backup.isSuccess
            ? "saved"
            : "pending";

  return { save, status };
}
