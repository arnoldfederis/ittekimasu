import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { Card, CardCaption } from "@/components/card";
import { DisplayPrefsSheet } from "@/components/display-prefs-sheet";
import { SegmentedProgress } from "@/components/segmented-progress";
import { StrokeText } from "@/components/stroke-text";
import { useThemeColors } from "@/constants/theme";
import {
  ApiError,
  api,
  type CardDue,
  type DueCardsResponse,
  type ReviewRating,
} from "@/lib/api";
import { TEXT_SCALE_FACTOR, useCardDisplayPrefs } from "@/lib/display-prefs";
import { useNotifications } from "@/lib/notifications";
import { dueQuery, queryKeys } from "@/lib/queries";
import {
  dropQueuedReview,
  REVIEW_MUTATION_KEY,
  UNDO_MUTATION_KEY,
} from "@/lib/query-client";
import { formatBackText } from "@/lib/romaji";
import {
  applyAudioMode,
  dismissAudioHint,
  getSelectedVoice,
  isSoundEnabled,
  playsInSilentMode,
  setSoundEnabled,
  shouldShowAudioHint,
  speakReading,
  spokenTextOf,
  stopSpeaking,
} from "@/lib/speech";
import { strokeFontSize } from "@/lib/stroke-font";

/**
 * The four ratings, in the order the buttons appear.
 *
 * "Again" is deliberately NOT red. It is a neutral scheduling signal — the learner asked to
 * see the card sooner, not failed a test — and the palette has no red for exactly this
 * reason. Amber, green and teal carry the other three.
 */
const RATINGS: {
  rating: ReviewRating;
  label: string;
  border: string;
  text: string;
}[] = [
  {
    rating: "AGAIN",
    label: "Again",
    border: "border-line",
    text: "text-ink-muted",
  },
  {
    rating: "HARD",
    label: "Hard",
    border: "border-accent",
    text: "text-accent",
  },
  {
    rating: "GOOD",
    label: "Good",
    border: "border-positive",
    text: "text-positive",
  },
  {
    rating: "EASY",
    label: "Easy",
    border: "border-primary",
    text: "text-primary",
  },
];

/**
 * " — the next batch is due in 6 days" or nothing at all.
 *
 * Naming the day is the difference between a deck that looks finished and one that is
 * simply resting.
 */
function describeReturn(nextDueDate: string | null): string {
  if (!nextDueDate) return "";
  const days = Math.round(
    (new Date(`${nextDueDate}T00:00:00`).getTime() -
      new Date().setHours(0, 0, 0, 0)) /
      86_400_000,
  );
  if (days <= 0) return "";
  if (days === 1) return " and the next is due tomorrow";
  return ` and the next batch is due in ${days} days`;
}

/** For the undo label, so it reads "Undo Good" rather than "Undo GOOD". */
const RATING_LABELS: Record<ReviewRating, string> = {
  AGAIN: "Again",
  HARD: "Hard",
  GOOD: "Good",
  EASY: "Easy",
};

