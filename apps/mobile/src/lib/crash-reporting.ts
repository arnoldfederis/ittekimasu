import * as Sentry from "@sentry/react-native";

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

/**
 * Crash reporting, off unless a DSN is configured.
 *
 * Called from the root layout module scope rather than inside a component: a crash during
 * the first render is exactly the kind this needs to catch, and an effect runs too late.
 */
export function initCrashReporting() {
  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    // Errors in dev are already in the console, and shipping them pollutes the real signal.
    enabled: !__DEV__,
    // Nothing in this app needs a breadcrumb trail through someone's checklist content.
    sendDefaultPii: false,
    tracesSampleRate: 0.2,
  });
}
