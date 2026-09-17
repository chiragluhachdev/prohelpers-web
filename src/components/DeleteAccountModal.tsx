"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, ErrorNote, Field, Input, Modal, Textarea } from "@/components/ui";

/**
 * Permanently delete one account — a customer, a helper or a referral partner.
 *
 * Only the account goes. Bookings, earnings, ratings and complaints stay as
 * they are, and the bookings keep the person's name, so the history still
 * reads. The phone number is free to sign up again afterwards.
 *
 * It asks for the admin's own password, because there is no undo.
 */
export function DeleteAccountModal({
  open,
  id,
  name,
  role,
  onClose,
  onDeleted,
}: {
  open: boolean;
  id: string;
  name: string;
  role: "customer" | "helper" | "partner";
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Never leave a typed password sitting in a closed dialog.
  useEffect(() => {
    if (!open) {
      setPassword("");
      setReason("");
      setError("");
    }
  }, [open]);

  const what = role === "partner" ? "referral partner" : role;

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/users/${id}/delete`, { method: "POST", body: { password, reason } });
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={`Delete this ${what}?`}
      subtitle="The account is removed for good and cannot be brought back."
      onClose={onClose}
    >
      <div className="grid gap-4">
        <div className="rounded-[10px] border border-line bg-sunken px-3.5 py-3 text-[13px] leading-relaxed text-ink-soft">
          <p>
            <span className="font-semibold text-ink">{name || "This account"}</span> will no longer be able to sign in,
            and the phone number becomes free to register again.
          </p>
          <p className="mt-1.5">
            Their bookings, payments, earnings, ratings and complaints are kept exactly as they are — the bookings will
            still show this name.
          </p>
        </div>

        <Field label="Your admin password" hint="The password you sign in to this dashboard with.">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>

        <Field label="Reason" hint="Optional, kept in the audit log.">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Asked for their account to be removed." />
        </Field>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={!password || busy} onClick={remove}>
            {busy ? "Deleting…" : "Delete permanently"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
