import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Card, CardCaption } from "@/components/card";
import { useOfflineBannerClearance } from "@/components/offline-banner";
import { useThemeColors } from "@/constants/theme";
import type { SeenCard } from "@/lib/api";
import { queryKeys, seenCardsQuery, useInvalidateOnFocus } from "@/lib/queries";

/**
 * Decks first, cards second.
 *
 * A flat list of every seen card is hundreds of rows the moment someone gets going, which is
 * slow to render and impossible to scan. The deck is the unit people actually think in —
 * "how am I doing on katakana" — so that is the first screen.
 */
export default function CardsIndexScreen() {
  const colors = useThemeColors();
  const bannerClearance = useOfflineBannerClearance();

  const {
    data: cards = [],
    isPending,
    isError,
    fetchStatus,
  } = useQuery(seenCardsQuery());

  const waitingOffline = isPending && fetchStatus === "paused";

  useInvalidateOnFocus([queryKeys.seenCards]);

  // Insertion order is deck order: the server sorts by the same sort_order the learn tab uses.
  const decks = new Map<string, { title: string; cards: SeenCard[] }>();
  for (const card of cards) {
    const deck = decks.get(card.courseId);
    if (deck) deck.cards.push(card);
    else decks.set(card.courseId, { title: card.courseTitle, cards: [card] });
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Cards learned" }} />

      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          paddingBottom: 32 + bannerClearance,
        }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {isPending && !waitingOffline && !isError ? (
          <ActivityIndicator className="py-8" />
        ) : null}

        {waitingOffline ? (
          <Card tone="sunken">
            <Text className="text-body text-ink">
              Your cards aren&apos;t saved on this device yet.
            </Text>
            <CardCaption>
              Open this once with a connection and they will be here offline.
            </CardCaption>
          </Card>
        ) : null}

        {!isPending && cards.length === 0 ? (
          <Card tone="sunken">
            <Text className="text-body text-ink">Nothing here yet</Text>
            <CardCaption>
              Cards appear once you have answered them. Review a deck and come
              back.
            </CardCaption>
          </Card>
        ) : null}

        {decks.size > 0 ? (
          <View className="overflow-hidden rounded-card bg-surface">
            {[...decks.entries()].map(([courseId, deck]) => {
              const due = deck.cards.filter(
                (card) => card.lastRating === "AGAIN",
              ).length;

              return (
                <Pressable
                  accessibilityRole="button"
                  className="min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-surface-sunken"
                  key={courseId}
                  onPress={() => router.push(`/cards/${courseId}`)}
                >
                  <View className="flex-1 gap-0.5">
                    <Text className="text-body text-ink">{deck.title}</Text>
                    <Text className="text-caption text-ink-muted">
                      {deck.cards.length}{" "}
                      {deck.cards.length === 1 ? "card" : "cards"} learned
                      {due > 0 ? ` · ${due} marked Again` : ""}
                    </Text>
                  </View>
                  <Image
                    source="sf:chevron.right"
                    style={{ width: 12, height: 12 }}
                    tintColor={colors.inkSubtle}
                  />
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}
