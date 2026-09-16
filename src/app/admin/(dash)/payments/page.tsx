"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { dateTime, rupees } from "@/lib/format";
import { apiQuery, useFilters } from "@/lib/useFilters";
import { DateFilter, FilterBar, Pagination, SearchFilter, SelectFilter } from "@/components/filters";
import {
  Badge, Card, Cell, EmptyState, ErrorNote, PageHeader,
  Row, SkeletonRows, Spinner, Stat, Table, type Tone,
} from "@/components/ui";

type Payment = {
  orderId: string;
  gateway: string;
  gatewayOrderId: string;
  gatewayPaymentId: string | null;
  amount: number;
  currency: string;
  method: string;
  status: "CREATED" | "PAID" | "FAILED" | "REFUNDED";
  failureReason: string;
  createdAt: string;
  paidAt: string | null;
  task: { id: string; code: string; status: string } | null;
  customer: { id: string; name: string; phone: string } | null;
};

type Payload = {
  payments: Payment[];
  counts: Record<string, { count: number; amount: number }>;
  page: number; pages: number; total: number;
};

const TONE: Record<Payment["status"], Tone> = {
  PAID: "green",
  CREATED: "amber",
  FAILED: "rose",
  REFUNDED: "slate",
};

const DEFAULTS = { status: "", q: "", range: "", from: "", to: "", page: "1" };

/** UC-C28 — every online payment: the order, what the gateway said, and what became of it. */
function PaymentsView() {
  const { values: f, set, reset, activeCount } = useFilters(DEFAULTS);
  const { data, error, loading } = useApi<Payload>(`/api/admin/payments?${apiQuery({ ...f, limit: "50" })}`, { pollMs: 20_000 });

  const counts = data?.counts ?? {};

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="In-app payments. The amount comes off the booking's own bill, and the gateway's callback is verified before anything is recorded."
      />

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Paid" value={counts.PAID?.count ?? 0} sub={rupees(counts.PAID?.amount ?? 0)} tone="green" />
        <Stat label="Started, not finished" value={counts.CREATED?.count ?? 0} sub={rupees(counts.CREATED?.amount ?? 0)} tone="amber" />
        <Stat label="Failed" value={counts.FAILED?.count ?? 0} sub={rupees(counts.FAILED?.amount ?? 0)} tone={counts.FAILED?.count ? "rose" : "slate"} />
        <Stat label="Refunded" value={counts.REFUNDED?.count ?? 0} sub={rupees(counts.REFUNDED?.amount ?? 0)} />
      </div>

      <FilterBar
        activeCount={activeCount}
        onReset={reset}
        summary={data ? `${data.total} payment${data.total === 1 ? "" : "s"}` : undefined}
      >
        <SearchFilter value={f.q} onChange={(q) => set({ q })} placeholder="Order or transaction id…" />
        <SelectFilter
          label="Status"
          value={f.status}
          onChange={(status) => set({ status })}
          options={[
            { value: "", label: "Any status" },
            { value: "PAID", label: "Paid" },
            { value: "CREATED", label: "Started" },
            { value: "FAILED", label: "Failed" },
            { value: "REFUNDED", label: "Refunded" },
          ]}
        />
        <DateFilter range={f.range} from={f.from} to={f.to} onChange={set} />
      </FilterBar>

      <Card padded={false}>
        {loading && !data ? (
          <SkeletonRows rows={6} cols={5} />
        ) : !data?.payments.length ? (
          <EmptyState title="No payments yet" body="A payment appears here the moment a customer starts paying in the app." />
        ) : (
          <>
            <Table head={["Order", "Booking", "Customer", "Amount", "Status", "When"]}>
              {data.payments.map((p) => (
                <Row key={p.orderId}>
                  <Cell>
                    <p className="tabular text-[13px] font-medium">{p.orderId}</p>
                    <p className="tabular text-xs text-ink-muted">{p.gatewayPaymentId || p.gatewayOrderId}</p>
                  </Cell>
                  <Cell className="tabular">
                    {p.task ? (
                      <Link href={`/admin/bookings/${p.task.id}`} className="hover:underline">{p.task.code}</Link>
                    ) : "—"}
                  </Cell>
                  <Cell>
                    {p.customer ? (
                      <Link href={`/admin/customers/${p.customer.id}`} className="hover:underline">{p.customer.name}</Link>
                    ) : "—"}
                    <p className="tabular text-xs text-ink-muted">{p.customer?.phone}</p>
                  </Cell>
                  <Cell className="tabular whitespace-nowrap font-medium">{rupees(p.amount)}</Cell>
                  <Cell>
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={TONE[p.status]}>{p.status === "CREATED" ? "Started" : p.status[0] + p.status.slice(1).toLowerCase()}</Badge>
                      {p.method && <span className="text-xs text-ink-muted">{p.method}</span>}
                      {p.failureReason && <span className="text-xs text-rose-ink">{p.failureReason}</span>}
                    </div>
                  </Cell>
                  <Cell className="whitespace-nowrap text-[13px] text-ink-muted">{dateTime(p.paidAt || p.createdAt)}</Cell>
                </Row>
              ))}
            </Table>
            <Pagination page={data.page} pages={data.pages} total={data.total} noun="payments" onPage={(page) => set({ page: String(page) })} />
          </>
        )}
      </Card>
    </>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<Spinner label="Loading payments" />}>
      <PaymentsView />
    </Suspense>
  );
}
