"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { rupees } from "@/lib/format";
import {
  Badge, Button, Card, Cell, EmptyState, ErrorNote, Field, Input,
  Modal, PageHeader, Row, SectionTitle, Spinner, Table, Textarea,
  SkeletonRows,
} from "@/components/ui";

type Service = {
  _id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  basePrice: number;
  durationLabel: string;
  defaultDurationMins: number;
  sortOrder: number;
  active: boolean;
};

type Draft = Partial<Service> & { code?: string };

export default function ServicesPage() {
  const { data, error, loading, reload } = useApi<{ services: Service[] }>("/api/admin/services");

  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [busy, setBusy] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (editing) setDraft({ ...editing });
  }, [editing]);

  const closeForm = () => {
    setEditing(null);
    setCreating(false);
    setDraft({});
    setFormError("");
  };

  async function save() {
    setBusy("save");
    setFormError("");
    try {
      if (creating) {
        await api("/api/admin/services", { method: "POST", body: draft });
      } else if (editing) {
        await api(`/api/admin/services/${editing.code}`, { method: "PATCH", body: draft });
      }
      await reload();
      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy("");
    }
  }

  async function toggleActive(s: Service) {
    setBusy(s.code);
    try {
      await api(`/api/admin/services/${s.code}`, { method: "PATCH", body: { active: !s.active } });
      await reload();
    } finally {
      setBusy("");
    }
  }

  const services = data?.services ?? [];
  const liveCount = services.filter((s) => s.active).length;

  return (
    <>
      <PageHeader
        title="Services"
        subtitle="The catalog both apps read. Edits go live on the next screen the customer opens — no app release needed."
        action={
          <Button
            onClick={() => {
              setCreating(true);
              setDraft({ icon: "🧹", category: "Cleaning", durationLabel: "1 - 2 hours", defaultDurationMins: 90 });
            }}
          >
            Add service
          </Button>
        }
      />

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="green">{liveCount} bookable</Badge>
        {services.length - liveCount > 0 && (
          <Badge tone="slate">{services.length - liveCount} retired</Badge>
        )}
      </div>

      <Card padded={false}>
        {loading ? (
          <SkeletonRows rows={6} cols={6} />
        ) : services.length === 0 ? (
          <EmptyState title="No services yet" body="Add the first service customers can book." />
        ) : (
          <Table head={["Service", "Code", "Price", "Duration", "Status", ""]}>
            {services.map((s) => (
              <Row key={s.code}>
                <Cell>
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-sunken text-lg">
                      {s.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{s.name}</p>
                      <p className="line-clamp-1 text-xs text-ink-muted">{s.description || s.category}</p>
                    </div>
                  </div>
                </Cell>
                <Cell>
                  <code className="rounded bg-sunken px-1.5 py-0.5 text-[12px] text-ink-soft">{s.code}</code>
                </Cell>
                <Cell className="tabular whitespace-nowrap font-semibold">{rupees(s.basePrice)}</Cell>
                <Cell className="whitespace-nowrap text-[13px] text-ink-soft">{s.durationLabel}</Cell>
                <Cell>
                  <Badge tone={s.active ? "green" : "slate"}>{s.active ? "Bookable" : "Retired"}</Badge>
                </Cell>
                <Cell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(s)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy === s.code}
                      onClick={() => toggleActive(s)}
                    >
                      {s.active ? "Retire" : "Restore"}
                    </Button>
                  </div>
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>

      <p className="mt-4 text-xs leading-relaxed text-ink-muted">
        Retiring a service hides it from new bookings. Past bookings keep the name and price they were
        created with, so historical revenue never changes retrospectively.
      </p>

      {/* ------------------------------------------------------------ form */}
      <Modal
        open={Boolean(editing) || creating}
        title={creating ? "Add a service" : `Edit ${editing?.name ?? ""}`}
        onClose={closeForm}
      >
        <div className="grid gap-4">
          {formError && <ErrorNote>{formError}</ErrorNote>}

          <div className="grid grid-cols-[64px_1fr] gap-3">
            <Field label="Icon">
              <Input
                value={draft.icon ?? ""}
                maxLength={2}
                className="text-center text-lg"
                onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}
              />
            </Field>
            <Field label="Name">
              <Input
                value={draft.name ?? ""}
                placeholder="Full Home Cleaning"
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </Field>
          </div>

          {creating && (
            <Field label="Code" hint="Used by the app to identify this service. Cannot be changed later.">
              <Input
                value={draft.code ?? ""}
                placeholder="full_home"
                onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
              />
            </Field>
          )}

          <Field label="Description">
            <Textarea
              rows={2}
              value={draft.description ?? ""}
              placeholder="What the customer gets for this price."
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price" hint="Before fees, GST and surcharge.">
              <Input
                type="number"
                value={String(draft.basePrice ?? "")}
                onChange={(e) => setDraft((d) => ({ ...d, basePrice: Number(e.target.value) }))}
              />
            </Field>
            <Field label="Duration shown" hint="e.g. 2 - 4 hours">
              <Input
                value={draft.durationLabel ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, durationLabel: e.target.value }))}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Slot length" hint="Minutes held in the helper's day.">
              <Input
                type="number"
                value={String(draft.defaultDurationMins ?? "")}
                onChange={(e) => setDraft((d) => ({ ...d, defaultDurationMins: Number(e.target.value) }))}
              />
            </Field>
            <Field label="Category">
              <Input
                value={draft.category ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={closeForm}>Cancel</Button>
            <Button disabled={busy === "save"} onClick={save}>
              {busy === "save" ? "Saving…" : creating ? "Add service" : "Save changes"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
