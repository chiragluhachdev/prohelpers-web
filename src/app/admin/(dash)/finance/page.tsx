"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { rupees, dateTime } from "@/lib/format";
import { apiQuery, useFilters } from "@/lib/useFilters";
import { useColumns } from "@/lib/useColumns";
import { DateFilter, FilterBar, Pagination, SearchFilter, SelectFilter } from "@/components/filters";
import {
  Badge, Button, Card, Cell, EmptyState, ErrorNote, KeyValue, Modal,
  PageHeader, Row, SectionTitle, SkeletonRows, Stat, Table, Textarea,
} from "@/components/ui";

type Pricing = {
  servicesAmount: number; platformFee: number; platformFeePercent: number;
  discount: number; total: number; helperCommission: number; helperCommissionPercent: number;
  helperPayout: number; currency?: string;
};

type Owed = {
  helperId: string; name: string; phone: string; jobs: number; amount: number;
  paymentDetails: { method?: string; upiId?: string; accountNo?: string; ifsc?: string } | null;
};

type Finance = {
  totals: {
    bookings: number; gross: number; services: number; platformFee: number;
    commission: number; helperPayout: number;
    platformEarned: number; awaitingPayment: number; referralCredit: number;
    discount: number; surcharge: number; gst: number;
    online: { bookings: number; gross: number };
    cash: { bookings: number; gross: number };
  };
  byDay: { date: string; bookings: number; gross: number; platformEarned: number }[];
  ledger: Record<string, { total: number; rows: number }>;
  commissionOwed: Owed[];
  payoutsOwed: Owed[];
};

type Txn = {
  id: string; code: string; status: string;
  services: { name: string; amount: number }[];
  customer: { id: string; name: string; phone: string } | null;
  helper: { id: string; name: string; phone: string } | null;
  completedAt?: string; settledAt?: string;
  paymentStatus: string; paymentMode: string | null; paidAt?: string; paidByRole?: "customer" | "helper";
  pricing: Pricing;
};

type TxnPage = { page: number; limit: number; total: number; pages: number; transactions: Txn[] };

/** How a helper would be paid, in one line, or an honest blank. */
function payoutLine(d: Owed["paymentDetails"]) {
  if (!d) return null;
  if (d.method === "BANK" && d.accountNo) {
    return `Bank ••••${d.accountNo.slice(-4)}${d.ifsc ? ` · ${d.ifsc}` : ""}`;
  }
  if (d.upiId) return `UPI · ${d.upiId}`;
  return null;
}

