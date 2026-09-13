"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { relative, rupees } from "@/lib/format";
import {
  Avatar, Button, Card, Cell, EmptyState, ErrorNote, Field, Input,
  Modal, PageHeader, Row, Spinner, StatusBadge, Table, Textarea,
  SkeletonRows,
} from "@/components/ui";

type Customer = {
  id: string; name: string; phone: string; photoUrl?: string;
  accountStatus: string; createdAt: string; bookings: number; spend: number;
};

export default function CustomersPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { data, error, loading, reload } = useApi<{ customers: Customer[] }>(
    `/api/admin/customers?${new URLSearchParams(q.trim() ? { q: q.trim() } : {})}`,
  );

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
      <PageHeader
        title="Customers"
        subtitle="Everyone who books help through the app."
        action={
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or phone…"
            className="max-w-[240px]"
          />
        }
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      <Card padded={false}>
        {loading ? (
          <SkeletonRows rows={6} cols={7} />
        ) : !data?.customers.length ? (
          <EmptyState title="No customers found" body="They appear here as soon as they sign up on the app." />
        ) : (
          <Table head={["Customer", "Phone", "Bookings", "Spend", "Status", "Joined", ""]}>
            {data.customers.map((c) => (
              <Row key={c.id} onClick={() => router.push(`/admin/customers/${c.id}`)}>
                <Cell>
                  <div className="flex items-center gap-3">
                    <Avatar name={c.name} src={c.photoUrl} />
                    <span className="font-medium">{c.name}</span>
                  </div>
                </Cell>
                <Cell className="tabular text-ink-soft">{c.phone}</Cell>
                <Cell className="tabular">{c.bookings}</Cell>
                <Cell className="tabular font-medium">{rupees(c.spend)}</Cell>
                <Cell><StatusBadge status={c.accountStatus} /></Cell>
                <Cell className="whitespace-nowrap text-[13px] text-ink-muted">{relative(c.createdAt)}</Cell>
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
