/**
 * Generates App Store screenshot backgrounds at 1290x2796 (iPhone 6.9" portrait — the size
 * App Store Connect asks for, and the one every smaller size is derived from).
 *
 * Backgrounds ONLY: no headline text, no device frame. The screenshots are composed on top
 * of these in a design tool, and copy baked into a background cannot be re-laid-out.
 *
 * No dependencies on purpose. Adding sharp to the mobile app would pull a native module into
 * a React Native project for the sake of eight PNGs, and every `expo install` afterwards
 * would be one more thing to check. Node's zlib is enough: the PNG encoder at the bottom is
 * the whole cost of avoiding that.
 *
 * Every colour is a literal copy of a token in src/global.css. Nothing here resolves CSS
 * variables, so when the palette moves, this file has to move with it.
 *
 * Run: node screenshots/generate-backgrounds.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "aso", "backgrounds");

const WIDTH = 1290;
const HEIGHT = 2796;

/** src/global.css, @variant light. */
const LIGHT = {
  primary: "#0f6e56",
  primaryPressed: "#0a5442",
  primaryTint: "#e6f0ec",
  accent: "#ef9f27",
  accentTint: "#fdf1dc",
  canvas: "#f5f1e6",
  surface: "#ffffff",
  surfaceSunken: "#efeadc",
  ink: "#1c1b17",
  positive: "#2f8f5b",
};

/** src/global.css, @variant dark. */
const DARK = {
  primary: "#1e8f70",
  primaryPressed: "#17755b",
  accent: "#f2ac46",
  canvas: "#14130f",
  surface: "#1e1c17",
  ink: "#f2eee3",
  positive: "#4cb07e",
};

function rgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Ease so a glow fades out like light rather than like a cone. */
function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function mix(base, over, alpha) {
  return [
    base[0] + (over[0] - base[0]) * alpha,
    base[1] + (over[1] - base[1]) * alpha,
    base[2] + (over[2] - base[2]) * alpha,
  ];
}

/**
 * Draws one background.
 *
 * `base` is either a flat colour or a linear gradient. `glows` are radial washes composited
 * in order. `band` fills everything above a parabola with its own gradient, for the layouts
 * that want a coloured top third — a straight horizontal edge there reads as a seam, so the
 * boundary curves.
 */
function render({ base, glows = [], band = null, grain = 1.2 }) {
  const pixels = Buffer.allocUnsafe(WIDTH * HEIGHT * 3);

  const baseFrom = rgb(base.from ?? base.color);
  const baseTo = rgb(base.to ?? base.color);
  const bandFrom = band ? rgb(band.from) : null;
  const bandTo = band ? rgb(band.to) : null;

  const prepared = glows.map((g) => ({ ...g, rgb: rgb(g.color) }));

  for (let y = 0; y < HEIGHT; y += 1) {
    // The band's lower edge: a parabola sagging `band.sag` px below `band.height` at the
    // centre, back up to `band.height` at both sides.
    const rowBandEdge = band ? band.height : 0;

    for (let x = 0; x < WIDTH; x += 1) {
      // Diagonal ramp for the base gradient, so a flat colour is just from === to.
      const t = (x / WIDTH) * 0.35 + (y / HEIGHT) * 0.65;
      let colour = mix(baseFrom, baseTo, t);

      if (band) {
        const nx = (x - WIDTH / 2) / (WIDTH / 2);
        const edge = rowBandEdge + band.sag * (1 - nx * nx);
        if (y < edge) {
          const bt = y / edge;
          colour = mix(bandFrom, bandTo, bt);
        } else if (y < edge + 2) {
          // Two-pixel feather, or the curve stair-steps.
          colour = mix(mix(bandFrom, bandTo, 1), colour, (y - edge) / 2);
        }
      }

      for (const g of prepared) {
        const dx = (x - g.cx) / g.r;
        const dy = (y - g.cy) / (g.ry ? g.ry : g.r);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= 1) continue;
        colour = mix(colour, g.rgb, smoothstep(1 - d) * g.opacity);
      }

      // A little noise. Gradients this large band visibly on an OLED without it.
      const n = grain ? (Math.random() - 0.5) * grain : 0;
      const i = (y * WIDTH + x) * 3;
      pixels[i] = Math.min(255, Math.max(0, Math.round(colour[0] + n)));
      pixels[i + 1] = Math.min(255, Math.max(0, Math.round(colour[1] + n)));
      pixels[i + 2] = Math.min(255, Math.max(0, Math.round(colour[2] + n)));
    }
  }

  return pixels;
}

