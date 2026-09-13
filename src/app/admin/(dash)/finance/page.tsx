"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { rupees, dateTime } from "@/lib/format";
import {
  Badge, Button, Card, Cell, EmptyState, ErrorNote, KeyValue, Modal,
  PageHeader, Row, SectionTitle, SkeletonRows, Stat, Table, Textarea,
} from "@/components/ui";

type Pricing = {
  servicesAmount: number; platformFee: number; platformFeePercent: number;
  discount: number; total: number; helperCommission: number; helperCommissionPercent: number;
  helperPayout: number; currency?: string;
};

type Finance = {
  totals: {
    bookings: number; gross: number; services: number; platformFee: number;
    commission: number; helperPayout: number;
    platformEarned: number; awaitingPayment: number;
  };
  byDay: { date: string; bookings: number; gross: number; platformEarned: number }[];
  ledger: Record<string, { total: number; rows: number }>;
  commissionOwed: {
    helperId: string; name: string; phone: string; jobs: number; amount: number;
    paymentDetails: { method?: string; upiId?: string; accountNo?: string; ifsc?: string } | null;
  }[];
  bookings: {
    id: string; code: string; completedAt: string; paymentStatus: string; paymentMode: string;
    customer: string; helper: string; services: string[]; pricing: Pricing;
  }[];
};

/** How a helper would be paid, in one line, or an honest blank. */
function payoutLine(d: Finance["commissionOwed"][number]["paymentDetails"]) {
  if (!d) return null;
  if (d.method === "BANK" && d.accountNo) {
    return `Bank ••••${d.accountNo.slice(-4)}${d.ifsc ? ` · ${d.ifsc}` : ""}`;
  }
  if (d.upiId) return `UPI · ${d.upiId}`;
  return null;
}

