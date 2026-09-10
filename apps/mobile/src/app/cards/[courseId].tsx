import { MenuView } from "@react-native-menu/menu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Button } from "@/components/button";
import { Card, CardCaption } from "@/components/card";
import { useOfflineBannerClearance } from "@/components/offline-banner";
import { useThemeColors } from "@/constants/theme";
import { api, type ReviewRating, type SeenCard } from "@/lib/api";
import { daysUntil } from "@/lib/checklist";
import { useDisplayPrefs } from "@/lib/display-prefs";
import { useIsOnline } from "@/lib/network";
import { queryKeys, seenCardsQuery, useInvalidateOnFocus } from "@/lib/queries";
import { formatBackText } from "@/lib/romaji";
import { toast } from "@/lib/toast";

const RATINGS: {
  rating: ReviewRating;
  label: string;
  text: string;
  /** SF Symbol for the native menu row. */
  symbol: string;
}[] = [
  {
    rating: "AGAIN",
    label: "Again",
    text: "text-ink-muted",
    symbol: "arrow.counterclockwise",
  },
  { rating: "HARD", label: "Hard", text: "text-accent", symbol: "tortoise" },
  { rating: "GOOD", label: "Good", text: "text-positive", symbol: "checkmark" },
  { rating: "EASY", label: "Easy", text: "text-primary", symbol: "hare" },
];

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "AGAIN", label: "Again" },
  { key: "HARD", label: "Hard" },
  { key: "GOOD", label: "Good" },
  { key: "EASY", label: "Easy" },
] as const;

type Filter = (typeof FILTERS)[number]["key"];

function ratingLabel(rating: ReviewRating | null): string {
  return RATINGS.find((entry) => entry.rating === rating)?.label ?? "Unrated";
}

function ratingColour(rating: ReviewRating | null): string {
  return (
    RATINGS.find((entry) => entry.rating === rating)?.text ?? "text-ink-subtle"
  );
}

/** "due today" / "back in 6 days" — where this card stands, in words. */
function describeDue(nextReviewDate: string): string {
  const days = daysUntil(nextReviewDate);
  if (days === null) return "";
  if (days < 0) return "due now";
  if (days === 0) return "due today";
  if (days === 1) return "back tomorrow";
  return `back in ${days} days`;
}

function formatDays(days: number): string {
  return days === 1 ? "1d" : `${days}d`;
}

/**
 * One deck's seen cards, with the two fixes for an answer noticed too late: change the
 * difficulty, or forget the card so it is taught again from scratch.
 *
 * A FlatList, not a ScrollView: a finished kana deck is 104 rows and every one of them was
 * being mounted at once.
 */
