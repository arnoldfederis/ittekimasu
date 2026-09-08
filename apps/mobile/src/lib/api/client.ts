import type { ErrorResponse } from "@/lib/api/types";
import { getIdToken } from "@/lib/firebase";
import { reportTransportFailure, reportTransportSuccess } from "@/lib/network";

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

/**
 * The request never reached the server: no connection, DNS failure, a dropped socket, a
 * server that is down. Distinct from ApiError, which means the server answered and said no.
 *
 * It exists so the app can stay quiet about it while offline. `fetch` rejects with a raw
 * platform string — "Network request failed", "The internet connection appears to be
 * offline" — and showing that to someone who can already see an offline banner is both
 * noise and the wrong voice.
 */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super("Could not reach the server.");
    this.name = "NetworkError";
    this.cause = cause;
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
    let token: string | null;
    try {
      token = await getIdToken();
    } catch (cause) {
      /*
       * Firebase refreshes an expired token over the network, so offline this rejects with
       * its own raw string ("The internet connection appears to be offline") BEFORE the
       * fetch below is ever reached. Same class of failure from the app's point of view —
       * the request never left the device — so it gets the same type, and the same silence
       * while the offline banner is up.
       */
      reportTransportFailure();
      throw new NetworkError(cause);
    }

    if (!token) {
      throw new NotSignedInError();
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    /*
     * Transport failure, not a response. Typed so the layers above can tell "you are on a
     * plane" apart from "the server said no" — and reported, because this is the only place
     * that KNOWS the connection is dead. The platform's own reachability flag says otherwise
     * in exactly the cases that matter.
     */
    reportTransportFailure();
    throw new NetworkError(cause);
  }

  // Reached the server. Even a 401 or a 404 proves the connection is back.
  reportTransportSuccess();

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
