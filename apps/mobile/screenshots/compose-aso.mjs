/**
 * Composes the App Store screenshots: background + framed device + headline.
 *
 * Inputs live in aso/backgrounds/aso/ as pairs — `N.name.png` is the 1290x2796 background
 * already chosen for that slide, `N.name-device.png` is the 1419x2796 framed mockup. Output
 * is 1290x2796 into aso/, numbered so the upload order is the file order.
 *
 * Rendered through an SVG and `qlmanage`, which is macOS's own WebKit rasteriser — no image
 * library to install, and text stays real text until the last step rather than being baked
 * into a bitmap by hand.
 *
 * Type sizes are set by the THUMBNAIL, not this canvas: a portrait screenshot renders about
 * 150-200px wide in App Store search, a ~7x reduction, so the 88px headline arrives at
 * roughly 12px. Anything smaller stops being words.
 *
 * Run: node screenshots/compose-aso.mjs
 */
import { execFile } from "node:child_process";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const IN_DIR = resolve(HERE, "aso/backgrounds/aso");
const OUT_DIR = resolve(HERE, "aso");
const TMP_DIR = resolve(HERE, ".compose-tmp");

const WIDTH = 1290;
const HEIGHT = 2796;

/** Apple's own convention, and the size the thumbnail test is calibrated against. */
const HEADLINE_SIZE = 88;
const CAPTION_SIZE = 46;

/** The device sits below the copy, centred, with the frame's own bezel as its margin. */
const DEVICE_WIDTH = 1010;
const DEVICE_TOP = 760;

/** Whatever the system has. WebKit resolves the first that exists. */
const FONT = "SF Pro Display, SF Pro Text, Helvetica Neue, Helvetica, Arial, sans-serif";

/**
 * Palettes, keyed by how light the background is. Text on the teal arc has to be white; the
 * paper grounds take the app's ink. Never red anywhere, same as the app.
 */
const ON_TEAL = { headline: "#ffffff", caption: "#cfe3db" };
const ON_PAPER = { headline: "#1c1b17", caption: "#6b675c" };
const ON_INK = { headline: "#f2eee3", caption: "#a9a395" };

/**
 * Headlines are hand-broken into lines rather than wrapped: two lines maximum, and where the
 * break falls changes how a sentence reads at a glance.
 */
const SLIDES = [
  {
    out: "01-checklist.png",
    background: "1.checklist.png",
    device: "1.checklist-device.png",
    headline: ["Every step, dated", "to your move."],
    caption: "Visa, housing, banking, the ward office.",
    palette: ON_TEAL,
  },
  {
    out: "02-review.png",
    background: "2.reveal.png",
    device: "2.reveal-device.png",
    headline: ["Every answer sets", "its own date."],
    caption: "Spaced repetition, no guesswork.",
    palette: ON_TEAL,
  },
  {
    out: "03-decks.png",
    background: "3.learn.png",
    device: "3.learn-device.png",
    headline: ["Start at kana.", "Finish at N3."],
    caption: "Kana and JLPT N5 are free.",
    palette: ON_TEAL,
  },
  {
    out: "04-streak.png",
    background: "4.profile.png",
    device: "4.profile-device.png",
    headline: ["A streak that", "survives a quiet day."],
    caption: "Nothing due doesn't break it.",
    palette: ON_PAPER,
  },
  {
    out: "05-ward-office.png",
    background: "5.ward.png",
    device: "5.ward-device.png",
    headline: ["The Japanese the", "counter will use."],
    caption: "55 cards for registering your life.",
    palette: ON_PAPER,
  },
  {
    out: "06-card-browser.png",
    background: "6.browser.png",
    device: "6.browser-device.png",
    headline: ["Fix a mis-tap.", "No penalty."],
    caption: "Change an answer without spending a review.",
    palette: ON_PAPER,
  },
  {
    out: "07-reminder.png",
    background: "7.reminder.png",
    device: "7.reminder-device.png",
    headline: ["One nudge,", "at your hour."],
    caption: "Any hour, in your own timezone.",
    palette: ON_INK,
  },
  {
    /*
     * Last on purpose. Offline is not what makes someone install — it is what settles a
     * doubt in someone already interested, which is what the tail of a gallery is for. On
     * the plainest ground of the set, because the amber banner in the shot is the thing to
     * look at and every other paper background has a warm glow that would compete with it.
     */
    out: "08-offline.png",
    background: "8.offline.png",
    device: "8.offline-device.png",
    headline: ["Study on the plane.", "Sync when you land."],
    caption: "Answers are queued, never lost.",
    palette: ON_PAPER,
  },
];

/** `&` in a headline would otherwise end the document. */
function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildSvg(slide) {
  const [first, second] = slide.headline;
  const deviceHeight = Math.round((DEVICE_WIDTH / 1419) * HEIGHT);
  const deviceX = Math.round((WIDTH - DEVICE_WIDTH) / 2);

  /*
   * The canvas is SQUARE and the artwork is centred in it. qlmanage fits a thumbnail to the
   * longest edge of a square box, so a 1290x2796 document gets scaled to 2796 WIDE — over
   * twice its intended size — and then clipped. Handing it a square means it renders 1:1 and
   * the crop below is exact.
   */
  const inset = Math.round((HEIGHT - WIDTH) / 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${HEIGHT}" height="${HEIGHT}" viewBox="0 0 ${HEIGHT} ${HEIGHT}">
  <g transform="translate(${inset} 0)">
  <image href="file://${join(IN_DIR, slide.background)}" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" preserveAspectRatio="xMidYMid slice"/>

  <g font-family="${FONT}" text-anchor="middle">
    <text x="${WIDTH / 2}" y="340" font-size="${HEADLINE_SIZE}" font-weight="700" letter-spacing="-1.5" fill="${slide.palette.headline}">${escapeXml(first)}</text>
    <text x="${WIDTH / 2}" y="452" font-size="${HEADLINE_SIZE}" font-weight="700" letter-spacing="-1.5" fill="${slide.palette.headline}">${escapeXml(second)}</text>
    <text x="${WIDTH / 2}" y="566" font-size="${CAPTION_SIZE}" font-weight="400" fill="${slide.palette.caption}">${escapeXml(slide.caption)}</text>
  </g>

  <image href="file://${join(IN_DIR, slide.device)}" x="${deviceX}" y="${DEVICE_TOP}" width="${DEVICE_WIDTH}" height="${deviceHeight}"/>
  </g>
</svg>`;
}

await mkdir(OUT_DIR, { recursive: true });
await mkdir(TMP_DIR, { recursive: true });

for (const slide of SLIDES) {
  const svgPath = join(TMP_DIR, `${slide.out}.svg`);
  await writeFile(svgPath, buildSvg(slide));

  await run("qlmanage", ["-t", "-s", String(HEIGHT), "-o", TMP_DIR, svgPath]);

  const rendered = (await readdir(TMP_DIR)).find(
    (name) => name.endsWith(".png") && name.includes(slide.out),
  );
  if (!rendered) throw new Error(`qlmanage produced nothing for ${slide.out}`);

  /*
   * Crops the centred 1290-wide artwork back out of the square render. sips takes height
   * then width, which is the wrong way round from every other tool.
   */
  await run("sips", [
    "-c",
    String(HEIGHT),
    String(WIDTH),
    join(TMP_DIR, rendered),
    "--out",
    join(OUT_DIR, slide.out),
  ]);
  process.stdout.write(`${slide.out}\n`);
}

await rm(TMP_DIR, { recursive: true, force: true });
process.stdout.write(`\n${SLIDES.length} screenshots → ${OUT_DIR}\n`);