export default function FinancePage() {
  const [days, setDays] = useState("30");
  const [owedQ, setOwedQ] = useState("");
  const { data, error, loading, reload } = useApi<Finance>(`/api/admin/finance?days=${days}`);

  const [settling, setSettling] = useState<{ row: Owed; kind: "commission" | "payout" } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [settleError, setSettleError] = useState("");

  async function settle() {
    if (!settling) return;
    setBusy(true);
    setSettleError("");
    try {
      const path = settling.kind === "commission" ? "settle" : "settle-payout";
      await api(`/api/admin/finance/${path}/${settling.row.helperId}`, {
        method: "POST",
        body: { reason: reason.trim() || (settling.kind === "commission" ? "Commission collected" : "Payout sent") },
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
  const owedNeedle = owedQ.toLowerCase();
  const matchesOwed = (h: Owed) =>
    !owedNeedle || h.name.toLowerCase().includes(owedNeedle) || h.phone.includes(owedNeedle);
  const owedTotal = data.commissionOwed.reduce((sum, h) => sum + h.amount, 0);
  const payoutTotal = data.payoutsOwed.reduce((sum, h) => sum + h.amount, 0);
  const peak = Math.max(...data.byDay.map((d) => d.gross), 1);

  return (
    <>
      <PageHeader
        title="Finance"
        subtitle="Paid online, the platform holds the money and owes the helper their payout. Paid in cash or UPI straight to the helper, the helper holds it and owes the platform everything beyond their own payout."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Platform earned" value={rupees(t.platformEarned)} sub="Fee + surcharge + commission − discounts & referral credit" tone="green" />
        <Stat label="Gross booked" value={rupees(t.gross)} sub={`${t.bookings} completed bookings`} />
        <Stat
          label="Commission owed"
          value={rupees(owedTotal)}
          sub={data.commissionOwed.length ? `${data.commissionOwed.length} helpers, paid cash` : "All settled"}
          tone={owedTotal > 0 ? "amber" : "green"}
        />
        <Stat
          label="Payouts owed"
          value={rupees(payoutTotal)}
          sub={data.payoutsOwed.length ? `${data.payoutsOwed.length} helpers, paid online` : "All sent"}
          tone={payoutTotal > 0 ? "amber" : "green"}
        />
      </div>

      {/* ----------------------------------------------------- payment split */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-[11px] border border-line bg-surface px-4 py-3">
          <Badge tone="sky">Online</Badge>
          <div className="min-w-0">
            <p className="tabular text-[15px] font-semibold text-ink">{rupees(t.online.gross)}</p>
            <p className="text-[11.5px] text-ink-muted">{t.online.bookings} booking{t.online.bookings === 1 ? "" : "s"} paid in the app</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-[11px] border border-line bg-surface px-4 py-3">
          <Badge tone="green">Cash / UPI</Badge>
          <div className="min-w-0">
            <p className="tabular text-[15px] font-semibold text-ink">{rupees(t.cash.gross)}</p>
            <p className="text-[11.5px] text-ink-muted">{t.cash.bookings} booking{t.cash.bookings === 1 ? "" : "s"} paid direct to helper</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* ------------------------------------------------------- the chart */}
        <Card>
          <div className="flex items-start justify-between gap-3">
            <SectionTitle title={`Last ${days} days`} />
            <SelectFilter
              label="Period"
              value={days}
              neutral="30"
              onChange={setDays}
              options={[
                { value: "7", label: "7 days" },
                { value: "30", label: "30 days" },
                { value: "90", label: "90 days" },
                { value: "365", label: "12 months" },
              ]}
            />
          </div>
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
              ["Discounts given", t.discount ? `− ${rupees(t.discount)}` : rupees(0)],
              ["Platform fee", rupees(t.platformFee)],
              ["Surcharges", rupees(t.surcharge)],
              ["GST collected", rupees(t.gst)],
              ["Customer total", rupees(t.gross)],
              ["Helper commission", rupees(t.commission)],
              ["Helper payout", rupees(t.helperPayout)],
              ["Referral balance customers used", t.referralCredit ? `− ${rupees(t.referralCredit)}` : rupees(0)],
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
      {(data.commissionOwed.length + data.payoutsOwed.length > 5 || owedQ) && (
        <div className="mt-6 -mb-2">
          <FilterBar activeCount={owedQ ? 1 : 0} onReset={() => setOwedQ("")}>
            <SearchFilter value={owedQ} onChange={setOwedQ} placeholder="Find a helper in the tables below…" />
          </FilterBar>
        </div>
      )}
      <OwedTable
        title="Commission owed by helpers"
        blurb="Collected in cash or UPI, straight to the helper — they owe the platform everything beyond their own payout. Settling writes a ledger entry and an audit record; it never edits a balance."
        emptyTitle="Nothing outstanding"
        emptyBody="Every helper is square with the platform."
        rows={data.commissionOwed.filter(matchesOwed)}
        onSettle={(row) => { setSettling({ row, kind: "commission" }); setSettleError(""); }}
        actionLabel="Mark settled"
      />

      {/* ----------------------------------------------------- payouts owed */}
      <div className="mt-6">
        <OwedTable
          title="Payouts owed to helpers"
          blurb="Paid online, in the app — the platform holds the money and owes the helper their payout. Settling here records that it was sent (bank transfer, UPI, etc.)."
          emptyTitle="Nothing pending"
          emptyBody="Every online-paid job has been paid out."
          rows={data.payoutsOwed.filter(matchesOwed)}
          onSettle={(row) => { setSettling({ row, kind: "payout" }); setSettleError(""); }}
          actionLabel="Mark sent"
        />
      </div>

      {/* --------------------------------------------------------- txns */}
      <div className="mt-6">
        <TransactionsPanel />
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink-muted">
        Every figure here is summed from bookings and ledger rows at the moment you load the page. Rates
        changed in Settings apply to new bookings only, so past totals never move retrospectively.
      </p>

      {/* ------------------------------------------------------------- modal */}
      <Modal
        open={Boolean(settling)}
        title={`${settling?.kind === "payout" ? "Send payout to" : "Settle"} ${settling?.row.name ?? ""}`}
        subtitle={
          settling?.kind === "payout"
            ? `Marks ${rupees(settling?.row.amount ?? 0)} across ${settling?.row.jobs ?? 0} job${settling?.row.jobs === 1 ? "" : "s"} as paid out to the helper. Recorded in the audit log; the helper is notified.`
            : `Marks ${rupees(settling?.row.amount ?? 0)} across ${settling?.row.jobs ?? 0} job${settling?.row.jobs === 1 ? "" : "s"} as collected. This is recorded in the audit log and the helper is notified.`
        }
        onClose={() => setSettling(null)}
      >
        <Textarea
          rows={3}
          placeholder={
            settling?.kind === "payout"
              ? "How it was sent — bank transfer, UPI…"
              : "How it was collected — cash, UPI transfer, adjusted against a payout…"
          }
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {settleError && <div className="mt-3"><ErrorNote>{settleError}</ErrorNote></div>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setSettling(null)}>Cancel</Button>
          <Button disabled={busy} onClick={settle}>
            {busy ? "Saving…" : settling?.kind === "payout" ? "Mark sent" : "Mark settled"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

/** The commission-owed and payouts-owed tables are the same shape, mirrored. */
function OwedTable({
  title, blurb, emptyTitle, emptyBody, rows, onSettle, actionLabel,
}: {
  title: string; blurb: string; emptyTitle: string; emptyBody: string;
  rows: Owed[]; onSettle: (row: Owed) => void; actionLabel: string;
}) {
  const router = useRouter();
  return (
    <div className="mt-6">
      <SectionTitle title={title} />
      <p className="-mt-1 mb-3 text-[13px] text-ink-muted">{blurb}</p>
      <Card padded={false}>
        {rows.length === 0 ? (
          <EmptyState title={emptyTitle} body={emptyBody} />
        ) : (
          <Table head={["Helper", "Payout details", "Jobs", "Amount", ""]}>
            {rows.map((h) => {
              const payout = payoutLine(h.paymentDetails);
              return (
                <Row key={h.helperId} onClick={() => router.push(`/admin/helpers/${h.helperId}`)}>
                  <Cell>
                    <p className="font-medium">{h.name}</p>
                    <p className="text-xs text-ink-muted">{h.phone}</p>
                  </Cell>
                  <Cell className="text-[13px]">
                    {payout ? <span className="text-ink-soft">{payout}</span> : <Badge tone="slate">Not provided</Badge>}
                  </Cell>
                  <Cell className="tabular text-[13px] text-ink-soft">{h.jobs}</Cell>
                  <Cell className="tabular whitespace-nowrap font-semibold">{rupees(h.amount)}</Cell>
                  <Cell className="text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => { e.stopPropagation(); onSettle(h); }}
                    >
                      {actionLabel}
                    </Button>
                  </Cell>
                </Row>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}

const TXN_STATUS = [
  { key: "all", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "pending", label: "Awaiting payment" },
] as const;
const TXN_METHOD = [
  { key: "all", label: "Any method" },
  { key: "online", label: "Online" },
  { key: "cash", label: "Cash / UPI direct" },
  { key: "referral", label: "Used referral balance" },
] as const;

/** Every completed booking's money, one row each, searchable and filterable. */
function TransactionsPanel() {
  const router = useRouter();
  const [f, setF] = useState({ status: "all", method: "all", q: "", helper: "", range: "", from: "", to: "", page: "1" });
  const set = (patch: Partial<typeof f>) => setF((prev) => ({ ...prev, ...patch, page: patch.page ?? "1" }));
  const helpers = useApi<{ helpers: { id: string; name: string; phone: string }[] }>(
    "/api/admin/helpers?status=APPROVED&sort=name&limit=200",
  );

  const query = apiQuery({
    ...f,
    status: f.status === "all" ? "" : f.status,
    method: f.method === "all" ? "" : f.method,
    limit: "20",
  });
  const { data, error, loading } = useApi<TxnPage>(`/api/admin/finance/transactions?${query}`);
  const activeCount = [f.status !== "all", f.method !== "all", f.q, f.helper, f.range].filter(Boolean).length;

  const { isVisible, ColumnToggle } = useColumns("admin_finance_txns", [
    { id: "booking", label: "Booking" },
    { id: "customer", label: "Customer" },
    { id: "helper", label: "Helper" },
    { id: "total", label: "Total" },
    { id: "paidvia", label: "Paid via" },
    { id: "confirmedby", label: "Confirmed by" },
    { id: "when", label: "When" },
  ]);

  return (
    <>
      <div className="mb-3">
        <SectionTitle title="Transactions" />
        <p className="-mt-1 text-[13px] text-ink-muted">
          Every completed booking&apos;s bill — who paid, how, to whom, and when. Click a row for the full record.
        </p>
      </div>

      <FilterBar
        activeCount={activeCount}
        onReset={() => setF({ status: "all", method: "all", q: "", helper: "", range: "", from: "", to: "", page: "1" })}
        summary={data ? `${data.total} transaction${data.total === 1 ? "" : "s"}` : undefined}
        actions={<ColumnToggle />}
      >
        <SearchFilter value={f.q} onChange={(q) => set({ q })} placeholder="Code, customer or helper…" />
        <SelectFilter
          label="Payment"
          value={f.status}
          neutral="all"
          onChange={(status) => set({ status })}
          options={TXN_STATUS.map((o) => ({ value: o.key, label: o.label }))}
        />
        <SelectFilter
          label="Method"
          value={f.method}
          neutral="all"
          onChange={(method) => set({ method })}
          options={TXN_METHOD.map((o) => ({ value: o.key, label: o.label }))}
        />
        <SelectFilter
          label="Helper"
          value={f.helper}
          onChange={(helper) => set({ helper })}
          options={[{ value: "", label: "Anyone" }, ...(helpers.data?.helpers ?? []).map((h) => ({ value: h.id, label: h.name }))]}
        />
        <DateFilter label="Completed" range={f.range} from={f.from} to={f.to} onChange={set} />
      </FilterBar>

      <div className="mt-3">
        <Card padded={false}>
          {loading ? (
            <SkeletonRows rows={6} cols={7} />
          ) : error ? (
            <div className="p-4"><ErrorNote>{error}</ErrorNote></div>
          ) : !data?.transactions.length ? (
            <EmptyState title="No transactions" body="Try a different filter or search." />
          ) : (
            <Table head={[
              isVisible("booking") && "Booking",
              isVisible("customer") && "Customer",
              isVisible("helper") && "Helper",
              isVisible("total") && "Total",
              isVisible("paidvia") && "Paid via",
              isVisible("confirmedby") && "Confirmed by",
              isVisible("when") && "When",
            ].filter(Boolean)}>
              {data.transactions.map((tx) => (
                <Row key={tx.id} onClick={() => router.push(`/admin/bookings/${tx.id}`)}>
                  {isVisible("booking") && (
                    <Cell>
                      <p className="font-medium">{tx.code}</p>
                      <p className="truncate text-xs text-ink-muted">{tx.services.map((s) => s.name).join(", ")}</p>
                    </Cell>
                  )}
                  {isVisible("customer") && (
                    <Cell className="text-[13px] text-ink-soft">
                      {tx.customer?.name || "—"}
                      <span className="block text-xs text-ink-muted">{tx.customer?.phone}</span>
                    </Cell>
                  )}
                  {isVisible("helper") && (
                    <Cell className="text-[13px] text-ink-soft">
                      {tx.helper?.name || "—"}
                      <span className="block text-xs text-ink-muted">{tx.helper?.phone}</span>
                    </Cell>
                  )}
                  {isVisible("total") && <Cell className="tabular whitespace-nowrap font-semibold">{rupees(tx.pricing?.total)}</Cell>}
                  {isVisible("paidvia") && (
                    <Cell>
                      {tx.paymentStatus === "PAID" ? (
                        <Badge tone={tx.paymentMode === "ONLINE" ? "sky" : "green"}>
                          {tx.paymentMode === "ONLINE" ? "Online" : "Cash / UPI"}
                        </Badge>
                      ) : (
                        <Badge tone="amber">Awaiting</Badge>
                      )}
                    </Cell>
                  )}
                  {isVisible("confirmedby") && (
                    <Cell className="text-[13px] text-ink-soft">
                      {tx.paidByRole === "customer" ? "Customer" : tx.paidByRole === "helper" ? "Helper" : "—"}
                    </Cell>
                  )}
                  {isVisible("when") && (
                    <Cell className="whitespace-nowrap text-[13px] text-ink-muted">
                      {tx.paidAt ? dateTime(tx.paidAt) : tx.completedAt ? dateTime(tx.completedAt) : "—"}
                    </Cell>
                  )}
                </Row>
              ))}
            </Table>
          )}
        </Card>

        {data && (
          <Pagination page={data.page} pages={data.pages} total={data.total} noun="transactions" onPage={(p) => set({ page: String(p) })} />
        )}
      </div>
    </>
  );
}
