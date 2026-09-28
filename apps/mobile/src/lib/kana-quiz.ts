import {
  KANA_ORDER,
  KANA_SECTIONS,
  type KanaCard,
  type KanaEntry,
} from "@/constants/kana";

/**
 * The kana quiz's rules, kept free of React and storage so they can be read on their own.
 *
 * Two modes over the same picked deck:
 *  - easy: the character, and four romaji to choose from.
 *  - hard: the character, and a box to type the romaji into.
 *
 * Answers are compared by ROMAJI, never by character. じゃ and ぢゃ are both "ja", as are じ/ぢ
 * and ず/づ; comparing characters would mark someone wrong for giving the right sound, and a
 * multiple-choice question could offer "ja" twice with only one of them counted.
 */

export type QuizMode = "easy" | "hard";

export type QuizAnswer = {
  card: KanaCard;
  /** What the learner chose or typed, as they gave it. Empty if they submitted nothing. */
  given: string;
  correct: boolean;
  /** From the question appearing to the answer landing. */
  ms: number;
};

/** How many choices an easy question offers, the right one included. */
export const CHOICE_COUNT = 4;

/**
 * Other ways people romanise the same sound. Hepburn is what the chart shows; Kunrei and
 * Nihon-shiki are what a lot of learners were taught first, and what an IME accepts, so
 * typing "si" for し is a spelling choice rather than a wrong answer.
 *
 * Keyed by the chart's Hepburn so it applies to both scripts at once. The ぢ/づ family's own
 * spellings live on those entries (`alt` in constants/kana.ts): "di" is right for ぢ but would
 * be wrong for じ, which shares "ji" here.
 */
const ROMANISATIONS: Record<string, string[]> = {
  shi: ["si"],
  chi: ["ti"],
  tsu: ["tu"],
  fu: ["hu"],
  ji: ["zi"],
  sha: ["sya"],
  shu: ["syu"],
  sho: ["syo"],
  cha: ["tya", "cya"],
  chu: ["tyu", "cyu"],
  cho: ["tyo", "cyo"],
  ja: ["zya", "jya"],
  ju: ["zyu", "jyu"],
  jo: ["zyo", "jyo"],
  // を is pronounced お in modern Japanese, and "o" is how most people hear it.
  wo: ["o"],
  n: ["nn"],
};

/**
 * Lowercased, with spaces and the punctuation people type between syllables removed.
 * "N'", " shi " and "Shi" are all the same answer.
 */
export function normaliseRomaji(input: string): string {
  return input.toLowerCase().replace(/[\s'’\-.]/g, "");
}

/** Every spelling the typed quiz takes for this character. */
export function acceptedAnswers(entry: KanaEntry): Set<string> {
  return new Set([
    entry.romaji,
    ...(ROMANISATIONS[entry.romaji] ?? []),
    ...(entry.alt ?? []),
  ]);
}

export function isCorrectAnswer(entry: KanaEntry, input: string): boolean {
  const answer = normaliseRomaji(input);
  return answer.length > 0 && acceptedAnswers(entry).has(answer);
}

/** Which section each character sits in, for choosing distractors that look like it. */
const SECTION_OF = new Map<KanaEntry, string>(
  KANA_SECTIONS.flatMap((section) =>
    section.rows
      .flat()
      .filter((cell): cell is KanaEntry => cell !== null)
      .map((entry) => [entry, section.id] as const),
  ),
);

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a !== undefined && b !== undefined) {
      copy[i] = b;
      copy[j] = a;
    }
  }
  return copy;
}

/**
 * Four romaji for an easy question: the right one and three that are not.
 *
 * Distractors come from the SAME section first. A yōon question answered from "a", "ka",
 * "mo" and "kya" is solved by counting letters rather than by reading; drawing from its own
 * section makes every option look like a plausible answer to that character. The rest of the
 * chart only fills in if a section runs short.
 *
 * Deduplicated by romaji, and the right answer's romaji is never used as a distractor — which
 * is what keeps ぢゃ from being offered "ja" twice.
 */
export function buildChoices(card: KanaCard): string[] {
  const { entry } = card;
  const section = SECTION_OF.get(entry);

  const candidates = KANA_ORDER.filter(
    (other) => other !== entry && other.romaji !== entry.romaji,
  );
  const preferred = shuffled(
    candidates.filter((other) => SECTION_OF.get(other) === section),
  );
  const fallback = shuffled(
    candidates.filter((other) => SECTION_OF.get(other) !== section),
  );

  const distractors: string[] = [];
  for (const other of [...preferred, ...fallback]) {
    if (distractors.length === CHOICE_COUNT - 1) break;
    if (!distractors.includes(other.romaji)) distractors.push(other.romaji);
  }

  return shuffled([entry.romaji, ...distractors]);
}

export type QuizSummary = {
  correct: number;
  total: number;
  /** Sum of the per-question times: time spent answering, not time the screen was open. */
  totalMs: number;
  averageMs: number;
};

export function summariseQuiz(answers: QuizAnswer[]): QuizSummary {
  const correct = answers.filter((answer) => answer.correct).length;
  const totalMs = answers.reduce((sum, answer) => sum + answer.ms, 0);
  return {
    correct,
    total: answers.length,
    totalMs,
    averageMs: answers.length ? totalMs / answers.length : 0,
  };
}

/** "1.6 s". One decimal: a tenth of a second is the difference a learner can feel. */
export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

/** "0:42", or "12:05" for a long session. */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
