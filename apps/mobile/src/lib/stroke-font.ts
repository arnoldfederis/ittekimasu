import * as Font from "expo-font";
import { useEffect, useState } from "react";

/**
 * The Kanji Stroke Order font, loaded the first time somebody asks to see stroke order.
 *
 * Not loaded at launch: it is ~950KB and most sessions never turn the toggle on, so paying
 * for it on every cold start would be a tax on the common case. Not bundled through the
 * expo-font config plugin either — that bakes the face into the native build, which would
 * put this behind a prebuild and a new binary instead of an `eas update`.
 *
 * The promise is kept at module scope so a second screen asking for it joins the first load
 * rather than starting another.
 */
export const STROKE_FONT_FAMILY = "StrokeOrder";

/**
 * The HEIGHT of a stroke number on screen, in points, before the text scale.
 *
 * ONE number for both halves of the app. The kana diagram is an SVG we draw and the kanji one
 * is a typeface, so nothing makes them agree by default. Both sizes are derived from this so
 * they cannot drift apart again.
 *
 * Height, not font size, because the kanji half leaves no choice: its numbers are contours
 * inside a glyph, so the only thing that can be measured is the ink. The kana half passing
 * this straight to `fontSize` was the mismatch — a digit inks about 0.72 of its em, so the
 * kana numbers came out a third short. See `DIGIT_CAP_RATIO` in components/kana-strokes.tsx.
 */
export const STROKE_NUMBER_POINTS = 15;

/**
 * The share of the em the font gives its numbers, measured off a render at a known size.
 *
 * It is the only way to size a number that is baked into a glyph: you cannot set it, so you
 * size the whole glyph until the number lands where you want it. Roughly an eighth — if the
 * font is ever updated and the numbers change proportion, this is the knob.
 */
const STROKE_FONT_NUMBER_RATIO = 0.125;

/** The point size to draw a word at so its stroke numbers match the kana chart's. */
export function strokeFontSize(scale: number): number {
  return (STROKE_NUMBER_POINTS * scale) / STROKE_FONT_NUMBER_RATIO;
}

let loading: Promise<void> | null = null;
let loaded = false;

function loadStrokeFont(): Promise<void> {
  loading ??= Font.loadAsync({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    [STROKE_FONT_FAMILY]: require("../../assets/fonts/stroke-order.ttf"),
  }).then(() => {
    loaded = true;
  });

  return loading;
}

/**
 * True once the face is ready to render with.
 *
 * Until then the caller shows the plain text rather than a spinner: the characters are the
 * same either way, only the numbers are missing, so a brief moment without them is far less
 * jarring than the word disappearing and coming back.
 */
export function useStrokeFont(enabled: boolean): boolean {
  const [ready, setReady] = useState(loaded);

  useEffect(() => {
    if (!enabled || ready) return;

    let cancelled = false;
    loadStrokeFont().then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, ready]);

  return ready;
}
