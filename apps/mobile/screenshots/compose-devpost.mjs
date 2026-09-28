/**
 * Composes the Devpost project gallery: a title card plus the App Store slides, re-laid
 * out for a LANDSCAPE canvas.
 *
 * Devpost wants 3:2 and the App Store wants 1290x2796 (0.46:1), so the finished slides
 * cannot simply be uploaded: a portrait image dropped into a 3:2 slot is mostly empty
 * ground, and the gallery thumbnail crops it into nonsense. Pairing two slides per canvas
 * fills the width honestly and gets a screenshot to about half its authored size rather
 * than a fifth.
 *
 * Inputs are the FINISHED slides in `aso/` — the ones that already carry their headline and
 * device frame. Nothing here re-renders a headline: the copy was written against a portrait
 * canvas and a second one on top of it would read as two captions for one picture. The
 * sources those slides were built from (aso/backgrounds/aso) are not in the repo, which is
 * the other reason this composes forward from the output rather than re-running compose-aso.
 *
 * The title card is the exception, and it is drawn from `src/constants/brand-mark.ts` — the
 * same geometry the app icon and the website favicons come from. The first image in a
 * Devpost gallery IS the project thumbnail, so this one is the mark that has to match the
 * store listing beside it.
 *
 * Rendered through SVG and `qlmanage`, exactly as compose-aso.mjs does: macOS's own WebKit,
 * no image library, text stays text until the last step.
 *
 * Run with BUN, not Node — it imports the TypeScript brand constants directly, which is the
 * whole reason there is only one copy of the artwork.
 *
 *   bun run screenshots/compose-devpost.mjs
 */
import { execFile } from "node:child_process";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  CHECK,
  GATE_PATHS,
  MARK_CANVAS,
  MARK_COLORS,
  NUKI,
} from "../src/constants/brand-mark.ts";

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const IN_DIR = resolve(HERE, "aso");
const OUT_DIR = resolve(HERE, "devpost");
const TMP_DIR = resolve(HERE, ".devpost-tmp");

/** 3:2, the ratio Devpost asks for. Comfortably under the 5 MB cap as PNG. */
const WIDTH = 2160;
const HEIGHT = 1440;

/** The aspect of the App Store slides being placed, so heights drive widths. */
const SLIDE_RATIO = 1290 / 2796;

/** Whatever the system has. WebKit resolves the first that exists. */
const FONT =
  "SF Pro Display, SF Pro Text, Helvetica Neue, Helvetica, Arial, sans-serif";

/** Mirrors src/global.css, as brand-mark.ts does — this runs outside the bundler. */
const INK = "#1c1b17";
const INK_MUTED = "#6b675c";
const CREAM_MUTED = "#cfe3db";

/**
 * Ward office leads, and that is the same call the paywall makes: it is the only thing in
 * the app nobody else sells, and a judge who stops after two images should have seen it.
 * The checklist rides beside it because together they are the whole premise — the move and
 * the language, which is the pairing every other slide is a detail of.
 */
const SLIDES = [
  { out: "01-title.png", title: true },
  { out: "02-ward-checklist.png", pair: ["05-ward-office.png", "01-checklist.png"] },
  { out: "03-review-decks.png", pair: ["02-review.png", "03-decks.png"] },
  { out: "04-kana-strokes.png", pair: ["10-practice.png", "09-stroke-order.png"] },
  { out: "05-streak-browser.png", pair: ["04-streak.png", "06-card-browser.png"] },
  { out: "06-reminder-offline.png", pair: ["07-reminder.png", "08-offline.png"] },
  /*
   * The YouTube thumbnail rides along here rather than in a script of its own: it is the same
   * brand, the same mark and the same source slide, and a second copy of this file would
   * drift from the first the first time either changed. 16:9, not 3:2, so it carries its own
   * size.
   */
  { out: "youtube-thumbnail.png", thumbnail: true, width: 1280, height: 720 },
  /*
   * The same thumbnail with a face, rendered only when THUMB_FACE points at a cut-out PNG
   * (screenshots/cutout.swift makes one). An env var rather than a file in the repo, because
   * the input is a photo of a person, not an app asset.
   */
  ...(process.env.THUMB_FACE
    ? [
        {
          out: "youtube-thumbnail-face.png",
          thumbnail: true,
          face: process.env.THUMB_FACE,
          width: 1280,
          height: 720,
        },
      ]
    : []),
];

