import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

/**
 * How cards and the kana chart are DISPLAYED. Device-only: these change nothing about
 * scheduling, so sending them to the server would turn a toggle into a request.
 *
 * One text scale shared by the review card and the kana sheet rather than a separate setting
 * per screen. Someone who wants bigger Japanese wants it everywhere, and two half-remembered
 * size controls is how a settings screen starts.
 */
const SCALE_KEY = "display.textScale";
const ROMAJI_KEY = "kana.romaji";

export type TextScale = "default" | "large" | "larger";

/** Multiplied into each screen's own base size, so the ratio between front and back text on
 * a card survives the change. */
export const TEXT_SCALE_FACTOR: Record<TextScale, number> = {
  default: 1,
  large: 1.35,
  larger: 1.7,
};

export const TEXT_SCALE_LABEL: Record<TextScale, string> = {
  default: "Default",
  large: "Large",
  larger: "Larger",
};

export const TEXT_SCALES: TextScale[] = ["default", "large", "larger"];

export type DisplayPrefs = {
  textScale: TextScale;
  /** Kana chart only. Off hides the reading in the chart and the sheet — a self-test. */
  showRomaji: boolean;
  setTextScale: (scale: TextScale) => void;
  setShowRomaji: (show: boolean) => void;
};

export function useDisplayPrefs(): DisplayPrefs {
  const [textScale, setScale] = useState<TextScale>("default");
  const [showRomaji, setRomaji] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [scale, romaji] = await AsyncStorage.multiGet([
        SCALE_KEY,
        ROMAJI_KEY,
      ]);
      if (cancelled) return;

      if (scale[1] && scale[1] in TEXT_SCALE_FACTOR) {
        setScale(scale[1] as TextScale);
      }
      // Romaji defaults ON: someone opening the chart for the first time cannot read kana
      // yet — that is why they are there — so hiding the readings by default would make the
      // screen useless to exactly the person it is for.
      if (romaji[1] === "false") setRomaji(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setTextScale = useCallback((scale: TextScale) => {
    setScale(scale);
    AsyncStorage.setItem(SCALE_KEY, scale);
  }, []);

  const setShowRomaji = useCallback((show: boolean) => {
    setRomaji(show);
    AsyncStorage.setItem(ROMAJI_KEY, show ? "true" : "false");
  }, []);

  return { textScale, showRomaji, setTextScale, setShowRomaji };
}
