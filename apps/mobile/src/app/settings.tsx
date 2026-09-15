import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { Button } from "@/components/button";
import { ListRow } from "@/components/list-row";
import { useOfflineBannerClearance } from "@/components/offline-banner";
import { PRIVACY_URL, TERMS_URL } from "@/constants/legal";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useIsOnline } from "@/lib/network";
import { openUrl } from "@/lib/open-url";
import { usePurchases } from "@/lib/purchases";
import { toast } from "@/lib/toast";

/** Apple's own subscription management screen. There is no in-app way to cancel. */
const MANAGE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

// PRIVACY_URL and TERMS_URL moved to constants/legal.ts — App Review reaches them from the
// paywall and the sign-in screen too, and three copies of the base URL is three chances for
// one of them to 404 on the screen a reviewer happens to be looking at.

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const online = useIsOnline();
  const { signOut, forgetOnboarded } = useAuth();
  const { restore, hasPremium } = usePurchases();
  const [busy, setBusy] = useState(false);
  const bannerClearance = useOfflineBannerClearance();

  async function restorePurchases() {
    setBusy(true);
    try {
      const premium = await restore();
      toast[premium ? "success" : "info"](
        premium ? "Restored" : "Nothing to restore",
        premium
          ? "Your subscription is active again."
          : "No active subscription on this Apple ID.",
      );
    } catch (error) {
      toast.fromError(error, "Couldn't restore purchases.");
    } finally {
      setBusy(false);
    }
  }

  const resetProgress = useMutation({
    mutationFn: () => api.resetProgress(),
    onSuccess: (result) => {
      // Everything derived from progress is now wrong: decks, due counts, the grid, the
      // streak on /users/me and the seen-cards browser.
      queryClient.invalidateQueries();
      toast.success(
        `${result.affected} ${result.affected === 1 ? "card" : "cards"} reset`,
        "Every deck starts from the beginning.",
      );
    },
    meta: { errorMessage: "Couldn't reset your progress." },
  });

  function confirmReset() {
    // An Alert, not a toast: this erases the study grid and the streak as well as the cards.
    Alert.alert(
      "Start learning over?",
      "Every card goes back to unseen, and your streak and study history are cleared. Your checklist and subscription are untouched. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => resetProgress.mutate(),
        },
      ],
    );
  }

  function confirmDelete() {
    // An Alert, not a toast: a toast can be missed, and this one cannot be undone.
    Alert.alert(
      "Delete account?",
      "This permanently removes your checklist, review history, and account. It cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteAccount.mutate(),
        },
      ],
    );
  }

  const deleteAccount = useMutation({
    mutationFn: () => api.deleteMe(),

    onSuccess: async () => {
      // Before the sign-out: the cached "already onboarded" answer is keyed by the Firebase
      // uid, which outlives the server row. Signing back in with the same Apple ID would
      // otherwise route straight into the tabs of an account that no longer exists.
      await forgetOnboarded();
      // Sign-out clears the query cache, so nothing of the deleted account survives it.
      await signOut();
    },

    meta: { errorMessage: "Could not reach the server. Try again." },
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Settings" }} />

      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{
          paddingBottom: 32 + bannerClearance,
          gap: 16,
          paddingTop: 16,
        }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="gap-4 px-4">
          <Section title="SUBSCRIPTION">
            <ListRow
              icon="creditcard"
              onPress={() => openUrl(MANAGE_SUBSCRIPTIONS_URL)}
              showChevron
              subtitle="Opens the App Store"
              title="Manage subscription"
            />
            {/*
              Required by App Store review guideline 3.1.1 — but only useful when there is
              something to restore. Offered to an active subscriber it can only ever answer
              "you already have this", which reads as though something might be wrong.
              Disabled rather than hidden: 3.1.1 wants the path to be findable, and a
              subscriber who lapses sees it come back without hunting for it.
            */}
            <ListRow
              disabled={busy || hasPremium}
              icon="arrow.clockwise"
              onPress={restorePurchases}
              subtitle={hasPremium ? "Your subscription is active" : undefined}
              title="Restore purchases"
            />
          </Section>

          <Section title="STUDY">
            <ListRow
              icon="textformat.size"
              onPress={() => router.push("/display-settings")}
              showChevron
              subtitle="Text size and romaji readings"
              title="Display"
            />
            <ListRow
              icon="speaker.wave.2"
              onPress={() => router.push("/voice")}
              showChevron
              subtitle="Used when a card's reading is spoken"
              title="Voice"
            />
          </Section>

          <Section title="LEARNING">
            {/*
              Deliberately separate from a deck's "remove all seen cards": that one is
              maintenance and leaves the streak alone, because those days were really
              studied. Here, erasing that history is the point of the request.
            */}
            <ListRow
              disabled={!online || resetProgress.isPending}
              icon="arrow.counterclockwise"
              onPress={confirmReset}
              subtitle={
                online
                  ? "Cards, streak and study history"
                  : "Needs a connection"
              }
              title="Start learning over"
            />
          </Section>

          <Section title="ABOUT">
            <ListRow
              icon="hand.raised"
              onPress={() => openUrl(PRIVACY_URL)}
              showChevron
              title="Privacy policy"
            />
            <ListRow
              icon="doc.text"
              onPress={() => openUrl(TERMS_URL)}
              showChevron
              title="Terms of use"
            />
          </Section>

          <Button onPress={signOut} title="Sign out" variant="secondary" />

          {/* App Store review guideline 5.1.1(v) requires in-app account deletion. */}
          <Button
            onPress={confirmDelete}
            title="Delete account"
            variant="destructive"
          />
        </View>
      </ScrollView>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="overflow-hidden rounded-card bg-surface">
      <Text className="px-4 pt-4 pb-1 font-semibold text-caption text-ink-subtle">
        {title}
      </Text>
      {children}
    </View>
  );
}
