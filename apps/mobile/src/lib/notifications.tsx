import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { LogLevel, OneSignal } from "react-native-onesignal";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
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
  const [reminderHour, setStoredHour] = useState<number | null>(null);

  useEffect(() => {
    if (!APP_ID) return;

    if (__DEV__) {
      OneSignal.Debug.setLogLevel(LogLevel.Warn);
    }
    OneSignal.initialize(APP_ID);
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
      OneSignal.login(user.uid);
    } else {
      OneSignal.logout();
    }
  }, [user]);

  // The server owns the setting; the OneSignal tag is a projection of it. Re-applying on
  // launch is what makes a reinstall or a new phone keep the reminder the user chose.
  useEffect(() => {
    if (!user) {
      setStoredHour(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const me = await api.getMe();
        if (cancelled) return;
        setStoredHour(me.reminderHour);
        applyTags(me.reminderHour, me.reminderTimezone ?? deviceTimezone());
      } catch {
        // Server unreachable. The existing tags stay as they are.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const promptAfterFirstSession = useCallback(async () => {
    if (!APP_ID) return;

    // Asking on launch, before the app has shown any value, is how opt-in rates get halved.
    // This runs after a completed review session and never again.
    const alreadyPrompted = await AsyncStorage.getItem(PROMPTED_KEY);
    if (alreadyPrompted === "true") return;

    await AsyncStorage.setItem(PROMPTED_KEY, "true");
    const accepted = await OneSignal.Notifications.requestPermission(true);

    if (accepted) {
      // A reminder the user never chose is not a reminder, it is a surprise. Default to a
      // sensible evening hour and let them move or kill it in settings.
      await persistHour(20);
    }
  }, []);

  const setReminderHour = useCallback(async (hour: number | null) => {
    await persistHour(hour);
  }, []);

  async function persistHour(hour: number | null) {
    const timezone = deviceTimezone();
    try {
      await api.updateReminders(hour, hour === null ? null : timezone);
      setStoredHour(hour);
      applyTags(hour, timezone);
    } catch (error) {
      toast.fromError(error, "Couldn't save your reminder time.");
    }
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
      promptAfterFirstSession,
      setReminderHour,
    }),
    [reminderHour, promptAfterFirstSession, setReminderHour],
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
