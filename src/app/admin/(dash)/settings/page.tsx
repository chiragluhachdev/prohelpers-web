"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { dateTime, titleCase } from "@/lib/format";
import { apiQuery } from "@/lib/useFilters";
import { DateFilter, FilterBar, Pagination, SearchFilter, SelectFilter, type FilterOptions } from "@/components/filters";
import {
  Badge, Button, Card, Cell, EmptyState, ErrorNote, Field, Input,
  PageHeader, Row, SectionTitle, Spinner, Table,
} from "@/components/ui";

type Settings = Record<string, number | string | boolean>;

type SettingField = {
  key: string;
  label: string;
  suffix?: string;
  type?: "number" | "text" | "boolean";
  help?: string;
  /** Stored value ÷ scale is what the admin edits — seconds shown as minutes, say. */
  scale?: number;
  /** Only relevant when location matching is on. */
  locationOnly?: boolean;
};

/** Grouped so the page reads like a policy document, not a key/value dump. */
const GROUPS: { title: string; blurb: string; keys: SettingField[] }[] = [
  {
    title: "Matching",
    blurb: "How an instant booking finds its helper. The search stays open for a set time: available helpers are alerted as soon as they can take it, and anyone who has not answered is reminded until they accept, decline, or the search closes.",
    keys: [
      {
        key: "match_ignore_location",
        label: "Alert every helper, wherever they work",
        type: "boolean",
        help: "On: a booking goes to every available helper. Off: only helpers who cover that society are alerted.",
      },
      {
        key: "search_duration_seconds",
        label: "Keep searching for",
        suffix: "minutes — then it closes as no helper available",
        scale: 60,
      },
      {
        key: "renotify_interval_seconds",
        label: "Remind unanswered helpers every",
        suffix: "seconds — until they accept or decline",
      },
      {
        key: "accept_window_seconds",
        label: "Each alert rings for",
        suffix: "seconds — never longer than the reminder gap",
      },
      { key: "search_radius_km", label: "Starting radius", suffix: "km", locationOnly: true },
      { key: "radius_step_km", label: "Widen by, each reminder", suffix: "km", locationOnly: true },
      { key: "dispatch_batch_size", label: "New helpers alerted at a time", suffix: "nearest first", locationOnly: true },
    ],
  },
  {
    title: "Bookings for later",
    blurb: "A booking for a later slot has no countdown. Instead, every available helper is alerted in a few waves spread evenly between the booking and the slot — the customer just sees that a helper is being lined up.",
    keys: [
      {
        key: "scheduled_notify_waves",
        label: "Alert helpers in",
        suffix: "waves — spread evenly until the search closes (1–12)",
      },
      {
        key: "scheduled_close_minutes_before",
        label: "Stop searching",
        suffix: "minutes before the slot — then it closes as no helper available",
      },
    ],
  },
  {
    title: "Referrals",
    blurb: "Share a code, a friend joins, both get referral balance. Customers can only spend it on bookings, up to the share of each booking set below; helpers can only use it to pay what they owe the platform. It is never paid out as cash, and the platform covers every rupee of it.",
    keys: [
      {
        key: "referral_enabled",
        label: "Accept referral codes",
        type: "boolean",
        help: "Off: new sign-ups cannot enter a code. Balances already earned can still be used.",
      },
      { key: "referral_reward_amount", label: "Reward to the person who referred", suffix: "₹ per friend who joins" },
      { key: "referral_welcome_amount", label: "Reward to the friend who joins", suffix: "₹, once, on sign-up" },
      { key: "referral_apply_window_days", label: "A code can be entered within", suffix: "days of signing up" },
      {
        key: "referral_max_booking_percent",
        label: "Referral balance can pay at most",
        suffix: "% of a booking's total — the rest of the balance is kept for later",
      },
    ],
  },
  {
    title: "Money",
    blurb: "Applies to new bookings only — past bookings keep the rates they were created with.",
    keys: [
      { key: "platform_fee_percent", label: "Customer service fee", suffix: "%" },
      { key: "helper_commission_percent", label: "Helper commission", suffix: "%" },
      { key: "currency", label: "Currency", type: "text", help: "ISO code used on every bill and ledger entry." },
    ],
  },
  {
    title: "Completion & safety",
    blurb: "The handshakes that open and close a job, and the limits around them.",
    keys: [
      {
        key: "start_otp_enabled",
        label: "Ask for the customer's start code before a job starts",
        type: "boolean",
        help: "On: the customer gets a 4-digit code when a helper is assigned, and the helper must enter it at the door to start. Wrong tries use the same limit as the completion OTP.",
      },
      { key: "completion_otp_ttl_seconds", label: "Completion OTP validity", suffix: "seconds" },
      { key: "completion_otp_max_attempts", label: "OTP attempts allowed", suffix: "tries" },
      { key: "rejection_block_threshold", label: "Auto-block after rejections", suffix: "rejections" },
      { key: "overdue_reminder_minutes", label: "Flag a job as overdue after", suffix: "minutes" },
    ],
  },
];

