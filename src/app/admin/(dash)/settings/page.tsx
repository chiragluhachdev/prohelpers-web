"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { dateTime, titleCase } from "@/lib/format";
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
    blurb: "How a booking finds its helper. The search stays open for a set time: available helpers are alerted as soon as they can take it, and anyone who has not answered is reminded until they accept, decline, or the search closes.",
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
    title: "Scheduled Bookings",
    blurb: "Bookings scheduled hours or days away alert available helpers in spread-out waves until the slot.",
    keys: [
      { key: "scheduled_notify_waves", label: "Search waves", suffix: "waves", help: "How many times to alert available helpers before giving up (max 12)." },
      { key: "scheduled_close_minutes_before", label: "Close search", suffix: "minutes before slot", help: "So the assigned helper has time to prepare and travel." },
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
    blurb: "The handshake that closes a job, and the limits around it.",
    keys: [
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

export default function SettingsPage() {
  const { data, error, loading, reload } = useApi<{ settings: Settings }>("/api/admin/settings");
  const audit = useApi<{ logs: AuditLog[] }>("/api/admin/audit?limit=25");

  const [draft, setDraft] = useState<Settings>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

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
      await audit.reload();
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

        <Card padded={false}>
          <div className="px-5 pt-5">
            <SectionTitle title="Audit log" />
            <p className="-mt-1 mb-3 text-[13px] text-ink-muted">
              Approvals, rejections, blocks and rate changes — who did what, when and why.
            </p>
          </div>
          {audit.loading ? (
            <Spinner />
          ) : !audit.data?.logs.length ? (
            <EmptyState title="Nothing logged yet" />
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
      </div>
    </>
  );
}
