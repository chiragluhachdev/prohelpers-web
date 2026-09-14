"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { dateTime, relative, timeOnly, titleCase } from "@/lib/format";
import { apiQuery, useFilters } from "@/lib/useFilters";
import {
  Badge, Card, Cell, EmptyState, ErrorNote,
  PageHeader, Row, SkeletonRows, Spinner, StatusBadge, Table, Tabs,
} from "@/components/ui";
import { DateFilter, FilterBar, Pagination, SearchFilter, SelectFilter } from "@/components/filters";

type Req = {
  helperId: string | null; helperName: string; helperPhone: string;
  round: number; status: "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "CANCELLED";
  distanceKm: number; sentAt: string; expiresAt: string; respondedAt: string | null; waitedSeconds: number;
};

type TrackedTask = {
  id: string; code: string; status: string; statusLabel: string;
  bookingType?: "instant" | "scheduled"; searchMode?: "instant" | "scheduled";
  services: string[];
  customer: { id: string; name: string; phone: string } | null;
  helper: { id: string; name: string; phone: string } | null;
  createdAt: string; scheduledAt: string; searchStartedAt?: string; searchExpiresAt?: string; acceptedAt?: string;
  requests: Req[];
  summary: { sent: number; accepted: number; declined: number; unanswered: number; standDown: number; pending: number };
};

type TrackPage = { page: number; limit: number; total: number; pages: number; tasks: TrackedTask[] };