type AuditLog = {
  _id: string; action: string; entity: string; reason?: string; createdAt: string;
  adminId?: { name: string; email: string } | null;
};

const toBool = (v: unknown) => v === true || v === "true" || v === 1 || v === "1";

/**
 * The matching settings read back as one sentence, so an admin can see what a
 * helper will actually experience before saving — the numbers interact, and a
 * ring longer than the reminder gap is quietly capped by the server.
 */
function MatchingSummary({ draft }: { draft: Settings }) {
  const duration = Number(draft.search_duration_seconds) || 0;
  const interval = Number(draft.renotify_interval_seconds) || 0;
  const ringSet = Number(draft.accept_window_seconds) || 0;
  if (!duration || !interval || !ringSet) return null;

  const ring = Math.min(ringSet, interval);
  const alerts = Math.max(1, Math.floor((duration - Math.min(15, ring)) / interval) + 1);
  const fmt = (secs: number) =>
    secs >= 60 && secs % 60 === 0 ? `${secs / 60} min` : secs >= 60 ? `${Math.floor(secs / 60)} min ${secs % 60} s` : `${secs} s`;

  return (
    <div className="mb-4 rounded-[10px] border border-forest-100 bg-forest-50 px-4 py-3 text-[13px] leading-relaxed text-forest-800">
      A booking searches for <b>{fmt(duration)}</b>. Each available helper hears it ring for{" "}
      <b>{fmt(ring)}</b>, and if they have not answered, again every <b>{fmt(interval)}</b> — up to{" "}
      <b>{alerts} alert{alerts === 1 ? "" : "s"}</b> before the search closes. Helpers who come online during
      the search are alerted within seconds.
      {ringSet > interval && (
        <span className="mt-1 block text-amber-ink">
          The ring is longer than the reminder gap, so it will be cut to {fmt(interval)}.
        </span>
      )}
    </div>
  );
}

/**
 * What a booking for later actually does with these numbers, worked through
 * for a slot three hours out — the waves are relative, so an example reads
 * better than a formula.
 */
