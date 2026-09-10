import * as AppleAuthentication from "expo-apple-authentication";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { BrandBackdrop } from "@/components/brand-backdrop";
import { Button } from "@/components/button";
import { GoogleLogo } from "@/components/google-logo";
import { PRIVACY_URL, TERMS_URL } from "@/constants/legal";
import { useIsDark, useThemeColors } from "@/constants/theme";
import {
  SignInCancelledError,
  signInWithApple,
  signInWithGoogle,
} from "@/lib/sign-in";
import { toast } from "@/lib/toast";

/** Apple sizes its label at 43% of button height; ours match at this height. */
const AUTH_BUTTON_HEIGHT = 56;

export default function SignInScreen() {
  const isDark = useIsDark();
  const colors = useThemeColors();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<"apple" | "google" | null>(null);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  async function run(
    provider: "apple" | "google",
    action: () => Promise<void>,
  ) {
    setBusy(provider);
    try {
      await action();
      // No navigation here on purpose: the auth state listener in AuthProvider
      // flips the guard in the root layout and the router follows.
    } catch (error) {
      if (!(error instanceof SignInCancelledError)) {
        toast.error("Could not sign in", (error as Error).message);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    // The backdrop is a sibling of the ScrollView, not a child: as a child it would scroll
    // with the content and the wash would slide off the top of the screen.
    <View className="flex-1 bg-canvas">
      <BrandBackdrop />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: 24,
          gap: 32,
        }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="items-center gap-3">
          <Image
            source={require("@/assets/images/icon.png")}
            // A shadow rather than a border: the icon now sits on a tinted wash instead of a
            // flat canvas, and without one its teal ground melts into the teal behind it.
            style={{
              width: 88,
              height: 88,
              borderRadius: 20,
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
            }}
          />
          <Text className="font-semibold text-display text-ink">
            Ittekimasu
          </Text>
          <Text className="text-center text-body text-ink-muted">
            Your move to Japan, one step at a time
          </Text>
        </View>

        <View className="gap-3">
          {/*
          Apple must come first and be at least as prominent as any other social option
          (App Store review guideline 4.8). Do not reorder these.
        */}
          {appleAvailable && Platform.OS === "ios" ? (
            // Apple's button is a native view: it cannot render a spinner, and restyling it
            // is against the HIG. Overlaying one keeps Apple's button untouched while still
            // showing that something is happening.
            <View>
              <AppleAuthentication.AppleAuthenticationButton
                // Apple's HIG requires the white variant on dark backgrounds.
                buttonStyle={
                  isDark
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                buttonType={
                  AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                }
                cornerRadius={14}
                onPress={() => run("apple", signInWithApple)}
                style={{
                  height: AUTH_BUTTON_HEIGHT,
                  opacity: busy === null ? 1 : 0.5,
                }}
              />
              {busy === "apple" ? (
                <View
                  className="absolute inset-0 items-center justify-center"
                  pointerEvents="none"
                >
                  <ActivityIndicator
                    color={isDark ? colors.ink : colors.inkInverse}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          <Button
            disabled={busy !== null}
            leading={<GoogleLogo size={14} />}
            loading={busy === "google"}
            onPress={() => run("google", signInWithGoogle)}
            size="auth"
            title="Sign in with Google"
            variant="secondary"
          />
        </View>

        {/*
          Tappable, not the flat sentence this used to be. Naming a Terms of Service the
          reader cannot open is the kind of thing an App Review tester tries first — and
          on the one screen that gates the whole app.
        */}
        <Text className="text-center text-caption text-ink-subtle">
          By continuing you agree to our{" "}
          <Text
            accessibilityRole="link"
            className="underline"
            onPress={() => Linking.openURL(TERMS_URL)}
          >
            Terms of Service
          </Text>{" "}
          and{" "}
          <Text
            accessibilityRole="link"
            className="underline"
            onPress={() => Linking.openURL(PRIVACY_URL)}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </ScrollView>
    </View>
  );
}
