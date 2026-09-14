"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
const TOKEN_KEY = "prohelper.partner.token";

const partnerTokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export type PartnerUser = { id: string; name: string; phone: string; role: string; status: string };

type AuthState = {
  user: PartnerUser | null;
  loading: boolean;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtpAndSignIn: (phone: string, code: string) => Promise<void>;
  signOut: () => void;
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
    throw new Error(payload?.error?.message || "Something went wrong.");
  }
  return payload as T;
}

export function PartnerAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PartnerUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!partnerTokenStore.get()) {
      setLoading(false);
      return;
    }
    partnerApi<{ user: PartnerUser }>("/api/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => partnerTokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    await partnerApi("/api/auth/otp/request", { method: "POST", body: { phone } });
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
      router.push("/referralpartner");
    },
    [router],
  );

  const signOut = useCallback(() => {
    partnerTokenStore.clear();
    setUser(null);
    router.push("/referralpartner/login");
  }, [router]);

  const value = useMemo(() => ({ user, loading, requestOtp, verifyOtpAndSignIn, signOut }), [user, loading, requestOtp, verifyOtpAndSignIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePartnerAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePartnerAuth must be used inside PartnerAuthProvider");
  return ctx;
}