/** "1 day" / "6 days" — the interval preview under each rating. */
function formatInterval(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

export default function ReviewScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { promptAfterFirstSession } = useNotifications();
  const queryClient = useQueryClient();

  const [session, setSession] = useState<DueCardsResponse | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [streak, setStreak] = useState(0);
  // Today's total across every deck, not just this sitting. Reopening a session restarts
  // "Card 1 of N", which reads as lost progress unless this is on screen too.
  const [reviewedToday, setReviewedToday] = useState(0);
  const [sound, setSound] = useState(true);
  const [voice, setVoice] = useState<string | null>(null);
  const [audioHint, setAudioHint] = useState(false);
  /**
   * Whether Settings ▸ Voice has "Play even when silent" on.
   *
   * The hint below used to tell everyone to check the ring/silent switch. Once that
   * preference exists the advice is wrong for anyone who has enabled it — they would go
   * hunting for a switch that is already irrelevant.
   */
  const [playsWhenSilent, setPlaysWhenSilent] = useState(false);
  const displayPrefs = useCardDisplayPrefs();
  const [showDisplayPrefs, setShowDisplayPrefs] = useState(false);

  /*
   * Stroke order for the card's front, as on the kana sheet: a toggle on the thing itself,
   * because "how is this written?" is a question you have while looking AT the word.
   *
   * Remembered in the display store, not held here — this screen is a modal, so component
   * state died every time the session was closed.
   */
  const strokeOrder = displayPrefs.strokeOrder;
  const scale = TEXT_SCALE_FACTOR[displayPrefs.textScale];
  /** The answer that can still be taken back, cleared once the next card is rated. */
  const [lastAnswer, setLastAnswer] = useState<{
    cardId: string;
    rating: ReviewRating;
    index: number;
  } | null>(null);

  useEffect(() => {
    isSoundEnabled().then(setSound);
    getSelectedVoice().then(setVoice);
    shouldShowAudioHint().then(setAudioHint);
    playsInSilentMode().then(setPlaysWhenSilent);
    // Set the audio session on entering a session, not at launch: no reason to touch the
    // process-wide category until the app actually intends to make noise.
    applyAudioMode();
  }, []);

  async function hideAudioHint() {
    setAudioHint(false);
    await dismissAudioHint();
  }

  // Leaving mid-word would otherwise keep talking over whatever screen comes next.
  useEffect(() => stopSpeaking, []);

  /*
   * A session is a snapshot, so it is fetched through the cache but then held locally.
   *
   * The learn tab reads this very same cache entry and refetches it whenever it regains
   * focus or the app returns to the foreground. Rendering straight from `data` would let
   * one of those refetches reorder or replace the deck under a learner who is halfway
   * through it; adopting it once is what keeps "Card 4 of 12" meaning what it says.
   */
  const {
    data: due,
    isError: failed,
    isPending,
    fetchStatus,
    refetch,
  } = useQuery({
    ...dueQuery(courseId),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnMount: "always",
  });

  /** Offline with nothing cached for this deck: not loading, and never will be. */
  const waitingOffline = isPending && fetchStatus === "paused";

  const adopted = useRef(false);

  useEffect(() => {
    if (adopted.current || !due) return;
    adopted.current = true;
    setSession(due);
    setStreak(due.studyStreakDays);
    setReviewedToday(due.reviewedToday);
  }, [due]);

  const cards = session?.cards ?? [];
  const card: CardDue | undefined = cards[index];
  const finished = session !== null && index >= cards.length;

  /*
   * Ask for notifications here and nowhere else. The user has just finished a session, so
   * "remind you tomorrow" is an obvious yes; asking on launch, before the app has shown any
   * value, is how opt-in rates get halved. The provider makes sure it only ever fires once.
   */
  useEffect(() => {
    if (finished && reviewed > 0) {
      promptAfterFirstSession();
    }
  }, [finished, reviewed, promptAfterFirstSession]);

  const close = useCallback(() => router.back(), []);

  const submit = useMutation({
    // The key carries the offline defaults from lib/query-client: networkMode
    // "offlineFirst", so a rating with no connection is queued rather than lost, and a
    // mutationFn that can replay it after the app has been killed and relaunched.
    mutationKey: REVIEW_MUTATION_KEY,
    mutationFn: ({
      cardId,
      rating,
    }: {
      cardId: string;
      rating: ReviewRating;
    }) => api.submitReview(cardId, rating),

    /*
     * Move to the next card here rather than in onSuccess.
     *
     * Offline the request is paused, so onSuccess may not run for hours — waiting for it
     * would freeze the session on one card, which is exactly the plane case this exists
     * for. The counters below are the optimistic version; onSuccess replaces them with
     * whatever the server actually recorded.
     */
    onMutate: () => {
      setReviewed((count) => count + 1);
      setReviewedToday((count) => count + 1);
      setRevealed(false);
      setIndex((current) => current + 1);
    },

    onSuccess: (result) => {
      setStreak(result.studyStreakDays);
      setReviewedToday(result.reviewedToday);

      /*
       * An inline onSuccess REPLACES the one in setMutationDefaults, so without this a live
       * session invalidates nothing at all. The learn and profile tabs hid it by
       * invalidating on focus; the seen-cards list and the study grid have no such cover and
       * were simply stale.
       *
       * Not the due queries: this screen holds its own snapshot and the learn tab refreshes
       * on focus, so refetching a session mid-session is work with nothing to show for it.
       */
      queryClient.invalidateQueries({ queryKey: queryKeys.seenCards });
      queryClient.invalidateQueries({ queryKey: queryKeys.studyDays });
    },

    onError: (error) => {
      if (error instanceof ApiError && error.requiresPremium) {
        // End the session before opening the paywall: leaving cards on screen would invite
        // taps that can only fail again.
        setIndex(cards.length);
        router.push("/paywall");
      }
      // Any other failure keeps the session moving. The server never recorded the answer,
      // so the card is still scheduled and comes back in the next session — rewinding the
      // deck under someone who has already read the next card is worse than repeating it.
    },

    meta: { errorMessage: "Couldn't save that answer." },
  });

  const rate = useCallback(
    (rating: ReviewRating) => {
      // Deliberately not gated on isPending: offline every rating stays pending until there
      // is a connection, and gating would let one card lock the whole session.
      if (!card) return;
      setLastAnswer({ cardId: card.id, rating, index });
      submit.mutate({ cardId: card.id, rating });
    },
    [card, index, submit],
  );

  /**
   * Takes back the answer just given and puts the card back on screen.
   *
   * Four buttons sit side by side under a thumb and the app deliberately never asks "are you
   * sure?" — so the way to make an honest rating feel safe is to make a wrong one
   * reversible. Offline it is a no-op: the rating itself has not reached the server yet.
   */
  const undo = useMutation({
    // Keyed, so a DELETE queued with no connection can still be replayed after the app has
    // been killed. Unkeyed it rehydrated with no mutationFn and was silently dropped — while
    // the rating it was undoing replayed fine, because THAT one was keyed.
    mutationKey: UNDO_MUTATION_KEY,
    mutationFn: ({ cardId }: { cardId: string }) => api.undoReview(cardId),

    onSettled: () => {
      // Whether or not the server had something to take back, the card's state moved.
      queryClient.invalidateQueries({ queryKey: queryKeys.seenCards });
    },

    meta: { silent: true },
  });

  /**
   * Takes back the answer just given and puts the card back on screen.
   *
   * Four buttons sit side by side under a thumb and the app deliberately never asks "are you
   * sure?" — so the way to make an honest rating feel safe is to make a wrong one
   * reversible. That has to hold with no connection too, which is exactly when someone is
   * rating fast and misses.
   *
   * The rollback is local and unconditional. It used to live in the mutation's onMutate,
   * which tied taking back a tap to a request that may not run for hours.
   */
  const undoLastAnswer = useCallback(() => {
    if (!lastAnswer) return;

    setIndex(lastAnswer.index);
    // Revealed, because the learner has already seen this answer — hiding it again would
    // make them tap through a card they were in the middle of correcting.
    setRevealed(true);
    setReviewed((count) => Math.max(0, count - 1));
    setReviewedToday((count) => Math.max(0, count - 1));

    // Say it again. The card is back on screen mid-correction, and hearing the reading is
    // most of what the reveal is for.
    const restored = cards[lastAnswer.index];
    if (sound && restored) {
      speakReading(spokenTextOf(restored.frontText, restored.backText), voice);
    }

    /*
     * If the rating is still in the offline queue, the server has never heard of it — so
     * dropping the queued POST *is* the undo. Sending a DELETE instead would 404 against a
     * review that was never created, and leave the POST in place to replay the moment a
     * connection returned, re-answering the card behind the learner's back.
     */
    if (!dropQueuedReview(queryClient, lastAnswer.cardId)) {
      undo.mutate({ cardId: lastAnswer.cardId });
    }

    setLastAnswer(null);
  }, [lastAnswer, cards, sound, voice, queryClient, undo]);

  const header = (
    <View className="flex-row items-center justify-between px-4 pb-2">
      {/*
        Inside the header so it travels with it: this screen returns from several branches
        (loading, failed, finished, the session itself) and the header is the one thing all
        of them render. A Modal draws into its own hierarchy, so where it sits in the tree
        costs nothing.
      */}
      <DisplayPrefsSheet
        onClose={() => setShowDisplayPrefs(false)}
        scope="cards"
        visible={showDisplayPrefs}
      />

      <Pressable
        accessibilityLabel="Close review"
        accessibilityRole="button"
        className="h-10 w-10 items-center justify-center rounded-pill active:bg-surface-sunken"
        onPress={close}
      >
        <Image
          source="sf:xmark"
          style={{ width: 18, height: 18 }}
          tintColor={colors.inkMuted}
        />
      </Pressable>

      <View className="flex-row items-center gap-3">
        {/*
          Display settings ARE worth changing mid-session, and that is a reversal.
          They used to live only in Settings ▸ Display, on the argument that a change should
          be previewed against a card first. In practice the card is right here and the
          setting was four taps and two screens away, so wanting bigger type mid-session
          meant abandoning the session — the preview was worth less than the round trip cost.
          The sheet opens OVER the card, which previews it better than the settings page can.
        */}
        <View className="flex-row items-center">
          <Pressable
            accessibilityHint="Shows how the word is written, stroke by stroke"
            accessibilityLabel="Stroke order"
            accessibilityRole="button"
            accessibilityState={{ selected: strokeOrder }}
            className="h-10 w-10 items-center justify-center rounded-pill active:bg-surface-sunken"
            onPress={() => displayPrefs.setStrokeOrder(!strokeOrder)}
          >
            <Image
              source={strokeOrder ? "sf:hand.draw.fill" : "sf:hand.draw"}
              style={{ width: 18, height: 18 }}
              tintColor={strokeOrder ? colors.primary : colors.inkMuted}
            />
          </Pressable>

          <Pressable
            accessibilityHint="Text size and romaji readings"
            accessibilityLabel="Display settings"
            accessibilityRole="button"
            className="h-10 w-10 items-center justify-center rounded-pill active:bg-surface-sunken"
            onPress={() => setShowDisplayPrefs(true)}
          >
            <Image
              source="sf:textformat.size"
              style={{ width: 18, height: 18 }}
              tintColor={colors.inkMuted}
            />
          </Pressable>
        </View>

        <View className="flex-row items-center">
          <Pressable
            accessibilityLabel={
              sound ? "Mute pronunciation" : "Unmute pronunciation"
            }
            accessibilityRole="button"
            className="h-10 w-10 items-center justify-center rounded-pill active:bg-surface-sunken"
            onPress={async () => {
              const next = !sound;
              setSound(next);
              await setSoundEnabled(next);
            }}
          >
            <Image
              source={sound ? "sf:speaker.wave.2" : "sf:speaker.slash"}
              style={{ width: 18, height: 18 }}
              tintColor={colors.inkMuted}
            />
          </Pressable>
        </View>

        <Image
          source="sf:flame.fill"
          style={{ width: 18, height: 18 }}
          tintColor={colors.accent}
        />
        <Text
          className="font-semibold text-callout text-ink"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {streak}
        </Text>
      </View>
    </View>
  );

  if (session === null || failed) {
    return (
      <View className="flex-1 bg-canvas" style={{ paddingTop: 8 }}>
        {header}
        {waitingOffline ? (
          // A paused query never resolves, so the spinner below would run until the
          // connection came back. This deck has simply never been opened online.
          <View className="gap-3 px-4 pt-8">
            <Card tone="sunken">
              <Text className="text-body text-ink">
                This deck isn&apos;t saved on your device yet.
              </Text>
              <CardCaption>
                Open it once with a connection and the cards will be here next
                time, plane or no plane.
              </CardCaption>
            </Card>
          </View>
        ) : failed ? (
          <View className="gap-3 px-4 pt-8">
            <Card tone="sunken">
              <Text className="text-body text-ink">
                Couldn&apos;t reach the server.
              </Text>
              <View className="pt-3">
                <Button
                  onPress={() => refetch()}
                  title="Try again"
                  variant="secondary"
                />
              </View>
            </Card>
          </View>
        ) : (
          <ActivityIndicator className="py-12" />
        )}
      </View>
    );
  }

  if (finished) {
    return (
      <SessionComplete
        courseTitle={session.courseTitle}
        header={header}
        insetTop={8}
        limitReached={session.reviewsRemainingToday === 0}
        nextDueDate={session.nextDueDate}
        onClose={close}
        pacedOut={
          session.unseenCardCount > 0 && session.newCardsRemainingToday === 0
        }
        reviewed={reviewed}
        reviewedToday={reviewedToday}
        /*
         * What is left in the deck AFTER the cards just answered.
         *
         * Derived rather than refetched: `session` is the snapshot taken when the screen
         * opened, so its `newCardsRemainingToday` still reads ten after all ten have been
         * met. The cards with `seen: false` ARE today's intake, so subtracting them from the
         * deck's unseen count gives what tomorrow holds without another request.
         *
         * The end of a session is exactly when "why was that only ten cards?" occurs, and
         * until now that question was answered only when the session had been empty to begin
         * with.
         */
        stillToLearn={Math.max(
          session.unseenCardCount - cards.filter((c) => !c.seen).length,
          0,
        )}
        streak={streak}
        wasEmpty={cards.length === 0}
      />
    );
  }

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: 8 }}>
      {header}

      {/*
        `index + 1`, not `index`: the bar marks the card you are ON, which is what the
        "Card N of M" line underneath already says.

        Passing `index` measured cards ANSWERED instead, and the two disagreed at both ends
        of every session — card 1 of 20 sat beside an empty bar, and the last card left a
        grey segment that read as one more question waiting. It never filled: answering it
        flips `finished`, and the summary replaces this bar before it could render full. The
        last segment therefore looked like a step the session skipped.
      */}
      <SegmentedProgress current={index + 1} total={cards.length} />

      {/*
        iOS silences speech when the ring/silent switch is on, with no error and no way for
        the app to detect it — the learner just gets nothing and assumes the feature is
        broken. Shown once, then dismissed for good.
      */}
      {audioHint && sound ? (
        <Pressable
          accessibilityHint="Dismisses this tip"
          accessibilityRole="button"
          className="mx-4 mb-2 flex-row items-center gap-2 rounded-button bg-surface-sunken px-3 py-2"
          onPress={hideAudioHint}
        >
          <Image
            source="sf:speaker.wave.2"
            style={{ width: 14, height: 14 }}
            tintColor={colors.inkMuted}
          />
          <Text className="flex-1 text-caption text-ink-muted">
            {playsWhenSilent
              ? "Readings are spoken aloud. If you hear nothing, check your volume."
              : "Readings are spoken aloud. If you hear nothing, check your phone isn't on silent, or turn on Play even when silent in Settings ▸ Voice."}
          </Text>
          <Image
            source="sf:xmark"
            style={{ width: 12, height: 12 }}
            tintColor={colors.inkSubtle}
          />
        </Pressable>
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
      >
        <Pressable
          accessibilityHint={revealed ? undefined : "Shows the answer"}
          accessibilityRole="button"
          className="mx-4 items-center gap-5 rounded-card bg-surface px-5 py-10"
          disabled={revealed}
          onPress={() => {
            setRevealed(true);
            if (sound)
              speakReading(
                spokenTextOf(card?.frontText, card?.backText),
                voice,
              );
          }}
          style={{ borderCurve: "continuous" }}
        >
          {!card?.seen ? (
            <View className="rounded-pill bg-primary-tint px-2 py-0.5">
              <Text className="font-semibold text-caption text-primary">
                NEW
              </Text>
            </View>
          ) : null}

          {/*
            Sized from the type scale rather than the class, so the display setting multiplies
            it. The ratio to the back text below is preserved, which is what keeps the card
            looking like itself at every size.

            Stroke order is drawn much larger than the plain word, and scrolls rather than
            shrinking: the numbers stop being legible somewhere near 100pt, so fitting a long
            word to the card width would render the one thing the toggle exists to show as
            specks. Reading the word is not the job here — reading its strokes is.
          */}
          {strokeOrder ? (
            <View
              className="w-full"
              style={{ height: strokeFontSize(scale) * 1.25 }}
            >
              <StrokeText
                color={colors.ink}
                size={strokeFontSize(scale)}
                text={card?.frontText ?? ""}
              />
            </View>
          ) : (
            <Text
              className="text-center font-semibold text-ink"
              style={{ fontSize: 34 * scale, lineHeight: 34 * scale * 1.2 }}
            >
              {card?.frontText}
            </Text>
          )}

          {revealed ? (
            <Animated.View
              className="w-full items-center gap-5"
              entering={FadeIn.duration(160)}
            >
              <View className="h-px w-16 bg-line" />
              <View className="flex-row items-center gap-3">
                {/*
                  The reading is transliterated when the learner has asked for romaji —
                  おとこ · man becomes otoko · man. Display only: what gets SPOKEN is always
                  the kana, because a Japanese voice reading "otoko" pronounces an English
                  word.
                */}
                <Text
                  className="flex-shrink text-center text-ink"
                  style={{ fontSize: 22 * scale, lineHeight: 22 * scale * 1.3 }}
                >
                  {formatBackText(
                    card?.backText ?? "",
                    displayPrefs.showRomaji,
                  )}
                </Text>
                {spokenTextOf(card?.frontText, card?.backText) ? (
                  <Pressable
                    accessibilityLabel="Play pronunciation"
                    accessibilityRole="button"
                    className="h-9 w-9 items-center justify-center rounded-pill active:bg-surface-sunken"
                    onPress={() =>
                      speakReading(
                        spokenTextOf(card?.frontText, card?.backText),
                        voice,
                      )
                    }
                  >
                    <Image
                      source="sf:speaker.wave.2.fill"
                      style={{ width: 18, height: 18 }}
                      tintColor={colors.primary}
                    />
                  </Pressable>
                ) : null}
              </View>
            </Animated.View>
          ) : (
            <CardCaption>Tap to reveal</CardCaption>
          )}
        </Pressable>
      </ScrollView>

      <View
        className="gap-3 px-4 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        {/*
          Outside the revealed branch on purpose: rating a card hides the answer and moves
          on, so an undo that only appeared after flipping the NEXT card would arrive a beat
          too late to be the thing you reach for.
        */}
        {lastAnswer ? (
          <Pressable
            accessibilityLabel={`Undo ${lastAnswer.rating.toLowerCase()}`}
            accessibilityRole="button"
            className="mb-2 flex-row items-center justify-center gap-1.5 self-center rounded-pill px-3 py-1 active:bg-surface-sunken"
            onPress={undoLastAnswer}
          >
            <Image
              source="sf:arrow.uturn.backward"
              style={{ width: 13, height: 13 }}
              tintColor={colors.inkMuted}
            />
            <Text className="text-caption text-ink-muted">
              Undo {RATING_LABELS[lastAnswer.rating]}
            </Text>
          </Pressable>
        ) : null}

        {revealed ? (
          <Animated.View className="gap-2" entering={FadeIn.duration(160)}>
            {/*
              Users read four coloured buttons as a grade out of four. They are not a score:
              the only thing they change is when the card comes back, and the number under
              each one already says exactly when. Saying so removes the "am I being marked?"
              hesitation that makes people rate dishonestly.
            */}
            <Text className="text-center text-caption text-ink-subtle">
              How well did you recall it? This only sets when you&apos;ll see it
              again.
            </Text>

            <View className="flex-row gap-2">
              {RATINGS.map(({ rating, label, border, text }) => (
                <RatingButton
                  border={border}
                  // Not gated on the request: offline it never settles, and a locked row of
                  // buttons is exactly the session-freeze this feature exists to avoid.
                  disabled={!card}
                  interval={
                    card?.intervals[
                      rating.toLowerCase() as Lowercase<ReviewRating>
                    ]
                  }
                  key={rating}
                  label={label}
                  onPress={() => rate(rating)}
                  text={text}
                />
              ))}
            </View>
          </Animated.View>
        ) : (
          // Reserves the row's height so revealing the answer doesn't shift the card upward.
          <View className="h-16" />
        )}

        <Text className="text-center text-caption text-ink-subtle">
          Card {Math.min(index + 1, cards.length)} of {cards.length} ·{" "}
          {reviewedToday} reviewed today
        </Text>
      </View>
    </View>
  );
}