const BACKGROUNDS = {
  /** The default. Paper canvas, teal above, amber below — the app's two colours, in order. */
  "01-paper-teal-amber": {
    base: { color: LIGHT.canvas },
    glows: [
      { cx: 210, cy: 400, r: 1000, color: LIGHT.primary, opacity: 0.26 },
      { cx: 1150, cy: 2300, r: 1050, color: LIGHT.accent, opacity: 0.3 },
      { cx: 950, cy: 1250, r: 800, color: LIGHT.positive, opacity: 0.1 },
    ],
  },

  /** Teal top third for a headline, paper below for the device. */
  "02-paper-teal-arc": {
    base: { color: LIGHT.canvas },
    band: { height: 940, sag: 190, from: LIGHT.primary, to: LIGHT.primaryPressed },
    glows: [
      { cx: 1080, cy: 300, r: 700, color: LIGHT.accent, opacity: 0.26 },
      { cx: 250, cy: 2250, r: 900, color: LIGHT.primary, opacity: 0.16 },
    ],
  },

  /** Full teal, for the screenshot that has to shout. White copy on top. */
  "03-teal-deep": {
    base: { from: LIGHT.primary, to: LIGHT.primaryPressed },
    glows: [
      { cx: 1100, cy: 520, r: 850, color: LIGHT.accent, opacity: 0.22 },
      { cx: 150, cy: 2450, r: 800, color: "#ffffff", opacity: 0.12 },
    ],
  },

  /** Warm amber wash, for the Pro / paywall screenshot. */
  "04-paper-amber": {
    base: { color: LIGHT.accentTint },
    glows: [
      { cx: 1060, cy: 470, r: 950, color: LIGHT.accent, opacity: 0.34 },
      { cx: 180, cy: 2400, r: 900, color: LIGHT.primary, opacity: 0.16 },
    ],
  },

  /** Dark mode, for the screenshot showing the app in dark mode. */
  "05-ink-dark": {
    base: { color: DARK.canvas },
    glows: [
      { cx: 240, cy: 460, r: 980, color: DARK.primary, opacity: 0.36 },
      { cx: 1130, cy: 2330, r: 950, color: DARK.accent, opacity: 0.24 },
    ],
  },

  /** Dark with the band, for a dark headline slide. */
  "06-ink-teal-arc": {
    base: { color: DARK.canvas },
    band: { height: 900, sag: 200, from: DARK.primary, to: DARK.primaryPressed },
    glows: [
      { cx: 1080, cy: 320, r: 680, color: DARK.accent, opacity: 0.24 },
      { cx: 300, cy: 2400, r: 900, color: DARK.primary, opacity: 0.2 },
    ],
  },

  /** Green, calm, for the streak / study-grid screenshot. */
  "07-paper-positive": {
    base: { color: LIGHT.primaryTint },
    glows: [
      { cx: 645, cy: 380, r: 950, color: LIGHT.positive, opacity: 0.26 },
      { cx: 1150, cy: 2350, r: 900, color: LIGHT.accent, opacity: 0.2 },
    ],
  },

  /** Nearly flat paper, for a screenshot that carries itself. */
  "08-paper-plain": {
    base: { color: LIGHT.canvas },
    glows: [
      { cx: 645, cy: 200, r: 1100, ry: 900, color: LIGHT.surface, opacity: 0.75 },
      { cx: 645, cy: 2700, r: 1100, ry: 900, color: LIGHT.surfaceSunken, opacity: 0.85 },
    ],
  },
};

/* ------------------------------------------------------------------ *
 * Minimal PNG encoder: 8-bit RGB, filter type 0, one IDAT.
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

function encodePng(pixels, width, height) {
  const stride = width * 3;
  // Every scanline carries a leading filter byte; 0 means "none", which compresses fine on
  // smooth gradients and keeps this encoder short.
  const raw = Buffer.allocUnsafe((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

await mkdir(OUT_DIR, { recursive: true });

for (const [name, spec] of Object.entries(BACKGROUNDS)) {
  const png = encodePng(render(spec), WIDTH, HEIGHT);
  await writeFile(join(OUT_DIR, `${name}.png`), png);
  process.stdout.write(
    `${name}.png  ${WIDTH}x${HEIGHT}  ${(png.length / 1024).toFixed(0)} KB\n`,
  );
}

process.stdout.write(
  `\n${Object.keys(BACKGROUNDS).length} backgrounds → ${OUT_DIR}\n`,
);
