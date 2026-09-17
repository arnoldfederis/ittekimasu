#!/usr/bin/env bun
/**
 * Derive `src/constants/kana-strokes.ts` — the stroke order for every kana the chart shows.
 *
 *   bun run kana-strokes
 *
 * Same principle as generate-brand-assets.mjs: ONE source, one generator, nothing checked in
 * by hand. The character list is read out of `src/constants/kana.ts` rather than typed here,
 * so adding a kana to the chart and forgetting its strokes is not a thing that can happen —
 * the next run picks it up, or fails loudly because upstream has no glyph for it.
 *
 * ## Source and licence
 *
 * Upstream is zhengkyl/strokesvg, pinned to a commit. Its kana SVGs are traced from the
 * Klee One font and carry the **SIL Open Font License 1.1**, NOT the repo's MIT — the
 * LICENSE file splits them out explicitly. What this script writes is a Modified Version of
 * that Font Software, so the output stays OFL and carries the notice.
 * `app/acknowledgements.tsx` shows it in the app, which is what OFL condition 2 asks for.
 *
 * KanjiVG is the better-known source and was the obvious first choice. It is CC BY-SA 3.0,
 * whose section 4(a) forbids distributing the work under "effective technological measures"
 * that stop a recipient exercising their rights — and an App Store binary is FairPlay
 * encrypted. That is the same clause that keeps GPL apps off the store, and CC BY-SA 4.0
 * keeps an equivalent bar in 2(a)(5)(B), so relicensing forward does not help. OFL has no
 * such clause. It also happens to be the better artwork here: Klee One is handwriting
 * shaped, which is what someone learning to WRITE kana needs.
 *
 * ## Shape of the upstream file
 *
 * Each glyph is a 1024x1024 viewBox holding two groups:
 *
 *   - `shadows` — the filled OUTLINE of each stroke piece, each with an id. This is the
 *     artwork: fill them all and you have the finished character.
 *   - `strokes` — fat round-capped centrelines, each clipped to its shadow, for driving a
 *     dasharray reveal.
 *
 * `<defs>` wires the two together with `<clipPath><use href="#shadow"/></clipPath>`.
 *
 * **We keep the outlines and throw the centrelines away.** The chart draws a static numbered
 * diagram, not an animation: the whole character, with a numbered marker where each stroke
 * begins. That needs the shape and the starting point, and nothing else — so the centreline
 * is read here only to take its first coordinate, and never reaches the bundle. Dropping it
 * also drops the clip-path indirection, the per-path lengths, and a build dependency.
 *
 * A stroke that crosses itself (あ, ぬ, な) is split upstream into several outlines under one
 * `<g style="--i:N">`. That grouping is the stroke, so its pieces stay together under one
 * number rather than being counted as separate strokes.
 */

import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { KANA_ORDER } from "../src/constants/kana.ts";

const MOBILE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = resolve(MOBILE_DIR, "src/constants/kana-strokes.ts");
const LICENCE_FILE = resolve(
  MOBILE_DIR,
  "src/constants/kana-strokes-license.ts",
);

/**
 * Pinned, not `main`. An unpinned generator means re-running it months later can silently
 * redraw every character in the app, and the diff would be 148 unreadable path strings.
 */
const UPSTREAM_REPO = "zhengkyl/strokesvg";
const UPSTREAM_REF = "e4c2c91034e03c9c2f4e95f14f2361a948f52cd0";
const UPSTREAM_URL = `https://raw.githubusercontent.com/${UPSTREAM_REPO}/${UPSTREAM_REF}/dist`;

/** Upstream draws every glyph in this box, and the renderer assumes it. */
const VIEWBOX = 1024;

/** Polite to raw.githubusercontent, and 148 files is quick either way. */
const CONCURRENCY = 8;

/**
 * Every distinct character the chart can show, per script.
 *
 * Yoon are two characters (きゃ), and both halves are ordinary glyphs that appear on their
 * own elsewhere in the table — so the set is the CHARACTERS, not the cells, and a digraph is
 * assembled at render time by drawing one after the other. That is also how it is written.
 */
function charactersByScript() {
  const hiragana = new Set();
  const katakana = new Set();

  for (const entry of KANA_ORDER) {
    for (const char of entry.hiragana) hiragana.add(char);
    for (const char of entry.katakana) katakana.add(char);
  }

  return [
    ...[...hiragana].map((char) => ({ char, script: "hiragana" })),
    ...[...katakana].map((char) => ({ char, script: "katakana" })),
  ];
}

async function fetchGlyph(char, script) {
  const url = `${UPSTREAM_URL}/${script}/${encodeURIComponent(char)}.svg`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `${script} ${char} (U+${char.codePointAt(0).toString(16).toUpperCase()}): ` +
        `${response.status} from ${url}`,
    );
  }

  return response.text();
}