export default function FinancePage() {
  const router = useRouter();
  const { data, error, loading, reload } = useApi<Finance>("/api/admin/finance?days=30");

  const [settling, setSettling] = useState<Finance["commissionOwed"][number] | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [settleError, setSettleError] = useState("");

  async function settle() {
    if (!settling) return;
    setBusy(true);
    setSettleError("");
    try {
      await api(`/api/admin/finance/settle/${settling.helperId}`, {
        method: "POST",
        body: { reason: reason.trim() || "Commission collected" },
      });
      await reload();
      setSettling(null);
      setReason("");
    } catch (err) {
      setSettleError(err instanceof Error ? err.message : "Could not settle.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <SkeletonRows rows={8} cols={5} />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return null;

  const t = data.totals;
  const owedTotal = data.commissionOwed.reduce((sum, h) => sum + h.amount, 0);
  const peak = Math.max(...data.byDay.map((d) => d.gross), 1);

  return (
    <>
      <PageHeader
        title="Finance"
        subtitle="Payment is settled directly between customer and helper, so what the platform earns is the service fee plus the commission deducted from each helper's gross."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Platform earned" value={rupees(t.platformEarned)} sub="Service fee + commission" tone="green" />
        <Stat label="Gross booked" value={rupees(t.gross)} sub={`${t.bookings} completed bookings`} />
        <Stat label="Paid to helpers" value={rupees(t.helperPayout)} sub="Collected by them directly" tone="sky" />
        <Stat
          label="Commission owed"
          value={rupees(owedTotal)}
          sub={data.commissionOwed.length ? `${data.commissionOwed.length} helpers` : "All settled"}
          tone={owedTotal > 0 ? "amber" : "green"}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* ------------------------------------------------------- the chart */}
        <Card>
          <SectionTitle title="Last 30 days" />
          <p className="-mt-1 mb-4 text-[13px] text-ink-muted">
            Gross booked per day, by the day the job was completed.
          </p>
          {data.byDay.length === 0 ? (
            <EmptyState title="No completed bookings yet" body="Bars appear here as jobs are closed." />
          ) : (
            <div className="flex h-32 items-end gap-[3px]">
              {data.byDay.map((d) => (
                <div key={d.date} className="group flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-t-[3px] bg-forest-500 transition group-hover:bg-forest-600"
                    style={{ height: `${Math.max(6, Math.round((d.gross / peak) * 100))}%` }}
                    title={`${new Date(`${d.date}T00:00:00`).toDateString()} — ${d.bookings} bookings, ${rupees(d.gross)} gross, ${rupees(d.platformEarned)} earned`}
                  />
                  <span className="text-[10px] text-ink-muted">
                    {new Date(`${d.date}T00:00:00`).getDate()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* --------------------------------------------------- the breakdown */}
        <Card>
          <SectionTitle title="Where the money goes" />
          <p className="-mt-1 mb-3 text-[13px] text-ink-muted">Across every completed booking.</p>
          <KeyValue
            items={[
              ["Services", rupees(t.services)],
              ["Service fee", rupees(t.platformFee)],
              ["Customer total", rupees(t.gross)],
              ["Helper commission", rupees(t.commission)],
              ["Helper payout", rupees(t.helperPayout)],
            ]}
          />
          {t.awaitingPayment > 0 && (
            <p className="mt-3 text-[12px] text-amber-ink">
              {t.awaitingPayment} completed booking{t.awaitingPayment === 1 ? "" : "s"} not marked paid.
            </p>
          )}
        </Card>
      </div>

      {/* --------------------------------------------------- commission owed */}
      <div className="mt-6">
        <SectionTitle title="Commission owed by helpers" />
        <p className="-mt-1 mb-3 text-[13px] text-ink-muted">
          Deducted from each completed job and collected from the helper. Settling writes a ledger entry
          and an audit record — it never edits a balance.
        </p>
        <Card padded={false}>
          {data.commissionOwed.length === 0 ? (
            <EmptyState title="Nothing outstanding" body="Every helper is square with the platform." />
          ) : (
            <Table head={["Helper", "Payout details", "Jobs", "Owed", ""]}>
              {data.commissionOwed.map((h) => {
                const payout = payoutLine(h.paymentDetails);
                return (
                  <Row key={h.helperId} onClick={() => router.push(`/admin/helpers/${h.helperId}`)}>
                    <Cell>
                      <p className="font-medium">{h.name}</p>
                      <p className="text-xs text-ink-muted">{h.phone}</p>
                    </Cell>
                    <Cell className="text-[13px]">
                      {payout ? (
                        <span className="text-ink-soft">{payout}</span>
                      ) : (
                        <Badge tone="slate">Not provided</Badge>
                      )}
                    </Cell>
                    <Cell className="tabular text-[13px] text-ink-soft">{h.jobs}</Cell>
                    <Cell className="tabular whitespace-nowrap font-semibold">{rupees(h.amount)}</Cell>
                    <Cell className="text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettling(h);
                          setSettleError("");
                        }}
                      >
                        Mark settled
                      </Button>
                    </Cell>
                  </Row>
                );
              })}
            </Table>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------- per-booking money */}
      <div className="mt-6">
        <SectionTitle title="Completed bookings" />
        <p className="-mt-1 mb-3 text-[13px] text-ink-muted">
          The full bill for each job — click a row for the whole record.
        </p>
        <Card padded={false}>
          {data.bookings.length === 0 ? (
            <EmptyState title="No completed bookings yet" />
          ) : (
            <Table
              head={["Booking", "Customer", "Helper", "Services", "Fee", "Commission", "Payout", "Total", "Paid"]}
            >
              {data.bookings.map((b) => (
                <Row key={b.id} onClick={() => router.push(`/admin/bookings/${b.id}`)}>
                  <Cell>
                    <p className="font-medium">{b.code}</p>
                    <p className="whitespace-nowrap text-xs text-ink-muted">{dateTime(b.completedAt)}</p>
                  </Cell>
                  <Cell className="text-[13px] text-ink-soft">{b.customer}</Cell>
                  <Cell className="text-[13px] text-ink-soft">{b.helper}</Cell>
                  <Cell className="tabular text-[13px]">{rupees(b.pricing?.servicesAmount)}</Cell>
                  <Cell className="tabular text-[13px] text-ink-soft">{rupees(b.pricing?.platformFee)}</Cell>
                  <Cell className="tabular text-[13px] text-amber-ink">{rupees(b.pricing?.helperCommission)}</Cell>
                  <Cell className="tabular text-[13px] text-forest-700">{rupees(b.pricing?.helperPayout)}</Cell>
                  <Cell className="tabular whitespace-nowrap font-semibold">{rupees(b.pricing?.total)}</Cell>
                  <Cell>
                    <Badge tone={b.paymentStatus === "PAID" ? "green" : "amber"}>
                      {b.paymentStatus === "PAID" ? b.paymentMode || "Cash" : "Pending"}
                    </Badge>
                  </Cell>
                </Row>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink-muted">
        Every figure here is summed from bookings and ledger rows at the moment you load the page. Rates
        changed in Settings apply to new bookings only, so past totals never move retrospectively.
      </p>

      {/* ------------------------------------------------------------- modal */}
      <Modal
        open={Boolean(settling)}
        title={`Settle ${settling?.name ?? ""}`}
        subtitle={`Marks ${rupees(settling?.amount ?? 0)} across ${settling?.jobs ?? 0} job${settling?.jobs === 1 ? "" : "s"} as collected. This is recorded in the audit log and the helper is notified.`}
        onClose={() => setSettling(null)}
      >
        <Textarea
          rows={3}
          placeholder="How it was collected — cash, UPI transfer, adjusted against a payout…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {settleError && <div className="mt-3"><ErrorNote>{settleError}</ErrorNote></div>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setSettling(null)}>Cancel</Button>
          <Button disabled={busy} onClick={settle}>
            {busy ? "Settling…" : "Mark settled"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