function ScheduledSummary({ draft }: { draft: Settings }) {
  const waves = Math.min(12, Math.max(1, Math.round(Number(draft.scheduled_notify_waves) || 0)));
  const closeBefore = Math.max(0, Number(draft.scheduled_close_minutes_before) || 0);
  const duration = Number(draft.search_duration_seconds) || 0;
  const interval = Number(draft.renotify_interval_seconds) || 0;
  if (!Number(draft.scheduled_notify_waves)) return null;

  const exampleMinutes = 180;
  const window = exampleMinutes - closeBefore;
  // A slot too close for its waves is searched the instant way (see backend/src/lib/searchPlan.js).
  const minWindowMinutes = Math.max(duration, waves * interval) / 60;
  const gap = window / waves;
  const clock = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
  };

  return (
    <div className="mb-4 rounded-[10px] border border-forest-100 bg-forest-50 px-4 py-3 text-[13px] leading-relaxed text-forest-800">
      {window >= minWindowMinutes ? (
        <>
          Booked 3 hours ahead, the search runs for <b>{clock(window)}</b> and alerts every available helper{" "}
          <b>{waves} time{waves === 1 ? "" : "s"}</b>
          {waves > 1 && <> — once straight away, then about every <b>{clock(gap)}</b></>}. Helpers who have not
          answered hear it again in the next wave; nobody is reminded in between.
        </>
      ) : (
        <>With these numbers a booking 3 hours ahead is too close for waves, so it is searched like an instant booking.</>
      )}
      <span className="mt-1 block text-forest-700">
        Slots closer than {clock(Math.max(minWindowMinutes, 1) + closeBefore)} away always search like an instant booking.
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const { data, error, loading, reload } = useApi<{ settings: Settings }>("/api/admin/settings");

  const [draft, setDraft] = useState<Settings>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  // Bumped after a save, so the audit log below reloads with the new entry.
  const [auditVersion, setAuditVersion] = useState(0);

  useEffect(() => {
    if (data?.settings) setDraft(data.settings);
  }, [data]);

  const dirty = data?.settings
    ? Object.keys(draft).some((k) => String(draft[k]) !== String(data.settings[k]))
    : false;

  async function save() {
    setBusy(true);
    setSaveError("");
    try {
      const patch: Settings = {};
      for (const [k, v] of Object.entries(draft)) {
        if (String(v) !== String(data?.settings[k])) patch[k] = v;
      }
      await api("/api/admin/settings", { method: "PUT", body: patch });
      await reload();
      setAuditVersion((v) => v + 1);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Loading settings" />;
  if (error) return <ErrorNote>{error}</ErrorNote>;

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Business rules the backend reads on every booking."
        action={
          <div className="flex items-center gap-3">
            {saved && <Badge tone="green">Saved</Badge>}
            <Button disabled={!dirty || busy} onClick={save}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      />

      {saveError && <div className="mb-4"><ErrorNote>{saveError}</ErrorNote></div>}

      <div className="grid gap-5">
        {GROUPS.map((group) => (
          <Card key={group.title}>
            <SectionTitle title={group.title} />
            <p className="-mt-1 mb-4 text-[13px] text-ink-muted">{group.blurb}</p>
            {group.title === "Matching" && <MatchingSummary draft={draft} />}
            {group.title === "Bookings for later" && <ScheduledSummary draft={draft} />}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.keys.map(({ key, label, suffix, type, help, scale, locationOnly }) =>
                // Distance settings do nothing while every helper is alerted.
                locationOnly && toBool(draft.match_ignore_location) ? null :
                type === "boolean" ? (
                  <div key={key} className="sm:col-span-2 lg:col-span-3">
                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, [key]: !toBool(d[key]) }))}
                      className="flex w-full items-start gap-3 rounded-[10px] border border-line bg-sunken p-3 text-left transition hover:border-forest-300"
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
                          toBool(draft[key]) ? "bg-forest-600" : "bg-line-strong"
                        }`}
                      >
                        <span
                          className={`h-4 w-4 rounded-full bg-surface shadow transition ${
                            toBool(draft[key]) ? "translate-x-4" : ""
                          }`}
                        />
                      </span>
                      <span>
                        <span className="block text-[13px] font-medium text-ink">{label}</span>
                        {help && <span className="mt-0.5 block text-[12px] text-ink-muted">{help}</span>}
                      </span>
                    </button>
                  </div>
                ) : (
                  <Field key={key} label={label} hint={suffix ?? help}>
                    <Input
                      type={type === "text" ? "text" : "number"}
                      min={type === "text" ? undefined : scale ? 1 : 0}
                      value={
                        scale && draft[key] !== "" && draft[key] !== undefined
                          ? String(Number(draft[key]) / scale)
                          : String(draft[key] ?? "")
                      }
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          [key]: scale && e.target.value !== "" ? String(Number(e.target.value) * scale) : e.target.value,
                        }))
                      }
                    />
                  </Field>
                ),
              )}
            </div>
          </Card>
        ))}

        <AuditLogPanel key={auditVersion} />
      </div>
    </>
  );
}

/** Who changed what, filterable — the log grows with every approval, block and rate change. */
function AuditLogPanel() {
  const [f, setF] = useState({ q: "", action: "", entity: "", range: "", from: "", to: "", page: "1" });
  const set = (patch: Partial<typeof f>) => setF((prev) => ({ ...prev, ...patch, page: patch.page ?? "1" }));
  const options = useApi<FilterOptions>("/api/admin/filter-options");
  const audit = useApi<{ logs: AuditLog[]; total: number; page: number; pages: number }>(
    `/api/admin/audit?${apiQuery({ ...f, limit: "25" })}`,
  );
  const activeCount = [f.q, f.action, f.entity, f.range].filter(Boolean).length;

  return (
    <div>
      <SectionTitle title="Audit log" />
      <p className="-mt-1 mb-3 text-[13px] text-ink-muted">
        Approvals, rejections, blocks and rate changes — who did what, when and why.
      </p>

      <FilterBar
        activeCount={activeCount}
        onReset={() => setF({ q: "", action: "", entity: "", range: "", from: "", to: "", page: "1" })}
        summary={audit.data ? `${audit.data.total} entr${audit.data.total === 1 ? "y" : "ies"}` : undefined}
      >
        <SearchFilter value={f.q} onChange={(q) => set({ q })} placeholder="Reason, action or admin…" />
        <SelectFilter
          label="Action"
          value={f.action}
          onChange={(action) => set({ action })}
          options={[{ value: "", label: "Any" }, ...(options.data?.auditActions ?? []).map((a) => ({ value: a, label: titleCase(a) }))]}
        />
        <SelectFilter
          label="On"
          value={f.entity}
          onChange={(entity) => set({ entity })}
          options={[{ value: "", label: "Anything" }, ...(options.data?.auditEntities ?? []).map((e) => ({ value: e, label: e }))]}
        />
        <DateFilter label="When" range={f.range} from={f.from} to={f.to} onChange={set} />
      </FilterBar>

      <Card padded={false}>
        {audit.loading ? (
          <Spinner />
        ) : !audit.data?.logs.length ? (
          <EmptyState title={activeCount ? "Nothing matches" : "Nothing logged yet"} body={activeCount ? "Try clearing a filter." : undefined} />
        ) : (
          <Table head={["Action", "Entity", "Admin", "Reason", "When"]}>
            {audit.data.logs.map((l) => (
              <Row key={l._id}>
                <Cell className="font-medium">{titleCase(l.action)}</Cell>
                <Cell className="text-ink-soft">{l.entity}</Cell>
                <Cell className="text-ink-soft">{l.adminId?.name || "—"}</Cell>
                <Cell className="max-w-[280px] truncate text-[13px] text-ink-muted">{l.reason || "—"}</Cell>
                <Cell className="whitespace-nowrap text-[13px] text-ink-muted">{dateTime(l.createdAt)}</Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>

      {audit.data && (
        <Pagination page={audit.data.page} pages={audit.data.pages} total={audit.data.total} noun="entries" onPage={(p) => set({ page: String(p) })} />
      )}
    </div>
  );
}
