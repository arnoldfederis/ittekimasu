import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

/**
 * How the kana chart and the vocabulary cards are DISPLAYED. Device-only: these change
 * nothing about scheduling, so sending them to the server would turn a toggle into a request.
 *
 * ## Two scopes, not one shared pair
 *
 * The kana chart and a JLPT card are read at different sizes for different reasons — a
 * single glyph you are studying the shape of, against a word with a reading and a gloss
 * underneath it. Sharing one scale meant sizing the chart also resized every card, and the
 * setting ended up parked wherever it hurt least. They are separate now, each reachable from
 * the screen it affects.
 *
 * Romaji only exists for cards. The kana chart always shows readings while you are browsing
 * it — someone opening the chart cannot read kana yet, which is the entire reason they are
 * there — and practice hides them by definition, since the reading IS the answer being
 * tested. A preference for it would only ever have been a way to break one of those two.
 *
 * ## Why this is a store and not `useState` per caller
 *
 * It used to be a hook with its own state, which worked only because the one place that
 * could change it was a screen you had to navigate to and back from — the remount did the
 * refreshing. The settings now open as a sheet sitting ON TOP of the thing they change, so
 * the screen underneath has to hear about it.
 *
 * `useSyncExternalStore` rather than a context provider: there is nothing to scope, and a
 * provider in the root layout would put a re-render of the whole app behind a preference
 * that only ever touches type.
 */
const KANA_SCALE_KEY = "display.kana.textScale";
const KANA_STROKE_KEY = "display.kana.strokeOrder";
const CARD_SCALE_KEY = "display.cards.textScale";
const CARD_ROMAJI_KEY = "display.cards.romaji";
const CARD_STROKE_KEY = "display.cards.strokeOrder";

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

function isTextScale(value: string | null): value is TextScale {
  return value !== null && value in TEXT_SCALE_FACTOR;
}

type Snapshot = {
  kanaScale: TextScale;
  cardScale: TextScale;
  /** Cards only: rewrites the READING half of a back, `おとこ · man` into `otoko · man`. */
  cardRomaji: boolean;
  /*
   * Stroke order, remembered.
   *
   * It began as component state and died with the screen — closing the sheet, or stepping
   * out to the Learn tab and back, turned it off again. Someone who wants to see how a
   * character is written wants that for the next one too, and for the next session; having
   * to switch it on at every character is the round trip that got the toggle moved onto the
   * card in the first place. Scoped like the rest: the chart and the vocabulary cards are
   * different surfaces, and a learner may well want it on one and not the other.
   */
  kanaStroke: boolean;
  cardStroke: boolean;
};

let snapshot: Snapshot = {
  kanaScale: "default",
  cardScale: "default",
  cardRomaji: true,
  kanaStroke: false,
  cardStroke: false,
};

const listeners = new Set<() => void>();
let hydrating: Promise<void> | null = null;

/**
 * Replaced, never mutated: `useSyncExternalStore` compares the snapshot by identity and
 * would skip the render if the same object came back with different fields.
 */
function commit(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

/** Reads the stored values once per launch, on the first subscriber. */
function hydrate() {
  hydrating ??= (async () => {
    const [kanaScale, cardScale, cardRomaji, kanaStroke, cardStroke] =
      await AsyncStorage.multiGet([
        KANA_SCALE_KEY,
        CARD_SCALE_KEY,
        CARD_ROMAJI_KEY,
        KANA_STROKE_KEY,
        CARD_STROKE_KEY,
      ]);

    commit({
      ...(isTextScale(kanaScale[1]) ? { kanaScale: kanaScale[1] } : {}),
      ...(isTextScale(cardScale[1]) ? { cardScale: cardScale[1] } : {}),
      ...(cardRomaji[1] === "false" ? { cardRomaji: false } : {}),
      ...(kanaStroke[1] === "true" ? { kanaStroke: true } : {}),
      ...(cardStroke[1] === "true" ? { cardStroke: true } : {}),
    });
  })();

  return hydrating;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  hydrate();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

// Module-level so the identities are stable across renders and the objects returned by the
// hooks can be rebuilt freely.
function setKanaScale(scale: TextScale) {
  commit({ kanaScale: scale });
  AsyncStorage.setItem(KANA_SCALE_KEY, scale);
}

function setCardScale(scale: TextScale) {
  commit({ cardScale: scale });
  AsyncStorage.setItem(CARD_SCALE_KEY, scale);
}

function setCardRomaji(show: boolean) {
  commit({ cardRomaji: show });
  AsyncStorage.setItem(CARD_ROMAJI_KEY, show ? "true" : "false");
}

function setKanaStroke(on: boolean) {
  commit({ kanaStroke: on });
  AsyncStorage.setItem(KANA_STROKE_KEY, on ? "true" : "false");
}

function setCardStroke(on: boolean) {
  commit({ cardStroke: on });
  AsyncStorage.setItem(CARD_STROKE_KEY, on ? "true" : "false");
}

export type KanaDisplayPrefs = {
  textScale: TextScale;
  strokeOrder: boolean;
  setTextScale: (scale: TextScale) => void;
  setStrokeOrder: (on: boolean) => void;
};

export function useKanaDisplayPrefs(): KanaDisplayPrefs {
  const current = useSyncExternalStore(subscribe, getSnapshot);
  return {
    textScale: current.kanaScale,
    strokeOrder: current.kanaStroke,
    setTextScale: setKanaScale,
    setStrokeOrder: setKanaStroke,
  };
}

export type CardDisplayPrefs = {
  textScale: TextScale;
  showRomaji: boolean;
  strokeOrder: boolean;
  setTextScale: (scale: TextScale) => void;
  setShowRomaji: (show: boolean) => void;
  setStrokeOrder: (on: boolean) => void;
};

export function useCardDisplayPrefs(): CardDisplayPrefs {
  const current = useSyncExternalStore(subscribe, getSnapshot);
  return {
    textScale: current.cardScale,
    showRomaji: current.cardRomaji,
    strokeOrder: current.cardStroke,
    setTextScale: setCardScale,
    setShowRomaji: setCardRomaji,
    setStrokeOrder: setCardStroke,
  };
}
