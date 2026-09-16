"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { dateTime, relative, titleCase } from "@/lib/format";
import { apiQuery, useFilters } from "@/lib/useFilters";
import { DateFilter, FilterBar, Pagination, SearchFilter, SelectFilter } from "@/components/filters";
import {
  Badge, Button, Card, Cell, EmptyState, ErrorNote, Field, Input, Modal,
  PageHeader, Row, Select, SkeletonRows, Spinner, Stat, Table, Textarea, type Tone,
} from "@/components/ui";
import type { Complaint } from "@/components/AccountPanels";

type Payload = {
  complaints: Complaint[];
  counts: Record<string, number>;
  admins: { id: string; name: string; email: string }[];
  me: string;
  page: number; pages: number; total: number;
};

const TONE: Record<string, Tone> = { OPEN: "rose", IN_REVIEW: "amber", RESOLVED: "green", DISMISSED: "slate" };

const CATEGORIES = [
  { value: "", label: "Any subject" },
  { value: "SERVICE_QUALITY", label: "Service quality" },
  { value: "BEHAVIOUR", label: "Behaviour" },
  { value: "PAYMENT", label: "Payment" },
  { value: "DAMAGE", label: "Damage" },
  { value: "SAFETY", label: "Safety" },
  { value: "APP", label: "The app" },
  { value: "OTHER", label: "Something else" },
];

const DEFAULTS = { status: "", category: "", role: "", assigned: "", escalated: "", q: "", range: "", from: "", to: "", page: "1" };

const NOTE_KIND: Record<string, string> = {
  NOTE: "Note", CONTACT: "Contacted", STATUS: "Status", ASSIGN: "Assigned", ESCALATE: "Escalation",
};

