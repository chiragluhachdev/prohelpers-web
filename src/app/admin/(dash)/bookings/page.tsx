"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { dateTime, relative, rupees } from "@/lib/format";
import { apiQuery, useFilters } from "@/lib/useFilters";
import { useColumns } from "@/lib/useColumns";
import {
  Badge, Card, Cell, EmptyState, ErrorNote, PageHeader,
  Row, SkeletonRows, Spinner, StatusBadge, Table, Tabs,
} from "@/components/ui";
import {
  DateFilter, FilterBar, Pagination, SearchFilter, SelectFilter, type FilterOptions,
} from "@/components/filters";

type Booking = {
  id: string; code: string; status: string; statusLabel: string; services: string[];
  total: number; bookingType?: "instant" | "scheduled"; scheduledAt: string; createdAt: string; area: string;
  customer: { name: string } | null; helper: { name: string } | null;
  /** Open well past its expected finish (UC-C18), and who called it off (UC-C22). */
  overdue?: boolean; cancelledBy?: string | null;
};

type Payload = {
  bookings: Booking[]; counts: Record<string, number>;
  total: number; page: number; pages: number;
};

/** Status tabs group the statuses an admin thinks of as one stage. */
const STAGES = [
  { key: "", label: "All", statuses: [] as string[] },
  { key: "CREATED,SEARCHING", label: "Searching", statuses: ["CREATED", "SEARCHING"] },
  { key: "ACCEPTED", label: "Confirmed", statuses: ["ACCEPTED"] },
  { key: "IN_PROGRESS,COMPLETION_PENDING", label: "In progress", statuses: ["IN_PROGRESS", "COMPLETION_PENDING"] },
  { key: "COMPLETED,SETTLED", label: "Completed", statuses: ["COMPLETED", "SETTLED"] },
  { key: "NO_HELPER_AVAILABLE", label: "No helper", statuses: ["NO_HELPER_AVAILABLE"] },
  { key: "CANCELLED,EXPIRED", label: "Cancelled", statuses: ["CANCELLED", "EXPIRED"] },
];

const DEFAULTS = {
  status: "", q: "", type: "", service: "", society: "", payment: "", customer: "", helper: "",
  dateField: "created", range: "", from: "", to: "", sort: "newest", page: "1",
};

