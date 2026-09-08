import { toast as sonner } from "sonner-native";
import { onlineManager } from "@tanstack/react-query";
import { ApiError, NetworkError, NotSignedInError } from "@/lib/api";

/**
 * Toasts are the default for feedback that does not need a decision: failed requests,
 * saved changes, sign-in problems. Use `Alert.alert` only when the user must confirm
 * something irreversible (deleting their account), because a toast can be missed.
 *
 * Tone rule from the design principle: state what happened and what to do next. Never
 * scold. "That email and password don't match" — not "Invalid credentials".
 */
export const toast = {
  success: (title: string, description?: string) =>
    sonner.success(title, { description }),
  info: (title: string, description?: string) => sonner(title, { description }),
  error: (title: string, description?: string) =>
    sonner.error(title, { description }),

  /**
   * Turns a thrown value into a toast — or into nothing, which is the right answer more
   * often than it looks.
   *
   * `fallback` is the caller's own copy, and it WINS over a raw `Error.message`. Platform
   * strings like "Network request failed" were written for a developer reading a stack
   * trace, never for someone holding a phone.
   */
  fromError: (
    error: unknown,
    fallback = "Something went wrong. Try again.",
  ) => {
    // The session ended mid-request. The router has already moved the user to sign-in;
    // a toast about it would only be noise.
    if (error instanceof NotSignedInError) {
      return;
    }

    if (error instanceof NetworkError) {
      // Offline is already on screen: the banner says so, and it says the useful half —
      // that answers are being kept. A toast repeating it in worse words is noise about a
      // situation the user cannot act on.
      if (!onlineManager.isOnline()) {
        return;
      }
      // Online, but the server did not answer: that IS worth saying, because it is not the
      // state the banner describes and retrying might work.
      sonner.error("Couldn't reach the server", {
        description: "It might be busy. Try again in a moment.",
      });
      return;
    }

    if (error instanceof ApiError) {
      sonner.error("Couldn't reach the server", { description: error.message });
      return;
    }

    sonner.error(fallback);
  },
};