/** UC-C39 / UC-C40 — problems reported from either app, and what was done about them. */
function ComplaintsView() {
  const { values: f, set, reset, activeCount } = useFilters(DEFAULTS);
  const { data, error, loading, reload } = useApi<Payload>(`/api/admin/complaints?${apiQuery({ ...f, limit: "50" })}`, { pollMs: 30_000 });

  const [open, setOpen] = useState<Complaint | null>(null);
  const [resolution, setResolution] = useState("");
  const [note, setNote] = useState("");
  const [escalateReason, setEscalateReason] = useState("");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");

  /** Runs one action on the open complaint and keeps the sheet on the fresh copy. */
  async function act(label: string, path: string, body: Record<string, unknown>) {
    if (!open) return;
    setBusy(label);
    setActionError("");
    try {
      const res = await api<{ complaint: Complaint }>(`/api/admin/complaints/${open.id}/${path}`, { method: "POST", body });
      setOpen(res.complaint);
      setResolution(res.complaint.resolution || "");
      setNote("");
      setEscalateReason("");
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy("");
    }
  }

  const counts = data?.counts ?? {};

  async function setStatus(status: "IN_REVIEW" | "RESOLVED" | "DISMISSED") {
    if (!open) return;
    setBusy(status);
    setActionError("");
    try {
      await api(`/api/admin/complaints/${open.id}/status`, { method: "POST", body: { status, resolution } });
      setOpen(null);
      setResolution("");
      setNote("");
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHeader
        title="Complaints"
        subtitle="Problems reported by customers and helpers. Whoever reported it is told what you decide."
      />

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open" value={counts.OPEN ?? 0} tone={counts.OPEN ? "rose" : "green"} sub={counts.OPEN ? "Waiting on you" : "Nothing waiting"} onClick={() => set({ status: "OPEN" })} />
        <Stat label="Being looked at" value={counts.IN_REVIEW ?? 0} tone="amber" onClick={() => set({ status: "IN_REVIEW" })} />
        <Stat label="Resolved" value={counts.RESOLVED ?? 0} tone="green" onClick={() => set({ status: "RESOLVED" })} />
        <Stat
          label="Escalated"
          value={counts.escalated ?? 0}
          tone={counts.escalated ? "rose" : "slate"}
          sub={`${counts.unassigned ?? 0} unassigned · ${counts.mine ?? 0} yours`}
          onClick={() => set({ escalated: "1", status: "" })}
        />
      </div>

      <FilterBar
        activeCount={activeCount}
        onReset={reset}
        summary={data ? `${data.total} complaint${data.total === 1 ? "" : "s"}` : undefined}
      >
        <SearchFilter value={f.q} onChange={(q) => set({ q })} placeholder="Code, booking, name or words…" />
        <SelectFilter
          label="Status"
          value={f.status}
          onChange={(status) => set({ status })}
          options={[
            { value: "", label: "Any status" },
            { value: "OPEN", label: "Open" },
            { value: "IN_REVIEW", label: "Being looked at" },
            { value: "RESOLVED", label: "Resolved" },
            { value: "DISMISSED", label: "Set aside" },
          ]}
        />
        <SelectFilter label="Subject" value={f.category} onChange={(category) => set({ category })} options={CATEGORIES} />
        <SelectFilter
          label="From"
          value={f.role}
          onChange={(role) => set({ role })}
          options={[
            { value: "", label: "Anyone" },
            { value: "customer", label: "Customers" },
            { value: "helper", label: "Helpers" },
          ]}
        />
        <SelectFilter
          label="Assigned"
          value={f.assigned}
          onChange={(assigned) => set({ assigned })}
          options={[
            { value: "", label: "Anyone" },
            { value: "me", label: "Me" },
            { value: "none", label: "Nobody yet" },
            ...(data?.admins ?? []).map((a) => ({ value: a.id, label: a.name || a.email })),
          ]}
        />
        <SelectFilter
          label="Escalated"
          value={f.escalated}
          onChange={(escalated) => set({ escalated })}
          options={[
            { value: "", label: "All" },
            { value: "1", label: "Escalated only" },
          ]}
        />
        <DateFilter range={f.range} from={f.from} to={f.to} onChange={set} />
      </FilterBar>

      <Card padded={false}>
        {loading && !data ? (
          <SkeletonRows rows={6} cols={5} />
        ) : !data?.complaints.length ? (
          <EmptyState title="No complaints" body="Anything reported from either app lands here." />
        ) : (
          <>
            <Table head={["Complaint", "From", "About", "Assigned", "Status", "When"]}>
              {data.complaints.map((c) => (
                <Row key={c.id} onClick={() => { setOpen(c); setResolution(c.resolution || ""); setActionError(""); }}>
                  <Cell>
                    <p className="tabular text-[13px] font-medium">{c.code}</p>
                    <p className="max-w-md truncate text-xs text-ink-muted">{c.message}</p>
                  </Cell>
                  <Cell>
                    <p>{c.by?.name || "—"}</p>
                    <p className="text-xs capitalize text-ink-muted">{c.by?.role}</p>
                  </Cell>
                  <Cell className="text-[13px]">
                    {titleCase(c.category)}
                    {c.taskCode && <p className="tabular text-xs text-ink-muted">{c.taskCode}</p>}
                  </Cell>
                  <Cell className="text-[13px] text-ink-soft">{c.assignedTo?.name || c.assignedTo?.email || "—"}</Cell>
                  <Cell>
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={TONE[c.status]}>{c.status === "IN_REVIEW" ? "Looking" : titleCase(c.status)}</Badge>
                      {c.escalated && <Badge tone="rose">Escalated</Badge>}
                    </div>
                  </Cell>
                  <Cell className="whitespace-nowrap text-[13px] text-ink-muted">{relative(c.at)}</Cell>
                </Row>
              ))}
            </Table>
            <Pagination page={data.page} pages={data.pages} total={data.total} noun="complaints" onPage={(page) => set({ page: String(page) })} />
          </>
        )}
      </Card>

      <Modal
        open={Boolean(open)}
        title={open ? `${open.code} · ${titleCase(open.category)}` : "Complaint"}
        subtitle={open ? `From ${open.by?.name || "someone"} (${open.by?.role}) · ${dateTime(open.at)}` : undefined}
        size="lg"
        onClose={() => setOpen(null)}
      >
        {open && (
          <div className="grid gap-4">
            {actionError && <ErrorNote>{actionError}</ErrorNote>}

            {open.escalated && (
              <ErrorNote>
                <strong className="font-semibold">Escalated</strong>
                {open.escalationReason ? ` — ${open.escalationReason}` : ""}
              </ErrorNote>
            )}

            <div className="rounded-[10px] border border-line bg-sunken/60 p-3.5 text-sm text-ink">{open.message}</div>

            <div className="flex flex-wrap gap-4 text-[13px] text-ink-soft">
              {open.task && (
                <Link href={`/admin/bookings/${open.task.id}`} className="font-medium text-forest-700 hover:underline">
                  Booking {open.task.code}
                </Link>
              )}
              {open.by && (
                <Link href={`/admin/${open.by.role === "helper" ? "helpers" : "customers"}/${open.by.id}`} className="font-medium text-forest-700 hover:underline">
                  Who reported it
                </Link>
              )}
              {open.against && (
                <Link href={`/admin/${open.by?.role === "helper" ? "customers" : "helpers"}/${open.against.id}`} className="font-medium text-forest-700 hover:underline">
                  The other side
                </Link>
              )}
            </div>

            {/* Contacting them, and who is on it */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[10px] border border-line p-3">
                <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-ink-muted">Contact</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {open.by?.phone && (
                    <a href={`tel:${open.by.phone}`} className="rounded-[8px] border border-line-strong px-2.5 py-1.5 text-[13px] font-medium text-ink hover:bg-sunken">
                      Call {open.by.name?.split(" ")[0] || "them"} · {open.by.phone}
                    </a>
                  )}
                  {open.against?.phone && (
                    <a href={`tel:${open.against.phone}`} className="rounded-[8px] border border-line-strong px-2.5 py-1.5 text-[13px] font-medium text-ink hover:bg-sunken">
                      Call the other side
                    </a>
                  )}
                  {open.by?.email && (
                    <a href={`mailto:${open.by.email}`} className="rounded-[8px] border border-line-strong px-2.5 py-1.5 text-[13px] font-medium text-ink hover:bg-sunken">
                      Email
                    </a>
                  )}
                </div>
                <p className="mt-2 text-[12px] text-ink-muted">Log the call below so the next person knows what was said.</p>
              </div>

              <div className="rounded-[10px] border border-line p-3">
                <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-ink-muted">Assigned to</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Select
                    value={open.assignedTo?.id || ""}
                    disabled={!!busy}
                    onChange={(e) => act("assign", "assign", { adminId: e.target.value || null })}
                  >
                    <option value="">Nobody yet</option>
                    {(data?.admins ?? []).map((a) => (
                      <option key={a.id} value={a.id}>{a.name || a.email}</option>
                    ))}
                  </Select>
                  {open.assignedTo?.id !== data?.me && (
                    <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => act("assign", "assign", { adminId: "me" })}>
                      Take it
                    </Button>
                  )}
                </div>
                <div className="mt-2">
                  {open.escalated ? (
                    <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act("escalate", "escalate", { escalated: false })}>
                      Clear escalation
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        value={escalateReason}
                        onChange={(e) => setEscalateReason(e.target.value)}
                        placeholder="Why escalate?"
                        className="h-9"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!!busy || !escalateReason.trim()}
                        onClick={() => act("escalate", "escalate", { reason: escalateReason.trim() })}
                      >
                        Escalate
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* The working record */}
            <div className="rounded-[10px] border border-line">
              <p className="border-b border-line px-3.5 py-2 text-[12px] font-medium uppercase tracking-[0.05em] text-ink-muted">
                Notes ({open.notes?.length ?? 0})
              </p>
              <div className="max-h-56 overflow-y-auto divide-y divide-line/70">
                {!open.notes?.length ? (
                  <p className="px-3.5 py-3 text-[13px] text-ink-muted">Nothing noted yet.</p>
                ) : (
                  open.notes.map((n, i) => (
                    <div key={i} className="px-3.5 py-2.5">
                      <p className="text-[13px] text-ink">{n.text}</p>
                      <p className="text-[11.5px] text-ink-muted">
                        {NOTE_KIND[n.kind] || n.kind} · {n.byName || "admin"} · {dateTime(n.at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-center gap-2 border-t border-line p-2.5">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you do or find out?" className="h-9" />
                <Button size="sm" variant="secondary" disabled={!!busy || !note.trim()} onClick={() => act("note", "notes", { text: note.trim(), kind: "NOTE" })}>
                  Add note
                </Button>
                <Button size="sm" variant="ghost" disabled={!!busy || !note.trim()} onClick={() => act("contact", "notes", { text: note.trim(), kind: "CONTACT" })}>
                  Log contact
                </Button>
              </div>
            </div>

            <Field label="What was decided?" hint="Sent to whoever reported it.">
              <Textarea
                rows={3}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="We spoke to the helper and refunded the booking."
              />
            </Field>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(null)}>Close</Button>
              {open.status === "OPEN" && (
                <Button variant="secondary" disabled={!!busy} onClick={() => setStatus("IN_REVIEW")}>
                  {busy === "IN_REVIEW" ? "Saving…" : "Looking into it"}
                </Button>
              )}
              <Button variant="secondary" disabled={!!busy || !resolution.trim()} onClick={() => setStatus("DISMISSED")}>
                {busy === "DISMISSED" ? "Saving…" : "Set aside"}
              </Button>
              <Button disabled={!!busy || !resolution.trim()} onClick={() => setStatus("RESOLVED")}>
                {busy === "RESOLVED" ? "Saving…" : "Mark resolved"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function ComplaintsPage() {
  return (
    <Suspense fallback={<Spinner label="Loading complaints" />}>
      <ComplaintsView />
    </Suspense>
  );
}
