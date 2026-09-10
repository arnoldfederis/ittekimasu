import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState } from "react-native";
import { LogLevel, OneSignal } from "react-native-onesignal";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { meQuery, queryKeys } from "@/lib/queries";
import { toast } from "@/lib/toast";

const APP_ID = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID;

/** Set once the permission prompt has been shown, so it is never shown a second time. */
const PROMPTED_KEY = "notifications.prompted";

type NotificationsState = {
  /** False when EXPO_PUBLIC_ONESIGNAL_APP_ID is missing — every call becomes a no-op. */
  configured: boolean;
  /** 0-23, or null when the daily reminder is off. */
  reminderHour: number | null;
  /**
   * Whether iOS has granted notification permission. Null until checked.
   *
   * Without this the app cannot explain the most common failure: OneSignal reports "all
   * included players are not subscribed" and the user just never hears anything.
   */
  hasPermission: boolean | null;
  /**
   * Asks for permission, but only the first time and only from a caller that has just
   * shown the user something worth being reminded about.
   */
  promptAfterFirstSession: () => Promise<void>;
  setReminderHour: (hour: number | null) => Promise<void>;
};

const NotificationsContext = createContext<NotificationsState | null>(null);

/** The device's IANA zone, e.g. Asia/Tokyo. The reminder fires at the user's hour, not ours. */
function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const save = useMutation({
    mutationFn: (hour: number | null) =>
      api.updateReminders(hour, hour === null ? null : deviceTimezone()),

    // The PATCH returns the updated user, so the profile tab's copy of it is correct
    // without a refetch — and the tag is written from what the server actually stored.
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.me, updated);
      applyTags(
        updated.reminderHour,
        updated.reminderTimezone ?? deviceTimezone(),
      );
    },

    meta: { errorMessage: "Couldn't save your reminder time." },
  });

  /**
   * Re-asserts the external id on the OneSignal subscription.
   *
   * login() on sign-in is not always enough: a subscription created before notification
   * permission existed carries no push token, and granting permission later (often via iOS
   * Settings, with the app closed) produces a fresh subscription that never learned who it
   * belongs to. Calling login again after a grant is what stops a device going permanently
   * unreachable — the "all included players are not subscribed" case.
   */
  const identify = useCallback(() => {
    if (!APP_ID || !user) return;
    OneSignal.login(user.uid);
    // OneSignal tracks its own opt-in state on top of the OS permission. A subscription
    // that was never explicitly opted in reports "Never Subscribed" and receives nothing,
    // even on a device where iOS has already granted permission — which is exactly what
    // happens to the second account to sign in on a shared phone.
    OneSignal.User.pushSubscription.optIn();
  }, [user]);

  const refreshPermission = useCallback(async () => {
    if (!APP_ID) return;
    try {
      setHasPermission(await OneSignal.Notifications.getPermissionAsync());
    } catch {
      setHasPermission(null);
    }
  }, []);

  useEffect(() => {
    refreshPermission();

    /*
     * Re-read on every foreground, not just at mount.
     *
     * Permission can change while the app is backgrounded — the user taps "Open Settings"
     * from the blocked card and grants it there, or turns it off later. Read once at mount,
     * the app kept showing "Notifications are blocked" to someone who had just allowed
     * them, and only a relaunch cleared it. That card's whole job is to be accurate.
     */
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshPermission();
    });

    return () => subscription.remove();
  }, [refreshPermission]);

  useEffect(() => {
    if (!APP_ID) return;

    if (__DEV__) {
      OneSignal.Debug.setLogLevel(LogLevel.Warn);
    }
    OneSignal.initialize(APP_ID);

    /*
     * Tapping the reminder lands on the learn tab, not wherever the app happened to be.
     * The whole point of the notification is "go study" — dumping someone on the dashboard
     * makes them navigate there themselves, which is a step too many for a nudge.
     */
    const onClick = () => {
      // A cold start opens the app before the router has mounted; the microtask lets the
      // navigation tree exist before we push into it.
      setTimeout(() => {
        try {
          router.push("/learn");
        } catch {
          // Navigation not ready. Landing on the default tab is an acceptable fallback —
          // better than crashing on a notification tap.
        }
      }, 0);
    };

    OneSignal.Notifications.addEventListener("click", onClick);
    return () => {
      OneSignal.Notifications.removeEventListener("click", onClick);
    };
  }, []);

  /**
   * Identify by Firebase UID, the same id RevenueCat uses.
   *
   * One external id across both services means a push campaign and a subscription event
   * describe the same person without a lookup table in between.
   */
  useEffect(() => {
    if (!APP_ID) return;

    if (user) {
      identify();
    } else {
      OneSignal.logout();
    }
  }, [user, identify]);

  // The same GET /users/me the learn and profile tabs read. One cache entry means the
  // reminder hour here can never disagree with the one rendered on the profile.
  const { data: me } = useQuery({ ...meQuery(), enabled: Boolean(user) });
  const reminderHour = me?.reminderHour ?? null;

  // The server owns the setting; the OneSignal tag is a projection of it. Re-applying on
  // launch is what makes a reinstall or a new phone keep the reminder the user chose.
  useEffect(() => {
    if (!me) return;
    applyTags(me.reminderHour, me.reminderTimezone ?? deviceTimezone());
  }, [me]);

  const promptAfterFirstSession = useCallback(async () => {
    if (!APP_ID) return;

    // Asking on launch, before the app has shown any value, is how opt-in rates get halved.
    // This runs after a completed review session and never again.
    const alreadyPrompted = await AsyncStorage.getItem(PROMPTED_KEY);
    if (alreadyPrompted === "true") return;

    const accepted = await OneSignal.Notifications.requestPermission(true);
    // Recorded AFTER the prompt resolves. Writing it first means a prompt that failed to
    // appear burns the one chance iOS gives us and the user is never asked again.
    await AsyncStorage.setItem(PROMPTED_KEY, "true");
    setHasPermission(accepted);

    if (accepted) {
      identify();
      // A reminder the user never chose is not a reminder, it is a surprise. Default to a
      // sensible evening hour and let them move or kill it in settings.
      await persistHour(20);
    }
  }, [identify]);

  /**
   * Turning the reminder on is the other honest moment to ask for permission — the user has
   * just explicitly asked to be reminded. Without this, someone who skipped the post-session
   * prompt could set a time and silently never hear from us: iOS drops every push.
   */
  const setReminderHour = useCallback(
    async (hour: number | null) => {
      if (hour !== null && APP_ID) {
        const granted = await OneSignal.Notifications.getPermissionAsync();
        // Already granted still needs the opt-in re-asserted — see identify(). This is the
        // path a second account on a shared device takes, and skipping it is what leaves
        // that account "Never Subscribed".
        if (granted) {
          identify();
        }
        if (!granted) {
          const accepted =
            await OneSignal.Notifications.requestPermission(true);
          await AsyncStorage.setItem(PROMPTED_KEY, "true");
          setHasPermission(accepted);
          if (accepted) {
            identify();
          }
          if (!accepted) {
            toast.info(
              "Notifications are off",
              "Turn them on in Settings → Ittekimasu → Notifications to get your reminder.",
            );
            return;
          }
        }
      }
      await persistHour(hour);
    },
    [identify],
  );

  async function persistHour(hour: number | null) {
    // A rejection is already a toast and a rolled-back cache; the caller has nothing to do
    // with it, and an unhandled rejection here would surface as a red box in dev.
    await save.mutateAsync(hour).catch(() => undefined);
  }

  /**
   * Tags, not a scheduled push: the delivery time lives in a OneSignal campaign that targets
   * the `reminder_hour` segment, so changing the copy or the cadence is a dashboard edit
   * rather than an app release.
   */
  function applyTags(hour: number | null, timezone: string) {
    if (!APP_ID) return;

    if (hour === null) {
      OneSignal.User.removeTags(["reminder_hour", "reminder_timezone"]);
      return;
    }
    OneSignal.User.addTags({
      reminder_hour: String(hour),
      reminder_timezone: timezone,
    });
  }

  const value = useMemo<NotificationsState>(
    () => ({
      configured: Boolean(APP_ID),
      reminderHour,
      hasPermission,
      promptAfterFirstSession,
      setReminderHour,
    }),
    [reminderHour, hasPermission, promptAfterFirstSession, setReminderHour],
  );

  return <NotificationsContext value={value}>{children}</NotificationsContext>;
}

export function useNotifications(): NotificationsState {
  const context = use(NotificationsContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used inside a NotificationsProvider",
    );
  }
  return context;
}

/** "8:00 PM", or "Off" when reminders are disabled. */
export function formatReminderHour(hour: number | null): string {
  if (hour === null) return "Off";
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
