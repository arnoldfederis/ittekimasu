import { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { ToriiMark } from "@/components/torii-mark";
import { useIsDark, useThemeColors } from "@/constants/theme";

/**
 * The moving ground behind sign-in and the paywall.
 *
 * Both screens are a logo, a paragraph and some buttons on a flat canvas — correct, and
 * completely forgettable, which is a problem on the two screens that have to carry the
 * product's first impression and its only ask for money.
 *
 * Drawn, not filmed. A looping video would cost several megabytes in the bundle, a poster
 * frame for the first paint, and battery on a screen people sit and read; this is three
 * radial gradients and one vector, it costs nothing offline, and it follows dark mode
 * because every colour comes from `useThemeColors()`.
 */

/** Long enough that the movement is felt rather than watched. */
const DRIFT_MS = 14_000;

type BlobProps = {
  /** Unique per instance: react-native-svg gradient ids share one namespace. */
  id: string;
  color: string;
  size: number;
  /** Distance travelled, in points, over one half-cycle. */
  drift: { x: number; y: number };
  /** Staggers the loops so the three never line up into one pulsing blob. */
  delay: number;
  opacity: number;
  style: { top?: number; bottom?: number; left?: number; right?: number };
};

function Blob({ id, color, size, drift, delay, opacity, style }: BlobProps) {
  // A user who has asked the system for less motion gets the composition and none of the
  // movement — the screen still looks designed, it just holds still.
  const reduced = useReducedMotion();
  const progress = useSharedValue(0.5);

  useEffect(() => {
    if (reduced) return;
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: DRIFT_MS, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [reduced, delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [-drift.x, drift.x]) },
      { translateY: interpolate(progress.value, [0, 1], [-drift.y, drift.y]) },
      { scale: interpolate(progress.value, [0, 1], [0.92, 1.14]) },
    ],
  }));

  return (
    <Animated.View style={[{ position: "absolute", ...style }, animatedStyle]}>
      <Svg height={size} width={size}>
        <Defs>
          <RadialGradient cx="50%" cy="50%" id={id} r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} fill={`url(#${id})`} r={size / 2} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Absolutely fills its parent and swallows no touches. Mount it as the FIRST child of a
 * screen that already sets its own background — this paints over that background, not
 * instead of it.
 */
export function BrandBackdrop() {
  const colors = useThemeColors();
  const isDark = useIsDark();
  const { width, height } = useWindowDimensions();

  // The same wash has to survive two very different grounds: on the cream canvas it only
  // has to tint, and on the near-black one it has to be visible at all.
  const blobOpacity = isDark ? 0.42 : 0.3;
  // Texture, not a logo. Anything above ~5% on the cream canvas and the watermark starts
  // competing with the real icon in the middle of the screen — the failure this is meant
  // to avoid. Dark needs a little more just to be present at all.
  const markOpacity = isDark ? 0.08 : 0.045;

  const blob = Math.max(width, height * 0.55);
  const markSize = width * 0.92;

  return (
    <View
      // Decorative: nothing here is content, and VoiceOver should walk straight past it.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}
    >
      <Blob
        color={colors.primary}
        delay={0}
        drift={{ x: 26, y: 34 }}
        id="backdrop-primary"
        opacity={blobOpacity}
        size={blob}
        style={{ top: -blob * 0.42, left: -blob * 0.3 }}
      />
      <Blob
        color={colors.accent}
        delay={2200}
        drift={{ x: -30, y: 22 }}
        id="backdrop-accent"
        opacity={blobOpacity * 0.8}
        size={blob * 0.85}
        style={{ top: -blob * 0.2, right: -blob * 0.34 }}
      />
      <Blob
        color={colors.positive}
        delay={4600}
        drift={{ x: 18, y: -28 }}
        id="backdrop-positive"
        opacity={blobOpacity * 0.7}
        size={blob * 0.95}
        style={{ bottom: -blob * 0.45, right: -blob * 0.18 }}
      />

      {/*
        The mark itself, bled off the top-right corner so it reads as texture rather than as
        a second logo competing with the real one in the middle of the screen. Flat, in one
        colour: two tones at 7% opacity are not two tones, they are a smudge.
      */}
      <View
        style={{
          position: "absolute",
          top: -markSize * 0.08,
          right: -markSize * 0.34,
        }}
      >
        <ToriiMark
          check={colors.primary}
          gate={colors.primary}
          opacity={markOpacity}
          size={markSize}
        />
      </View>
    </View>
  );
}
