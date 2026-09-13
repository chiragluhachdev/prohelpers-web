"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { relative, titleCase } from "@/lib/format";
import {
  Avatar, Badge, Card, Cell, Dot, EmptyState, ErrorNote, Input,
  PageHeader, Row, Spinner, StatusBadge, Table, Tabs,
  SkeletonRows,
} from "@/components/ui";

type Helper = {
  id: string; name: string; phone: string; photoUrl?: string;
  accountStatus: string; approvalStatus: string; kycStatus: string;
  services: string[]; serviceArea?: { label?: string; radiusKm?: number };
  isOnline: boolean; rating: number; ratingCount: number; completedJobs: number;
  jobsShown?: number; jobsLabel?: string;
  submittedAt?: string; createdAt: string;
};

type Payload = { helpers: Helper[]; counts: Record<string, number> };

const FILTERS = ["ALL", "PENDING_VERIFICATION", "APPROVED", "REJECTED", "DRAFT"] as const;
type Filter = (typeof FILTERS)[number];

function HelpersView() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<Filter>((params.get("status") as Filter) || "ALL");
  const [q, setQ] = useState("");

  const query = new URLSearchParams();
  if (status !== "ALL") query.set("status", status);
  if (q.trim()) query.set("q", q.trim());
  const { data, error, loading } = useApi<Payload>(`/api/admin/helpers?${query}`);

  return (
    <>
      <PageHeader title="Helpers" subtitle="Verify identity and documents before a helper can take jobs." />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          active={status}
          onChange={setStatus}
          tabs={FILTERS.map((f) => ({
            key: f,
            label: f === "ALL" ? "All" : titleCase(f),
            count: f === "ALL" ? undefined : data?.counts?.[f],
          }))}
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or phone…"
          className="max-w-[240px]"
        />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Card padded={false}>
        {loading ? (
          <SkeletonRows rows={6} cols={7} />
        ) : !data?.helpers.length ? (
          <EmptyState
            title="No helpers here"
            body={status === "ALL" ? "Helpers appear once they register on the app." : "Try another filter."}
          />
        ) : (
          <Table head={["Helper", "Verification", "Services", "Area", "Jobs", "Rating", "Joined"]}>
            {data.helpers.map((h) => (
              <Row key={h.id} onClick={() => router.push(`/admin/helpers/${h.id}`)}>
                <Cell>
                  <div className="flex items-center gap-3">
                    <Avatar name={h.name} src={h.photoUrl} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-medium">
                        {h.name}
                        {h.isOnline && <Dot on />}
                      </p>
                      <p className="truncate text-xs text-ink-muted">{h.phone}</p>
                    </div>
                  </div>
                </Cell>
                <Cell>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge status={h.approvalStatus} />
                    {h.accountStatus === "blocked" && <Badge tone="rose">Blocked</Badge>}
                  </div>
                </Cell>
                <Cell className="text-ink-soft">
                  <span className="line-clamp-1 text-[13px]">
                    {h.services?.length ? h.services.map(titleCase).join(", ") : "—"}
                  </span>
                </Cell>
                <Cell className="text-[13px] text-ink-soft">
                  {h.serviceArea?.label || "—"}
                  {h.serviceArea?.radiusKm ? (
                    <span className="block text-xs text-ink-muted">{h.serviceArea.radiusKm} km radius</span>
                  ) : null}
                </Cell>
                <Cell className="tabular whitespace-nowrap">
                  {h.completedJobs}
                  {h.jobsLabel && h.jobsLabel !== String(h.completedJobs) && (
                    <span className="ml-1.5 text-[12px] text-ink-muted" title="What customers see">
                      · shows {h.jobsLabel}
                    </span>
                  )}
                </Cell>
                <Cell className="tabular whitespace-nowrap">
                  {h.ratingCount ? `${h.rating.toFixed(1)} ★` : <span className="text-ink-muted">—</span>}
                </Cell>
                <Cell className="whitespace-nowrap text-[13px] text-ink-muted">{relative(h.createdAt)}</Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

export default function HelpersPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <HelpersView />
    </Suspense>
  );
}
