"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { dateTime, relative } from "@/lib/format";
import {
  Badge, Button, Card, Cell, EmptyState, ErrorNote,
  PageHeader, Row, SkeletonRows, Stat, StatusBadge, Table, Tabs,
} from "@/components/ui";

type OpenTask = {
  id: string; code: string; status: string; statusLabel: string;
  services: string[];
  bookingType: "instant" | "scheduled";
  scheduledAt: string; startedAt: string | null;
  customer: { id: string; name: string; phone: string } | null;
  helper: { id: string; name: string; phone: string } | null;
  area: string;
  durationMins: number;
  expectedEndAt: string;
  lateMinutes: number;
  overdue: boolean;
  overdueSince: string | null;
  reminders: number;
  lastRemindedAt: string | null;
};

type OpenTasks = {
  tasks: OpenTask[];
  counts: { open: number; overdue: number; ACCEPTED: number; IN_PROGRESS: number; COMPLETION_PENDING: number };
  rule: { overdueAfterMinutes: number; repeatMinutes: number; maxReminders: number };
};

type TabKey = "all" | "overdue" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETION_PENDING";

const late = (mins: number) => {
  const m = Math.abs(mins);
  const text = m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
  return mins >= 0 ? `${text} late` : `due in ${text}`;
};

/**
 * UC-C18 — every job a helper has and nobody has closed, overdue ones first.
 * Refreshes on its own; a reminder can be sent to both sides from here.
 */
export default function OpenTasksPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const { data, error, loading, reload } = useApi<OpenTasks>("/api/admin/open-tasks", { pollMs: 30_000 });

  const rows = (data?.tasks ?? []).filter((t) =>
    tab === "all" ? true : tab === "overdue" ? t.overdue : t.status === tab,
  );

  async function remind(t: OpenTask) {
    setBusy(t.id);
    setNote("");
    try {
      await api(`/api/admin/bookings/${t.id}/remind`, { method: "POST", body: {} });
      setNote(`Reminder sent to both sides of ${t.code}.`);
      await reload();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not send the reminder.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Open tasks"
        subtitle={
          data
            ? `Jobs a helper has that aren't closed yet. Overdue ${data.rule.overdueAfterMinutes} min after the expected finish — then both sides are reminded${
                data.rule.repeatMinutes ? ` every ${data.rule.repeatMinutes} min, up to ${data.rule.maxReminders} times` : " once"
              }.`
            : "Jobs a helper has that aren't closed yet."
        }
      />

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}
      {note && <div className="mb-4 rounded-[10px] border border-forest-100 bg-forest-50 px-3.5 py-2.5 text-sm text-forest-800">{note}</div>}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open" value={data?.counts.open ?? "—"} onClick={() => setTab("all")} />
        <Stat
          label="Overdue"
          value={data?.counts.overdue ?? "—"}
          tone={data?.counts.overdue ? "rose" : "green"}
          sub={data?.counts.overdue ? "Needs attention" : "All on time"}
          onClick={() => setTab("overdue")}
        />
        <Stat label="Not started yet" value={data?.counts.ACCEPTED ?? "—"} onClick={() => setTab("ACCEPTED")} />
        <Stat
          label="Under way"
          value={data ? data.counts.IN_PROGRESS + data.counts.COMPLETION_PENDING : "—"}
          onClick={() => setTab("IN_PROGRESS")}
        />
      </div>

      <div className="mb-3">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: "all", label: "All", count: data?.counts.open },
            { key: "overdue", label: "Overdue", count: data?.counts.overdue },
            { key: "ACCEPTED", label: "Not started", count: data?.counts.ACCEPTED },
            { key: "IN_PROGRESS", label: "In progress", count: data?.counts.IN_PROGRESS },
            { key: "COMPLETION_PENDING", label: "Awaiting OTP", count: data?.counts.COMPLETION_PENDING },
          ]}
        />
      </div>

      <Card padded={false}>
        {loading && !data ? (
          <SkeletonRows rows={5} cols={6} />
        ) : rows.length === 0 ? (
          <EmptyState title={tab === "overdue" ? "Nothing overdue" : "No open tasks"} body="Jobs show up here from the moment a helper accepts them until they're closed." />
        ) : (
          <Table head={["Booking", "Status", "Customer", "Helper", "Expected finish", "Reminders", ""]}>
            {rows.map((t) => (
              <Row key={t.id} onClick={() => router.push(`/admin/bookings/${t.id}`)}>
                <Cell>
                  <p className="tabular font-medium">{t.code}</p>
                  <p className="text-xs text-ink-muted">{t.services.join(", ")}</p>
                </Cell>
                <Cell>
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={t.status} label={t.statusLabel} />
                    {t.overdue && <Badge tone="rose">Overdue</Badge>}
                  </div>
                </Cell>
                <Cell>
                  <p>{t.customer?.name || "—"}</p>
                  <p className="tabular text-xs text-ink-muted">{t.customer?.phone}</p>
                </Cell>
                <Cell>
                  <p>{t.helper?.name || "—"}</p>
                  <p className="tabular text-xs text-ink-muted">{t.helper?.phone}</p>
                </Cell>
                <Cell>
                  <p className="tabular">{dateTime(t.expectedEndAt)}</p>
                  <p className={`text-xs ${t.overdue ? "font-medium text-rose-ink" : "text-ink-muted"}`}>
                    {late(t.lateMinutes)} · {t.startedAt ? `started ${relative(t.startedAt)}` : "not started"}
                  </p>
                </Cell>
                <Cell>
                  <p className="tabular">{t.reminders}</p>
                  {t.lastRemindedAt && <p className="text-xs text-ink-muted">last {relative(t.lastRemindedAt)}</p>}
                </Cell>
                <Cell className="text-right">
                  <span onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="secondary" disabled={busy === t.id} onClick={() => remind(t)}>
                      {busy === t.id ? "Sending…" : "Remind"}
                    </Button>
                  </span>
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
