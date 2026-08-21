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

const ONBOARDED_KEY = "ittekimasu.onboarded";

type AuthState = {
  user: User | null;
  /** True until Firebase has restored the persisted session — render nothing meaningful before this flips. */
  initializing: boolean;
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

      if (nextUser) {
        // Creates the backend user row on first sight. Failure here must not block
        // sign-in — the next authenticated request will create it just the same.
        try {
          await api.getMe();
        } catch (error) {
          // Surfaced anyway because in local dev it almost always means the Spring
          // server isn't running, and nothing else in the app will work.
          toast.fromError(error, "Signed in, but the server didn't respond.");
        }
        setHasOnboarded((await AsyncStorage.getItem(ONBOARDED_KEY)) === "true");
      } else {
        setHasOnboarded(false);
      }

      setInitializing(false);
    });
  }, []);

  const markOnboarded = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDED_KEY, "true");
    setHasOnboarded(true);
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(ONBOARDED_KEY);
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
