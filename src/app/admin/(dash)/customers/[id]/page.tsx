"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { DeleteAccountModal } from "@/components/DeleteAccountModal";
import { useApi } from "@/lib/useApi";
import { dateTime, relative, rupees, titleCase } from "@/lib/format";
import { ComplaintsPanel, RatingsGivenPanel, RejectionsPanel, type Complaint, type GivenRating, type Rejections } from "@/components/AccountPanels";
import {
  Avatar, Badge, Button, Card, Cell, EmptyState, ErrorNote, Field,
  KeyValue, Modal, PageHeader, Row, SectionTitle, Spinner, StatusBadge,
  Table, Textarea,
} from "@/components/ui";

type Detail = {
  customer: {
    id: string; name: string; phone: string; email?: string; photoUrl?: string;
    previousPhones?: { phone: string; changedAt: string }[];
    accountStatus: string; blockReason?: string; createdAt: string;
    referral?: {
      code: string; balance: number; referrals: number;
      referredBy: { id: string; name: string; phone: string; role: string } | null;
    };
  };
  addresses: { _id: string; label: string; line1: string; line2?: string; city: string; state: string; pin: string }[];
  tasks: { id: string; code: string; status: string; statusLabel: string; services: string[]; total: number; scheduledAt: string }[];
  ratings: {
    _id: string; stars: number; comment?: string; createdAt: string;
    fromUserId?: { _id: string; name: string; role: string };
    taskId?: { _id: string; shortId: string };
  }[];
  ratingsGiven?: GivenRating[];
  rejections?: Rejections;
  complaints?: { raised: Complaint[]; about: Complaint[] };
  /** UC-C40 — what they have paid, and their referral balance movements. */
  payments?: {
    orderId: string; amount: number; status: string; method: string;
    gatewayPaymentId: string | null; paidAt: string | null; createdAt: string; taskCode: string;
  }[];
  referralLedger?: { id: string; txnId: string; type: string; amount: number; note: string; taskCode: string; at: string }[];
};

export default function CustomerDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<Detail>(`/api/admin/customers/${id}`);

  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [blockOpen, setBlockOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
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
            <Button variant="ghost" disabled={!!busy} onClick={() => setDeleteOpen(true)}>
              Delete account
            </Button>
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
            <div className="flex items-center justify-between px-5 pt-5">
              <SectionTitle title="Recent bookings" />
              <Link href={`/admin/bookings?customer=${id}`} className="-mt-3 text-[13px] font-medium text-forest-700 hover:underline">
                See all & filter →
              </Link>
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

          <RatingsGivenPanel ratings={data.ratingsGiven} otherRole="helpers" />

          <Card padded={false}>
            <div className="px-5 pt-5">
              <SectionTitle title="Money" />
              <p className="text-[13px] text-ink-soft">
                What this customer has paid in the app, and every movement of their referral balance.
              </p>
            </div>
            {!data.payments?.length && !data.referralLedger?.length ? (
              <EmptyState title="Nothing yet" body="In-app payments and referral balance show up here." />
            ) : (
              <div className="mt-2 divide-y divide-line">
                {(data.payments ?? []).map((pay) => (
                  <div key={pay.orderId} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-ink">
                        Paid in the app{pay.method ? ` · ${pay.method}` : ""}
                      </p>
                      <p className="tabular text-[11.5px] text-ink-muted">
                        {pay.orderId}{pay.taskCode ? ` · ${pay.taskCode}` : ""} · {dateTime(pay.paidAt || pay.createdAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular text-[13.5px] font-medium">{rupees(pay.amount)}</p>
                      <Badge tone={pay.status === "PAID" ? "green" : pay.status === "FAILED" ? "rose" : "amber"}>
                        {titleCase(pay.status)}
                      </Badge>
                    </div>
                  </div>
                ))}
                {(data.referralLedger ?? []).map((row) => (
                  <div key={row.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-ink">{titleCase(row.type)}</p>
                      <p className="text-[12px] text-ink-muted">{row.note}</p>
                      <p className="tabular text-[11.5px] text-ink-muted">
                        {row.txnId}{row.taskCode ? ` · ${row.taskCode}` : ""} · {dateTime(row.at)}
                      </p>
                    </div>
                    <p className={`tabular shrink-0 text-[13.5px] font-medium ${row.amount >= 0 ? "text-forest-700" : "text-ink"}`}>
                      {row.amount >= 0 ? "+" : "−"}{rupees(Math.abs(row.amount))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <ComplaintsPanel complaints={data.complaints} />

          <RejectionsPanel rejections={data.rejections} blocked={customer.accountStatus === "blocked"} />
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
                ["Referral code", customer.referral ? <span key="rc" className="font-mono font-semibold tracking-[0.12em]">{customer.referral.code}</span> : "—"],
                ["Referral balance", customer.referral ? `${rupees(customer.referral.balance)} · ${customer.referral.referrals} referral${customer.referral.referrals === 1 ? "" : "s"}` : "—"],
                ["Joined with code of", customer.referral?.referredBy ? (
                  <Link key="rb" href={`/admin/${customer.referral.referredBy.role === "helper" ? "helpers" : "customers"}/${customer.referral.referredBy.id}`} className="font-medium text-forest-700 hover:underline">
                    {customer.referral.referredBy.name || customer.referral.referredBy.phone}
                  </Link>
                ) : "—"],
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
      <DeleteAccountModal
        open={deleteOpen}
        id={id}
        name={customer.name}
        role="customer"
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => router.push("/admin/customers")}
      />

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