/**
 * The phone's body inside a finished App Store slide, in that slide's own pixels, and the
 * radius of its corners. Used to lift the phone out of a slide without the slide's headline
 * or its background.
 *
 * MEASURED from the bezel, not taken from compose-aso.mjs's DEVICE_WIDTH / DEVICE_TOP: those
 * describe the mockup IMAGE, which includes a margin of slide background around the frame
 * plus the side buttons. A rectangular crop at those numbers brought a pale panel of the
 * slide's amber ground along with the phone. Clipping to the body's own rounded outline is
 * what makes it sit on the teal as a phone rather than as a picture of one.
 */
const SLIDE_DEVICE = { x: 190, y: 811, width: 909, height: 1889, radius: 140 };

/** `&` in a headline would otherwise end the document. */
function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * The mark, at an arbitrary size, from the 1024 grid it is authored on.
 *
 * `gate` and `check` are passed in rather than read from MARK_COLORS directly: on the teal
 * title card the gate is cream, and as a watermark it is teal on cream. The geometry is the
 * constant; the two tones are not.
 */
function markSvg({ x, y, size, gate, check, opacity = 1 }) {
  const scale = size / MARK_CANVAS;
  return `<g transform="translate(${x} ${y}) scale(${scale})" opacity="${opacity}">
    ${GATE_PATHS.map((d) => `<path d="${d}" fill="${gate}"/>`).join("\n    ")}
    <rect x="${NUKI.x}" y="${NUKI.y}" width="${NUKI.width}" height="${NUKI.height}" rx="${NUKI.rx}" fill="${gate}"/>
    <path d="${CHECK.d}" fill="none" stroke="${check}" stroke-width="${CHECK.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

/**
 * The thumbnail.
 *
 * A title card rather than a screenshot, because the gallery listing renders this a few
 * hundred pixels wide and a phone screenshot at that size is a grey rectangle. The mark and
 * four words survive the reduction; a checklist does not.
 */
function titleCardSvg() {
  const markSize = 360;
  const markY = 300;

  return `
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="${MARK_COLORS.teal}"/>
  ${markSvg({
    x: (WIDTH - markSize) / 2,
    y: markY,
    size: markSize,
    gate: MARK_COLORS.cream,
    check: MARK_COLORS.amber,
  })}
  <g font-family="${FONT}" text-anchor="middle">
    <text x="${WIDTH / 2}" y="${markY + markSize + 150}" font-size="150" font-weight="700" letter-spacing="-3" fill="${MARK_COLORS.cream}">Ittekimasu</text>
    <text x="${WIDTH / 2}" y="${markY + markSize + 232}" font-size="58" font-weight="400" letter-spacing="6" fill="${CREAM_MUTED}">行ってきます</text>
    <text x="${WIDTH / 2}" y="${markY + markSize + 346}" font-size="52" font-weight="400" fill="${CREAM_MUTED}">${escapeXml("A Japan relocation checklist, and the Japanese you'll actually need.")}</text>
  </g>`;
}

/**
 * Two finished slides on a paper ground, with the mark behind them.
 *
 * The watermark is at 4.5%, the same value BrandBackdrop uses in the app: above roughly 5%
 * on cream it stops being texture and starts competing with the screenshots, which are the
 * only thing on this canvas anyone came to look at.
 */
function pairSvg(sources) {
  const slideHeight = 1180;
  const slideWidth = Math.round(slideHeight * SLIDE_RATIO);
  const gap = 80;
  const totalWidth = slideWidth * sources.length + gap * (sources.length - 1);
  const startX = Math.round((WIDTH - totalWidth) / 2);
  const y = Math.round((HEIGHT - slideHeight) / 2);

  const markSize = 900;

  return `
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="${MARK_COLORS.cream}"/>
  ${markSvg({
    x: (WIDTH - markSize) / 2,
    y: (HEIGHT - markSize) / 2,
    size: markSize,
    gate: MARK_COLORS.teal,
    check: MARK_COLORS.teal,
    opacity: 0.045,
  })}
  ${sources
    .map(
      (source, i) =>
        `<image href="file://${join(IN_DIR, source)}" x="${startX + i * (slideWidth + gap)}" y="${y}" width="${slideWidth}" height="${slideHeight}"/>`,
    )
    .join("\n  ")}`;
}

/**
 * The YouTube thumbnail: the hook on the left, the 区役所 card on the right.
 *
 * Sized for where it is actually seen — a search result or a suggested-video rail, about 360px
 * wide, a ~3.5x reduction. The headline is set at 96px so it lands near 27px there; anything
 * under ~40px on this canvas is decoration, which is why the wordmark line is small and the
 * claim is not. Three words a line, because a thumbnail is read in the time it takes to scroll
 * past it.
 *
 * The phone is cropped out of the finished Ward Office slide rather than re-rendered, so its
 * own headline ("The Japanese the counter will use.") is left behind: two headlines on one
 * thumbnail would be two things to read and neither read.
 */
function thumbnailSvg(width, height) {
  const deviceHeight = 640;
  const deviceWidth = Math.round(
    deviceHeight * (SLIDE_DEVICE.width / SLIDE_DEVICE.height),
  );
  const deviceX = width - deviceWidth - 120;
  const deviceY = Math.round((height - deviceHeight) / 2);

  const textX = 84;
  const markSize = 64;

  return `
  <rect x="0" y="0" width="${width}" height="${height}" fill="${MARK_COLORS.teal}"/>
  ${markSvg({
    x: deviceX - 170,
    y: -40,
    size: 800,
    gate: MARK_COLORS.cream,
    check: MARK_COLORS.cream,
    opacity: 0.06,
  })}
  <svg x="${deviceX}" y="${deviceY}" width="${deviceWidth}" height="${deviceHeight}" viewBox="${SLIDE_DEVICE.x} ${SLIDE_DEVICE.y} ${SLIDE_DEVICE.width} ${SLIDE_DEVICE.height}">
    <defs>
      <clipPath id="phone-body">
        <rect x="${SLIDE_DEVICE.x}" y="${SLIDE_DEVICE.y}" width="${SLIDE_DEVICE.width}" height="${SLIDE_DEVICE.height}" rx="${SLIDE_DEVICE.radius}"/>
      </clipPath>
    </defs>
    <image href="file://${join(IN_DIR, "05-ward-office.png")}" x="0" y="0" width="1290" height="2796" clip-path="url(#phone-body)"/>
  </svg>
  ${markSvg({
    x: textX,
    y: 118,
    size: markSize,
    gate: MARK_COLORS.cream,
    check: MARK_COLORS.amber,
  })}
  <g font-family="${FONT}">
    <text x="${textX + markSize + 18}" y="${118 + 46}" font-size="40" font-weight="700" letter-spacing="-0.5" fill="${MARK_COLORS.cream}">Ittekimasu</text>
    <text x="${textX}" y="330" font-size="96" font-weight="800" letter-spacing="-2.5" fill="${MARK_COLORS.cream}">Nobody preps</text>
    <text x="${textX}" y="436" font-size="96" font-weight="800" letter-spacing="-2.5" fill="${MARK_COLORS.cream}">for the</text>
    <text x="${textX}" y="542" font-size="96" font-weight="800" letter-spacing="-2.5" fill="${MARK_COLORS.amber}">ward office.</text>
    <text x="${textX}" y="618" font-size="30" font-weight="500" fill="${CREAM_MUTED}">${escapeXml("A Japan move checklist + the Japanese you'll need")}</text>
  </g>`;
}

/**
 * The thumbnail with a face: the hook on the left, the person on the right looking at it.
 *
 * The face goes on the RIGHT because the photo faces left. Viewers follow a gaze, so a face
 * turned toward the headline hands the eye to "ward office"; the same face in the left corner
 * would be looking off the edge of the frame and take the eye with it. Placing it rather than
 * mirroring it also keeps the face as people actually see it.
 *
 * That leaves no room for the phone, so the 区役所 card comes across as TYPE instead — the
 * card's real text, laid out the way the app lays it out (word, rule, reading · meaning).
 * It is the one piece of the phone that ever survived at thumbnail size anyway.
 *
 * `preserveAspectRatio="xMaxYMax meet"` pins the cut-out to the bottom-right corner whatever
 * its proportions, and the box runs 140px past the right edge so the shoulder bleeds off the
 * frame instead of ending in a hard line — and so a wide head-and-shoulders photo still gets
 * a face big enough to read, since `meet` sizes by whichever side runs out first.
 */
function thumbnailFaceSvg(width, height, facePath) {
  const textX = 72;
  const markSize = 58;
  const card = { x: textX, y: 520, width: 420, height: 150 };

  return `
  <rect x="0" y="0" width="${width}" height="${height}" fill="${MARK_COLORS.teal}"/>
  ${markSvg({
    x: width - 760,
    y: -60,
    size: 820,
    gate: MARK_COLORS.cream,
    check: MARK_COLORS.cream,
    opacity: 0.06,
  })}
  <image href="file://${facePath}" x="${width - 760}" y="110" width="900" height="${height - 110}" preserveAspectRatio="xMaxYMax meet"/>
  ${markSvg({
    x: textX,
    y: 96,
    size: markSize,
    gate: MARK_COLORS.cream,
    check: MARK_COLORS.amber,
  })}
  <g font-family="${FONT}">
    <text x="${textX + markSize + 16}" y="${96 + 42}" font-size="36" font-weight="700" letter-spacing="-0.5" fill="${MARK_COLORS.cream}">Ittekimasu</text>
    <text x="${textX}" y="290" font-size="84" font-weight="800" letter-spacing="-2" fill="${MARK_COLORS.cream}">Nobody preps</text>
    <text x="${textX}" y="382" font-size="84" font-weight="800" letter-spacing="-2" fill="${MARK_COLORS.cream}">for the</text>
    <text x="${textX}" y="474" font-size="84" font-weight="800" letter-spacing="-2" fill="${MARK_COLORS.amber}">ward office.</text>
  </g>
  <rect x="${card.x}" y="${card.y}" width="${card.width}" height="${card.height}" rx="24" fill="${MARK_COLORS.cream}"/>
  <g font-family="${FONT}" text-anchor="middle">
    <text x="${card.x + card.width / 2}" y="${card.y + 72}" font-size="56" font-weight="600" fill="${INK}">区役所</text>
    <rect x="${card.x + card.width / 2 - 28}" y="${card.y + 92}" width="56" height="2" fill="${INK_MUTED}" opacity="0.35"/>
    <text x="${card.x + card.width / 2}" y="${card.y + 128}" font-size="26" font-weight="500" fill="${INK_MUTED}">${escapeXml("くやくしょ · ward office")}</text>
  </g>`;
}

/** The gallery is 3:2; an entry that needs another shape says so. */
function sizeOf(slide) {
  return { width: slide.width ?? WIDTH, height: slide.height ?? HEIGHT };
}

function buildSvg(slide) {
  /*
   * The canvas is SQUARE and the artwork is centred in it, for the reason compose-aso.mjs
   * documents: qlmanage fits a thumbnail to the LONGEST edge of a square box, so handing it
   * a 2160x1440 document would scale it to 2160 tall and clip. Square renders 1:1 and the
   * crop below is exact. Here the long edge is the WIDTH, so the inset is vertical.
   */
  const { width, height } = sizeOf(slide);
  const side = Math.max(width, height);
  const inset = Math.round((side - height) / 2);
  const body = slide.thumbnail
    ? slide.face
      ? thumbnailFaceSvg(width, height, slide.face)
      : thumbnailSvg(width, height)
    : slide.title
      ? titleCardSvg()
      : pairSvg(slide.pair);

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${side}" height="${side}" viewBox="0 0 ${side} ${side}">
  <rect x="0" y="0" width="${side}" height="${side}" fill="${MARK_COLORS.cream}"/>
  <g transform="translate(0 ${inset})">${body}
  </g>
</svg>`;
}

await mkdir(OUT_DIR, { recursive: true });
await mkdir(TMP_DIR, { recursive: true });

for (const slide of SLIDES) {
  const { width, height } = sizeOf(slide);
  const side = Math.max(width, height);
  const svgPath = join(TMP_DIR, `${slide.out}.svg`);
  await writeFile(svgPath, buildSvg(slide));

  await run("qlmanage", ["-t", "-s", String(side), "-o", TMP_DIR, svgPath]);

  const rendered = (await readdir(TMP_DIR)).find(
    (name) => name.endsWith(".png") && name.includes(slide.out),
  );
  if (!rendered) throw new Error(`qlmanage produced nothing for ${slide.out}`);

  // sips takes height then width, which is the wrong way round from every other tool.
  await run("sips", [
    "-c",
    String(height),
    String(width),
    join(TMP_DIR, rendered),
    "--out",
    join(OUT_DIR, slide.out),
  ]);
  process.stdout.write(`${slide.out}\n`);
}

await rm(TMP_DIR, { recursive: true, force: true });
process.stdout.write(`\n${SLIDES.length} gallery images → ${OUT_DIR}\n`);
