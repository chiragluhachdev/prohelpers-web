"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { relative } from "@/lib/format";
import { apiQuery, useFilters } from "@/lib/useFilters";
import {
  Avatar, Button, Card, Cell, EmptyState, ErrorNote, Field,
  Modal, PageHeader, Row, Spinner, StatusBadge, Table,
  SkeletonRows, Input,
} from "@/components/ui";
import { FilterBar, Pagination, SearchFilter } from "@/components/filters";
import { useColumns } from "@/lib/useColumns";

type Partner = {
  id: string; name: string; phone: string;
  status: string; createdAt: string; referralCode: string;
};

type Payload = {
  partners: Partner[]; total: number; page: number; pages: number;
};

const DEFAULTS = { q: "", page: "1" };

function PartnersView() {
  const { values: f, set, reset, activeCount } = useFilters(DEFAULTS);
  const { data, error, loading, reload } = useApi<Payload>(`/api/admin/partners?${apiQuery({ ...f, limit: "50" })}`);

  const { isVisible, ColumnToggle } = useColumns("admin_partners", [
    { id: "partner", label: "Partner" },
    { id: "phone", label: "Phone" },
    { id: "code", label: "Code" },
    { id: "status", label: "Status" },
    { id: "joined", label: "Joined" },
  ]);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  async function createPartner() {
    setBusy(true);
    setActionError("");
    try {
      await api(`/api/admin/partners`, { method: "POST", body: { name, phone } });
      await reload();
      setAdding(false);
      setName("");
      setPhone("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-start justify-between">
        <PageHeader title="Referral Partners" subtitle="Manage people approved to refer customers and helpers." />
        <Button onClick={() => setAdding(true)}>Add Partner</Button>
      </div>

      <FilterBar
        activeCount={activeCount}
        onReset={reset}
        summary={data ? `${data.total} partner${data.total === 1 ? "" : "s"}` : undefined}
        actions={<ColumnToggle />}
      >
        <SearchFilter value={f.q} onChange={(q) => set({ q })} placeholder="Name or phone…" />
      </FilterBar>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Card padded={false}>
        {loading ? (
          <SkeletonRows rows={6} cols={5} />
        ) : !data?.partners.length ? (
          <EmptyState
            title="No partners match"
            body={activeCount ? "Try clearing the search filter." : "Add a referral partner to get started."}
          />
        ) : (
          <Table head={[
            isVisible("partner") && "Partner",
            isVisible("phone") && "Phone",
            isVisible("code") && "Code",
            isVisible("status") && "Status",
            isVisible("joined") && "Joined"
          ].filter(Boolean)}>
            {data.partners.map((p) => (
              <Row key={p.id}>
                {isVisible("partner") && (
                  <Cell>
                    <div className="flex items-center gap-3">
                      <Avatar name={p.name} />
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </Cell>
                )}
                {isVisible("phone") && <Cell className="tabular text-ink-soft">{p.phone}</Cell>}
                {isVisible("code") && <Cell className="font-mono text-sm tracking-widest">{p.referralCode || "—"}</Cell>}
                {isVisible("status") && <Cell><StatusBadge status={p.status} /></Cell>}
                {isVisible("joined") && <Cell className="whitespace-nowrap text-[13px] text-ink-muted">{relative(p.createdAt)}</Cell>}
              </Row>
            ))}
          </Table>
        )}
      </Card>

      {data && (
        <Pagination page={data.page} pages={data.pages} total={data.total} noun="partners" onPage={(p) => set({ page: String(p) })} />
      )}

      <Modal open={adding} title="Add Referral Partner" onClose={() => setAdding(false)}>
        <div className="grid gap-4">
          {actionError && <ErrorNote>{actionError}</ErrorNote>}
          <p className="text-sm text-ink-soft">The partner will be able to log into the portal using their phone number.</p>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rajesh Kumar" />
          </Field>
          <Field label="Mobile Number">
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" />
          </Field>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button disabled={!name.trim() || phone.length < 10 || busy} onClick={createPartner}>
              {busy ? "Creating…" : "Create Partner"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function PartnersPage() {
  return (
    <Suspense fallback={<Spinner label="Loading partners" />}>
      <PartnersView />
    </Suspense>
  );
}
