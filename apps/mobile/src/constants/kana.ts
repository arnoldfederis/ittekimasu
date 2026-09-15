/**
 * The two kana syllabaries, in the app rather than the database.
 *
 * Kana used to be two decks of 104 cards each, scheduled by SM-2 like vocabulary. That was
 * wrong: a syllabary is a TABLE you learn to read off, not 104 independent facts, and
 * spacing あ six days out because it was answered correctly is the algorithm working against
 * the material. It also made the first ten minutes of the app feel like an exam.
 *
 * Living here rather than in `courses`/`cards` means the chart needs no request, no progress
 * rows, and no daily allowance — it opens instantly and offline, on a screen the learner
 * will come back to for weeks.
 *
 * Hiragana and katakana share one structure on purpose. Two parallel tables drift the moment
 * someone fixes a romaji in one of them.
 *
 * Coverage: 46 gojūon + 25 dakuten/handakuten + 33 yōon = 104 per script, the same set the
 * decks carried. Still deliberately excluded: the katakana long-vowel mark ー and the
 * extended foreign-sound combinations (ファ, ティ, ウェ) — they matter for reading menus, but
 * neither is a syllable you can sound out on its own.
 */

export type KanaScript = "hiragana" | "katakana";

export type KanaEntry = {
  hiragana: string;
  katakana: string;
  romaji: string;
  /** Shown under the romaji in the sheet. Only where the character needs a caveat. */
  note?: string;
};

/** A gap in the grid — や has no い or え column. Keeps the table aligned. */
export type KanaCell = KanaEntry | null;

export type KanaSection = {
  id: string;
  title: string;
  caption: string;
  /** Cells per row, so the chart lays out without measuring anything. */
  columns: number;
  rows: KanaCell[][];
};

const GOJUON: KanaSection = {
  id: "gojuon",
  title: "Gojūon",
  caption: "The 46 basic sounds. Everything else is built from these.",
  columns: 5,
  rows: [
    [
      { hiragana: "あ", katakana: "ア", romaji: "a" },
      { hiragana: "い", katakana: "イ", romaji: "i" },
      { hiragana: "う", katakana: "ウ", romaji: "u" },
      { hiragana: "え", katakana: "エ", romaji: "e" },
      { hiragana: "お", katakana: "オ", romaji: "o" },
    ],
    [
      { hiragana: "か", katakana: "カ", romaji: "ka" },
      { hiragana: "き", katakana: "キ", romaji: "ki" },
      { hiragana: "く", katakana: "ク", romaji: "ku" },
      { hiragana: "け", katakana: "ケ", romaji: "ke" },
      { hiragana: "こ", katakana: "コ", romaji: "ko" },
    ],
    [
      { hiragana: "さ", katakana: "サ", romaji: "sa" },
      { hiragana: "し", katakana: "シ", romaji: "shi" },
      { hiragana: "す", katakana: "ス", romaji: "su" },
      { hiragana: "せ", katakana: "セ", romaji: "se" },
      { hiragana: "そ", katakana: "ソ", romaji: "so" },
    ],
    [
      { hiragana: "た", katakana: "タ", romaji: "ta" },
      { hiragana: "ち", katakana: "チ", romaji: "chi" },
      { hiragana: "つ", katakana: "ツ", romaji: "tsu" },
      { hiragana: "て", katakana: "テ", romaji: "te" },
      { hiragana: "と", katakana: "ト", romaji: "to" },
    ],
    [
      { hiragana: "な", katakana: "ナ", romaji: "na" },
      { hiragana: "に", katakana: "ニ", romaji: "ni" },
      { hiragana: "ぬ", katakana: "ヌ", romaji: "nu" },
      { hiragana: "ね", katakana: "ネ", romaji: "ne" },
      { hiragana: "の", katakana: "ノ", romaji: "no" },
    ],
    [
      { hiragana: "は", katakana: "ハ", romaji: "ha" },
      { hiragana: "ひ", katakana: "ヒ", romaji: "hi" },
      { hiragana: "ふ", katakana: "フ", romaji: "fu" },
      { hiragana: "へ", katakana: "ヘ", romaji: "he" },
      { hiragana: "ほ", katakana: "ホ", romaji: "ho" },
    ],
    [
      { hiragana: "ま", katakana: "マ", romaji: "ma" },
      { hiragana: "み", katakana: "ミ", romaji: "mi" },
      { hiragana: "む", katakana: "ム", romaji: "mu" },
      { hiragana: "め", katakana: "メ", romaji: "me" },
      { hiragana: "も", katakana: "モ", romaji: "mo" },
    ],
    [
      { hiragana: "や", katakana: "ヤ", romaji: "ya" },
      null,
      { hiragana: "ゆ", katakana: "ユ", romaji: "yu" },
      null,
      { hiragana: "よ", katakana: "ヨ", romaji: "yo" },
    ],
    [
      { hiragana: "ら", katakana: "ラ", romaji: "ra" },
      { hiragana: "り", katakana: "リ", romaji: "ri" },
      { hiragana: "る", katakana: "ル", romaji: "ru" },
      { hiragana: "れ", katakana: "レ", romaji: "re" },
      { hiragana: "ろ", katakana: "ロ", romaji: "ro" },
    ],
    [
      { hiragana: "わ", katakana: "ワ", romaji: "wa" },
      null,
      null,
      null,
      {
        hiragana: "を",
        katakana: "ヲ",
        romaji: "wo",
        note: "Only ever the object particle, and pronounced 'o'.",
      },
    ],
    [
      {
        hiragana: "ん",
        katakana: "ン",
        romaji: "n",
        note: "The only kana that is a consonant on its own.",
      },
      null,
      null,
      null,
      null,
    ],
  ],
};

