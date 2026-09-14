"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { dateTime, relative, rupees, timeOnly, titleCase } from "@/lib/format";
import {
  Avatar, Badge, Button, Card, Cell, Detail, EmptyState, ErrorNote, Field,
  KeyValue, Modal, PageHeader, Row, SectionTitle, Spinner, StatusBadge,
  Table, Textarea,
} from "@/components/ui";

type Person = { id: string; name: string; phone: string; photoUrl?: string } | null;

type BookingDetail = {
  task: {
    id: string; code: string; status: string; statusLabel: string;
    services: { code: string; name: string; icon?: string; basePrice?: number; options: Record<string, unknown>; amount: number }[];
    address: {
      label?: string; line1: string; line2?: string; landmark?: string;
      city?: string; pincode?: string; society?: string; lat?: number; lng?: number;
    };
    bookingType?: "instant" | "scheduled";
    scheduledAt: string; scheduledDate: string; scheduledTime: string; durationMins: number;
    instructions?: string; paymentStatus: string; paymentMode: string | null;
    paidAt?: string | null; paidByRole?: "customer" | "helper" | null;
    owedByHelper: { amount: number; settled: boolean } | null;
    payoutToHelper: { amount: number; settled: boolean } | null;
    pricing: {
      servicesAmount: number; platformFee: number; platformFeePercent: number;
      discount: number; promoCode?: string; total: number; referralCredit?: number;
      helperCommission: number; helperCommissionPercent: number; helperPayout: number; currency?: string;
    };
    helper: Person; customer: Person;
    createdAt: string; acceptedAt?: string; startedAt?: string; completedAt?: string; settledAt?: string;
    cancellation?: { by: string; reason: string; at: string; previousStatus?: string } | null;
    rated?: boolean;
  };
  timeline: { _id: string; from?: string; to: string; actorType: string; reason?: string; at: string }[];
  requests: {
    id: string; round: number; status: string; distanceKm: number;
    sentAt: string; expiresAt: string; respondedAt?: string; helper: Person;
  }[];
  ratings: { _id: string; direction: string; stars: number; comment?: string; createdAt?: string }[];
};

