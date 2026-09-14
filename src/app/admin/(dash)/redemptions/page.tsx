"use client";

import { Suspense, useState } from "react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { relative, rupees } from "@/lib/format";
import { apiQuery, useFilters } from "@/lib/useFilters";
import {
  Button, Card, Cell, EmptyState, ErrorNote, Field,
  Modal, PageHeader, Row, Spinner, StatusBadge, Table,
  SkeletonRows, Input, Textarea,
} from "@/components/ui";
import { FilterBar, Pagination, SelectFilter } from "@/components/filters";

type RedemptionRequest = {
  id: string; 
  userId: { id: string; name: string; phone: string };
  amount: number;
  paymentDetails: string;
  status: string;
  createdAt: string;
  rejectionReason?: string;
  processedBy?: { id: string; name: string };
};

type Payload = {
  requests: RedemptionRequest[]; total: number; page: number; pages: number;
};

const DEFAULTS = { status: "", page: "1" };

function RedemptionsView() {
  const { values: f, set, reset, activeCount } = useFilters(DEFAULTS);
  const { data, error, loading, reload } = useApi<Payload>(`/api/admin/redemptions?${apiQuery({ ...f, limit: "50" })}`);

  const [target, setTarget] = useState<RedemptionRequest | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  async function handleRequest(status: 'PAID' | 'REJECTED') {
    if (!target) return;
    setBusy(true);
    setActionError("");
    try {
      await api(`/api/admin/redemptions/${target.id}`, { 
        method: "PUT", 
        body: { status, rejectionReason: status === 'REJECTED' ? rejectionReason : undefined } 
      });
      await reload();
      setTarget(null);
      setRejecting(false);
      setRejectionReason("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Payout Requests" subtitle="Manage referral partner earnings redemptions." />

      <FilterBar
        activeCount={activeCount}
        onReset={reset}
        summary={data ? `${data.total} request${data.total === 1 ? "" : "s"}` : undefined}
      >
        <SelectFilter
          label="Status"
          value={f.status}
          onChange={(status) => set({ status })}
          options={[
            { value: "", label: "All" },
            { value: "PROCESSING", label: "Processing" },
            { value: "PAID", label: "Paid" },
            { value: "REJECTED", label: "Rejected" },
          ]}
        />
      </FilterBar>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Card padded={false}>
        {loading ? (
          <SkeletonRows rows={6} cols={6} />
        ) : !data?.requests.length ? (
          <EmptyState
            title="No requests match"
            body={activeCount ? "Try clearing the filters." : "When partners request payouts, they appear here."}
          />
        ) : (
          <Table head={["Date", "Partner", "Amount", "Details", "Status", ""]}>
            {data.requests.map((r) => (
              <Row key={r.id}>
                <Cell className="whitespace-nowrap text-[13px] text-ink-muted">{relative(r.createdAt)}</Cell>
                <Cell>
                  <div className="leading-tight">
                    <p className="font-medium text-ink">{r.userId?.name || "Unknown"}</p>
                    <p className="text-[13px] text-ink-soft">{r.userId?.phone}</p>
                  </div>
                </Cell>
                <Cell className="tabular font-medium">{rupees(r.amount)}</Cell>
                <Cell className="text-sm font-mono max-w-[200px] truncate" title={r.paymentDetails}>{r.paymentDetails}</Cell>
                <Cell><StatusBadge status={r.status} /></Cell>
                <Cell className="text-right">
                  {r.status === "PROCESSING" && (
                    <Button size="sm" variant="secondary" onClick={() => { setTarget(r); setRejecting(false); }}>
                      Review
                    </Button>
                  )}
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>

      {data && (
        <Pagination page={data.page} pages={data.pages} total={data.total} noun="requests" onPage={(p) => set({ page: String(p) })} />
      )}

      <Modal open={Boolean(target)} title="Review Payout Request" onClose={() => { setTarget(null); setRejecting(false); }}>
        <div className="grid gap-4">
          {actionError && <ErrorNote>{actionError}</ErrorNote>}
          
          <div className="rounded-lg bg-sunken p-4 text-sm">
            <div className="mb-2 flex justify-between">
              <span className="text-ink-soft">Partner</span>
              <span className="font-medium text-ink">{target?.userId?.name} ({target?.userId?.phone})</span>
            </div>
            <div className="mb-2 flex justify-between">
              <span className="text-ink-soft">Amount</span>
              <span className="font-medium text-ink">{rupees(target?.amount || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">Payment Details</span>
              <span className="font-mono text-ink text-right">{target?.paymentDetails}</span>
            </div>
          </div>

          {rejecting ? (
            <>
              <Field label="Reason for rejection (optional)">
                <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="e.g. Invalid UPI ID" />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setRejecting(false)}>Back</Button>
                <Button variant="danger" disabled={busy} onClick={() => handleRequest('REJECTED')}>
                  {busy ? "Rejecting…" : "Confirm Rejection"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-soft">
                Transfer the funds to the payment details provided above, then mark this request as paid.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setRejecting(true)}>Reject</Button>
                <Button disabled={busy} onClick={() => handleRequest('PAID')}>
                  {busy ? "Updating…" : "Mark as Paid"}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

export default function RedemptionsPage() {
  return (
    <Suspense fallback={<Spinner label="Loading requests" />}>
      <RedemptionsView />
    </Suspense>
  );
}
