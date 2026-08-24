import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { api } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { toast } from "@/lib/toast";

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
  /** Whether the user already has a checklist on the server. */
  hasOnboarded: boolean;
  markOnboarded: () => Promise<void>;
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

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setHasOnboarded(false);
        setResolvingRoute(false);
        setInitializing(false);
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
        // authenticated request, so no separate call to /users/me is needed.
        const checklist = await api.getChecklist();
        const onboarded = checklist.totalCount > 0;

        setHasOnboarded(onboarded);
        await AsyncStorage.setItem(
          onboardedKey(nextUser.uid),
          String(onboarded),
        );
      } catch (error) {
        // Offline or server down. With a cached answer we keep it; without one the only
        // safe default is onboarding, which is recoverable — the server rejects a second
        // checklist anyway by replacing it.
        if (!hasCachedAnswer) {
          setHasOnboarded(false);
        }
        toast.fromError(error, "Signed in, but the server didn't respond.");
      } finally {
        setResolvingRoute(false);
        setInitializing(false);
      }
    });
  }, []);

  const markOnboarded = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (uid) {
      await AsyncStorage.setItem(onboardedKey(uid), "true");
    }
    setHasOnboarded(true);
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
      signOut,
    }),
    [user, initializing, resolvingRoute, hasOnboarded, markOnboarded, signOut],
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
