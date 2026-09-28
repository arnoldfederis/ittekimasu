import { useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useThemeColors } from "@/constants/theme";

/**
 * A single burst of confetti, for a perfect kana quiz.
 *
 * Drawn with Reanimated views rather than a confetti library: the app already ships
 * Reanimated, and forty-odd coloured rectangles falling once do not justify a dependency.
 * Every piece is a transform on the UI thread, so the JS thread is free while it plays.
 *
 * Brand colours only — teal, amber and green. Mount it only when it should play; it runs
 * once on mount and then sits invisible, and it never takes a touch.
 *
 * The caller decides about Reduce Motion (see kana-quiz-results.tsx), because the right
 * answer there is "don't render this at all" rather than "render it standing still".
 */

const PIECE_COUNT = 48;

type PieceSpec = {
  x: number;
  drift: number;
  spin: number;
  delay: number;
  duration: number;
  width: number;
  height: number;
  color: string;
};

function Piece({ spec, fall }: { spec: PieceSpec; fall: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      spec.delay,
      withTiming(1, {
        duration: spec.duration,
        easing: Easing.out(Easing.quad),
      }),
    );
  }, [progress, spec]);

  const style = useAnimatedStyle(() => ({
    // Fades over the last stretch of the fall so nothing pops out of existence mid-screen.
    opacity: progress.value < 0.8 ? 1 : (1 - progress.value) / 0.2,
    transform: [
      { translateX: spec.x + spec.drift * progress.value },
      { translateY: -40 + fall * progress.value },
      { rotate: `${spec.spin * progress.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          backgroundColor: spec.color,
          height: spec.height,
          width: spec.width,
        },
        style,
      ]}
    />
  );
}

export function Confetti() {
  const colors = useThemeColors();
  const { width, height } = useWindowDimensions();

  // Chosen once per burst: a state initialiser runs on mount only, so a re-render of the
  // results screen cannot reshuffle pieces that are already falling.
  const [specs] = useState<PieceSpec[]>(() => {
    const palette = [colors.primary, colors.accent, colors.positive];
    return Array.from({ length: PIECE_COUNT }, (_, i) => ({
      x: Math.random() * width,
      drift: (Math.random() - 0.5) * 160,
      spin: (Math.random() - 0.5) * 900,
      delay: Math.random() * 350,
      duration: 1600 + Math.random() * 1200,
      width: 6 + Math.random() * 6,
      height: 10 + Math.random() * 8,
      color: palette[i % palette.length] ?? colors.primary,
    }));
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {specs.map((spec, index) => (
        // Index is the identity: the set is fixed for the life of the burst.
        <Piece fall={height * 0.9} key={index} spec={spec} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: {
    borderRadius: 2,
    left: 0,
    position: "absolute",
    top: 0,
  },
});