const DAKUTEN: KanaSection = {
  id: "dakuten",
  title: "Dakuten",
  caption: "The same shapes with two strokes, or a circle, added.",
  columns: 5,
  rows: [
    [
      { hiragana: "が", katakana: "ガ", romaji: "ga" },
      { hiragana: "ぎ", katakana: "ギ", romaji: "gi" },
      { hiragana: "ぐ", katakana: "グ", romaji: "gu" },
      { hiragana: "げ", katakana: "ゲ", romaji: "ge" },
      { hiragana: "ご", katakana: "ゴ", romaji: "go" },
    ],
    [
      { hiragana: "ざ", katakana: "ザ", romaji: "za" },
      { hiragana: "じ", katakana: "ジ", romaji: "ji" },
      { hiragana: "ず", katakana: "ズ", romaji: "zu" },
      { hiragana: "ぜ", katakana: "ゼ", romaji: "ze" },
      { hiragana: "ぞ", katakana: "ゾ", romaji: "zo" },
    ],
    [
      { hiragana: "だ", katakana: "ダ", romaji: "da" },
      {
        hiragana: "ぢ",
        katakana: "ヂ",
        romaji: "ji",
        note: "Rare. じ does this job in almost every word.",
      },
      {
        hiragana: "づ",
        katakana: "ヅ",
        romaji: "zu",
        note: "Rare. ず does this job in almost every word.",
      },
      { hiragana: "で", katakana: "デ", romaji: "de" },
      { hiragana: "ど", katakana: "ド", romaji: "do" },
    ],
    [
      { hiragana: "ば", katakana: "バ", romaji: "ba" },
      { hiragana: "び", katakana: "ビ", romaji: "bi" },
      { hiragana: "ぶ", katakana: "ブ", romaji: "bu" },
      { hiragana: "べ", katakana: "ベ", romaji: "be" },
      { hiragana: "ぼ", katakana: "ボ", romaji: "bo" },
    ],
    [
      { hiragana: "ぱ", katakana: "パ", romaji: "pa" },
      { hiragana: "ぴ", katakana: "ピ", romaji: "pi" },
      { hiragana: "ぷ", katakana: "プ", romaji: "pu" },
      { hiragana: "ぺ", katakana: "ペ", romaji: "pe" },
      { hiragana: "ぽ", katakana: "ポ", romaji: "po" },
    ],
  ],
};

