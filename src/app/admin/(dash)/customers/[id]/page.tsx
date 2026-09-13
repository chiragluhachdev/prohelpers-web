"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { dateTime, relative, rupees, titleCase } from "@/lib/format";
import {
  Avatar, Button, Card, Cell, EmptyState, ErrorNote, Field,
  KeyValue, Modal, PageHeader, Row, SectionTitle, Spinner, StatusBadge,
  Table, Textarea,
} from "@/components/ui";

type Detail = {
  customer: {
    id: string; name: string; phone: string; email?: string; photoUrl?: string;
    previousPhones?: { phone: string; changedAt: string }[];
    accountStatus: string; blockReason?: string; createdAt: string;
  };
  addresses: { _id: string; label: string; line1: string; line2?: string; city: string; state: string; pin: string }[];
  tasks: { id: string; code: string; status: string; statusLabel: string; services: string[]; total: number; scheduledAt: string }[];
  ratings: {
    _id: string; stars: number; comment?: string; createdAt: string;
    fromUserId?: { _id: string; name: string; role: string };
    taskId?: { _id: string; shortId: string };
  }[];
};

export default function CustomerDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<Detail>(`/api/admin/customers/${id}`);

  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [blockOpen, setBlockOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setActionError("");
    try {
      await fn();
      await reload();
      setBlockOpen(false);
      setReason("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy("");
    }
  }

  if (loading) return <Spinner label="Loading customer" />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data?.customer) return <ErrorNote>Customer not found.</ErrorNote>;

  const { customer, addresses } = data;
  const blocked = customer.accountStatus === "blocked";

  return (
    <>
      <Link href="/admin/customers" className="mb-4 inline-block text-[13px] font-medium text-ink-muted hover:text-ink">
        ← All customers
      </Link>

      <PageHeader
        title={customer.name || "Unnamed customer"}
        subtitle={`${customer.phone} · joined ${relative(customer.createdAt)}`}
        action={
          <div className="flex flex-wrap gap-2">
            {blocked ? (
              <Button variant="secondary" disabled={!!busy} onClick={() => run("unblock", () => api(`/api/admin/users/${id}/unblock`, { method: "POST" }))}>
                {busy === "unblock" ? "Unblocking…" : "Unblock account"}
              </Button>
            ) : (
              <Button variant="danger" disabled={!!busy} onClick={() => setBlockOpen(true)}>
                Block
              </Button>
            )}
          </div>
        }
      />

      {actionError && <div className="mb-4"><ErrorNote>{actionError}</ErrorNote></div>}

      {blocked && (
        <div className="mb-5">
          <ErrorNote>
            <strong className="font-semibold">Account blocked.</strong> {customer.blockReason}
          </ErrorNote>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-5">
          {/* --------------------------------------------------- history */}
          <Card padded={false}>
            <div className="px-5 pt-5">
              <SectionTitle title="Recent bookings" />
            </div>
            {data.tasks.length === 0 ? (
              <EmptyState title="No bookings yet" />
            ) : (
              <Table head={["Booking", "Services", "When", "Status", "Value"]}>
                {data.tasks.map((t) => (
                  <Row key={t.id} onClick={() => router.push(`/admin/bookings/${t.id}`)}>
                    <Cell className="font-medium">{t.code}</Cell>
                    <Cell className="text-[13px] text-ink-soft">{t.services.join(", ")}</Cell>
                    <Cell className="whitespace-nowrap text-[13px] text-ink-soft">{dateTime(t.scheduledAt)}</Cell>
                    <Cell><StatusBadge status={t.status} label={t.statusLabel} /></Cell>
                    <Cell className="tabular font-medium">{rupees(t.total)}</Cell>
                  </Row>
                ))}
              </Table>
            )}
          </Card>

          {/* --------------------------------------------------- ratings */}
          <Card padded={false}>
            <div className="px-5 pt-5">
              <SectionTitle title="Ratings & Reviews" />
            </div>
            {data.ratings.length === 0 ? (
              <EmptyState title="No ratings yet" body="This customer has not received any reviews." />
            ) : (
              <div className="divide-y divide-line">
                {data.ratings.map((r) => (
                  <div key={r._id} className="p-5">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5 rounded-[6px] bg-amber-bg px-2 py-0.5 text-[13px] font-semibold text-amber-ink">
                          {r.stars} ★
                        </span>
                        <span className="text-[13px] text-ink-muted">{dateTime(r.createdAt)}</span>
                      </div>
                      {r.fromUserId && (
                        <Link
                          href={`/admin/helpers/${r.fromUserId._id}`}
                          className="text-[13px] font-medium text-forest-600 hover:underline"
                        >
                          From: {r.fromUserId.name || "Helper"}
                        </Link>
                      )}
                    </div>
                    {r.comment ? (
                      <p className="text-[14px] text-ink-soft">{r.comment}</p>
                    ) : (
                      <p className="text-[14px] italic text-ink-muted">No comment left</p>
                    )}
                    {r.taskId && (
                      <Link href={`/admin/bookings/${r.taskId._id}`} className="mt-2 inline-block text-[12px] text-ink-muted hover:text-ink">
                        Booking: #{r.taskId.shortId}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ------------------------------------------------------ sidebar */}
        <div className="grid content-start gap-5">
          <Card>
            <div className="mb-4 flex items-center gap-3">
              <Avatar name={customer.name} src={customer.photoUrl} size={52} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={customer.accountStatus} />
                </div>
              </div>
            </div>
            <KeyValue
              items={[
                ["Phone", customer.phone],
                ["Previous numbers", (() => {
                  const past = customer.previousPhones ?? [];
                  if (!past.length) return "—";
                  return past
                    .slice()
                    .reverse()
                    .map((p) => `${p.phone} (until ${dateTime(p.changedAt)})`)
                    .join(", ");
                })()],
                ["Email", customer.email || "—"],
                ["Joined", dateTime(customer.createdAt)],
              ]}
            />
          </Card>

          <Card>
            <SectionTitle title="Saved Addresses" />
            {addresses.length === 0 ? (
              <p className="text-sm text-ink-muted">No saved addresses.</p>
            ) : (
              <div className="grid gap-3">
                {addresses.map((addr) => (
                  <div key={addr._id} className="rounded-md border border-line bg-sunken p-3">
                    <p className="text-[13px] font-medium text-ink">{addr.label}</p>
                    <p className="text-[13px] text-ink-soft">{addr.line1}</p>
                    {addr.line2 && <p className="text-[13px] text-ink-soft">{addr.line2}</p>}
                    <p className="text-[13px] text-ink-soft">{addr.city}, {addr.state} {addr.pin}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* -------------------------------------------------------- modals */}
      <Modal open={blockOpen} title="Block this account" onClose={() => setBlockOpen(false)}>
        <div className="grid gap-4">
          <p className="text-sm text-ink-soft">
            The customer will not be able to log in or create bookings.
          </p>
          <Field label="Reason">
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Repeated cancellations." />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setBlockOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={!reason.trim() || !!busy}
              onClick={() => run("block", () => api(`/api/admin/users/${id}/block`, { method: "POST", body: { reason } }))}
            >
              {busy === "block" ? "Blocking…" : "Block account"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