/**
 * Pull the stroke list out of one upstream SVG.
 *
 * Regex rather than a parser because the input is machine-generated and uniform — but the
 * assumptions it rests on are all asserted below, so a change upstream fails the run instead
 * of quietly emitting a glyph with no strokes.
 */
function parseGlyph(svg, label) {
  const shadowsAt = svg.indexOf('data-strokesvg="shadows"');
  const strokesAt = svg.indexOf('data-strokesvg="strokes"');

  if (shadowsAt === -1 || strokesAt === -1 || strokesAt < shadowsAt) {
    throw new Error(
      `${label}: no shadows/strokes groups — upstream format changed`,
    );
  }

  // Slicing on the group markers rather than matching <g>...</g>: the strokes group nests
  // another <g> for split strokes, and a lazy match would stop at the inner closing tag.
  const shadowsXml = svg.slice(shadowsAt, strokesAt);
  const strokesXml = svg.slice(strokesAt, svg.lastIndexOf("</svg>"));

  /** Shadow path id -> its outline. */
  const shadowById = new Map();
  for (const match of shadowsXml.matchAll(
    /<path\s+id="([^"]+)"\s+d="([^"]+)"/g,
  )) {
    shadowById.set(match[1], match[2]);
  }

  /** clipPath id -> shadow path id, the <defs> indirection we resolve away here. */
  const shadowByClip = new Map();
  for (const match of svg.matchAll(
    /<clipPath id="([^"]+)">\s*<use href="#([^"]+)"\s*\/>\s*<\/clipPath>/g,
  )) {
    shadowByClip.set(match[1], match[2]);
  }

  /*
   * One pass over the strokes group in document order. `--i:N` is the stroke's number, and it
   * sits in one of two places: on the path itself for an ordinary stroke, or on the <g>
   * wrapping the pieces of a self-crossing one. A path's own index wins; otherwise it
   * inherits the group it is inside. (The outer `strokes` group carries no index, so it
   * contributes nothing here.)
   *
   * The centreline is read for its first coordinate and then discarded — see the header.
   */
  const byIndex = new Map();
  let groupIndex = -1;

  for (const token of strokesXml.matchAll(/<g([^>]*)>|<path([^>]*)\/>/g)) {
    if (token[1] !== undefined) {
      const index = /--i:(\d+)/.exec(token[1])?.[1];
      if (index !== undefined) groupIndex = Number(index);
      continue;
    }

    const attrs = token[2];
    const d = /\sd="([^"]+)"/.exec(attrs)?.[1];
    const clipId = /clip-path="url\(#([^)]+)\)"/.exec(attrs)?.[1];
    const own = /--i:(\d+)/.exec(attrs)?.[1];
    const current = own === undefined ? groupIndex : Number(own);

    if (!d) throw new Error(`${label}: stroke path with no d`);
    if (current < 0) {
      throw new Error(`${label}: stroke path with no --i index`);
    }

    const outline =
      clipId === undefined
        ? undefined
        : shadowById.get(shadowByClip.get(clipId));
    if (!outline) {
      throw new Error(`${label}: stroke ${current} has no resolvable outline`);
    }

    const stroke = byIndex.get(current) ?? { start: null, outlines: [] };
    // The first piece in document order is where the stroke begins.
    stroke.start ??= startPoint(d, label);
    stroke.outlines.push(outline);
    byIndex.set(current, stroke);
  }

  if (byIndex.size === 0) throw new Error(`${label}: no strokes found`);

  // Keyed by number while parsing and flattened here, so a gap in the --i values is caught
  // rather than becoming a hole in an array the renderer walks by position.
  const strokes = [];
  const last = Math.max(...byIndex.keys());
  for (let slot = 0; slot <= last; slot++) {
    const stroke = byIndex.get(slot);
    if (!stroke) throw new Error(`${label}: stroke index ${slot} is missing`);
    strokes.push(stroke);
  }

  return strokes;
}

/**
 * Where a stroke begins, which is where its number goes.
 *
 * The first command of an SVG path is a moveto whose coordinates are absolute even when it
 * is written lowercase, so the first two numbers are the point with no path state to track.
 */
function startPoint(d, label) {
  const match = /^\s*[Mm]\s*(-?[\d.]+)[,\s]+(-?[\d.]+)/.exec(d);
  if (!match) throw new Error(`${label}: path does not start with a moveto`);
  return [Math.round(Number(match[1])), Math.round(Number(match[2]))];
}

async function mapWithLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

