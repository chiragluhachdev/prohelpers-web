"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, tokenStore } from "./api";

export type AdminUser = { id: string; name: string; email: string; role: string };

type AuthState = {
  user: AdminUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Restore the session on first paint so a refresh doesn't bounce to login.
  useEffect(() => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    api<{ user: AdminUser }>("/api/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const r = await api<{ token: string; user: AdminUser }>("/api/auth/admin/login", {
        method: "POST",
        body: { email, password },
      });
      tokenStore.set(r.token);
      setUser(r.user);
      router.push("/dashboard");
    },
    [router],
  );

  const signOut = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    router.push("/login");
  }, [router]);

  const value = useMemo(() => ({ user, loading, signIn, signOut }), [user, loading, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
