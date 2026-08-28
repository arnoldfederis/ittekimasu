import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { useThemeColors } from "@/constants/theme";
import { isPurchaseCancelled, usePurchases } from "@/lib/purchases";
import { toast } from "@/lib/toast";

const BENEFITS = [
  // Kana and N5 are FREE, so neither belongs here — a benefit list that promises what the
  // reader already has is the fastest way to lose their trust in the rest of it.
  "N4 and N3, once kana and N5 are behind you",
  "Unlimited daily reviews",
  "Extra decks, like ward-office vocabulary",
  "Priority updates as the app grows",
];

export default function PaywallScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { ready, configured, annual, monthly, purchase, restore } =
    usePurchases();

  // Annual is preselected: it is the better deal and the one worth defaulting someone into.
  const [selected, setSelected] = useState<"annual" | "monthly">("annual");
  const [busy, setBusy] = useState(false);

  const chosen: PurchasesPackage | null =
    selected === "annual" ? annual : monthly;

  async function buy() {
    if (!chosen || busy) return;
    setBusy(true);
    try {
      const premium = await purchase(chosen);
      if (premium) {
        toast.success("You're in", "Everything is unlocked. Happy studying.");
        router.back();
      }
    } catch (error) {
      // Backing out of Apple's sheet is a decision, not a failure — so it gets a neutral
      // acknowledgement rather than an error toast.
      if (isPurchaseCancelled(error)) {
        toast.info("No charge made", "You can upgrade whenever you're ready.");
      } else {
        toast.fromError(error, "Couldn't complete that purchase.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function restorePurchases() {
    setBusy(true);
    try {
      const premium = await restore();
      if (premium) {
        toast.success("Restored", "Your subscription is active again.");
        router.back();
      } else {
        toast.info(
          "Nothing to restore",
          "No active subscription on this Apple ID.",
        );
      }
    } catch (error) {
      toast.fromError(error, "Couldn't restore purchases.");
    } finally {
      setBusy(false);
    }
  }

  return (
    // A modal sheet already sits below the status bar, but useSafeAreaInsets still reports
    // the device's full top inset because the provider is mounted at the root. Adding it
    // here stacks a second ~59pt gap on top of the sheet's own.
    <View className="flex-1 bg-canvas" style={{ paddingTop: 8 }}>
      <View className="flex-row items-center justify-between px-4 pb-2">
        <Pressable
          accessibilityLabel="Close"
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center rounded-pill active:bg-surface-sunken"
          onPress={() => router.back()}
        >
          <Image
            source="sf:xmark"
            style={{ width: 18, height: 18 }}
            tintColor={colors.inkMuted}
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          className="px-2 py-1"
          disabled={busy}
          onPress={restorePurchases}
        >
          <Text className="text-callout text-primary">Restore</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24, gap: 24 }}
      >
        <View className="items-center gap-3 px-4 pt-2">
          <Image
            contentFit="contain"
            source={require("../../assets/images/icon.png")}
            style={{ width: 72, height: 72, borderRadius: 16 }}
          />
          <Text className="text-center font-semibold text-ink text-title">
            Go further
          </Text>
          <Text className="text-center text-body text-ink-muted">
            Everything you need for the move
          </Text>
        </View>

        <View className="gap-3 px-4">
          {BENEFITS.map((benefit) => (
            <View className="flex-row items-center gap-3" key={benefit}>
              <Image
                source="sf:checkmark.circle.fill"
                style={{ width: 22, height: 22 }}
                tintColor={colors.positive}
              />
              <Text className="flex-1 text-body text-ink">{benefit}</Text>
            </View>
          ))}
        </View>

        <View className="gap-3 px-4">
          {!ready ? <ActivityIndicator className="py-4" /> : null}

          {ready && !configured ? (
            <Card tone="sunken">
              <Text className="text-body text-ink">
                Subscriptions aren&apos;t set up in this build.
              </Text>
              <Text className="pt-1 text-caption text-ink-muted">
                Add EXPO_PUBLIC_REVENUECAT_API_KEY to apps/mobile/.env and
                restart Metro.
              </Text>
            </Card>
          ) : null}

          {ready && configured && !annual && !monthly ? (
            <Card tone="sunken">
              <Text className="text-body text-ink">
                No plans available right now.
              </Text>
              <Text className="pt-1 text-caption text-ink-muted">
                The RevenueCat offering has no monthly or annual package yet.
              </Text>
            </Card>
          ) : null}

          {annual ? (
            <PlanCard
              badge="Save 50%"
              onPress={() => setSelected("annual")}
              period="per year"
              price={annual.product.priceString}
              selected={selected === "annual"}
              title="Annual"
            />
          ) : null}

          {monthly ? (
            <PlanCard
              onPress={() => setSelected("monthly")}
              period="per month"
              price={monthly.product.priceString}
              selected={selected === "monthly"}
              title="Monthly"
            />
          ) : null}
        </View>
      </ScrollView>

      <View
        className="gap-3 px-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Button
          disabled={!chosen}
          loading={busy}
          onPress={buy}
          title="Start 7-day free trial"
          variant="primary"
        />
        <Text className="text-center text-caption text-ink-subtle">
          {chosen
            ? `Then ${chosen.product.priceString} ${selected === "annual" ? "a year" : "a month"}. Cancel anytime.`
            : "Cancel anytime."}
        </Text>
      </View>
    </View>
  );
}

/**
 * Prices come from `product.priceString`, never a hardcoded "$29.99": it is already localised
 * and already correct when App Store Connect pricing changes.
 */
function PlanCard({
  title,
  price,
  period,
  badge,
  selected,
  onPress,
}: {
  title: string;
  price: string;
  period: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} selected={selected}>
      <View className="flex-row items-center gap-3">
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            <Text className="font-semibold text-body text-ink">{title}</Text>
            {badge ? (
              <View className="rounded-pill bg-accent-tint px-2 py-0.5">
                <Text className="font-semibold text-accent text-caption">
                  {badge}
                </Text>
              </View>
            ) : null}
          </View>
          <Text className="text-caption text-ink-muted">{period}</Text>
        </View>
        <Text className="font-semibold text-heading text-ink">{price}</Text>
      </View>
    </Card>
  );
}
