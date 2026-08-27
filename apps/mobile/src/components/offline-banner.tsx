import { useMutationState } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/constants/theme";
import { useIsOnline } from "@/lib/network";
import { REVIEW_MUTATION_KEY } from "@/lib/query-client";

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
      style={{ bottom: insets.bottom + 12 }}
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
