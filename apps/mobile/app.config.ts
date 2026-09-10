import { config as loadEnv } from "dotenv";
import path from "node:path";
import type { ExpoConfig } from "expo/config";

/**
 * Load .env before anything below reads it.
 *
 * Expo's CLI loads .env for the BUNDLER, but that happens after this file is evaluated and
 * its config plugins run. Without this line `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` is undefined
 * during `expo export` and during Xcode's "Bundle React Native code and images" phase, the
 * Google plugin receives `{}`, and the build dies with "Missing `iosUrlScheme`". Metro dev
 * builds skip that phase, which is why this only shows up in a real build.
 */
loadEnv({ path: path.resolve(__dirname, ".env") });

/**
 * Dynamic config, not app.json, for one reason: the Google Sign-In plugin needs an iOS URL
 * scheme that is the *reversed* iOS OAuth client ID. Deriving it from the env var here means
 * it can never drift from EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, and the ID is not duplicated
 * into a checked-in file.
 */
function googleIosUrlScheme(): string | undefined {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!clientId) return undefined;

  // 912040…-abc.apps.googleusercontent.com → com.googleusercontent.apps.912040…-abc
  return clientId.split(".").reverse().join(".");
}

const iosUrlScheme = googleIosUrlScheme();

/** From `extra.eas.projectId` below — the OTA endpoint is derived from it, never typed twice. */
const EAS_PROJECT_ID = "5df7d65b-4e25-4364-adc5-03109611433a";

const config: ExpoConfig = {
  name: "Ittekimasu",
  slug: "ittekimasu",
  /*
   * Becomes CFBundleShortVersionString, and it MUST equal the Version string on the App
   * Store Connect version page — "1.0" there and "1.0.0" here means the uploaded build
   * never attaches to that version and cannot be selected for submission.
   *
   * The build NUMBER is not here: eas.json sets appVersionSource "remote", so EAS owns it
   * and autoIncrement bumps it per production build.
   */
  version: "1.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "ittekimasu",

  /*
   * Over-the-air updates. expo-updates was already a dependency but nothing configured
   * it, so `eas update` had no endpoint and no runtime version to match against.
   *
   * The "fingerprint" policy hashes the actual native project — every native module,
   * every config plugin, the app.config.ts values that reach the native build. An update
   * is only ever delivered to a binary whose native side is identical, which is the whole
   * safety property: a JS bundle that calls a native module the installed build does not
   * contain would otherwise crash on launch with no way back.
   *
   * Adding these two keys changes the native project. They reach a device only after a
   * prebuild and a rebuild, not a Metro reload.
   */
  runtimeVersion: {
    policy: "fingerprint",
  },
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
  },
  // "automatic" lets the OS drive light/dark. Without it iOS always reports light.
  userInterfaceStyle: "automatic",
  platforms: ["ios", "android"],
  ios: {
    icon: "./assets/expo.icon",
    bundleIdentifier: "com.arnoldfederis.ittekimasu",
    supportsTablet: false,
    usesAppleSignIn: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.arnoldfederis.ittekimasu",
    softwareKeyboardLayoutMode: "resize",
    adaptiveIcon: {
      // The brand teal, matching android-icon-background.png. This is the fallback the
      // launcher uses when it draws the layers itself rather than the background image —
      // leaving it on the canvas cream put a cream torii on a cream ground.
      backgroundColor: "#0F6E56",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    "expo-apple-authentication",
    [
      "@react-native-google-signin/google-signin",
      // Without iosUrlScheme the native SDK throws
      // "Your app is missing support for the following URL schemes".
      iosUrlScheme ? { iosUrlScheme } : {},
    ],
    [
      // Written into ios/sentry.properties at prebuild. Without org and project the build's
      // "Upload Debug Symbols to Sentry" phase dies with "An organization ID or slug is
      // required" — and that phase runs on every build, including local Debug ones.
      // The auth token is NOT here: it is a secret, and belongs in the environment.
      "@sentry/react-native",
      {
        organization: process.env.SENTRY_ORG ?? "ittekimasu",
        project: process.env.SENTRY_PROJECT ?? "ittekimasu",
      },
    ],
    [
      // Adds the iOS Notification Service Extension and the entitlements OneSignal needs.
      // Changing `mode` requires a prebuild and a rebuild, not just a Metro restart.
      "onesignal-expo-plugin",
      { mode: process.env.APP_ENV === "production" ? "production" : "development" },
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#F5F1E6",
        dark: { backgroundColor: "#14130F" },
        // The rounded app tile, not a bare glyph: the splash canvas is the same cream as
        // the mark's gate, so an unmasked torii would be invisible in light mode. Showing
        // the tile the user just tapped also makes the launch read as continuous.
        image: "./assets/images/splash-icon.png",
        imageWidth: 120,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: EAS_PROJECT_ID,
    },
  },
  owner: "arnoldfederis",
};

export default config;