const money = (n?: number) => rupees(n ?? 0);

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<BookingDetail>(`/api/admin/bookings/${id}`, { pollMs: 5000 });

  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  async function cancel() {
    setBusy(true);
    setActionError("");
    try {
      await api(`/api/admin/bookings/${id}/cancel`, { method: "POST", body: { reason } });
      await reload();
      setCancelOpen(false);
      setReason("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Loading booking" />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data?.task) return <ErrorNote>This booking no longer exists.</ErrorNote>;

  const { task, timeline, requests, ratings } = data;
  const p = task.pricing ?? ({} as BookingDetail["task"]["pricing"]);
  const cancellable = ["CREATED", "SEARCHING", "ACCEPTED", "IN_PROGRESS"].includes(task.status);

  const address = [task.address?.line1, task.address?.line2, task.address?.landmark]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <Link href="/admin/bookings" className="mb-4 inline-block text-[13px] font-medium text-ink-muted hover:text-ink">
        ← All bookings
      </Link>

      <PageHeader
        title={task.code}
        subtitle={`${task.services.map((s) => s.name).join(", ")} · created ${relative(task.createdAt)}`}
        action={
          <div className="flex items-center gap-3">
            <StatusBadge status={task.status} label={task.statusLabel} />
            {cancellable && <Button variant="danger" onClick={() => setCancelOpen(true)}>Cancel booking</Button>}
          </div>
        }
      />

      {task.cancellation?.at && (
        <div className="mb-5">
          <ErrorNote>
            <strong className="font-semibold">Cancelled by {task.cancellation.by}</strong>
            {task.cancellation.previousStatus && ` from ${titleCase(task.cancellation.previousStatus)}`} ·{" "}
            {dateTime(task.cancellation.at)} — {task.cancellation.reason}
          </ErrorNote>
        </div>
      )}

      {/* ------------------------------------------------- at a glance */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <p className="text-[12px] text-ink-muted">
            {task.bookingType === "instant" ? "Requested" : "Scheduled"}
          </p>
          <p className="mt-1 text-[14px] font-semibold">{dateTime(task.scheduledAt)}</p>
          {task.bookingType === "instant" && (
            <span className="mt-1 inline-block"><Badge tone="amber">Instant · ASAP</Badge></span>
          )}
        </Card>
        <Card><p className="text-[12px] text-ink-muted">Duration</p><p className="mt-1 text-[14px] font-semibold">{task.durationMins} mins</p></Card>
        <Card><p className="text-[12px] text-ink-muted">Customer pays</p><p className="tabular mt-1 text-[14px] font-semibold">{money(p.total)}</p></Card>
        <Card><p className="text-[12px] text-ink-muted">Helper earns</p><p className="tabular mt-1 text-[14px] font-semibold text-forest-700">{money(p.helperPayout)}</p></Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-5">
          {/* ---------------------------------------------- the people */}
          <Card>
            <SectionTitle title="People" />
            <div className="grid gap-4 sm:grid-cols-2">
              <PersonCard role="Customer" person={task.customer} />
              <PersonCard role="Helper" person={task.helper} href={task.helper ? `/admin/helpers/${task.helper.id}` : undefined} />
            </div>
          </Card>

          {/* ------------------------------------------- what and where */}
          <Card>
            <SectionTitle title="Request" />
            <dl>
              <Detail label="Booking code" value={task.code} mono />
              <Detail label="Status" value={<StatusBadge status={task.status} label={task.statusLabel} />} />
              <Detail label="Scheduled for" value={`${dateTime(task.scheduledAt)} · ${task.durationMins} mins`} />
              <Detail label="Society" value={task.address?.society ? titleCase(task.address.society.replace(/_/g, " ")) : "—"} />
              <Detail label="Address" value={address || "—"} />
              <Detail label="City / PIN" value={[task.address?.city, task.address?.pincode].filter(Boolean).join(" · ") || "—"} />
              <Detail label="Instructions" value={task.instructions || "—"} />
            </dl>

            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.05em] text-ink-muted">
                Services &amp; answers
              </p>
              {task.services.map((s) => (
                <div key={s.code} className="flex items-start justify-between gap-4 border-b border-line/70 py-2.5 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {s.icon ? `${s.icon} ` : ""}{s.name}
                    </p>
                    <p className="text-xs text-ink-muted">
                      <code className="rounded bg-sunken px-1 py-0.5">{s.code}</code>
                      {s.basePrice != null && ` · base ${money(s.basePrice)}`}
                    </p>
                    {Object.keys(s.options ?? {}).length > 0 && (
                      <ul className="mt-1.5 grid gap-0.5">
                        {Object.entries(s.options).map(([k, v]) => (
                          <li key={k} className="text-xs text-ink-soft">
                            · {titleCase(k)}: <span className="font-medium">{String(v)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span className="tabular shrink-0 text-sm font-semibold">{money(s.amount)}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* ------------------------------------------- dispatch trail */}
          <Card padded={false}>
            <div className="px-5 pt-5">
              <SectionTitle title={`Dispatch trail (${requests.length})`} />
              <p className="-mt-1 mb-3 text-[13px] text-ink-muted">
                Every helper the matcher alerted, in the order it tried them.
              </p>
            </div>
            {requests.length === 0 ? (
              <EmptyState title="No helpers were alerted" body="Nobody matched the service, society and time." />
            ) : (
              <Table head={["Alert", "Helper", "Distance", "Sent", "Stopped ringing", "Responded", "Outcome"]}>
                {requests.map((r) => (
                  <Row key={r.id}>
                    {/* Which alert this was for that helper: 1st, or a reminder. */}
                    <Cell className="tabular whitespace-nowrap text-ink-muted">
                      {r.round === 1 ? "1st" : `Reminder ${r.round - 1}`}
                    </Cell>
                    <Cell>
                      {r.helper ? (
                        <Link href={`/admin/helpers/${r.helper.id}`} className="font-medium text-forest-700 hover:underline">
                          {r.helper.name || r.helper.phone}
                        </Link>
                      ) : "—"}
                    </Cell>
                    <Cell className="tabular text-ink-soft">{r.distanceKm} km</Cell>
                    <Cell className="tabular whitespace-nowrap text-[13px] text-ink-soft">{timeOnly(r.sentAt)}</Cell>
                    <Cell className="tabular whitespace-nowrap text-[13px] text-ink-muted">{timeOnly(r.expiresAt)}</Cell>
                    <Cell className="tabular whitespace-nowrap text-[13px] text-ink-muted">{r.respondedAt ? timeOnly(r.respondedAt) : "—"}</Cell>
                    <Cell><StatusBadge status={r.status === "ACCEPTED" ? "COMPLETED" : r.status} label={titleCase(r.status)} /></Cell>
                  </Row>
                ))}
              </Table>
            )}
          </Card>
        </div>

        {/* ------------------------------------------------------ side */}
        <div className="grid content-start gap-5">
          <Card>
            <SectionTitle title="Bill" />
            <dl>
              {task.services.map((s) => <Detail key={s.code} label={s.name} value={money(s.amount)} mono />)}
              <Detail label={`Platform fee (${p.platformFeePercent ?? 0}%)`} value={money(p.platformFee)} mono />
              {p.discount > 0 && <Detail label={`Discount${p.promoCode ? ` · ${p.promoCode}` : ""}`} value={`− ${money(p.discount)}`} mono />}
              {(p.referralCredit ?? 0) > 0 && (
                <>
                  <Detail label="Booking total" value={money(p.total)} mono />
                  <Detail label="Referral balance used (platform covers)" value={`− ${money(p.referralCredit)}`} mono />
                </>
              )}
            </dl>
            <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
              <span className="font-semibold text-ink">Customer pays</span>
              <span className="tabular text-base font-semibold text-ink">{money(p.total - (p.referralCredit ?? 0))}</span>
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <dl>
                <Detail label={`Commission (${p.helperCommissionPercent ?? 0}%)`} value={money(p.helperCommission)} mono />
              </dl>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-medium text-ink">Helper receives</span>
                <span className="tabular font-semibold text-forest-700">{money(p.helperPayout)}</span>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-muted">
              Frozen when the booking was made. Changing rates in Settings only affects new bookings.
            </p>
          </Card>

          {/* ------------------------------------------------------ payment */}
          <Card>
            <SectionTitle title="Payment" />
            {task.paymentStatus === "PAID" ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge tone="green">{task.paymentMode === "ONLINE" ? "Paid online" : "Paid cash / UPI direct"}</Badge>
                </div>
                <dl className="mt-3">
                  <Detail
                    label="Confirmed by"
                    value={task.paidByRole === "customer" ? "Customer, in the app" : "Helper, on receiving payment"}
                  />
                  <Detail label="Confirmed at" value={task.paidAt ? dateTime(task.paidAt) : "—"} />
                </dl>
                {task.owedByHelper && (
                  <p className="mt-3 rounded-[9px] bg-sunken px-3 py-2 text-[12.5px] leading-relaxed text-ink-soft">
                    Collected in cash — the helper owes the platform{" "}
                    <span className="font-semibold text-ink">{money(task.owedByHelper.amount)}</span> for this job.{" "}
                    {task.owedByHelper.settled ? (
                      <span className="font-medium text-forest-700">Settled.</span>
                    ) : (
                      <>
                        Still outstanding —{" "}
                        <Link href="/admin/finance" className="font-medium text-forest-700 hover:underline">settle it from Finance</Link>.
                      </>
                    )}
                  </p>
                )}
                {task.payoutToHelper && (
                  <p className="mt-3 rounded-[9px] bg-sunken px-3 py-2 text-[12.5px] leading-relaxed text-ink-soft">
                    Paid online — the platform owes the helper a payout of{" "}
                    <span className="font-semibold text-ink">{money(task.payoutToHelper.amount)}</span>.{" "}
                    {task.payoutToHelper.settled ? (
                      <span className="font-medium text-forest-700">Sent.</span>
                    ) : (
                      <>
                        Not sent yet —{" "}
                        <Link href="/admin/finance" className="font-medium text-forest-700 hover:underline">send it from Finance</Link>.
                      </>
                    )}
                  </p>
                )}
              </>
            ) : ["COMPLETED", "SETTLED"].includes(task.status) ? (
              <Badge tone="amber">Awaiting payment</Badge>
            ) : (
              <p className="text-sm text-ink-muted">Due once the job is complete.</p>
            )}
          </Card>

          <Card>
            <SectionTitle title="Timestamps" />
            <dl>
              <Detail label="Created" value={dateTime(task.createdAt)} />
              <Detail label="Accepted" value={task.acceptedAt ? dateTime(task.acceptedAt) : "—"} />
              <Detail label="Started" value={task.startedAt ? dateTime(task.startedAt) : "—"} />
              <Detail label="Completed" value={task.completedAt ? dateTime(task.completedAt) : "—"} />
              <Detail label="Settled" value={task.settledAt ? dateTime(task.settledAt) : "—"} />
            </dl>
          </Card>

          <Card>
            <SectionTitle title="Timeline" />
            {timeline.length === 0 ? (
              <p className="text-sm text-ink-muted">Nothing recorded yet.</p>
            ) : (
              <ol className="relative ml-1.5 border-l border-line">
                {timeline.map((e) => (
                  <li key={e._id} className="relative pb-4 pl-4 last:pb-0">
                    <span className="absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full bg-forest-500" />
                    <p className="text-[13px] font-medium text-ink">
                      {e.from ? `${titleCase(e.from)} → ` : ""}{titleCase(e.to)}
                    </p>
                    <p className="text-xs text-ink-muted">{dateTime(e.at)} · by {e.actorType}</p>
                    {e.reason && <p className="mt-0.5 text-xs text-ink-soft">{e.reason}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card>
            <SectionTitle title={`Ratings (${ratings.length})`} />
            {ratings.length === 0 ? (
              <p className="text-sm text-ink-muted">Not rated yet.</p>
            ) : (
              <div className="grid gap-3">
                {ratings.map((r) => (
                  <div key={r._id} className="border-b border-line/70 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <Badge tone="green">{"★".repeat(r.stars)}</Badge>
                      <span className="text-xs text-ink-muted">
                        {r.direction === "customer_to_helper" ? "Customer → Helper" : "Helper → Customer"}
                      </span>
                    </div>
                    {r.comment && <p className="mt-1.5 text-sm text-ink-soft">“{r.comment}”</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal open={cancelOpen} title="Cancel this booking" onClose={() => setCancelOpen(false)}>
        <div className="grid gap-4">
          {actionError && <ErrorNote>{actionError}</ErrorNote>}
          <p className="text-sm text-ink-soft">Both the customer and the helper are notified with this reason.</p>
          <Field label="Reason">
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer called support to cancel." />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>Keep booking</Button>
            <Button variant="danger" disabled={!reason.trim() || busy} onClick={cancel}>
              {busy ? "Cancelling…" : "Cancel booking"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function PersonCard({ role, person, href }: { role: string; person: Person; href?: string }) {
  const body = (
    <div className="flex items-center gap-3 rounded-[11px] border border-line bg-sunken/50 p-3.5">
      <Avatar name={person?.name} src={person?.photoUrl} size={42} />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-ink-muted">{role}</p>
        <p className="truncate text-sm font-semibold text-ink">{person?.name || "Unassigned"}</p>
        {person?.phone && <p className="tabular truncate text-xs text-ink-muted">{person.phone}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block transition-opacity hover:opacity-80">{body}</Link> : body;
}
