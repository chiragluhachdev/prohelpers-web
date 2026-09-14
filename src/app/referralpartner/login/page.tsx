"use client";

import { useState } from "react";
import { usePartnerAuth } from "@/lib/partnerAuth";
import { Button, ErrorNote, Field, Input } from "@/components/ui";
import { Logo } from "@/components/logo";

export default function PartnerLogin() {
  const { requestOtp, verifyOtpAndSignIn } = usePartnerAuth();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { devCode, dummyAuth } = await requestOtp(phone);
      if (devCode) setCode(devCode);
      if (dummyAuth && !devCode) setCode("123456"); // Pre-fill with a valid length if any code works
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP.");
    } finally {
      setBusy(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await verifyOtpAndSignIn(phone, code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface p-4 text-ink md:bg-sunken">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-8 shadow-none md:border md:border-line md:shadow-xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex justify-center">
            <Logo size={48} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Referral Partner Portal</h1>
          <p className="mt-1 text-sm text-ink-soft">Sign in or create an account</p>
        </div>

        {error && <div className="mb-6"><ErrorNote>{error}</ErrorNote></div>}

        {step === "phone" ? (
          <form onSubmit={handlePhoneSubmit} className="grid gap-5">
            <Field label="Mobile Number">
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your registered mobile number"
                autoFocus
                className="text-lg"
              />
            </Field>
            <Button type="submit" size="md" disabled={phone.length < 10 || busy} className="w-full h-12 font-semibold">
              {busy ? "Sending OTP…" : "Continue"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="grid gap-5">
            <Field label={`Enter OTP sent to ${phone}`}>
              <Input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
                autoFocus
                className="text-center text-2xl tracking-[0.25em]"
                maxLength={6}
              />
            </Field>
            <Button type="submit" size="md" disabled={code.length !== 6 || busy} className="w-full h-12 font-semibold">
              {busy ? "Verifying…" : "Verify & Continue"}
            </Button>
            <p className="text-center text-sm text-ink-soft">
              Didn&apos;t get it? <button type="button" onClick={() => { setStep("phone"); setCode(""); }} className="font-medium text-forest-600 hover:underline">Change number</button>
            </p>
          </form>
        )}

        <div className="mt-10 border-t border-line pt-6 text-center text-sm text-ink-soft">
          <p className="font-medium text-ink">Are you a customer or helper?</p>
          <p className="mt-1">Use the regular Pro Helper app to sign in.</p>
        </div>
      </div>
    </div>
  );
}
