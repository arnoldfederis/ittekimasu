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

const config: ExpoConfig = {
  name: "Ittekimasu",
  slug: "ittekimasu",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "ittekimasu",
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
      backgroundColor: "#F5F1E6",
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
        image: "./assets/images/splash-icon.png",
        imageWidth: 76,
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
      projectId: "5df7d65b-4e25-4364-adc5-03109611433a",
    },
  },
  owner: "arnoldfederis",
};

export default config;