function serialise(glyphs) {
  const entries = glyphs.map(({ char, strokes }) => {
    const strokeLiterals = strokes.map((stroke) => {
      const outlines = stroke.outlines.map((d) => JSON.stringify(d)).join(", ");
      return `{ start: [${stroke.start[0]}, ${stroke.start[1]}], outlines: [${outlines}] }`;
    });

    return `  ${JSON.stringify(char)}: [${strokeLiterals.join(", ")}],`;
  });

  return `/**
 * Stroke order for every kana in the chart. GENERATED — do not edit.
 *
 *   bun run kana-strokes
 *
 * Source: apps/mobile/scripts/generate-kana-strokes.mjs, which derives the character list
 * from constants/kana.ts and subsets ${UPSTREAM_REPO} at ${UPSTREAM_REF.slice(0, 12)}.
 *
 * -------------------------------------------------------------------------------------
 * These outlines are a Modified Version of Font Software under the SIL Open Font License
 * 1.1, traced from Klee One (Copyright (c) Fontworks Inc.) by way of ${UPSTREAM_REPO}.
 * This file is therefore also under the OFL, which is reproduced in the app on
 * Settings > About > Acknowledgements.
 *
 * "Klee" is a Reserved Font Name: nothing derived from this data may carry it.
 * -------------------------------------------------------------------------------------
 */

/** Upstream draws every glyph in this square, and the renderer maps it onto the card. */
export const KANA_STROKE_VIEWBOX = ${VIEWBOX};

export type KanaStroke = {
  /** Where the brush lands. The stroke's number is drawn here. */
  start: [number, number];
  /**
   * The stroke's shape, filled. Usually one path; a stroke that crosses itself is split
   * upstream into several, and they are ONE stroke sharing one number.
   */
  outlines: string[];
};

/** Keyed by the single character — a yoon is drawn as its two characters in turn. */
export const KANA_STROKES: Record<string, KanaStroke[]> = {
${entries.join("\n")}
};
`;
}

/**
 * Vendor upstream's own LICENSE verbatim, from the same pinned commit as the paths.
 *
 * OFL condition 2 wants the notice to travel with the Font Software, and the app is the only
 * thing being distributed — so it has to be readable in there, which is what
 * `app/acknowledgements.tsx` is for. Fetched rather than pasted so it cannot drift from the
 * data it covers: bumping UPSTREAM_REF re-pulls both or neither.
 */
async function fetchLicence() {
  const url = `https://raw.githubusercontent.com/${UPSTREAM_REPO}/${UPSTREAM_REF}/LICENSE`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`LICENSE: ${response.status} from ${url}`);

  const text = (await response.text()).trim();

  // Cheap proof we got the licence and not a 404 page or a redirect.
  for (const marker of ["SIL OPEN FONT LICENSE", "Klee", "MIT License"]) {
    if (!text.includes(marker)) {
      throw new Error(`LICENSE does not mention ${marker} — upstream changed`);
    }
  }

  return `/**
 * The licence covering src/constants/kana-strokes.ts. GENERATED — do not edit.
 *
 *   bun run kana-strokes
 *
 * Fetched verbatim from ${UPSTREAM_REPO} at ${UPSTREAM_REF.slice(0, 12)}, the same commit the
 * stroke data comes from. Shown in the app on Settings > About > Acknowledgements, which is
 * how OFL condition 2 is satisfied for a binary that ships the outlines and nothing else.
 */
export const KANA_STROKES_LICENSE = ${JSON.stringify(text)};
`;
}

async function main() {
  const wanted = charactersByScript();
  console.log(
    `Fetching ${wanted.length} glyphs from ${UPSTREAM_REPO}@${UPSTREAM_REF.slice(0, 7)}`,
  );

  const glyphs = await mapWithLimit(wanted, CONCURRENCY, async (item) => {
    const svg = await fetchGlyph(item.char, item.script);
    return {
      char: item.char,
      strokes: parseGlyph(svg, `${item.script} ${item.char}`),
    };
  });

  // Sorted by codepoint so a re-run produces a byte-identical file and the diff means
  // something. Set iteration order would otherwise follow the chart's layout.
  glyphs.sort((a, b) => a.char.codePointAt(0) - b.char.codePointAt(0));

  const source = serialise(glyphs);
  await writeFile(OUT_FILE, source);
  await writeFile(LICENCE_FILE, await fetchLicence());

  const strokeCount = glyphs.reduce(
    (total, glyph) => total + glyph.strokes.length,
    0,
  );
  console.log(
    `Wrote ${glyphs.length} glyphs, ${strokeCount} strokes, ` +
      `${(source.length / 1024).toFixed(0)}KB to src/constants/kana-strokes.ts`,
  );
  console.log("Wrote src/constants/kana-strokes-license.ts");
}

await main();