const YOON: KanaSection = {
  id: "yoon",
  title: "Yōon",
  caption: "A small や, ゆ or よ glides onto the sound before it.",
  columns: 3,
  rows: [
    [
      { hiragana: "きゃ", katakana: "キャ", romaji: "kya" },
      { hiragana: "きゅ", katakana: "キュ", romaji: "kyu" },
      { hiragana: "きょ", katakana: "キョ", romaji: "kyo" },
    ],
    [
      { hiragana: "しゃ", katakana: "シャ", romaji: "sha" },
      { hiragana: "しゅ", katakana: "シュ", romaji: "shu" },
      { hiragana: "しょ", katakana: "ショ", romaji: "sho" },
    ],
    [
      { hiragana: "ちゃ", katakana: "チャ", romaji: "cha" },
      { hiragana: "ちゅ", katakana: "チュ", romaji: "chu" },
      { hiragana: "ちょ", katakana: "チョ", romaji: "cho" },
    ],
    [
      { hiragana: "にゃ", katakana: "ニャ", romaji: "nya" },
      { hiragana: "にゅ", katakana: "ニュ", romaji: "nyu" },
      { hiragana: "にょ", katakana: "ニョ", romaji: "nyo" },
    ],
    [
      { hiragana: "ひゃ", katakana: "ヒャ", romaji: "hya" },
      { hiragana: "ひゅ", katakana: "ヒュ", romaji: "hyu" },
      { hiragana: "ひょ", katakana: "ヒョ", romaji: "hyo" },
    ],
    [
      { hiragana: "みゃ", katakana: "ミャ", romaji: "mya" },
      { hiragana: "みゅ", katakana: "ミュ", romaji: "myu" },
      { hiragana: "みょ", katakana: "ミョ", romaji: "myo" },
    ],
    [
      { hiragana: "りゃ", katakana: "リャ", romaji: "rya" },
      { hiragana: "りゅ", katakana: "リュ", romaji: "ryu" },
      { hiragana: "りょ", katakana: "リョ", romaji: "ryo" },
    ],
    [
      { hiragana: "ぎゃ", katakana: "ギャ", romaji: "gya" },
      { hiragana: "ぎゅ", katakana: "ギュ", romaji: "gyu" },
      { hiragana: "ぎょ", katakana: "ギョ", romaji: "gyo" },
    ],
    [
      { hiragana: "じゃ", katakana: "ジャ", romaji: "ja" },
      { hiragana: "じゅ", katakana: "ジュ", romaji: "ju" },
      { hiragana: "じょ", katakana: "ジョ", romaji: "jo" },
    ],
    [
      { hiragana: "びゃ", katakana: "ビャ", romaji: "bya" },
      { hiragana: "びゅ", katakana: "ビュ", romaji: "byu" },
      { hiragana: "びょ", katakana: "ビョ", romaji: "byo" },
    ],
    [
      { hiragana: "ぴゃ", katakana: "ピャ", romaji: "pya" },
      { hiragana: "ぴゅ", katakana: "ピュ", romaji: "pyu" },
      { hiragana: "ぴょ", katakana: "ピョ", romaji: "pyo" },
    ],
  ],
};

export const KANA_SECTIONS: KanaSection[] = [GOJUON, DAKUTEN, YOON];

/**
 * Every kana in reading order, which is the order the sheet swipes through: across each row,
 * then down, then on to the next section. Swiping right from ん lands on が, which is where
 * a chart reader's eye goes next anyway.
 */
export const KANA_ORDER: KanaEntry[] = KANA_SECTIONS.flatMap((section) =>
  section.rows.flat().filter((cell): cell is KanaEntry => cell !== null),
);

export const KANA_COUNT = KANA_ORDER.length;

export function glyphOf(entry: KanaEntry, script: KanaScript): string {
  return script === "hiragana" ? entry.hiragana : entry.katakana;
}

/** Where a character sits in KANA_ORDER, for opening the sheet at the tapped cell. */
export function indexOfKana(entry: KanaEntry): number {
  return KANA_ORDER.indexOf(entry);
}

/**
 * The whole syllabary in random order, for the shuffle mode on the chart.
 *
 * Reading order is what makes the chart a chart — あいうえお is a shape you memorise, and
 * swiping through it reinforces that shape. Which is exactly why it is useless for testing
 * yourself: by the third row you are reciting the sequence, not reading the character.
 * Shuffling breaks that, and nothing else about the sheet changes.
 *
 * Fisher-Yates over a copy. A `sort(() => Math.random() - 0.5)` is not a shuffle — the
 * comparator is inconsistent, so the result is biased and V8's sort may not even terminate
 * sensibly on it.
 */
export function shuffledKanaOrder(): KanaEntry[] {
  const shuffled = [...KANA_ORDER];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = shuffled[i];
    const b = shuffled[j];
    // Indices are in range by construction; the guard is for noUncheckedIndexedAccess.
    if (a !== undefined && b !== undefined) {
      shuffled[i] = b;
      shuffled[j] = a;
    }
  }
  return shuffled;
}
