"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { dateTime, titleCase } from "@/lib/format";
import {
  Badge, Button, Card, Cell, EmptyState, ErrorNote, Field, Input,
  PageHeader, Row, SectionTitle, Spinner, Table,
} from "@/components/ui";

type Settings = Record<string, number | string>;

/** Grouped so the page reads like a policy document, not a key/value dump. */
const GROUPS: { title: string; blurb: string; keys: { key: string; label: string; suffix?: string }[] }[] = [
  {
    title: "Matching",
    blurb: "How far the search reaches and how long a helper has to answer.",
    keys: [
      { key: "search_radius_km", label: "Initial search radius", suffix: "km" },
      { key: "radius_step_km", label: "Widen radius each round by", suffix: "km" },
      { key: "max_dispatch_rounds", label: "Maximum rounds", suffix: "rounds" },
      { key: "dispatch_batch_size", label: "Helpers alerted per round", suffix: "helpers" },
      { key: "accept_window_seconds", label: "Accept window", suffix: "seconds" },
    ],
  },
  {
    title: "Money",
    blurb: "Applies to new bookings only — past bookings keep the rates they were created with.",
    keys: [
      { key: "platform_fee_percent", label: "Customer service fee", suffix: "%" },
      { key: "helper_commission_percent", label: "Helper commission", suffix: "%" },
      { key: "gst_percent", label: "GST", suffix: "%" },
      { key: "surcharge_flat", label: "Flat surcharge", suffix: "₹" },
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.keys.map(({ key, label, suffix }) => (
                <Field key={key} label={label} hint={suffix}>
                  <Input
                    type="number"
                    value={String(draft[key] ?? "")}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  />
                </Field>
              ))}
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
