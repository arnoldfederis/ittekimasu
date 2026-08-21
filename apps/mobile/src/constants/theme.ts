import { useUniwind } from "uniwind";

/**
 * Raw token values, mirroring the `@variant` blocks in src/global.css.
 *
 * Prefer `className` everywhere it works — it swaps with the appearance automatically.
 * This file exists only for props that cannot take one: NativeTabs tint, StatusBar,
 * react-native-svg fills, navigation themes, placeholderTextColor.
 *
 * Reach for `useThemeColors()`, not the raw palettes, so the values follow dark mode.
 * Keep in sync with global.css by hand — nothing enforces it.
 */
export const lightColors = {
  primary: "#0F6E56",
  primaryPressed: "#0A5442",
  primaryTint: "#E6F0EC",

  accent: "#EF9F27",
  accentTint: "#FDF1DC",

  canvas: "#F5F1E6",
  surface: "#FFFFFF",
  surfaceSunken: "#EFEADC",

  ink: "#1C1B17",
  inkMuted: "#6B675C",
  inkSubtle: "#9A968A",
  inkInverse: "#FFFFFF",

  line: "#E2DCCB",
  positive: "#2F8F5B",
} as const;

export type ThemeColors = Record<keyof typeof lightColors, string>;

export const darkColors: ThemeColors = {
  primary: "#1E8F70",
  primaryPressed: "#17755B",
  primaryTint: "#16302A",

  accent: "#F2AC46",
  accentTint: "#33281A",

  canvas: "#14130F",
  surface: "#1E1C17",
  surfaceSunken: "#2A2721",

  ink: "#F2EEE3",
  inkMuted: "#A9A395",
  inkSubtle: "#7C7669",
  inkInverse: "#FFFFFF",

  line: "#33302A",
  positive: "#4CB07E",
};

/** Follows the system appearance through uniwind's adaptive themes. */
export function useThemeColors(): ThemeColors {
  const { theme } = useUniwind();
  return theme === "dark" ? darkColors : lightColors;
}

/** True when the app is currently rendering dark. */
export function useIsDark(): boolean {
  const { theme } = useUniwind();
  return theme === "dark";
}

/** Matches Tailwind's 4px base, so `gap-4` here is `spacing[4]` there. */
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const fontSize = {
  display: 34,
  title: 28,
  heading: 22,
  body: 17,
  callout: 15,
  caption: 13,
  /** Matches Apple's native auth button, which sizes its label at 43% of button height. */
  authButton: 20,
} as const;

export const radius = {
  card: 16,
  button: 14,
  pill: 999,
} as const;
