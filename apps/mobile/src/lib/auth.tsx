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

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setHasOnboarded(false);
        setInitializing(false);
        return;
      }

      // Trust the cache first so a cold start doesn't bounce a returning user through
      // onboarding while the network call is in flight.
      const cached = await AsyncStorage.getItem(onboardedKey(nextUser.uid));
      setHasOnboarded(cached === "true");

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
        // Offline or server down: keep whatever the cache said rather than forcing the
        // user to redo onboarding. Surfaced because in local dev it almost always means
        // the Spring server isn't running.
        toast.fromError(error, "Signed in, but the server didn't respond.");
      }

      setInitializing(false);
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
    const uid = auth.currentUser?.uid;
    if (uid) {
      await AsyncStorage.removeItem(onboardedKey(uid));
    }
    await firebaseSignOut(auth);
  }, []);

  const value = useMemo(
    () => ({ user, initializing, hasOnboarded, markOnboarded, signOut }),
    [user, initializing, hasOnboarded, markOnboarded, signOut],
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
