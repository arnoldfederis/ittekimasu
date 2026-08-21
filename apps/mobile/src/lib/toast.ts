import { toast as sonner } from "sonner-native";
import { ApiError } from "@/lib/api";

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

  /** Turns a thrown value into a toast, with a sensible fallback for network failures. */
  fromError: (
    error: unknown,
    fallback = "Something went wrong. Try again.",
  ) => {
    if (error instanceof ApiError) {
      sonner.error("Couldn't reach the server", { description: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : fallback;
    sonner.error(message);
  },
};
