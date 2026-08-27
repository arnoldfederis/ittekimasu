import type { ErrorResponse } from "@/lib/api/types";
import { getIdToken } from "@/lib/firebase";

/**
 * Every route on the Spring backend is served under /api (see WebMvcConfig), except the
 * Scalar docs. Point EXPO_PUBLIC_API_URL at a LAN IP when running on a physical device —
 * localhost resolves to the phone itself, not your Mac.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api";

/** Thrown for any non-2xx response, so callers can branch on `status`. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ErrorResponse | null;

  constructor(status: number, body: ErrorResponse | null) {
    super(body?.message ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  /** The backend returns 402 when a route needs premium — the paywall trigger. */
  get requiresPremium(): boolean {
    return this.status === 402;
  }
}

/**
 * Thrown instead of sending an authenticated request with no token. Sign-out and account
 * deletion can land while a screen's fetch is in flight; that request would reach the
 * server without an Authorization header and come back 401, which is a toast about a
 * session the user just ended on purpose. `toast.fromError` stays silent for this one.
 */
export class NotSignedInError extends Error {
  constructor() {
    super("Not signed in.");
    this.name = "NotSignedInError";
  }
}

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Skip the Authorization header. Only the RevenueCat webhook is unauthenticated. */
  anonymous?: boolean;
};

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, anonymous = false } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (!anonymous) {
    const token = await getIdToken();
    if (!token) {
      throw new NotSignedInError();
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      await readJson<ErrorResponse>(response),
    );
  }

  // 204 No Content, as returned by DELETE /users/me.
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
