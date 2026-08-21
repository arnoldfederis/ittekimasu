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

export type ErrorResponse = {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  fieldErrors: Record<string, string> | null;
};

export type UserResponse = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Skip the Authorization header. Only the RevenueCat webhook is unauthenticated. */
  anonymous?: boolean;
};

async function request<T>(
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
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
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

export const api = {
  /**
   * Also the account-creation call: the backend creates the user row on first
   * authenticated request, so this must run once after every fresh sign-in.
   */
  getMe: () => request<UserResponse>("/users/me"),

  /** Required by App Store review guideline 5.1.1(v). */
  deleteMe: () => request<void>("/users/me", { method: "DELETE" }),
};
