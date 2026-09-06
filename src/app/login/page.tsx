"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button, Card, ErrorNote, Field, Input } from "@/components/ui";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("admin@prohelper.in");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo size={38} />
          <h1 className="mt-4 text-xl font-semibold tracking-[-0.01em] text-ink">Pro Helper Admin</h1>
          <p className="mt-1 text-sm text-ink-soft">Verify helpers, manage accounts, monitor bookings.</p>
        </div>

        <Card className="p-6">
          <form onSubmit={onSubmit} className="grid gap-4">
            {error && <ErrorNote>{error}</ErrorNote>}

            <Field label="Email">
              <Input
                type="email"
                value={email}
                autoComplete="username"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@prohelper.in"
                required
              />
            </Field>

            <Field label="Password">
              <Input
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </Field>

            <Button type="submit" disabled={busy} className="mt-1 w-full">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>

        <p className="mt-5 text-center text-xs leading-relaxed text-ink-muted">
          The admin dashboard is separate from the mobile app.
          <br />
          Customers and helpers sign in on their phones with an OTP.
        </p>
      </div>
    </main>
  );
}
