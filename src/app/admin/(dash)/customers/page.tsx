"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { relative, rupees } from "@/lib/format";
import { apiQuery, useFilters } from "@/lib/useFilters";
import {
  Avatar, Button, Card, Cell, EmptyState, ErrorNote, Field,
  Modal, PageHeader, Row, Spinner, StatusBadge, Table, Tabs, Textarea,
  SkeletonRows,
} from "@/components/ui";
import { DateFilter, FilterBar, Pagination, SearchFilter, SelectFilter } from "@/components/filters";
import { useColumns } from "@/lib/useColumns";

type Customer = {
  id: string; name: string; phone: string; photoUrl?: string;
  accountStatus: string; createdAt: string; bookings: number; spend: number; lastBookingAt?: string | null;
};

type Payload = {
  customers: Customer[]; counts: { all: number; active: number; blocked: number };
  total: number; page: number; pages: number;
};

const DEFAULTS = { status: "", q: "", has: "", range: "", from: "", to: "", sort: "newest", page: "1" };

function CustomersView() {
  const router = useRouter();
  const { values: f, set, reset, activeCount } = useFilters(DEFAULTS);
  const { data, error, loading, reload } = useApi<Payload>(`/api/admin/customers?${apiQuery({ ...f, limit: "50" })}`);

  const { isVisible, ColumnToggle } = useColumns("admin_customers", [
    { id: "customer", label: "Customer" },
    { id: "phone", label: "Phone" },
    { id: "bookings", label: "Bookings" },
    { id: "spend", label: "Spend" },
    { id: "status", label: "Status" },
    { id: "joined", label: "Joined" },
  ]);

  const [target, setTarget] = useState<Customer | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  async function toggleBlock(customer: Customer) {
    setBusy(true);
    setActionError("");
    try {
      if (customer.accountStatus === "blocked") {
        await api(`/api/admin/users/${customer.id}/unblock`, { method: "POST" });
      } else {
        await api(`/api/admin/users/${customer.id}/block`, { method: "POST", body: { reason } });
      }
      await reload();
      setTarget(null);
      setReason("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Customers" subtitle="Everyone who books help through the app." />

      <div className="mb-3">
        <Tabs
          active={f.status}
          onChange={(status) => set({ status })}
          tabs={[
            { key: "", label: "All", count: data?.counts.all },
            { key: "active", label: "Active", count: data?.counts.active },
            { key: "blocked", label: "Blocked", count: data?.counts.blocked },
          ]}
        />
      </div>

      <FilterBar
        activeCount={activeCount}
        onReset={reset}
        summary={data ? `${data.total} customer${data.total === 1 ? "" : "s"}` : undefined}
        actions={<ColumnToggle />}
      >
        <SearchFilter value={f.q} onChange={(q) => set({ q })} placeholder="Name or phone…" />
        <SelectFilter
          label="Bookings"
          value={f.has}
          onChange={(has) => set({ has })}
          options={[
            { value: "", label: "Any" },
            { value: "booked", label: "Has booked" },
            { value: "never", label: "Never booked" },
          ]}
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
            { value: "recent", label: "Booked most recently" },
            { value: "bookings", label: "Most bookings" },
            { value: "spend", label: "Highest spend" },
            { value: "name", label: "Name A–Z" },
          ]}
        />
      </FilterBar>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Card padded={false}>
        {loading ? (
          <SkeletonRows rows={6} cols={7} />
        ) : !data?.customers.length ? (
          <EmptyState
            title="No customers match"
            body={activeCount || f.status ? "Try another tab or clear a filter." : "They appear here as soon as they sign up on the app."}
          />
        ) : (
          <Table head={[
            isVisible("customer") && "Customer",
            isVisible("phone") && "Phone",
            isVisible("bookings") && "Bookings",
            isVisible("spend") && "Spend",
            isVisible("status") && "Status",
            isVisible("joined") && "Joined",
            ""
          ].filter(Boolean)}>
            {data.customers.map((c) => (
              <Row key={c.id} onClick={() => router.push(`/admin/customers/${c.id}`)}>
                {isVisible("customer") && (
                  <Cell>
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} src={c.photoUrl} />
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </Cell>
                )}
                {isVisible("phone") && <Cell className="tabular text-ink-soft">{c.phone}</Cell>}
                {isVisible("bookings") && <Cell className="tabular">{c.bookings}</Cell>}
                {isVisible("spend") && <Cell className="tabular font-medium">{rupees(c.spend)}</Cell>}
                {isVisible("status") && <Cell><StatusBadge status={c.accountStatus} /></Cell>}
                {isVisible("joined") && <Cell className="whitespace-nowrap text-[13px] text-ink-muted">{relative(c.createdAt)}</Cell>}
                <Cell className="text-right">
                  <Button
                    size="sm"
                    variant={c.accountStatus === "blocked" ? "secondary" : "ghost"}
                    onClick={() => (c.accountStatus === "blocked" ? toggleBlock(c) : setTarget(c))}
                  >
                    {c.accountStatus === "blocked" ? "Unblock" : "Block"}
                  </Button>
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>

      {data && (
        <Pagination page={data.page} pages={data.pages} total={data.total} noun="customers" onPage={(p) => set({ page: String(p) })} />
      )}

      <Modal open={Boolean(target)} title={`Block ${target?.name}`} onClose={() => setTarget(null)}>
        <div className="grid gap-4">
          {actionError && <ErrorNote>{actionError}</ErrorNote>}
          <p className="text-sm text-ink-soft">They will not be able to sign in or create new bookings.</p>
          <Field label="Reason">
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Repeated fake bookings." />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button>
            <Button variant="danger" disabled={!reason.trim() || busy} onClick={() => target && toggleBlock(target)}>
              {busy ? "Blocking…" : "Block account"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<Spinner label="Loading customers" />}>
      <CustomersView />
    </Suspense>
  );
}
