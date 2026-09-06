const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100";

const TOKEN_KEY = "prohelper.admin.token";

export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Options = { method?: string; body?: unknown; signal?: AbortSignal };

/**
 * Every call to the Express API goes through here so the token, the error
 * shape and the 401 redirect are handled in exactly one place.
 */
export async function api<T = unknown>(path: string, { method = "GET", body, signal }: Options = {}): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`${BASE}${path}`, {
    method,
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = payload?.error ?? {};
    if (res.status === 401 && typeof window !== "undefined") {
      tokenStore.clear();
      if (!window.location.pathname.startsWith("/login")) window.location.href = "/login";
    }
    throw new ApiError(res.status, err.message || "Something went wrong.", err.code);
  }

  return payload as T;
}