const FILTERS = [
  { key: "active", label: "Active" },
  { key: "nohelper", label: "No helper found" },
  { key: "done", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

const DEFAULTS = { status: "active", q: "", outcome: "", type: "", range: "", from: "", to: "", page: "1" };

const REQ_TONE: Record<Req["status"], "green" | "rose" | "slate" | "amber"> = {
  ACCEPTED: "green",
  DECLINED: "rose",
  EXPIRED: "slate",
  CANCELLED: "slate",
  SENT: "amber",
};

const waited = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${Math.max(0, s)}s`);

function TrackView() {
  const { values: f, set, reset, activeCount } = useFilters(DEFAULTS);
  const [open, setOpen] = useState<string | null>(null);

  const { data, error, loading } = useApi<TrackPage>(`/api/admin/track?${apiQuery({ ...f, limit: "20" })}`, { pollMs: 8000 });

  return (
    <>
      <PageHeader
        title="Track"
        subtitle="Every booking's dispatch, at a glance: who was asked, in what order, and whether they accepted, declined, or never answered."
      />

      <div className="mb-3">
        <Tabs
          active={f.status}
          onChange={(status) => { set({ status }); setOpen(null); }}
          tabs={FILTERS.map((t) => ({ key: t.key, label: t.label }))}
        />
      </div>

      <FilterBar
        activeCount={activeCount}
        onReset={reset}
        summary={data ? `${data.total} booking${data.total === 1 ? "" : "s"}` : undefined}
      >
        <SearchFilter value={f.q} onChange={(q) => set({ q })} placeholder="Code, customer or any helper…" />
        <SelectFilter
          label="Outcome"
          value={f.outcome}
          onChange={(outcome) => set({ outcome })}
          options={[
            { value: "", label: "Any" },
            { value: "accepted", label: "A helper accepted" },
            { value: "no_takers", label: "Nobody accepted" },
            { value: "declined", label: "Someone declined" },
            { value: "unanswered", label: "Someone didn't answer" },
            { value: "not_alerted", label: "Nobody was alerted" },
          ]}
        />
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
        <DateFilter label="Booked" range={f.range} from={f.from} to={f.to} onChange={set} />
      </FilterBar>

      {error && <ErrorNote>{error}</ErrorNote>}

      {loading ? (
        <SkeletonRows rows={6} cols={6} />
      ) : !data?.tasks.length ? (
        <Card><EmptyState title="Nothing matches" body="Try another tab or clear a filter." /></Card>
      ) : (
        <div className="grid gap-3">
          {data.tasks.map((task) => (
            <Card key={task.id} padded={false}>
              <button
                type="button"
                onClick={() => setOpen(open === task.id ? null : task.id)}
                className="flex w-full flex-wrap items-center gap-4 px-4 py-3.5 text-left"
              >
                <div className="min-w-[140px]">
                  <p className="font-medium text-ink">{task.code}</p>
                  <p className="truncate text-xs text-ink-muted">{task.services.join(", ")}</p>
                </div>

                <div className="min-w-[160px] text-[13px] text-ink-soft">
                  <span className="text-ink">{task.customer?.name || "—"}</span>
                  {task.helper && <span className="text-ink-muted"> → {task.helper.name}</span>}
                </div>

                <StatusBadge status={task.status} label={task.statusLabel} />
                {task.bookingType === "instant" && <Badge tone="amber">Instant</Badge>}
                {task.searchMode === "scheduled" && <Badge tone="sky">Waves</Badge>}

                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <Count label="Sent" n={task.summary.sent} tone="slate" />
                  <Count label="Accepted" n={task.summary.accepted} tone="green" />
                  <Count label="Declined" n={task.summary.declined} tone="rose" />
                  <Count label="Unanswered" n={task.summary.unanswered} tone="amber" />
                  {task.summary.pending > 0 && <Count label="Ringing" n={task.summary.pending} tone="sky" />}
                </div>

                <span className="whitespace-nowrap text-xs text-ink-muted">{relative(task.createdAt)}</span>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`shrink-0 text-ink-muted transition-transform ${open === task.id ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {open === task.id && (
                <div className="border-t border-line">
                  {task.requests.length === 0 ? (
                    <div className="px-4 py-4">
                      <EmptyState title="No helpers were alerted" body="Nobody matched the service, society and time." />
                    </div>
                  ) : (
                    <Table head={["Alert", "Helper", "Distance", "Sent", "Responded", "Waited", "Outcome"]}>
                      {task.requests.map((r, i) => (
                        <Row key={`${r.helperId}-${r.round}-${i}`}>
                          <Cell className="tabular whitespace-nowrap text-ink-muted">
                            {r.round === 1 ? "1st" : `Reminder ${r.round - 1}`}
                          </Cell>
                          <Cell>
                            {r.helperId ? (
                              <Link href={`/admin/helpers/${r.helperId}`} className="font-medium text-forest-700 hover:underline">
                                {r.helperName}
                              </Link>
                            ) : (
                              r.helperName
                            )}
                          </Cell>
                          <Cell className="tabular text-ink-soft">{r.distanceKm} km</Cell>
                          <Cell className="tabular whitespace-nowrap text-[13px] text-ink-soft">{timeOnly(r.sentAt)}</Cell>
                          <Cell className="tabular whitespace-nowrap text-[13px] text-ink-muted">
                            {r.respondedAt ? timeOnly(r.respondedAt) : "—"}
                          </Cell>
                          <Cell className="tabular whitespace-nowrap text-[13px] text-ink-muted">{waited(r.waitedSeconds)}</Cell>
                          <Cell><Badge tone={REQ_TONE[r.status]}>{titleCase(r.status)}</Badge></Cell>
                        </Row>
                      ))}
                    </Table>
                  )}
                  <div className="flex items-center justify-between px-4 py-3 text-xs text-ink-muted">
                    <span>Booked {dateTime(task.createdAt)}</span>
                    <Link href={`/admin/bookings/${task.id}`} className="font-medium text-forest-700 hover:underline">
                      View full booking →
                    </Link>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {data && (
        <Pagination page={data.page} pages={data.pages} total={data.total} noun="bookings" onPage={(p) => set({ page: String(p) })} />
      )}
    </>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<Spinner label="Loading dispatch" />}>
      <TrackView />
    </Suspense>
  );
}

function Count({ label, n, tone }: { label: string; n: number; tone: "green" | "rose" | "slate" | "amber" | "sky" }) {
  if (n === 0) return null;
  return (
    <Badge tone={tone}>
      {n} {label}
    </Badge>
  );
}
