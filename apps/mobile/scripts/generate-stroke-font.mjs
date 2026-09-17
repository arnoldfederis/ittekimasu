#!/usr/bin/env bun
/**
 * Subset the Kanji Stroke Order font to the characters the decks actually use.
 *
 *   bun run stroke-font
 *
 * ## Why a font and not stroke data
 *
 * The kana chart draws its diagrams from per-stroke outlines (see generate-kana-strokes.mjs)
 * because no font covers kana stroke order under a licence that works here. Kanji is the
 * opposite case: this font draws every glyph WITH its stroke numbers already attached, so
 * "show me the stroke order" is a change of `fontFamily` and nothing else. No path data in
 * the bundle, no generator output to keep in step with the seeds, and — unlike numbering a
 * system-font glyph from a separate coordinate list — no way for the numbers to sit off the
 * strokes they label, because they ARE the glyph.
 *
 * ## Licence
 *
 * Kanji Stroke Order font, copyright (C) 2004-2020 Ulrich Apel, the AAAA project and the
 * Wadoku project, under **BSD-3-Clause** — confirmed from the SPDX declaration KDE ships
 * beside the font in kiten, and from the font's own readme: "Use of the font in
 * non-commercial and commercial software."
 *
 * BSD-3 is more permissive than the kana data's OFL: no anti-TPM clause (so no App Store
 * problem), no share-alike, no reserved font name. The only obligation is reproducing the
 * copyright notice in a binary redistribution, which `app/acknowledgements.tsx` does.
 * Subsetting is squarely permitted — the full face is 16MB and 6,373 kanji, of which the
 * decks use a few hundred.
 *
 * ## Coverage
 *
 * Every Japanese character in the Flyway seeds — the one place that says what content exists.
 * That is wider than the card fronts it is for (it sweeps up the kana seeds and the checklist
 * templates' Japanese names too), and deliberately so: the cost is a few hundred KB against
 * the risk of a word rendering half-numbered because one character was missed. Card fronts
 * mix kanji and kana (食べる), and a font without the kana would fall back to the system face
 * mid-word, numbering some characters and not others.
 *
 * Backs are skipped — they carry a middle dot and are read, not written.
 *
 * Adding a deck means re-running this.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const MOBILE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = resolve(
  MOBILE_DIR,
  "../server/src/main/resources/db/migrations",
);
const OUT_FONT = resolve(MOBILE_DIR, "assets/fonts/stroke-order.ttf");
const OUT_LICENCE = resolve(MOBILE_DIR, "src/constants/stroke-font-license.ts");

/**
 * Pinned to a commit, not a branch. An unpinned font URL means a re-run months later can
 * silently redraw every character in the app.
 */
const FONT_REPO = "KDE/kiten";
const FONT_REF = "ba0e72251b9255230581fa84eac1d2f23d6689b0";
const FONT_URL = `https://raw.githubusercontent.com/${FONT_REPO}/${FONT_REF}/data/font/KanjiStrokeOrders.ttf`;

/** The upstream project, for the notice. */
const FONT_HOME = "https://www.nihilist.org.uk/";

/**
 * Reproduced rather than fetched: a licence does not drift, and a notice that silently
 * changed because a URL moved is worse than one that is wrong in a reviewable diff. The
 * copyright line matches the SPDX record KDE ships with the font.
 */
const LICENCE_TEXT = `Kanji Stroke Order Font
Copyright (C) 2004-2020 Ulrich Apel, the AAAA project and the Wadoku project.
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`;

/** Japanese only: kana, kanji, and the long-vowel mark. */
const JAPANESE = /^[぀-ヿ一-鿿ー]+$/;

/**
 * Every Japanese character in the seeds, minus the backs.
 *
 * A back is `'reading · meaning'` and always carries the middle dot, which separates the two
 * without parsing SQL properly. Erring wide is the right way to be wrong here: an extra glyph
 * costs bytes, a missing one shows up as an un-numbered character in the middle of a word.
 */
async function japaneseCharacters() {
  const { readdir, readFile } = await import("node:fs/promises");
  const files = (await readdir(MIGRATIONS_DIR)).filter((name) =>
    name.endsWith(".sql"),
  );

  const characters = new Set();
  let literals = 0;

  for (const file of files) {
    const sql = await readFile(resolve(MIGRATIONS_DIR, file), "utf8");
    for (const match of sql.matchAll(/'([^']+)'/g)) {
      const value = match[1];
      if (value.includes("·") || !JAPANESE.test(value)) continue;
      literals++;
      for (const character of value) characters.add(character);
    }
  }

  if (characters.size === 0) {
    throw new Error(
      `No card fronts found under ${MIGRATIONS_DIR} — has the seed format changed?`,
    );
  }

  return { characters, literals };
}

async function main() {
  const { characters, literals } = await japaneseCharacters();
  const text = [...characters].sort().join("");

  console.log(
    `${characters.size} distinct characters across ${literals} Japanese literals`,
  );
  console.log(`Fetching ${FONT_REPO}@${FONT_REF.slice(0, 7)}`);

  const response = await fetch(FONT_URL);
  if (!response.ok) {
    throw new Error(`font: ${response.status} from ${FONT_URL}`);
  }
  const original = Buffer.from(await response.arrayBuffer());

  const subset = await subsetFont(original, text, { targetFormat: "truetype" });

  await mkdir(dirname(OUT_FONT), { recursive: true });
  await writeFile(OUT_FONT, subset);
  await writeFile(
    OUT_LICENCE,
    `/**
 * The licence covering assets/fonts/stroke-order.ttf. GENERATED — do not edit.
 *
 *   bun run stroke-font
 *
 * Shown in the app on Settings > About > Acknowledgements, which is how BSD-3 condition 2 is
 * satisfied for a binary that ships the font and no documentation beside it.
 */
export const STROKE_FONT_HOME = ${JSON.stringify(FONT_HOME)};

export const STROKE_FONT_LICENSE = ${JSON.stringify(LICENCE_TEXT)};
`,
  );

  console.log(
    `Wrote assets/fonts/stroke-order.ttf (${(subset.length / 1024).toFixed(0)}KB, ` +
      `from ${(original.length / 1024 / 1024).toFixed(1)}MB)`,
  );
  console.log("Wrote src/constants/stroke-font-license.ts");
}

await main();
