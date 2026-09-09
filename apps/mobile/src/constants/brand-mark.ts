/**
 * The Ittekimasu mark — a torii with a check in its opening — as geometry.
 *
 * This is the ONE place the artwork exists. Two things read it:
 *
 *  - `components/torii-mark.tsx`, which draws it at runtime (the sign-in and paywall
 *    backdrops).
 *  - `scripts/generate-brand-assets.mjs`, which renders every shipped icon from it: the
 *    iOS Icon Composer layer, the Android adaptive trio, the splash tile, and the
 *    marketing site's favicons and Open Graph logo.
 *
 * The script is run with Bun, not Node, precisely so it can import this TypeScript file
 * rather than keeping a second copy of the path data. A copy is how the amber check ends
 * up nudged in the app icon and not on the website.
 */

/** The artwork is authored on a 1024 grid — the largest size any target needs. */
export const MARK_CANVAS = 1024;

/**
 * Mirrors the light palette in src/global.css. The script runs outside the bundler and
 * cannot read CSS variables, so these are literals; change a value there and here.
 */
export const MARK_COLORS = {
  /** --color-primary. The ground the mark sits on. */
  teal: "#0f6e56",
  /** --color-canvas. The gate itself. */
  cream: "#f5f1e6",
  /** --color-accent. The check, and the only second tone in the mark. */
  amber: "#ef9f27",
} as const;

/**
 * The gate, drawn the way a real one is: a kasagi that overhangs the pillars and sweeps
 * upward, and hashira that splay outward at the base.
 */
export const GATE_PATHS = [
  // kasagi: the top beam
  "M118 242 Q512 164 906 242 L906 316 Q512 250 118 316 Z",
  // hashira: the pillars
  "M286 316 h150 l-26 470 h-98 Z",
  "M738 316 h-150 l26 470 h98 Z",
] as const;

/** nuki: the second beam, a rounded bar rather than a path. */
export const NUKI = {
  x: 212,
  y: 380,
  width: 600,
  height: 88,
  rx: 34,
} as const;

/**
 * The check sits in the widest part of the opening, low between the pillars, and is sized
 * so its round caps clear both of them. An earlier version spanned the full width and its
 * ends merged into the pillars at small sizes — the exact blob this mark exists to avoid.
 */
export const CHECK = {
  d: "M445 700 l42 44 l92 -102",
  strokeWidth: 60,
} as const;

/**
 * Android's adaptive icon draws a 108dp layer and shows at most the middle 72dp, with 66dp
 * guaranteed safe. Scaling the whole 1024 artwork to 0.75 puts its ink inside ~58% of the
 * canvas — within that safe circle, with the artwork's own margin left intact.
 */
export const ANDROID_SAFE_SCALE = 0.75;

/**
 * Apple's continuous-corner radius is ~22.37% of the side. An `rx` is a plain rounded
 * corner rather than a squircle, but at splash and favicon sizes the difference is
 * invisible and it beats hand-fitting a bezier.
 */
export const SQUIRCLE_RADIUS = Math.round(MARK_CANVAS * 0.2237);
