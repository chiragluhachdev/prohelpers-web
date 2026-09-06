"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { dateTime, relative, rupees, timeOnly, titleCase } from "@/lib/format";
import {
  Badge, Button, Card, Cell, EmptyState, ErrorNote, Field, KeyValue,
  Modal, PageHeader, Row, SectionTitle, Spinner, StatusBadge, Table, Textarea,
} from "@/components/ui";

type Detail = {
  task: {
    id: string; code: string; status: string; statusLabel: string;
    services: { code: string; name: string; options: Record<string, unknown>; amount: number }[];
    address: { label?: string; line1: string; line2?: string; landmark?: string; city?: string; pincode?: string };
    scheduledAt: string; scheduledDate: string; scheduledTime: string; durationMins: number;
    instructions?: string; paymentStatus: string; paymentMode: string;
    pricing: {
      servicesAmount: number; platformFee: number; platformFeePercent: number; surcharge: number;
      discount: number; gst: number; gstPercent: number; total: number;
      helperCommission: number; helperCommissionPercent: number; helperPayout: number;
    };
    helper: { id: string; name: string; phone: string } | null;
    customer: { id: string; name: string; phone: string } | null;
    createdAt: string; acceptedAt?: string; startedAt?: string; completedAt?: string;
    cancellation?: { by: string; reason: string; at: string } | null;
  };
  timeline: { _id: string; from?: string; to: string; actorType: string; reason?: string; at: string }[];
  requests: {
    id: string; round: number; status: string; distanceKm: number;
    sentAt: string; expiresAt: string; respondedAt?: string;
    helper: { id: string; name: string; phone: string } | null;
  }[];
  ratings: { _id: string; direction: string; stars: number; comment?: string }[];
};

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<Detail>(`/api/admin/bookings/${id}`, { pollMs: 5000 });

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
  if (!data) return null;

  const { task, timeline, requests } = data;
  const p = task.pricing;
  const cancellable = ["CREATED", "SEARCHING", "ACCEPTED", "IN_PROGRESS"].includes(task.status);

  return (
    <>
      <Link href="/bookings" className="mb-4 inline-block text-[13px] font-medium text-ink-muted hover:text-ink">
        ← All bookings
      </Link>

      <PageHeader
        title={task.code}
        subtitle={`Created ${relative(task.createdAt)} · ${task.services.map((s) => s.name).join(", ")}`}
        action={
          <div className="flex items-center gap-3">
            <StatusBadge status={task.status} label={task.statusLabel} />
            {cancellable && (
              <Button variant="danger" onClick={() => setCancelOpen(true)}>
                Cancel booking
              </Button>
            )}
          </div>
        }
      />

      {task.cancellation && (
        <div className="mb-5">
          <ErrorNote>
            <strong className="font-semibold">Cancelled by {task.cancellation.by}.</strong> {task.cancellation.reason}
          </ErrorNote>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-5">
          <Card>
            <SectionTitle title="Request" />
            <KeyValue
              items={[
                ["Scheduled", `${dateTime(task.scheduledAt)} · ${task.durationMins} mins`],
                ["Payment", `${titleCase(task.paymentMode)} · ${titleCase(task.paymentStatus)}`],
                ["Customer", task.customer ? `${task.customer.name} · ${task.customer.phone}` : "—"],
                [
                  "Helper",
                  task.helper ? (
                    <Link href={`/helpers/${task.helper.id}`} className="text-forest-700 hover:underline">
                      {task.helper.name} · {task.helper.phone}
                    </Link>
                  ) : (
                    "Unassigned"
                  ),
                ],
                [
                  "Address",
                  [task.address.line1, task.address.line2, task.address.landmark, task.address.city, task.address.pincode]
                    .filter(Boolean)
                    .join(", "),
                ],
                ["Instructions", task.instructions || "—"],
              ]}
            />

            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.05em] text-ink-muted">Services</p>
              {task.services.map((s) => (
                <div key={s.code} className="flex items-start justify-between gap-4 py-1.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{s.name}</p>
                    {Object.keys(s.options || {}).length > 0 && (
                      <p className="text-xs text-ink-muted">
                        {Object.entries(s.options)
                          .map(([k, v]) => `${titleCase(k)}: ${String(v)}`)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <span className="tabular shrink-0 text-sm font-medium">{rupees(s.amount)}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* ------------------------------------- who was alerted, and when */}
          <Card padded={false}>
            <div className="px-5 pt-5">
              <SectionTitle title={`Dispatch trail (${requests.length})`} />
              <p className="-mt-1 mb-3 text-[13px] text-ink-muted">
                Every helper the matcher alerted, in the order it tried them.
              </p>
            </div>
            {requests.length === 0 ? (
              <EmptyState title="No helpers were alerted" body="Nobody matched the service, area and time." />
            ) : (
              <Table head={["Round", "Helper", "Distance", "Sent", "Window closed", "Outcome"]}>
                {requests.map((r) => (
                  <Row key={r.id}>
                    <Cell className="tabular text-ink-muted">{r.round}</Cell>
                    <Cell>
                      {r.helper ? (
                        <Link href={`/helpers/${r.helper.id}`} className="font-medium text-forest-700 hover:underline">
                          {r.helper.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Cell>
                    <Cell className="tabular text-ink-soft">{r.distanceKm} km</Cell>
                    <Cell className="tabular whitespace-nowrap text-[13px] text-ink-soft">{timeOnly(r.sentAt)}</Cell>
                    <Cell className="tabular whitespace-nowrap text-[13px] text-ink-muted">{timeOnly(r.expiresAt)}</Cell>
                    <Cell>
                      <StatusBadge status={r.status === "ACCEPTED" ? "COMPLETED" : r.status === "EXPIRED" ? "EXPIRED" : r.status} label={titleCase(r.status)} />
                    </Cell>
                  </Row>
                ))}
              </Table>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-5">
          {/* ------------------------------------------------------- money */}
          <Card>
            <SectionTitle title="Bill" />
            <dl className="grid gap-2 text-sm">
              <Line label="Services" value={rupees(p.servicesAmount)} />
              <Line label={`Platform fee (${p.platformFeePercent}%)`} value={rupees(p.platformFee)} />
              {p.surcharge > 0 && <Line label="Surcharge" value={rupees(p.surcharge)} />}
              {p.discount > 0 && <Line label="Discount" value={`− ${rupees(p.discount)}`} />}
              <Line label={`GST (${p.gstPercent}%)`} value={rupees(p.gst)} />
              <div className="mt-1 flex items-center justify-between border-t border-line pt-2.5">
                <dt className="font-semibold text-ink">Customer pays</dt>
                <dd className="tabular text-base font-semibold text-ink">{rupees(p.total)}</dd>
              </div>
            </dl>

            <div className="mt-4 border-t border-line pt-4">
              <dl className="grid gap-2 text-sm">
                <Line label={`Commission (${p.helperCommissionPercent}%)`} value={rupees(p.helperCommission)} />
                <div className="flex items-center justify-between">
                  <dt className="font-medium text-ink">Helper receives</dt>
                  <dd className="tabular font-semibold text-forest-700">{rupees(p.helperPayout)}</dd>
                </div>
              </dl>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-muted">
              These figures were frozen when the booking was made. Changing rates in Settings only affects new bookings.
            </p>
          </Card>

          {/* ---------------------------------------------------- timeline */}
          <Card>
            <SectionTitle title="Timeline" />
            <ol className="relative ml-1.5 border-l border-line">
              {timeline.map((e) => (
                <li key={e._id} className="relative pb-4 pl-4 last:pb-0">
                  <span className="absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full bg-forest-500" />
                  <p className="text-[13px] font-medium text-ink">{titleCase(e.to)}</p>
                  <p className="text-xs text-ink-muted">
                    {dateTime(e.at)} · by {e.actorType}
                  </p>
                  {e.reason && <p className="mt-0.5 text-xs text-ink-soft">{e.reason}</p>}
                </li>
              ))}
            </ol>
          </Card>

          {data.ratings.length > 0 && (
            <Card>
              <SectionTitle title="Ratings" />
              <div className="grid gap-3">
                {data.ratings.map((r) => (
                  <div key={r._id}>
                    <div className="flex items-center gap-2">
                      <Badge tone="green">{"★".repeat(r.stars)}</Badge>
                      <span className="text-xs text-ink-muted">
                        {r.direction === "customer_to_helper" ? "Customer → Helper" : "Helper → Customer"}
                      </span>
                    </div>
                    {r.comment && <p className="mt-1 text-sm text-ink-soft">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}
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

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="tabular text-ink">{value}</dd>
    </div>
  );
}
