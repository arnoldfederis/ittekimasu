import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";

/** Persisted so someone who studies on a train isn't re-muting every session. */
const SOUND_KEY = "review.sound";

/** Chosen voice identifier, or absent to let the system pick. */
const VOICE_KEY = "review.voice";

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