export default function DeckCardsScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const colors = useThemeColors();
  const online = useIsOnline();
  const queryClient = useQueryClient();
  const bannerClearance = useOfflineBannerClearance();
  // Settings ▸ Display owns this for the whole app; the browser has no control of its own.
  const { showRomaji } = useDisplayPrefs();

  const [filter, setFilter] = useState<Filter>("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: allCards = [], isPending } = useQuery(seenCardsQuery());

  useInvalidateOnFocus([queryKeys.seenCards]);

  const deckCards = allCards.filter((card) => card.courseId === courseId);
  const deckTitle = deckCards[0]?.courseTitle ?? "Cards";

  const visible =
    filter === "ALL"
      ? deckCards
      : deckCards.filter((card) => card.lastRating === filter);

  function refreshLists() {
    // Re-rating or forgetting moves the deck progress, the due counts and the grid, all of
    // which are read on screens the learner is about to walk back to.
    for (const queryKey of [
      queryKeys.seenCards,
      queryKeys.courses,
      queryKeys.me,
      ["due"],
    ]) {
      queryClient.invalidateQueries({ queryKey });
    }
  }

  const rerate = useMutation({
    mutationFn: ({
      cardId,
      rating,
    }: {
      cardId: string;
      rating: ReviewRating;
      /*
       * A CORRECTION, not a review. submitReview runs SM-2 against the card's CURRENT state,
       * so three taps of Easy walked one card 6 → 21 → 76 → 289 days. correctCardRating
       * measures from where the card stood before its last answer, spends no daily
       * allowance and moves no streak.
       */
    }) => api.correctCardRating(cardId, rating),
    onSuccess: (result) => {
      setExpanded(null);
      refreshLists();
      toast.success(
        "Rescheduled",
        `Back in ${result.intervalDays} ${result.intervalDays === 1 ? "day" : "days"}.`,
      );
    },
    meta: { errorMessage: "Couldn't change that card." },
  });

  const forget = useMutation({
    mutationFn: ({ cardId }: { cardId: string }) => api.forgetCard(cardId),
    onSuccess: () => {
      setExpanded(null);
      refreshLists();
      toast.success("Removed", "This card goes back into the deck as new.");

      // That was the last one: this screen only exists to list seen cards, so an empty one
      // is a dead end just as it is after a wholesale wipe.
      if (deckCards.length <= 1) router.back();
    },
    meta: { errorMessage: "Couldn't remove that card." },
  });

  const rateAll = useMutation({
    mutationFn: ({ rating }: { rating: ReviewRating }) =>
      api.rateAllCards(rating, courseId),
    onSuccess: (result, { rating }) => {
      refreshLists();
      toast.success(
        `${result.affected} ${result.affected === 1 ? "card" : "cards"} set to ${ratingLabel(rating)}`,
        "Rescheduled from today. This did not use any of your daily reviews.",
      );
    },
    meta: { errorMessage: "Couldn't update the deck." },
  });

  const forgetAll = useMutation({
    mutationFn: () => api.forgetAllCards(courseId),
    onSuccess: (result) => {
      refreshLists();
      toast.success(
        `${result.affected} ${result.affected === 1 ? "card" : "cards"} removed`,
        "The deck starts again from the beginning.",
      );
      // Nothing left to look at here — this screen only exists to show seen cards, and an
      // empty one after a deliberate wipe is a dead end.
      router.back();
    },
    meta: { errorMessage: "Couldn't reset the deck." },
  });

  // Bulk work in flight, or no connection to do it over: either way the deck menu offers
  // nothing that would work, so the button says so rather than the sheet doing it.
  const deckActionsDisabled =
    rateAll.isPending || forgetAll.isPending || !online;

  /*
   * No confirmation for the ratings: they only move scheduling, the toast says how many
   * cards moved, and every card keeps its own undo. Reserving the Alert for the one
   * irreversible action is what keeps that Alert meaningful.
   */
  function applyRateAll(rating: ReviewRating) {
    rateAll.mutate({ rating });
  }

  /** An Alert here and nowhere else in this menu: this one cannot be undone. */
  function confirmForgetAll() {
    Alert.alert(
      "Remove all seen cards?",
      `All ${deckCards.length} cards you have learned in ${deckTitle} go back to unseen, and the deck starts from the beginning. Your streak is not affected.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove all",
          style: "destructive",
          onPress: () => forgetAll.mutate(),
        },
      ],
    );
  }

  function renderCard({ item: card }: { item: SeenCard }) {
    const isOpen = expanded === card.cardId;
    const cardBusy = (rerate.isPending || forget.isPending) && isOpen;

    return (
      <View className="border-line border-b bg-surface">
        <Pressable
          accessibilityHint="Shows the actions for this card"
          accessibilityRole="button"
          className="min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-surface-sunken"
          onPress={() => setExpanded(isOpen ? null : card.cardId)}
        >
          <View className="flex-1 gap-0.5">
            <Text className="text-body text-ink">
              {card.frontText}
              <Text className="text-ink-muted">
                {"  "}
                {/*
                  Transliterated, exactly as the review screen does it. This browser used to
                  render backText raw, so a learner with romaji ON saw "otoko · man" while
                  reviewing and "おとこ · man" here — the one screen where they go to check
                  what they have learned showed them a script they had asked not to see.
                */}
                {formatBackText(card.backText, showRomaji)}
              </Text>
            </Text>
            <Text className="text-caption text-ink-subtle">
              {describeDue(card.nextReviewDate)}
            </Text>
          </View>
          <Text className={`text-caption ${ratingColour(card.lastRating)}`}>
            {ratingLabel(card.lastRating)}
          </Text>
          {/* Without it the row looks like a label rather than a control. */}
          <Image
            source={isOpen ? "sf:chevron.up" : "sf:chevron.down"}
            style={{ width: 11, height: 11 }}
            tintColor={colors.inkSubtle}
          />
        </Pressable>

        {isOpen ? (
          <Animated.View
            className="gap-3 border-line border-t px-4 py-3"
            entering={FadeIn.duration(140)}
          >
            <Text className="text-caption text-ink-muted">
              Changes the answer you gave and reschedules from today. It does
              not use a daily review, and pressing the same one twice changes
              nothing further.
            </Text>

            <View className="flex-row gap-2">
              {RATINGS.map((entry) => (
                <Pressable
                  accessibilityRole="button"
                  className="flex-1 items-center gap-0.5 rounded-button border border-line py-2 active:bg-surface-sunken"
                  disabled={cardBusy || !online}
                  key={entry.rating}
                  onPress={() =>
                    rerate.mutate({
                      cardId: card.cardId,
                      rating: entry.rating,
                    })
                  }
                >
                  <Text className={`font-semibold text-caption ${entry.text}`}>
                    {entry.label}
                  </Text>
                  {/* The number before the tap, so twenty-two days is a choice. */}
                  <Text className="text-caption text-ink-subtle">
                    {formatDays(
                      card.intervals[
                        entry.rating.toLowerCase() as Lowercase<ReviewRating>
                      ],
                    )}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Button
              disabled={cardBusy || !online}
              onPress={() => forget.mutate({ cardId: card.cardId })}
              title="Remove from seen cards"
              variant="ghost"
            />
          </Animated.View>
        ) : null}
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: deckTitle,
          /*
           * Deck-wide actions belong in the navigation bar, not at the bottom of the list.
           * Below the cards they read as one more row to scroll past, and on a 104-card deck
           * nobody ever scrolls that far.
           */
          /*
           * A real UIMenu, not an approximation. Two hand-rolled versions of this — a sheet
           * with a scrim, then an anchored popover — both read as "not quite an iOS menu",
           * because that is exactly what they were. @react-native-menu/menu renders the
           * platform's own control, which is why it costs a native rebuild.
           *
           * Only above one card: "set all" and "remove all" over a single card are the
           * per-card actions with extra steps.
           */
          headerRight: () =>
            deckCards.length > 1 ? (
              <MenuView
                actions={[
                  ...RATINGS.map((entry) => ({
                    id: entry.rating,
                    title: `Set all to ${entry.label}`,
                    image: entry.symbol,
                    /*
                     * imageColor is NOT optional under the New Architecture, whatever the
                     * types say. Fabric always sends the prop, and an omitted one arrives as
                     * 0 — which the native side reads as #00000000 and tints the symbol
                     * fully transparent. The icons were rendering; they just could not be
                     * seen. See MenuView.mm and RCTMenuItem.swift in the library.
                     */
                    imageColor: colors.ink,
                    attributes: { disabled: deckActionsDisabled },
                  })),
                  {
                    id: "FORGET_ALL",
                    title: "Remove all seen cards",
                    image: "trash",
                    // UIKit's own destructive red, to match the title it sits beside. The
                    // app's palette has no red by design; this menu is the platform's.
                    imageColor: "#FF3B30",
                    attributes: {
                      destructive: true,
                      disabled: deckActionsDisabled,
                    },
                  },
                ]}
                onPressAction={({ nativeEvent }) => {
                  if (nativeEvent.event === "FORGET_ALL") confirmForgetAll();
                  else applyRateAll(nativeEvent.event as ReviewRating);
                }}
                title={`All ${deckCards.length} learned cards`}
              >
                <View
                  className={`h-10 w-10 items-center justify-center ${
                    deckActionsDisabled ? "opacity-40" : ""
                  }`}
                >
                  <Image
                    source="sf:ellipsis"
                    style={{ width: 18, height: 18 }}
                  />
                </View>
              </MenuView>
            ) : null,
        }}
      />

      <FlatList
        className="flex-1 bg-canvas"
        contentContainerStyle={{ paddingBottom: 32 + bannerClearance }}
        contentInsetAdjustmentBehavior="automatic"
        data={visible}
        keyExtractor={(card) => card.cardId}
        ListEmptyComponent={
          isPending ? (
            <ActivityIndicator className="py-8" />
          ) : (
            <Card tone="sunken">
              <CardCaption>
                {deckCards.length === 0
                  ? "You have not answered any cards in this deck yet."
                  : `No cards you answered ${ratingLabel(filter as ReviewRating)}.`}
              </CardCaption>
            </Card>
          )
        }
        ListHeaderComponent={
          <View className="flex-row gap-2 px-4 pt-4 pb-3">
            {FILTERS.map((entry) => {
              const selected = filter === entry.key;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`rounded-pill border px-3 py-1.5 ${
                    selected
                      ? "border-primary bg-primary-tint"
                      : "border-line bg-surface"
                  }`}
                  key={entry.key}
                  onPress={() => setFilter(entry.key)}
                >
                  <Text
                    className={`text-caption ${selected ? "font-semibold text-primary" : "text-ink-muted"}`}
                  >
                    {entry.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        }
        renderItem={renderCard}
      />
    </>
  );
}
