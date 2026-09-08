import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAudioModeAsync } from "expo-audio";
import * as Speech from "expo-speech";

/** Persisted so someone who studies on a train isn't re-muting every session. */
const SOUND_KEY = "review.sound";

/** Chosen voice identifier, or absent to let the system pick. */
const VOICE_KEY = "review.voice";

/** Set once the "check your silent switch" hint has been dismissed. */
const AUDIO_HINT_KEY = "review.audioHintSeen";

/** Opt-in: speak even when the ring/silent switch is off. */
const SILENT_MODE_KEY = "review.playInSilentMode";

/**
 * Japanese. iOS picks its own Japanese voice (Kyoko on most devices); naming a specific
 * voice id would break on any device that doesn't have it installed.
 */
const LANGUAGE = "ja-JP";

/**
 * Slightly under natural pace. Vocabulary is heard once and repeated back, and the default
 * rate clips short words like きょう before the learner has registered them.
 */
const RATE = 0.85;

/**
 * The reading, split out of the card's back text.
 *
 * Back text is stored as `reading · meaning` in one column, so speaking it whole would read
 * the English gloss aloud too. Splitting is the pragmatic fix; a dedicated `reading` column
 * is the correct one, and worth doing before this grows a listening card type.
 *
 * Returns null when there is no separator, so a malformed row stays silent rather than
 * having an English sentence read out in a Japanese voice.
 */
export function readingOf(backText: string): string | null {
  const [reading] = backText.split("·");
  const trimmed = reading?.trim();
  return trimmed && trimmed !== backText.trim() ? trimmed : null;
}

/**
 * What to say out loud for a card.
 *
 * A vocabulary card carries its reading on the back, before the `·`. The fallback to the
 * front is what keeps a card whose back has no reading segment from being read out in
 * English by a Japanese voice — kana used to be exactly that case, and although the chart
 * now speaks its glyphs directly (components/kana-sheet.tsx), any future deck that puts the
 * spoken form on the front gets the same protection.
 */
export function spokenTextOf(
  frontText: string | undefined,
  backText: string | undefined,
): string | null {
  const reading = readingOf(backText ?? "");
  if (reading) return reading;

  const front = frontText?.trim();
  return front ? front : null;
}

/**
 * Japanese voices installed on THIS device.
 *
 * Apps cannot bundle or download system voices — iOS ships Kyoko and the user adds others
 * (Otoya, the Enhanced variants) in Settings → Accessibility → Spoken Content → Voices. So
 * this list is frequently one entry long, and the UI has to cope with that.
 */
export async function japaneseVoices(): Promise<Speech.Voice[]> {
  const all = await Speech.getAvailableVoicesAsync();
  return all.filter((voice) => voice.language.toLowerCase().startsWith("ja"));
}

export async function getSelectedVoice(): Promise<string | null> {
  return AsyncStorage.getItem(VOICE_KEY);
}

export async function setSelectedVoice(
  identifier: string | null,
): Promise<void> {
  if (identifier === null) {
    await AsyncStorage.removeItem(VOICE_KEY);
    return;
  }
  await AsyncStorage.setItem(VOICE_KEY, identifier);
}

/**
 * Whether to show the silent-switch hint.
 *
 * iOS silences AVSpeechSynthesizer when the ring/silent switch is on, with no error and no
 * callback — the app cannot detect it, and the learner just gets nothing. Since we cannot
 * know, we tell them once and let them dismiss it.
 */
export async function shouldShowAudioHint(): Promise<boolean> {
  return (await AsyncStorage.getItem(AUDIO_HINT_KEY)) !== "true";
}

export async function dismissAudioHint(): Promise<void> {
  await AsyncStorage.setItem(AUDIO_HINT_KEY, "true");
}

export async function playsInSilentMode(): Promise<boolean> {
  // OFF by default, deliberately. Overriding the silent switch without being asked means a
  // phone that speaks Japanese out loud in a meeting — the exact thing the user flipped
  // that switch to prevent. Opt-in only.
  return (await AsyncStorage.getItem(SILENT_MODE_KEY)) === "true";
}

export async function setPlaysInSilentMode(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(SILENT_MODE_KEY, enabled ? "true" : "false");
  await applyAudioMode();
}

/**
 * Pushes the preference into the process-wide audio session.
 *
 * AVAudioSession is shared across the app, so setting the category here is what lets
 * expo-speech play through the mute switch — expo-speech has no such option of its own.
 */
export async function applyAudioMode(): Promise<void> {
  try {
    await setAudioModeAsync({ playsInSilentMode: await playsInSilentMode() });
  } catch {
    // A failed session change just means the default behaviour stands. Not worth a toast:
    // the silent-switch hint already covers "why can't I hear anything".
  }
}

export async function isSoundEnabled(): Promise<boolean> {
  // Defaults ON: hearing the word is the point of the feature, and it is one tap to mute.
  return (await AsyncStorage.getItem(SOUND_KEY)) !== "false";
}

export async function setSoundEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(SOUND_KEY, enabled ? "true" : "false");
  if (!enabled) {
    Speech.stop();
  }
}

/**
 * Speaks a reading. Silently does nothing if the text isn't usable.
 *
 * `voice` is passed through untouched when set. A stored identifier can go stale — the user
 * deletes the voice, or restores onto a new phone — and iOS falls back to its own Japanese
 * voice in that case rather than failing, which is the behaviour we want.
 */
export function speakReading(
  reading: string | null,
  voice?: string | null,
): void {
  if (!reading) return;

  // Cancels anything still playing, so tapping quickly through cards doesn't queue up a
  // backlog of words that arrive over the top of each other.
  Speech.stop();
  Speech.speak(reading, {
    language: LANGUAGE,
    rate: RATE,
    ...(voice ? { voice } : {}),
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}
