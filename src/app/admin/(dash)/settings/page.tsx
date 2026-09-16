"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { dateTime, titleCase } from "@/lib/format";
import { apiQuery } from "@/lib/useFilters";
import { DateFilter, FilterBar, Pagination, SearchFilter, SelectFilter, type FilterOptions } from "@/components/filters";
import {
  Badge, Button, Card, Cell, Detail, EmptyState, ErrorNote, Field, Input,
  Modal, PageHeader, Row, SectionTitle, Spinner, Table,
} from "@/components/ui";

type Settings = Record<string, number | string | boolean>;

type SettingField = {
  key: string;
  label: string;
  suffix?: string;
  type?: "number" | "text" | "boolean" | "select";
  help?: string;
  /** For type "select". */
  choices?: { value: string; label: string }[];
  /** Stored value ÷ scale is what the admin edits — seconds shown as minutes, say. */
  scale?: number;
  /** Only shown while this boolean setting is on — a switched-off charge needs no amount. */
  dependsOn?: string;
};

/** Grouped so the page reads like a policy document, not a key/value dump. */
const GROUPS: { title: string; blurb: string; keys: SettingField[] }[] = [
  {
    title: "Matching",
    blurb: "How an instant booking finds its helper. The search stays open for a set time: available helpers are alerted as soon as they can take it, and anyone who has not answered is reminded until they accept, decline, or the search closes.",
    keys: [
      {
        key: "match_mode",
        label: "Send a booking to",
        type: "select",
        help: "Helpers choose the localities they work in from their app. \"Only that locality\" alerts just the helpers who picked the booking's locality.",
        choices: [
          { value: "anywhere", label: "Every available helper" },
          { value: "society", label: "Only helpers who work in that locality" },
        ],
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
      {
        key: "accept_after_ring_enabled",
        label: "Let a helper accept after their alert stopped ringing",
        type: "boolean",
        help: "Only while the search is still open. Off: a lapsed alert cannot be taken. Either way the phone's countdown decides nothing — the server does.",
      },
      { key: "dispatch_batch_size", label: "New helpers alerted at a time", suffix: "nearest first" },
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
      { key: "referral_reward_amount", label: "Reward to the person who referred", suffix: "₹ per friend who qualifies" },
      { key: "referral_welcome_amount", label: "Reward to the friend who joins", suffix: "₹, once they qualify" },
      { key: "partner_reward_amount", label: "Cashback to a referral partner", suffix: "₹ per person they sign up — guards, society staff" },
      {
        key: "referral_qualify_event", label: "A referral earns its reward when", type: "select",
        help: "Never for installing the app alone: the referred person has to actually use it.",
        choices: [
          { value: "COMPLETED", label: "Their first booking is completed" },
          { value: "SETTLED", label: "Their first booking is paid for" },
        ],
      },
      { key: "referral_apply_window_days", label: "A code can be entered within", suffix: "days of signing up" },
      {
        key: "referral_max_booking_percent",
        label: "Referral balance can pay at most",
        suffix: "% of a booking's total — the rest of the balance is kept for later",
      },
    ],
  },
  {
    title: "Pricing",
    blurb: "Every charge on the customer's bill, each with its own switch. The apps only show what the server works out from these — changes apply to new bookings, and past bookings keep the bill they were made with.",
    keys: [
      { key: "platform_fee_enabled", label: "Charge a platform fee", type: "boolean", help: "The customer's side of the commission. Taken on the services amount, after any discount or promo code." },
      {
        key: "platform_fee_type", label: "Platform fee is", type: "select", dependsOn: "platform_fee_enabled",
        choices: [
          { value: "percent", label: "A percentage of the booking" },
          { value: "flat", label: "A flat amount per booking" },
        ],
      },
      { key: "platform_fee_percent", label: "Platform fee", suffix: "% of services", dependsOn: "platform_fee_enabled" },
      { key: "platform_fee_flat", label: "Or, as a flat fee", suffix: "₹ per booking — used when the type above is flat", dependsOn: "platform_fee_enabled" },
      { key: "platform_fee_label", label: "Shown to customers as", type: "text", dependsOn: "platform_fee_enabled" },

      { key: "discount_enabled", label: "Give a discount", type: "boolean", help: "Taken off the services amount; the platform bears it — helpers are paid in full." },
      { key: "discount_percent", label: "Discount", suffix: "% of services", dependsOn: "discount_enabled" },
      { key: "discount_max", label: "Up to", suffix: "₹ per booking — 0 for no cap", dependsOn: "discount_enabled" },
      { key: "discount_min_order", label: "Only above", suffix: "₹ of services — 0 for every booking", dependsOn: "discount_enabled" },
      { key: "discount_label", label: "Shown to customers as", type: "text", dependsOn: "discount_enabled" },

      { key: "surcharge_enabled", label: "Add a special surcharge", type: "boolean", help: "A flat amount on top — for rush hours, festivals, or instant bookings." },
      { key: "surcharge_flat", label: "Surcharge", suffix: "₹ per booking", dependsOn: "surcharge_enabled" },
      {
        key: "surcharge_applies_to", label: "Applies to", type: "select", dependsOn: "surcharge_enabled",
        choices: [
          { value: "all", label: "Every booking" },
          { value: "instant", label: "Instant bookings only" },
          { value: "scheduled", label: "Bookings for later only" },
        ],
      },
      { key: "surcharge_label", label: "Shown to customers as", type: "text", dependsOn: "surcharge_enabled" },

      { key: "gst_enabled", label: "Charge GST", type: "boolean", help: "Added last, on the amount you choose below." },
      { key: "gst_percent", label: "GST rate", suffix: "%", dependsOn: "gst_enabled" },
      {
        key: "gst_base", label: "GST is charged on", type: "select", dependsOn: "gst_enabled",
        choices: [
          { value: "all", label: "The whole bill" },
          { value: "fees", label: "Platform fee and surcharge only" },
        ],
      },
      { key: "gst_label", label: "Shown to customers as", type: "text", dependsOn: "gst_enabled" },

      {
        key: "helper_commission_enabled", label: "Take a commission from helpers", type: "boolean",
        help: "The helper's side of the commission. Off (or 0) means the helper keeps the whole services amount.",
      },
      {
        key: "helper_commission_type", label: "Helper commission is", type: "select", dependsOn: "helper_commission_enabled",
        choices: [
          { value: "percent", label: "A percentage of the services amount" },
          { value: "flat", label: "A flat amount per booking" },
        ],
      },
      { key: "helper_commission_percent", label: "Helper commission", suffix: "% of services — kept by the platform", dependsOn: "helper_commission_enabled" },
      { key: "helper_commission_flat", label: "Or, as a flat commission", suffix: "₹ per booking", dependsOn: "helper_commission_enabled" },

      {
        key: "promo_enabled", label: "Accept promo codes", type: "boolean",
        help: "Codes are made on the Promo codes page. The platform funds every discount — helpers are always paid in full.",
      },
      {
        key: "online_payment_enabled", label: "Allow paying in the app", type: "boolean",
        help: "Off: customers pay their helper directly, and the helper confirms it.",
      },
      {
        key: "locality_uplift_to", label: "When a locality is priced higher, the extra goes to", type: "select",
        help: "Locality prices are set under Locality pricing. This decides who keeps the difference from the catalog price.",
        choices: [
          { value: "helper", label: "The helper (they are paid on the price charged)" },
          { value: "platform", label: "The platform (the helper is paid on the catalog price)" },
        ],
      },
      { key: "currency", label: "Currency", type: "text", help: "ISO code used on every bill and ledger entry." },
    ],
  },
  {
    title: "Starting & closing a job",
    blurb: "UC-C16 / UC-C17 — the handshakes that open and close a job. Codes are made and checked only by the server; the customer's completion OTP goes to their registered number and their app, never to the helper.",
    keys: [
      {
        key: "start_otp_enabled",
        label: "Ask for the customer's start code before a job starts",
        type: "boolean",
        help: "On: the customer gets a 4-digit code when a helper is assigned, and the helper must enter it at the door to start. Wrong tries use the same limit as the completion OTP.",
      },
      {
        key: "start_early_minutes",
        label: "A booking for later can be started from",
        suffix: "minutes before its slot (0 = any time)",
        help: "Instant bookings can always be started straight away.",
      },
      { key: "completion_otp_ttl_seconds", label: "Completion OTP stays valid for", suffix: "minutes", scale: 60 },
      { key: "completion_otp_max_attempts", label: "Wrong codes allowed per OTP", suffix: "tries — then a new code is needed" },
      { key: "completion_otp_resend_seconds", label: "Wait before sending a new OTP", suffix: "seconds" },
      {
        key: "completion_otp_max_sends",
        label: "OTPs one job can send in all",
        suffix: "codes",
        help: "A new code resets the wrong-try count, so this cap stops the limit being sidestepped by asking again and again.",
      },
    ],
  },
  {
    title: "Overdue jobs",
    blurb: "UC-C18 — a job still open well past its expected finish (its start, or its slot if not started, plus the booked duration). Both sides are reminded, admins are told, and it shows in Open tasks.",
    keys: [
      { key: "overdue_reminder_minutes", label: "Overdue this long after the expected finish", suffix: "minutes" },
      { key: "overdue_repeat_minutes", label: "Remind again every", suffix: "minutes (0 = remind once)" },
      { key: "overdue_max_reminders", label: "Stop reminding after", suffix: "reminders" },
    ],
  },
  {
    title: "Cancellation",
    blurb: "UC-C22 — who can cancel, and until when. Every cancellation records who, when, why, the status it was in, and what it did to money. Admins can cancel anything that isn't finished.",
    keys: [
      {
        key: "customer_cancel_until", label: "Customers can cancel", type: "select",
        choices: [
          { value: "SEARCHING", label: "Only while we are still finding a helper" },
          { value: "ACCEPTED", label: "Until the helper starts work" },
          { value: "IN_PROGRESS", label: "Until the job is being closed (even mid-job)" },
        ],
      },
      {
        key: "helper_cancel_enabled",
        label: "Helpers can drop a job they accepted",
        type: "boolean",
        help: "Only before starting it. It counts as a rejection towards the auto-block below.",
      },
      {
        key: "helper_cancel_min_minutes_before", label: "…but not closer to a booking-for-later's slot than",
        suffix: "minutes (0 = any time)", dependsOn: "helper_cancel_enabled",
      },
      {
        key: "helper_cancel_action", label: "When a helper drops a job", type: "select", dependsOn: "helper_cancel_enabled",
        choices: [
          { value: "research", label: "Find the customer another helper" },
          { value: "cancel", label: "Cancel the booking" },
        ],
      },
      {
        key: "auto_cancel_unstarted_hours", label: "System cancels a job not started this long after its slot",
        suffix: "hours (0 = never)",
      },
      {
        key: "auto_cancel_no_helper_hours", label: "System closes a search that found nobody, if not retried within",
        suffix: "hours (0 = never)",
      },
    ],
  },
  {
    title: "Rejections & blocking",
    blurb: "UC-C23 — every rejection is recorded. At the threshold the account is blocked at once, admins are notified, and only an admin can unblock it (which resets the count). 0 switches a rule off.",
    keys: [
      {
        key: "rejection_block_threshold", label: "Block a helper after",
        suffix: "rejections — declined requests and dropped jobs",
      },
      {
        key: "customer_rejection_block_threshold", label: "Block a customer after",
        suffix: "cancellations made after a helper was assigned",
      },
    ],
  },
];

type AuditLog = {
  _id: string; action: string; entity: string; entityId?: string; reason?: string; createdAt: string;
  adminId?: { name: string; email: string } | null;
  /** Where the change came from (UC-C46). */
  ip?: string; userAgent?: string; route?: string;
  before?: unknown; after?: unknown;
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
      A booking searches for <b>{fmt(duration)}</b>.{" "}
      {draft.match_mode === "society"
        ? "Only available helpers who work in the booking's locality are alerted."
        : "Every available helper offering the service is alerted, whatever locality they picked."}{" "}
      Each one hears it ring for{" "}
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
            {group.title === "Pricing" && <PricingPreview draft={draft} />}
            {group.title === "Bookings for later" && <ScheduledSummary draft={draft} />}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.keys.map(({ key, label, suffix, type, help, scale, dependsOn, choices }) =>
                // A switched-off charge needs no amount.
                dependsOn && !toBool(draft[dependsOn]) ? null :
                type === "select" ? (
                  <Field key={key} label={label} hint={help}>
                    <select
                      value={String(draft[key] ?? "")}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                      className="h-10 w-full rounded-[9px] border border-line-strong bg-surface px-2.5 text-sm text-ink focus:border-forest-500 focus:outline-none"
                    >
                      {(choices ?? []).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </Field>
                ) :
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
  const [openLog, setOpenLog] = useState<AuditLog | null>(null);
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
          <Table head={["Action", "Entity", "Admin", "Change", "From", "When"]}>
            {audit.data.logs.map((l) => (
              <Row key={l._id} onClick={() => setOpenLog(l)}>
                <Cell className="font-medium">{titleCase(l.action)}</Cell>
                <Cell className="text-ink-soft">
                  {l.entity}
                  {l.entityId && <p className="tabular text-[11px] text-ink-muted">{l.entityId}</p>}
                </Cell>
                <Cell className="text-ink-soft">{l.adminId?.name || "—"}</Cell>
                <Cell className="max-w-[260px] truncate text-[13px] text-ink-muted">{l.reason || changeSummary(l) || "—"}</Cell>
                <Cell className="text-[12px] text-ink-muted">
                  <p className="tabular">{l.ip || "—"}</p>
                  <p className="max-w-[160px] truncate">{deviceOf(l.userAgent)}</p>
                </Cell>
                <Cell className="whitespace-nowrap text-[13px] text-ink-muted">{dateTime(l.createdAt)}</Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>

      {audit.data && (
        <Pagination page={audit.data.page} pages={audit.data.pages} total={audit.data.total} noun="entries" onPage={(p) => set({ page: String(p) })} />
      )}

      {/* The whole record: what it was, what it became, and where the change came from. */}
      <Modal
        open={Boolean(openLog)}
        title={openLog ? titleCase(openLog.action) : "Audit entry"}
        subtitle={openLog ? `${openLog.entity}${openLog.entityId ? ` · ${openLog.entityId}` : ""} · ${dateTime(openLog.createdAt)}` : undefined}
        size="lg"
        onClose={() => setOpenLog(null)}
      >
        {openLog && (
          <div className="grid gap-3">
            <dl>
              <Detail label="Admin" value={openLog.adminId?.name || openLog.adminId?.email || "—"} />
              <Detail label="Reason" value={openLog.reason || "—"} />
              <Detail label="From" value={openLog.ip || "—"} mono />
              <Detail label="Device" value={openLog.userAgent || "—"} />
              <Detail label="Call" value={openLog.route || "—"} mono />
            </dl>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-[12px] font-medium uppercase tracking-[0.05em] text-ink-muted">Before</p>
                <pre className="max-h-64 overflow-auto rounded-[10px] border border-line bg-sunken/60 p-3 text-[12px] text-ink-soft">
                  {JSON.stringify(openLog.before ?? null, null, 2)}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-[12px] font-medium uppercase tracking-[0.05em] text-ink-muted">After</p>
                <pre className="max-h-64 overflow-auto rounded-[10px] border border-line bg-sunken/60 p-3 text-[12px] text-ink-soft">
                  {JSON.stringify(openLog.after ?? null, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** "Android", "iPhone", "Windows browser" — enough to tell one device from another. */
function deviceOf(ua?: string) {
  if (!ua) return "—";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad/i.test(ua)) return "iPhone or iPad";
  if (/mac os/i.test(ua)) return "Mac browser";
  if (/windows/i.test(ua)) return "Windows browser";
  return ua.slice(0, 40);
}

/** The gist of a change when no reason was given: the fields that actually moved. */
function changeSummary(l: AuditLog) {
  const before = (l.before ?? {}) as Record<string, unknown>;
  const after = (l.after ?? {}) as Record<string, unknown>;
  const keys = Object.keys(after).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  if (!keys.length) return "";
  return keys.slice(0, 3).map((k) => `${k}: ${JSON.stringify(after[k])}`).join(", ");
}

/**
 * What these switches do to a real bill, worked through for an example
 * booking — so an admin sees the customer's total before saving. It mirrors
 * the server's formula (backend/src/lib/pricing.js) for this preview only;
 * every real bill is still worked out by the server.
 */
function BillRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "border-t border-forest-100 pt-1.5 font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}

function PricingPreview({ draft }: { draft: Settings }) {
  const [services, setServices] = useState(500);
  const [instant, setInstant] = useState(true);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const on = (k: string) => toBool(draft[k]);
  const n = (k: string) => Number(draft[k]) || 0;
  const money = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  let discount = 0;
  if (on("discount_enabled") && services >= n("discount_min_order")) {
    discount = r2((services * n("discount_percent")) / 100);
    if (n("discount_max") > 0) discount = Math.min(discount, n("discount_max"));
  }
  const after = r2(services - discount);
  const fee = !on("platform_fee_enabled")
    ? 0
    : draft.platform_fee_type === "flat"
      ? r2(n("platform_fee_flat"))
      : r2((after * n("platform_fee_percent")) / 100);
  const appliesTo = String(draft.surcharge_applies_to || "all");
  const surcharge = on("surcharge_enabled") && (appliesTo === "all" || appliesTo === (instant ? "instant" : "scheduled")) ? r2(n("surcharge_flat")) : 0;
  const taxable = draft.gst_base === "fees" ? r2(fee + surcharge) : r2(after + fee + surcharge);
  const gst = on("gst_enabled") ? r2((taxable * n("gst_percent")) / 100) : 0;
  const total = r2(after + fee + surcharge + gst);
  const commission = !on("helper_commission_enabled")
    ? 0
    : draft.helper_commission_type === "flat"
      ? r2(Math.min(n("helper_commission_flat"), services))
      : r2((services * n("helper_commission_percent")) / 100);

  return (
    <div className="mb-4 rounded-[10px] border border-forest-100 bg-forest-50 px-4 py-3 text-[13px] leading-relaxed text-forest-800">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span>For a booking whose services come to</span>
        <input
          type="number"
          min={0}
          value={services}
          onChange={(e) => setServices(Math.max(0, Number(e.target.value) || 0))}
          className="h-7 w-24 rounded-[7px] border border-forest-200 bg-surface px-2 text-[13px] text-ink"
        />
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={instant} onChange={(e) => setInstant(e.target.checked)} />
          instant booking
        </label>
        <span>, the customer sees:</span>
      </div>
      <div className="max-w-sm space-y-0.5">
        <BillRow label="Service amount" value={money(services)} />
        {discount > 0 && <BillRow label={String(draft.discount_label || "Discount")} value={`− ${money(discount)}`} />}
        {fee > 0 && (
          <BillRow
            label={`${draft.platform_fee_label || "Platform fee"}${draft.platform_fee_type === "flat" ? "" : ` (${n("platform_fee_percent")}%)`}`}
            value={money(fee)}
          />
        )}
        {surcharge > 0 && <BillRow label={String(draft.surcharge_label || "Special surcharge")} value={money(surcharge)} />}
        {gst > 0 && <BillRow label={`${draft.gst_label || "GST"} (${n("gst_percent")}%)`} value={money(gst)} />}
        <BillRow label="Final payable" value={money(total)} strong />
      </div>
      <p className="mt-2 text-[12px] text-forest-700">
        The helper earns {money(r2(services - commission))}
        {commission > 0
          ? ` (${draft.helper_commission_type === "flat" ? `${money(commission)} flat` : `${n("helper_commission_percent")}%`} commission on the services amount).`
          : " — no commission is taken."}
      </p>
    </div>
  );
}
