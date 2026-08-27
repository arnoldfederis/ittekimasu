import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import {
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { auth } from "@/lib/firebase";
import { meQuery } from "@/lib/queries";
import { clearPersistedCache } from "@/lib/query-client";

/**
 * Per-uid so signing in as someone else on the same device never inherits their state.
 * This is only a cache to stop the app flashing onboarding on a cold start — the server is
 * the source of truth.
 */
const onboardedKey = (uid: string) => `ittekimasu.onboarded.${uid}`;

type AuthState = {
  user: User | null;
  /** True until Firebase has restored the persisted session — render nothing meaningful before this flips. */
  initializing: boolean;
  /** True while the correct route for a signed-in user is still unknown. */
  resolvingRoute: boolean;
  /** Whether the server says onboarding is finished — with or without a checklist. */
  hasOnboarded: boolean;
  markOnboarded: () => Promise<void>;
  /** Drops the cached answer for the current uid. Account deletion, not sign-out. */
  forgetOnboarded: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  /**
   * True while we still have no idea which route this user belongs on. The router renders
   * nothing rather than guessing — guessing "not onboarded" is what made onboarding flash
   * for a second before jumping to the tabs.
   */
  const [resolvingRoute, setResolvingRoute] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setHasOnboarded(false);
        setResolvingRoute(false);
        setInitializing(false);
        // Nothing cached survives a sign-out. On a shared phone the next account would
        // otherwise render the previous one's checklist and streak for a frame — and the
        // persisted copy would survive a relaunch, which is worse.
        queryClient.clear();
        clearPersistedCache();
        return;
      }

      const cached = await AsyncStorage.getItem(onboardedKey(nextUser.uid));
      const hasCachedAnswer = cached !== null;

      // A cached answer is trustworthy enough to route on immediately; the fetch below
      // just reconciles it. With no cached answer there is nothing to show yet, so hold.
      if (hasCachedAnswer) {
        setHasOnboarded(cached === "true");
      }
      setResolvingRoute(!hasCachedAnswer);

      try {
        // Doubles as account creation: the backend creates the user row on the first
        // authenticated request, so this is the only call needed here.
        //
        // fetchQuery, not api.getMe: the answer lands in the same cache entry the learn
        // tab, the profile and the notifications provider all read.
        //
        // `onboarded` is a field on the user now, not a count of checklist tasks — someone
        // who only wants the language decks has none and is still finished.
        const me = await queryClient.fetchQuery(meQuery());

        setHasOnboarded(me.onboarded);
        await AsyncStorage.setItem(
          onboardedKey(nextUser.uid),
          String(me.onboarded),
        );
      } catch {
        // Offline or server down — the query cache has already toasted. With a cached
        // answer we keep it; without one the only safe default is onboarding, which is
        // recoverable: finishing it again just re-stamps a value the server already has.
        if (!hasCachedAnswer) {
          setHasOnboarded(false);
        }
      } finally {
        setResolvingRoute(false);
        setInitializing(false);
      }
    });
  }, [queryClient]);

  const markOnboarded = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (uid) {
      await AsyncStorage.setItem(onboardedKey(uid), "true");
    }
    setHasOnboarded(true);
  }, []);

  /**
   * DELETE /users/me removes the server row but not the Firebase user, so signing back in
   * returns the SAME uid — and with it a cached "onboarded" answer for an account that no
   * longer exists. That is what made the tabs paint for a moment before bouncing to
   * onboarding. Sign-out deliberately keeps the cache; deletion must clear it.
   *
   * Only the cache — deliberately NOT setHasOnboarded(false). The user is still signed in
   * for the moment it takes to sign out, and flipping the flag here routed them into
   * onboarding for that moment, which both flashed and kicked off a templates fetch that
   * landed after the token was gone.
   */
  const forgetOnboarded = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (uid) {
      await AsyncStorage.removeItem(onboardedKey(uid));
    }
  }, []);

  const signOut = useCallback(async () => {
    // The cache key is per-uid, so leaving it is both safe and the whole point: signing
    // back in routes instantly instead of flashing onboarding while the checklist loads.
    await firebaseSignOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      user,
      initializing,
      resolvingRoute,
      hasOnboarded,
      markOnboarded,
      forgetOnboarded,
      signOut,
    }),
    [
      user,
      initializing,
      resolvingRoute,
      hasOnboarded,
      markOnboarded,
      forgetOnboarded,
      signOut,
    ],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const context = use(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}
