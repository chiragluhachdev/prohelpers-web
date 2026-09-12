"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { dateTime, relative, rupees } from "@/lib/format";
import {
  Card, Cell, EmptyState, ErrorNote, Input, PageHeader,
  Row, SkeletonRows, Spinner, StatusBadge, Table, Tabs,
} from "@/components/ui";

type Booking = {
  id: string; code: string; status: string; statusLabel: string; services: string[];
  total: number; bookingType?: "instant" | "scheduled"; scheduledAt: string; createdAt: string; area: string;
  customer: { name: string } | null; helper: { name: string } | null;
};

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "SEARCHING", label: "Searching" },
  { key: "ACCEPTED", label: "Confirmed" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "NO_HELPER_AVAILABLE", label: "No helper" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export default function BookingsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<FilterKey>("ALL");
  const [q, setQ] = useState("");

  const query = new URLSearchParams();
  if (status !== "ALL") query.set("status", status);
  if (q.trim()) query.set("q", q.trim());

  // Live view — bookings change state on their own while the admin watches.
  const { data, error, loading } = useApi<{ bookings: Booking[]; counts: Record<string, number> }>(
    `/api/admin/bookings?${query}`,
    { pollMs: 8000 },
  );

  return (
    <>
      <PageHeader title="Bookings" subtitle="Every request, from creation through to completion." />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          active={status}
          onChange={setStatus}
          tabs={FILTERS.map((f) => ({
            key: f.key,
            label: f.label,
            count: f.key === "ALL" ? undefined : data?.counts?.[f.key],
          }))}
        />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search booking code…" className="max-w-[220px]" />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Card padded={false}>
        {loading ? (
          <SkeletonRows rows={6} cols={7} />
        ) : !data?.bookings.length ? (
          <EmptyState title="No bookings here" body="Try a different filter." />
        ) : (
          <Table head={["Booking", "Customer", "Helper", "Scheduled", "Status", "Value", "Created"]}>
            {data.bookings.map((b) => (
              <Row key={b.id} onClick={() => router.push(`/admin/bookings/${b.id}`)}>
                <Cell>
                  <span className="font-medium">{b.code}</span>
                  <span className="mt-0.5 block truncate text-xs text-ink-muted">{b.services.join(", ")}</span>
                </Cell>
                <Cell className="text-ink-soft">{b.customer?.name || "—"}</Cell>
                <Cell className="text-ink-soft">{b.helper?.name || <span className="text-ink-muted">Unassigned</span>}</Cell>
                <Cell className="whitespace-nowrap text-[13px] text-ink-soft">
                  {dateTime(b.scheduledAt)}
                  {b.bookingType === "instant" && (
                    <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-ink">
                      Instant
                    </span>
                  )}
                </Cell>
                <Cell><StatusBadge status={b.status} label={b.statusLabel} /></Cell>
                <Cell className="tabular whitespace-nowrap font-medium">{rupees(b.total)}</Cell>
                <Cell className="whitespace-nowrap text-[13px] text-ink-muted">{relative(b.createdAt)}</Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
