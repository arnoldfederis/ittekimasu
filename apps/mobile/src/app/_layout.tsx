import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Toaster } from "sonner-native";
import { radius, useIsDark, useThemeColors } from "@/constants/theme";
import { AuthProvider, useAuth } from "@/lib/auth";
import { PurchasesProvider } from "@/lib/purchases";
import "../global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    // sonner-native drives swipe-to-dismiss through gesture-handler, so the Toaster has to
    // sit inside a GestureHandlerRootView or toasts render but never dismiss by swipe.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        {/* Inside AuthProvider: RevenueCat is identified by the Firebase UID. */}
        <PurchasesProvider>
          <Chrome />
        </PurchasesProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function Chrome() {
  const colors = useThemeColors();
  const isDark = useIsDark();

  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.canvas,
        card: colors.surface,
        text: colors.ink,
        border: colors.line,
      },
    };
  }, [isDark, colors]);

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <RootNavigator />
      <Toaster
        duration={4000}
        // Clears the Dynamic Island / notch. At a small offset the toast renders
        // underneath the status bar and the title is unreadable.
        offset={64}
        position="top-center"
        theme={isDark ? "dark" : "light"}
        toastOptions={{
          style: {
            backgroundColor: colors.surface,
            borderColor: colors.line,
            borderWidth: 1,
            borderRadius: radius.card,
            borderCurve: "continuous",
          },
          titleStyle: { color: colors.ink, fontWeight: "600" },
          descriptionStyle: { color: colors.inkMuted },
        }}
      />
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { user, initializing, resolvingRoute, hasOnboarded } = useAuth();
  const colors = useThemeColors();

  useEffect(() => {
    if (!initializing) {
      SplashScreen.hideAsync();
    }
  }, [initializing]);

  // Hold rather than guess. On the first launch this keeps the splash up while the
  // session is restored; on a later sign-in it stops onboarding painting for a moment
  // before the checklist comes back and bounces the user to the tabs.
  if (initializing || resolvingRoute) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={!!user && !hasOnboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={!!user && hasOnboarded}>
        <Stack.Screen name="(tabs)" />
        {/*
          A modal, not a tab: a review session is a single task the learner starts and
          finishes, and the tab bar would invite them to wander out of it half-done.
        */}
        <Stack.Screen
          name="review/[courseId]"
          options={{ presentation: "modal" }}
        />
        {/* A modal too: the paywall interrupts something, and it must be dismissable. */}
        <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
        <Stack.Screen name="settings" />
      </Stack.Protected>
    </Stack>
  );
}
