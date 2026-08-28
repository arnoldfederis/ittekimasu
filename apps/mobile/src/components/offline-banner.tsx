import { useMutationState } from "@tanstack/react-query";
import { Image } from "expo-image";
import { usePathname } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/constants/theme";
import { useIsOnline } from "@/lib/network";
import { REVIEW_MUTATION_KEY } from "@/lib/query-client";

/**
 * Height of the iOS tab bar itself, without the home-indicator inset the safe area already
 * covers. TAB_BAR_CLEARANCE is scroll padding and far too tall to sit a banner on.
 */
const TAB_BAR_HEIGHT = 49;

/**
 * The only routes that render a tab bar. Everything else — sign-in, settings, the pushed
 * screens and the modals — goes to the bottom of the screen, where clearing a tab bar that
 * is not there just leaves a gap.
 */
const TAB_ROUTES = new Set(["/", "/checklist", "/learn", "/profile"]);

/** Roughly the banner's own height plus its gap — what a scroll view has to clear. */
const BANNER_HEIGHT = 76;

function bannerBottom(onTabs: boolean, safeBottom: number): number {
  return safeBottom + (onTabs ? TAB_BAR_HEIGHT + 12 : 12);
}

/**
 * Extra bottom padding for a scrolling screen, so the last row is not parked under the
 * banner. Zero when online, which is why it belongs in a hook rather than a constant.
 *
 * The tab screens do not need it: TAB_BAR_CLEARANCE already reserves far more.
 */
export function useOfflineBannerClearance(): number {
  const online = useIsOnline();
  return online ? 0 : BANNER_HEIGHT;
}

/**
 * Says "you are offline" once, at the bottom, instead of letting every screen discover it
 * separately through a failed request.
 *
 * Amber, never red: being on a plane is not an error, and the palette has no red for
 * exactly this kind of thing. The second line is the important half — it tells the learner
 * their answers are being kept, which is what makes carrying on feel safe.
 */
export function OfflineBanner() {
  const online = useIsOnline();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  // Being signed in is not the question — being ON a tab is. Settings and the modals are
  // signed-in screens with no tab bar under them.
  const pathname = usePathname();
  const onTabs = TAB_ROUTES.has(pathname);

  /*
   * The offset is animated because the banner OUTLIVES the navigation: it is mounted at the
   * root, so pushing settings from the profile does not remount it — it would simply jump
   * 49pt down the screen mid-transition. Sliding it takes the same time as the push.
   */
  const bottom = useSharedValue(bannerBottom(onTabs, insets.bottom));
  const target = bannerBottom(onTabs, insets.bottom);

  useEffect(() => {
    bottom.value = withTiming(target, { duration: 280 });
  }, [bottom, target]);

  const offset = useAnimatedStyle(() => ({ bottom: bottom.value }));

  // Ratings given with no connection: held by React Query and replayed on reconnect.
  const queued = useMutationState({
    filters: { mutationKey: REVIEW_MUTATION_KEY, status: "pending" },
    select: (mutation) => mutation.state.isPaused,
  }).filter(Boolean).length;

  if (online) return null;

  return (
    <Animated.View
      className="absolute right-0 left-0 px-4"
      entering={FadeInDown}
      exiting={FadeOutDown}
      pointerEvents="none"
      // Above the tab bar, not over it. Sitting on top of the tabs hid them behind a
      // message about being offline, which is the one time you most want to navigate.
      style={offset}
    >
      <View className="flex-row items-center gap-3 rounded-card border border-accent bg-accent-tint px-4 py-3">
        <Image
          source="sf:wifi.slash"
          style={{ width: 18, height: 18 }}
          tintColor={colors.accent}
        />
        <View className="flex-1 gap-0.5">
          <Text className="font-semibold text-callout text-ink">
            You're offline
          </Text>
          <Text className="text-caption text-ink-muted">
            {queued > 0
              ? `Carry on — ${queued} ${queued === 1 ? "answer syncs" : "answers sync"} when you're back.`
              : "Showing what was saved on this device."}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
