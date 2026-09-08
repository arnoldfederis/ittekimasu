import { KANA_ORDER } from "@/constants/kana";

/**
 * Kana → romaji, for the learners who cannot read kana yet.
 *
 * Built from `constants/kana.ts` rather than a second table of its own: the chart is already
 * the app's one source for what each character says, and a parallel mapping would drift the
 * first time someone corrects a reading in one of them.
 *
 * This is DISPLAY only. Nothing spoken goes through here — `speech.ts` always says the kana,
 * because a Japanese voice reading "otoko" pronounces an English word.
 */

/** Two-character combinations first (きゃ), or きゃ would come out as "kiya". */
const DIGRAPHS = new Map<string, string>();
const SINGLES = new Map<string, string>();

for (const entry of KANA_ORDER) {
  const target = entry.hiragana.length > 1 ? DIGRAPHS : SINGLES;
  target.set(entry.hiragana, entry.romaji);
  target.set(entry.katakana, entry.romaji);
}

/** っ doubles the consonant that follows it: きって → kitte. */
const SOKUON = new Set(["っ", "ッ"]);

/** The katakana長音 mark holds the previous vowel: コーヒー → koohii. */
const LONG_MARK = "ー";

const VOWELS = new Set(["a", "i", "u", "e", "o"]);

/** Small vowels that follow a kana in loan words (ファ, ティ) — not syllables on their own,
 * and deliberately absent from the chart, so they are approximated here rather than dropped. */
const SMALL_VOWELS = new Map([
  ["ぁ", "a"],
  ["ぃ", "i"],
  ["ぅ", "u"],
  ["ぇ", "e"],
  ["ぉ", "o"],
  ["ァ", "a"],
  ["ィ", "i"],
  ["ゥ", "u"],
  ["ェ", "e"],
  ["ォ", "o"],
]);

/**
 * Transliterates a kana string. Anything that is not kana — kanji, latin, punctuation, the
 * `·` separator — passes through untouched, so a half-kana string degrades to a half-
 * transliterated one instead of disappearing.
 */
export function toRomaji(text: string): string {
  let out = "";
  let i = 0;

  while (i < text.length) {
    const pair = text.slice(i, i + 2);
    const digraph = DIGRAPHS.get(pair);
    if (digraph) {
      out += digraph;
      i += 2;
      continue;
    }

    const char = text[i];

    if (SOKUON.has(char)) {
      // Double whatever consonant comes next. Looking it up rather than assuming, because
      // the next kana may itself be a digraph (いっしょ → issho).
      const nextPair = text.slice(i + 1, i + 3);
      const next = DIGRAPHS.get(nextPair) ?? SINGLES.get(text[i + 1] ?? "");
      if (next && !VOWELS.has(next[0])) out += next[0];
      i += 1;
      continue;
    }

    if (char === LONG_MARK) {
      const last = out.at(-1);
      if (last && VOWELS.has(last)) out += last;
      i += 1;
      continue;
    }

    const small = SMALL_VOWELS.get(char);
    if (small) {
      out += small;
      i += 1;
      continue;
    }

    const single = SINGLES.get(char);
    if (single) {
      // ん before a vowel needs the apostrophe or the syllable boundary is lost:
      // しんいち is shin'ichi, not shinichi.
      const nextChar = text[i + 1] ?? "";
      const nextRomaji =
        DIGRAPHS.get(text.slice(i + 1, i + 3)) ?? SINGLES.get(nextChar) ?? "";
      if (single === "n" && nextRomaji && VOWELS.has(nextRomaji[0])) {
        out += "n'";
      } else {
        out += single;
      }
      i += 1;
      continue;
    }

    out += char;
    i += 1;
  }

  return out;
}

/**
 * A card's back, with the reading transliterated when the learner has asked for romaji.
 *
 * The back is `reading · meaning`, and only the reading is Japanese — running the whole
 * string through would leave the English meaning untouched anyway, but splitting makes that
 * explicit and keeps a meaning containing a kana loan word from being rewritten.
 */
export function formatBackText(backText: string, showRomaji: boolean): string {
  if (!showRomaji) return backText;

  const separator = backText.indexOf("·");
  if (separator === -1) return toRomaji(backText);

  const reading = backText.slice(0, separator);
  const rest = backText.slice(separator);
  return toRomaji(reading) + rest;
}