function BookingsView() {
  const router = useRouter();
  const { values: f, set, reset, activeCount } = useFilters(DEFAULTS);
  const options = useApi<FilterOptions>("/api/admin/filter-options");

  const { isVisible, ColumnToggle } = useColumns("admin_bookings", [
    { id: "booking", label: "Booking" },
    { id: "customer", label: "Customer" },
    { id: "helper", label: "Helper" },
    { id: "scheduled", label: "Scheduled" },
    { id: "status", label: "Status" },
    { id: "value", label: "Value" },
    { id: "created", label: "Created" },
  ]);

  const query = apiQuery({ ...f, limit: "50" });
  // Live view — bookings change state on their own while the admin watches.
  const { data, error, loading } = useApi<Payload>(`/api/admin/bookings?${query}`, { pollMs: 8000 });

  const countFor = (statuses: string[]) =>
    statuses.length ? statuses.reduce((sum, s) => sum + (data?.counts?.[s] ?? 0), 0) : undefined;

  return (
    <>
      <PageHeader title="Bookings" subtitle="Every request, from creation through to completion." />

      <div className="mb-3">
        <Tabs
          active={f.status}
          onChange={(status) => set({ status })}
          tabs={STAGES.map((s) => ({ key: s.key, label: s.label, count: countFor(s.statuses) }))}
        />
      </div>

      <FilterBar
        activeCount={activeCount}
        onReset={reset}
        summary={data ? `${data.total} booking${data.total === 1 ? "" : "s"}` : undefined}
        actions={<ColumnToggle />}
      >
        {(f.customer || f.helper) && (
          <button
            type="button"
            onClick={() => set({ customer: "", helper: "" })}
            className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-forest-300 bg-forest-50 px-2.5 text-[13px] font-medium text-forest-800"
            title="Show everyone's bookings"
          >
            {f.customer ? "One customer's bookings" : "One helper's jobs"}
            <span aria-hidden className="text-forest-600">×</span>
          </button>
        )}
        <SearchFilter value={f.q} onChange={(q) => set({ q })} placeholder="Code, customer or helper…" />
        <SelectFilter
          label="Type"
          value={f.type}
          onChange={(type) => set({ type })}
          options={[
            { value: "", label: "Any" },
            { value: "instant", label: "Instant" },
            { value: "scheduled", label: "Scheduled" },
          ]}
        />
        <SelectFilter
          label="Service"
          value={f.service}
          onChange={(service) => set({ service })}
          options={[{ value: "", label: "Any" }, ...(options.data?.services ?? []).map((s) => ({ value: s.code, label: s.name }))]}
        />
        <SelectFilter
          label="Society"
          value={f.society}
          onChange={(society) => set({ society })}
          options={[{ value: "", label: "Any" }, ...(options.data?.societies ?? []).map((s) => ({ value: s.code, label: s.name }))]}
        />
        <SelectFilter
          label="Payment"
          value={f.payment}
          onChange={(payment) => set({ payment })}
          options={[
            { value: "", label: "Any" },
            { value: "paid", label: "Paid" },
            { value: "awaiting", label: "Awaiting payment" },
            { value: "online", label: "Paid online" },
            { value: "cash", label: "Paid cash / UPI" },
            { value: "referral", label: "Used referral balance" },
          ]}
        />
        <SelectFilter
          label="Date of"
          value={f.dateField}
          neutral="created"
          onChange={(dateField) => set({ dateField })}
          options={[
            { value: "created", label: "Booking made" },
            { value: "scheduled", label: "Service slot" },
          ]}
        />
        <DateFilter label="When" range={f.range} from={f.from} to={f.to} onChange={set} />
        <SelectFilter
          label="Sort"
          value={f.sort}
          neutral="newest"
          onChange={(sort) => set({ sort })}
          options={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "scheduled", label: "Soonest slot" },
            { value: "latestSlot", label: "Latest slot" },
            { value: "value", label: "Highest value" },
          ]}
        />
      </FilterBar>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Card padded={false}>
        {loading ? (
          <SkeletonRows rows={6} cols={7} />
        ) : !data?.bookings.length ? (
          <EmptyState title="No bookings match" body={activeCount ? "Try clearing a filter." : "Bookings appear here as customers make them."} />
        ) : (
          <Table head={[
            isVisible("booking") && "Booking",
            isVisible("customer") && "Customer",
            isVisible("helper") && "Helper",
            isVisible("scheduled") && "Scheduled",
            isVisible("status") && "Status",
            isVisible("value") && "Value",
            isVisible("created") && "Created",
          ].filter(Boolean)}>
            {data.bookings.map((b) => (
              <Row key={b.id} onClick={() => router.push(`/admin/bookings/${b.id}`)}>
                {isVisible("booking") && (
                  <Cell>
                    <span className="font-medium">{b.code}</span>
                    <span className="mt-0.5 block truncate text-xs text-ink-muted">{b.services.join(", ")}</span>
                  </Cell>
                )}
                {isVisible("customer") && <Cell className="text-ink-soft">{b.customer?.name || "—"}</Cell>}
                {isVisible("helper") && <Cell className="text-ink-soft">{b.helper?.name || <span className="text-ink-muted">Unassigned</span>}</Cell>}
                {isVisible("scheduled") && (
                  <Cell className="whitespace-nowrap text-[13px] text-ink-soft">
                    {dateTime(b.scheduledAt)}
                    {b.bookingType === "instant" && (
                      <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-ink">
                        Instant
                      </span>
                    )}
                  </Cell>
                )}
                {isVisible("status") && (
                  <Cell>
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={b.status} label={b.statusLabel} />
                      {b.overdue && <Badge tone="rose">Overdue</Badge>}
                      {b.cancelledBy && <span className="text-[11px] text-ink-muted">by {b.cancelledBy}</span>}
                    </div>
                  </Cell>
                )}
                {isVisible("value") && <Cell className="tabular whitespace-nowrap font-medium">{rupees(b.total)}</Cell>}
                {isVisible("created") && (
                  <Cell className="whitespace-nowrap text-[13px] text-ink-muted">{relative(b.createdAt)}</Cell>
                )}
              </Row>
            ))}
          </Table>
        )}
      </Card>

      {data && (
        <Pagination page={data.page} pages={data.pages} total={data.total} noun="bookings" onPage={(p) => set({ page: String(p) })} />
      )}
    </>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<Spinner label="Loading bookings" />}>
      <BookingsView />
    </Suspense>
  );
}
