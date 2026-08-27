import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";
import type { EntitlementResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { entitlementQuery } from "@/lib/queries";

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;

/** Must match the entitlement identifier in the RevenueCat dashboard and EntitlementService. */
export const PREMIUM_ENTITLEMENT_ID = "ittekimasu_pro";

type PurchasesState = {
  /** True once the SDK has been configured and the first customer info has landed. */
  ready: boolean;
  /** False when EXPO_PUBLIC_REVENUECAT_API_KEY is missing — the paywall says so plainly. */
  configured: boolean;
  /**
   * RevenueCat's own view, used for rendering only. The server decides what a request is
   * allowed to do; this just avoids showing a locked deck to someone who has just paid.
   */
  isPremium: boolean;
  /** The server's answer, which lags a purchase by however long the webhook takes. */
  entitlement: EntitlementResponse | null;
  offering: PurchasesOffering | null;
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
};

const PurchasesContext = createContext<PurchasesState | null>(null);

/** True when RevenueCat says the premium entitlement is active right now. */
function readPremium(info: CustomerInfo): boolean {
  return info.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
}

/**
 * RevenueCat log lines the app already handles and reports to the user itself. Keeping them
 * out of LogBox stops a normal "user tapped Cancel" from looking like a crash in dev.
 */
const HANDLED_LOG_PATTERNS = [
  /purchase was cancelled/i,
  /error when syncing subscriber attributes/i,
];

/** Cancelling a purchase sheet is not an error worth surfacing. */
export function isPurchaseCancelled(error: unknown): boolean {
  return (error as { userCancelled?: boolean })?.userCancelled === true;
}

export function PurchasesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);

  // The server's answer, shared with anything else that asks. Signing out clears the cache,
  // so this can never describe the previous account.
  const { data: entitlement = null, refetch: refetchEntitlement } = useQuery({
    ...entitlementQuery(),
    enabled: Boolean(user),
  });

  // Configure once per app launch. Calling configure again on every auth change resets the
  // SDK's cached customer info and re-fetches offerings for no benefit.
  useEffect(() => {
    if (!API_KEY) {
      setReady(true);
      return;
    }

    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.WARN);
      // The SDK routes its own messages through console.error, so a user tapping Cancel
      // raises a LogBox error over the app. These are handled outcomes, not bugs — swallow
      // the ones we already surface to the user, keep the rest visible.
      Purchases.setLogHandler((level, message) => {
        if (HANDLED_LOG_PATTERNS.some((pattern) => pattern.test(message))) {
          return;
        }
        console.log(`[RevenueCat] ${level}: ${message}`);
      });
    }
    Purchases.configure({ apiKey: API_KEY });

    const listener = (info: CustomerInfo) => setIsPremium(readPremium(info));
    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  /**
   * Identify the customer by Firebase UID.
   *
   * This is what makes the webhook usable: RevenueCat sends `app_user_id`, and the backend
   * looks the user up by `firebase_uid`. Configure the SDK anonymously and skip this and
   * every purchase lands on an anonymous id the server cannot match to anyone.
   */
  useEffect(() => {
    if (!API_KEY) return;

    let cancelled = false;

    (async () => {
      try {
        if (user) {
          const { customerInfo } = await Purchases.logIn(user.uid);
          if (!cancelled) setIsPremium(readPremium(customerInfo));
        } else {
          // logOut throws when the customer is already anonymous, which is the normal state
          // on a cold start at the sign-in screen. Read the cached info instead of calling it.
          const customerInfo = (await Purchases.isAnonymous())
            ? await Purchases.getCustomerInfo()
            : await Purchases.logOut();
          if (!cancelled) setIsPremium(readPremium(customerInfo));
        }

        const offerings = await Purchases.getOfferings();
        if (!cancelled) setOffering(offerings.current);
      } catch {
        // Offline, or the dashboard has no offering configured yet. The paywall renders an
        // empty state rather than the app failing to start.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const refresh = useCallback(async () => {
    await refetchEntitlement();
  }, [refetchEntitlement]);

  /**
   * Waits for the RevenueCat webhook to reach our own backend.
   *
   * The purchase itself is instant on-device, but premium is decided from OUR database, so
   * for a few seconds after paying the server would still return 402. Polling briefly is the
   * difference between "unlocked" and "I paid and it's still locked".
   */
  const waitForServerEntitlement = useCallback(async () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      // staleTime 0 forces a real request each pass — the whole point is to see the value
      // change, and the cached copy is what we are waiting to invalidate.
      const next = await queryClient
        .fetchQuery({ ...entitlementQuery(), staleTime: 0 })
        // Keep trying: a transient failure here is not worth ending the loop over.
        .catch(() => null);

      if (next?.premium) return;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }, [queryClient]);

  const purchase = useCallback(
    async (pkg: PurchasesPackage) => {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const premium = readPremium(customerInfo);
      setIsPremium(premium);
      if (premium) await waitForServerEntitlement();
      return premium;
    },
    [waitForServerEntitlement],
  );

  /** Required by App Store review guideline 3.1.1 — every paid app needs a restore path. */
  const restore = useCallback(async () => {
    const customerInfo = await Purchases.restorePurchases();
    const premium = readPremium(customerInfo);
    setIsPremium(premium);
    if (premium) await waitForServerEntitlement();
    return premium;
  }, [waitForServerEntitlement]);

  const value = useMemo<PurchasesState>(
    () => ({
      ready,
      configured: Boolean(API_KEY),
      isPremium,
      entitlement,
      offering,
      monthly: offering?.monthly ?? null,
      annual: offering?.annual ?? null,
      purchase,
      restore,
      refresh,
    }),
    [ready, isPremium, entitlement, offering, purchase, restore, refresh],
  );

  return <PurchasesContext value={value}>{children}</PurchasesContext>;
}

export function usePurchases(): PurchasesState {
  const context = use(PurchasesContext);
  if (!context) {
    throw new Error("usePurchases must be used inside a PurchasesProvider");
  }
  return context;
}
