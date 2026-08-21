import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/** False until the Google OAuth client IDs are present in .env. */
export const isGoogleConfigured = Boolean(
  GOOGLE_WEB_CLIENT_ID || GOOGLE_IOS_CLIENT_ID,
);

let googleConfigured = false;

/**
 * Configured lazily. Calling GoogleSignin.configure() at module scope throws an unhandled
 * rejection at import time when the client IDs are missing, which takes down the whole
 * sign-in screen instead of just the one button.
 */
function ensureGoogleConfigured() {
  if (googleConfigured) return;
  if (!isGoogleConfigured) {
    throw new Error(
      "Google sign-in isn't set up yet. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and " +
        "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID from the Firebase console to apps/mobile/.env.",
    );
  }
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });
  googleConfigured = true;
}

/** Raised when the user backs out of a native sign-in sheet. Callers should stay silent. */
export class SignInCancelledError extends Error {
  constructor() {
    super("Sign-in cancelled");
    this.name = "SignInCancelledError";
  }
}

export async function signInWithApple(): Promise<void> {
  // Apple requires the nonce sent to it to be the SHA-256 of the one handed to Firebase,
  // which is what stops a stolen identity token from being replayed.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "ERR_REQUEST_CANCELED") {
      throw new SignInCancelledError();
    }
    throw error;
  }

  if (!credential.identityToken) {
    throw new Error("Apple did not return an identity token.");
  }

  const provider = new OAuthProvider("apple.com");
  const { user } = await signInWithCredential(
    auth,
    provider.credential({ idToken: credential.identityToken, rawNonce }),
  );

  // Apple hands over fullName on the FIRST sign-in only. If it is not persisted onto the
  // Firebase profile right now it is gone permanently, and the backend — which reads the
  // name off the verified token — will never see it.
  const appleName = formatAppleName(credential.fullName);
  if (appleName && !user.displayName) {
    await updateProfile(user, { displayName: appleName });
    await user.getIdToken(true); // Force-refresh so the next API call carries the name.
  }
}

function formatAppleName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
) {
  if (!fullName) return null;
  const parts = [fullName.givenName, fullName.familyName].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

export async function signInWithGoogle(): Promise<void> {
  ensureGoogleConfigured();
  await GoogleSignin.hasPlayServices();

  const result = await GoogleSignin.signIn();
  if (result.type === "cancelled") {
    throw new SignInCancelledError();
  }

  const idToken = result.data?.idToken;
  if (!idToken) {
    throw new Error("Google did not return an ID token.");
  }

  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}
