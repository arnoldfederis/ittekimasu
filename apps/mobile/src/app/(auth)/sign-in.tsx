import * as AppleAuthentication from "expo-apple-authentication";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { Button } from "@/components/button";
import { GoogleLogo } from "@/components/google-logo";
import { useIsDark } from "@/constants/theme";
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
    <ScrollView
      className="flex-1 bg-canvas"
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
          style={{ width: 88, height: 88, borderRadius: 20 }}
        />
        <Text className="font-semibold text-display text-ink">Ittekimasu</Text>
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
            style={{ height: AUTH_BUTTON_HEIGHT }}
          />
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

      <Text className="text-center text-caption text-ink-subtle">
        By continuing you agree to our Terms of Service and Privacy Policy.
      </Text>
    </ScrollView>
  );
}
