import { router, Stack } from "expo-router";
import { useState } from "react";
import { Alert, Linking, ScrollView, Text, View } from "react-native";
import { Button } from "@/components/button";
import { ListRow } from "@/components/list-row";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { usePurchases } from "@/lib/purchases";
import { toast } from "@/lib/toast";

/** Apple's own subscription management screen. There is no in-app way to cancel. */
const MANAGE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

/**
 * Hosted, not in-app: App Store Connect needs a public privacy policy URL to submit at all,
 * so the pages have to exist on the web regardless. BOTH MUST BE LIVE BEFORE SUBMISSION —
 * a 404 here is a review rejection.
 */
const LEGAL_BASE_URL = "https://ittekimasu.app";

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { restore } = usePurchases();
  const [busy, setBusy] = useState(false);

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

  function confirmDelete() {
    // An Alert, not a toast: a toast can be missed, and this one cannot be undone.
    Alert.alert(
      "Delete account?",
      "This permanently removes your checklist, review history, and account. It cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: deleteAccount },
      ],
    );
  }

  async function deleteAccount() {
    try {
      await api.deleteMe();
      await signOut();
    } catch (error) {
      toast.fromError(error, "Could not reach the server. Try again.");
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Settings" }} />

      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{ paddingBottom: 32, gap: 16, paddingTop: 16 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="gap-4 px-4">
          <Section title="SUBSCRIPTION">
            <ListRow
              icon="creditcard"
              onPress={() => Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)}
              showChevron
              subtitle="Opens the App Store"
              title="Manage subscription"
            />
            {/* Required by App Store review guideline 3.1.1. */}
            <ListRow
              disabled={busy}
              icon="arrow.clockwise"
              onPress={restorePurchases}
              title="Restore purchases"
            />
          </Section>

          <Section title="STUDY">
            <ListRow
              icon="speaker.wave.2"
              onPress={() => router.push("/voice")}
              showChevron
              subtitle="Used when a card's reading is spoken"
              title="Voice"
            />
          </Section>

          <Section title="ABOUT">
            <ListRow
              icon="hand.raised"
              onPress={() => Linking.openURL(`${LEGAL_BASE_URL}/privacy`)}
              showChevron
              title="Privacy policy"
            />
            <ListRow
              icon="doc.text"
              onPress={() => Linking.openURL(`${LEGAL_BASE_URL}/terms`)}
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