/** One segment per card, filled as the session moves through them. */
/**
 * Two lines: the rating, and what it schedules. Showing the interval on every button rather
 * than only the highlighted one is the touch equivalent of the same idea — there is no hover
 * state to reveal it, and seeing all four is what makes honest self-rating feel safe.
 */
function RatingButton({
  label,
  interval,
  border,
  text,
  disabled,
  onPress,
}: {
  label: string;
  interval: number | undefined;
  border: string;
  text: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={
        interval === undefined
          ? label
          : `${label}, next review in ${formatInterval(interval)}`
      }
      accessibilityRole="button"
      className={`h-16 flex-1 items-center justify-center gap-0.5 rounded-button border bg-surface ${border} ${
        disabled ? "opacity-50" : "active:bg-surface-sunken"
      }`}
      disabled={disabled}
      onPress={onPress}
      style={{ borderCurve: "continuous" }}
    >
      <Text className={`font-semibold text-callout ${text}`}>{label}</Text>
      {interval === undefined ? null : (
        <Text className="text-caption text-ink-subtle">
          {formatInterval(interval)}
        </Text>
      )}
    </Pressable>
  );
}

function SessionComplete({
  header,
  insetTop,
  courseTitle,
  reviewed,
  reviewedToday,
  streak,
  wasEmpty,
  limitReached,
  nextDueDate,
  pacedOut,
  stillToLearn,
  onClose,
}: {
  header: React.ReactNode;
  insetTop: number;
  courseTitle: string;
  reviewed: number;
  reviewedToday: number;
  streak: number;
  wasEmpty: boolean;
  limitReached: boolean;
  /** ISO date this deck's next card is due, if anything here has been reviewed. */
  nextDueDate: string | null;
  /** Today's intake of new cards is spent, but the deck still holds unseen ones. */
  pacedOut: boolean;
  /** Cards in this deck not yet met, counting the ones just answered as met. */
  stillToLearn: number;
  onClose: () => void;
}) {
  const colors = useThemeColors();

  // Three different endings, and they are not interchangeable: nothing due is a win, the
  // daily cap is an upsell, and a finished session is a celebration.
  const title = wasEmpty
    ? limitReached
      ? "That's today's reviews"
      : pacedOut
        ? "That's today's new cards"
        : "Nothing due right now"
    : "Session complete";

  const body = wasEmpty
    ? limitReached
      ? "You've used today's free reviews. They reset tomorrow."
      : pacedOut
        ? "A fresh batch arrives tomorrow. Meeting a handful of new cards a day is what makes them stick — a hundred at once is cramming, and cramming fades."
        : `Every ${courseTitle} card is scheduled ahead${describeReturn(nextDueDate)}. Spacing them out is what makes them stick.`
    : /*
       * A finished session has to account for its own length. Ten cards out of a deck of
       * fifty-five looks like the deck withholding what was paid for unless the count of
       * what is coming is right here — which is the moment the question gets asked, not the
       * next time the learn tab happens to be open.
       */
      `${reviewed} ${reviewed === 1 ? "card" : "cards"} this session, ${reviewedToday} today. Every one is scheduled to come back at the right moment.${
        stillToLearn > 0
          ? ` ${stillToLearn} more in this deck are waiting — a few new ones a day is what makes them stick.`
          : ""
      }`;

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insetTop }}>
      {header}

      <View className="flex-1 justify-center gap-6 px-4">
        <View className="items-center gap-4">
          <Image
            source="sf:flame.fill"
            style={{ width: 56, height: 56 }}
            tintColor={colors.accent}
          />
          <Text className="text-center font-semibold text-ink text-title">
            {title}
          </Text>
          <Text className="text-center text-body text-ink-muted">{body}</Text>
        </View>

        <Card tone="accent">
          <View className="flex-row items-center justify-between">
            <Text className="text-body text-ink">Day streak</Text>
            <Text
              className="font-semibold text-heading text-ink"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {streak}
            </Text>
          </View>
        </Card>

        <Button onPress={onClose} title="Done" variant="primary" />
      </View>
    </View>
  );
}
