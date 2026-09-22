"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
const TOKEN_KEY = "prohelper.partner.token";

const partnerTokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export type PartnerUser = { id: string; name: string; phone: string; role: string; status: string; photoUrl?: string };

/** Carries the status code, so a refused token can be told from a server that is simply unreachable. */
export class PartnerApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "PartnerApiError";
  }
}

type AuthState = {
  user: PartnerUser | null;
  loading: boolean;
  /** A session is stored, but the server could not be reached to check it. */
  unreachable: boolean;
  retry: () => void;
  requestOtp: (phone: string) => Promise<{ devCode?: string, dummyAuth?: boolean }>;
  verifyOtpAndSignIn: (phone: string, code: string) => Promise<void>;
  signOut: () => void;
  reloadUser: () => Promise<void>;
  setUser: (user: PartnerUser) => void;
};

const Ctx = createContext<AuthState | null>(null);

export async function partnerApi<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = partnerTokenStore.get();
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100"}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      partnerTokenStore.clear();
      if (!window.location.pathname.startsWith("/referralpartner/login")) window.location.href = "/referralpartner/login";
    }
    throw new PartnerApiError(res.status, payload?.error?.message || "Something went wrong.");
  }
  return payload as T;
}

export function PartnerAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PartnerUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();

  /*
   * A signed-in partner stays signed in. Only a token the server actually
   * refuses ends the session — a slow server or a dead connection used to
   * clear it too, which is why people found themselves logged out.
   */
  useEffect(() => {
    let live = true;
    if (!partnerTokenStore.get()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setUnreachable(false);
    partnerApi<{ user: PartnerUser }>("/api/auth/me")
      .then((r) => {
        if (!live) return;
        setUser(r.user);
        setLoading(false);
      })
      .catch((err) => {
        if (!live) return;
        const status = err instanceof PartnerApiError ? err.status : 0;
        if (status === 401 || status === 403) {
          partnerTokenStore.clear();
        } else {
          setUnreachable(true);
        }
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const reloadUser = useCallback(async () => {
    try {
      const res = await partnerApi<{ user: PartnerUser }>("/api/auth/me");
      setUser(res.user);
    } catch {
      // ignore
    }
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    return await partnerApi<{ devCode?: string, dummyAuth?: boolean }>("/api/auth/otp/request", { method: "POST", body: { phone } });
  }, []);

  const verifyOtpAndSignIn = useCallback(
    async (phone: string, code: string) => {
      // Step 1: Verify OTP and get verificationToken
      const { verificationToken } = await partnerApi<{ verificationToken: string }>("/api/auth/otp/verify", {
        method: "POST",
        body: { phone, code },
      });

      // Step 2: Exchange for session token as role 'partner'
      const r = await partnerApi<{ token: string; user: PartnerUser }>("/api/auth/session", {
        method: "POST",
        body: { verificationToken, role: "partner" },
      });

      partnerTokenStore.set(r.token);
      setUser(r.user);
      router.replace("/referralpartner");
    },
    [router],
  );

  const signOut = useCallback(() => {
    partnerTokenStore.clear();
    setUser(null);
    router.push("/referralpartner/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, unreachable, retry, requestOtp, verifyOtpAndSignIn, signOut, reloadUser, setUser }),
    [user, loading, unreachable, retry, requestOtp, verifyOtpAndSignIn, signOut, reloadUser]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePartnerAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePartnerAuth must be used inside PartnerAuthProvider");
  return ctx;
}
