import { Linking } from "react-native";
import { toast } from "@/lib/toast";

/**
 * Opens a link, and says so when it cannot.
 *
 * `Linking.openURL` returns a promise, and every call site used to be fire-and-forget:
 * `onPress={() => Linking.openURL(url)}`. When iOS refuses — a managed device, Screen Time
 * web restrictions, a simulator with no Safari — the rejection had nobody to catch it, so
 * it reached Sentry as an unhandled error and, on screen, as a button that did nothing.
 *
 * That silence is worst on the two screens App Review inspects: the paywall and sign-in
 * both link Terms and Privacy, and guideline 3.1.2 expects those links to work. A reviewer
 * tapping a dead button cannot tell a blocked link from a broken app.
 *
 * The toast names the address so it can at least be typed somewhere else. Deliberately no
 * clipboard fallback — expo-clipboard is a native module, and this fix has to be shippable
 * as an over-the-air update.
 */
export async function openUrl(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    toast.info("Couldn't open that link", `Visit ${url} in your browser.`);
    return false;
  }
}

/**
 * Opens this app's page in iOS Settings.
 *
 * Same reasoning as {@link openUrl}: the two screens that offer this are the ones telling
 * someone their notifications are blocked, so a button that silently fails leaves them
 * with a problem and no route out of it.
 */
export async function openAppSettings(): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    toast.info(
      "Couldn't open Settings",
      "Open the Settings app, then find Ittekimasu in the list.",
    );
    return false;
  }
}
