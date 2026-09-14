"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { relative, titleCase } from "@/lib/format";
import { apiQuery, useFilters } from "@/lib/useFilters";
import { useColumns } from "@/lib/useColumns";
import {
  Avatar, Badge, Card, Cell, Dot, EmptyState, ErrorNote,
  PageHeader, Row, Spinner, StatusBadge, Table, Tabs,
  SkeletonRows,
} from "@/components/ui";
import {
  DateFilter, FilterBar, Pagination, SearchFilter, SelectFilter, type FilterOptions,
} from "@/components/filters";

type Helper = {
  id: string; name: string; phone: string; photoUrl?: string;
  accountStatus: string; approvalStatus: string; kycStatus: string;
  services: string[]; serviceArea?: { label?: string; radiusKm?: number };
  isOnline: boolean; rating: number; ratingCount: number; completedJobs: number;
  jobsShown?: number; jobsLabel?: string;
  submittedAt?: string; createdAt: string;
};

type Payload = { helpers: Helper[]; counts: Record<string, number>; total: number; page: number; pages: number };

const STATUSES = ["", "PENDING_VERIFICATION", "APPROVED", "REJECTED", "DRAFT"] as const;

const DEFAULTS = {
  status: "", q: "", online: "", account: "", kyc: "", service: "", society: "",
  range: "", from: "", to: "", sort: "newest", page: "1",
};

function HelpersView() {
  const router = useRouter();
  const { values: f, set, reset, activeCount } = useFilters(DEFAULTS);
  const options = useApi<FilterOptions>("/api/admin/filter-options");
  const { data, error, loading } = useApi<Payload>(`/api/admin/helpers?${apiQuery({ ...f, limit: "50" })}`);

  const { isVisible, ColumnToggle } = useColumns("admin_helpers", [
    { id: "helper", label: "Helper" },
    { id: "verification", label: "Verification" },
    { id: "services", label: "Services" },
    { id: "area", label: "Area" },
    { id: "jobs", label: "Jobs" },
    { id: "rating", label: "Rating" },
    { id: "joined", label: "Joined" },
  ]);
  const status = f.status;

  return (
    <>
      <PageHeader title="Helpers" subtitle="Verify identity and documents before a helper can take jobs." />

      <div className="mb-3">
        <Tabs
          active={f.status}
          onChange={(next) => set({ status: next })}
          tabs={STATUSES.map((key) => ({
            key,
            label: key === "" ? "All" : titleCase(key),
            count: key === "" ? undefined : data?.counts?.[key],
          }))}
        />
      </div>

      <FilterBar
        activeCount={activeCount}
        onReset={reset}
        summary={data ? `${data.total} helper${data.total === 1 ? "" : "s"}` : undefined}
        actions={<ColumnToggle />}
      >
        <SearchFilter value={f.q} onChange={(q) => set({ q })} placeholder="Name or phone…" />
        <SelectFilter
          label="Availability"
          value={f.online}
          onChange={(online) => set({ online })}
          options={[
            { value: "", label: "Any" },
            { value: "online", label: "Online now" },
            { value: "offline", label: "Offline" },
          ]}
        />
        <SelectFilter
          label="Account"
          value={f.account}
          onChange={(account) => set({ account })}
          options={[
            { value: "", label: "Any" },
            { value: "active", label: "Active" },
            { value: "blocked", label: "Blocked" },
          ]}
        />
        <SelectFilter
          label="Aadhaar"
          value={f.kyc}
          onChange={(kyc) => set({ kyc })}
          options={[
            { value: "", label: "Any" },
            { value: "VERIFIED", label: "Verified" },
            { value: "NOT_STARTED", label: "Not verified" },
            { value: "FAILED", label: "Failed" },
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
        <DateFilter label="Joined" range={f.range} from={f.from} to={f.to} onChange={set} />
        <SelectFilter
          label="Sort"
          value={f.sort}
          neutral="newest"
          onChange={(sort) => set({ sort })}
          options={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "submitted", label: "Waiting longest for review" },
            { value: "rating", label: "Highest rated" },
            { value: "jobs", label: "Most jobs" },
            { value: "name", label: "Name A–Z" },
          ]}
        />
      </FilterBar>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Card padded={false}>
        {loading ? (
          <SkeletonRows rows={6} cols={7} />
        ) : !data?.helpers.length ? (
          <EmptyState
            title="No helpers match"
            body={!status && !activeCount ? "Helpers appear once they register on the app." : "Try another tab or clear a filter."}
          />
        ) : (
          <Table head={[
            isVisible("helper") && "Helper",
            isVisible("verification") && "Verification",
            isVisible("services") && "Services",
            isVisible("area") && "Area",
            isVisible("jobs") && "Jobs",
            isVisible("rating") && "Rating",
            isVisible("joined") && "Joined"
          ].filter(Boolean)}>
            {data.helpers.map((h) => (
              <Row key={h.id} onClick={() => router.push(`/admin/helpers/${h.id}`)}>
                {isVisible("helper") && (
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
                )}
                {isVisible("verification") && (
                  <Cell>
                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge status={h.approvalStatus} />
                      {h.accountStatus === "blocked" && <Badge tone="rose">Blocked</Badge>}
                    </div>
                  </Cell>
                )}
                {isVisible("services") && (
                  <Cell className="text-ink-soft">
                    <span className="line-clamp-1 text-[13px]">
                      {h.services?.length ? h.services.map(titleCase).join(", ") : "—"}
                    </span>
                  </Cell>
                )}
                {isVisible("area") && (
                  <Cell className="text-[13px] text-ink-soft">
                    {h.serviceArea?.label || "—"}
                    {h.serviceArea?.radiusKm ? (
                      <span className="block text-xs text-ink-muted">{h.serviceArea.radiusKm} km radius</span>
                    ) : null}
                  </Cell>
                )}
                {isVisible("jobs") && (
                  <Cell className="tabular whitespace-nowrap">
                    {h.completedJobs}
                    {h.jobsLabel && h.jobsLabel !== String(h.completedJobs) && (
                      <span className="ml-1.5 text-[12px] text-ink-muted" title="What customers see">
                        · shows {h.jobsLabel}
                      </span>
                    )}
                  </Cell>
                )}
                {isVisible("rating") && (
                  <Cell className="tabular whitespace-nowrap">
                    {h.ratingCount ? `${h.rating.toFixed(1)} ★` : <span className="text-ink-muted">—</span>}
                  </Cell>
                )}
                {isVisible("joined") && (
                  <Cell className="whitespace-nowrap text-[13px] text-ink-muted">{relative(h.createdAt)}</Cell>
                )}
              </Row>
            ))}
          </Table>
        )}
      </Card>

      {data && (
        <Pagination page={data.page} pages={data.pages} total={data.total} noun="helpers" onPage={(p) => set({ page: String(p) })} />
      )}
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
