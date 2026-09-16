"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { rupees } from "@/lib/format";
import {
  Badge, Button, Card, Cell, EmptyState, ErrorNote, Field, Input,
  Modal, PageHeader, Row, SectionTitle, Select, SkeletonRows, Table, Textarea, Toggle,
} from "@/components/ui";

type Zone = {
  id: string;
  _id: string;
  code: string;
  name: string;
  description?: string;
  societies: string[];
  adjustType: "percent" | "flat" | "none";
  adjustValue: number;
  overrides: { serviceCode: string; price: number }[];
  active: boolean;
  rule: string;
  prices: { code: string; name: string; listPrice: number; price: number; source: "base" | "zone" | "override" }[];
};

type Society = { code: string; name: string; area: string; city: string; zone: string | null; taken: boolean };

type Payload = {
  zones: Zone[];
  services: { code: string; name: string; basePrice: number }[];
  societies: Society[];
};

type Draft = {
  code: string; name: string; description: string;
  adjustType: Zone["adjustType"]; adjustValue: string;
  societies: string[]; overrides: Record<string, string>; active: boolean;
};

const blank: Draft = {
  code: "", name: "", description: "", adjustType: "percent", adjustValue: "10",
  societies: [], overrides: {}, active: true,
};

const draftOf = (z: Zone): Draft => ({
  code: z.code, name: z.name, description: z.description || "",
  adjustType: z.adjustType, adjustValue: String(z.adjustValue ?? 0),
  societies: z.societies || [],
  overrides: Object.fromEntries((z.overrides || []).map((o) => [o.serviceCode, String(o.price)])),
  active: z.active,
});

/**
 * Locality pricing: a zone is a group of societies that pay the same prices —
 * one rule for everything, and an exact price where the rule does not fit.
 * Bookings keep the prices they were made with, so changing a zone only
 * affects new ones.
 */
export default function ZonesPage() {
  const { data, error, loading, reload } = useApi<Payload>("/api/admin/zones");
  const [editing, setEditing] = useState<Zone | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [preview, setPreview] = useState<Zone | null>(null);

  const startNew = () => { setEditing(null); setDraft({ ...blank }); setFormError(""); };
  const startEdit = (z: Zone) => { setEditing(z); setDraft(draftOf(z)); setFormError(""); };

  async function save() {
    if (!draft) return;
    setSaving(true);
    setFormError("");
    try {
      const body = {
        ...draft,
        adjustValue: Number(draft.adjustValue) || 0,
        overrides: Object.entries(draft.overrides)
          .filter(([, v]) => v !== "" && Number.isFinite(Number(v)))
          .map(([serviceCode, v]) => ({ serviceCode, price: Number(v) })),
      };
      if (editing) await api(`/api/admin/zones/${editing._id}`, { method: "PUT", body });
      else await api("/api/admin/zones", { method: "POST", body });
      setDraft(null);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "That did not save.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(z: Zone) {
    if (!confirm(`Remove ${z.name}? Its societies go back to catalog prices. Past bookings keep the prices they were made with.`)) return;
    await api(`/api/admin/zones/${z._id}`, { method: "DELETE" }).catch(() => {});
    await reload();
  }

  const zones = data?.zones ?? [];
  const services = data?.services ?? [];
  const societies = data?.societies ?? [];
  const unzoned = societies.filter((s) => !s.zone);

  /** The example price a rule produces, so the effect is visible before saving. */
  function previewPrice(base: number) {
    if (!draft) return base;
    const v = Number(draft.adjustValue) || 0;
    if (draft.adjustType === "percent") return Math.round(Math.max(0, base * (1 + v / 100)) * 100) / 100;
    if (draft.adjustType === "flat") return Math.round(Math.max(0, base + v) * 100) / 100;
    return base;
  }

  return (
    <>
      <PageHeader
        title="Locality pricing"
        subtitle="Societies grouped into zones, each with its own prices. A society in no zone pays the catalog price."
        action={<Button onClick={startNew}>New zone</Button>}
      />

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      {unzoned.length > 0 && (
        <div className="mb-4 rounded-[10px] border border-line bg-sunken/60 px-4 py-3 text-[13px] text-ink-soft">
          <span className="font-medium text-ink">At catalog prices:</span>{" "}
          {unzoned.map((s) => s.name).join(", ")}
        </div>
      )}

      <Card padded={false}>
        {loading && !data ? (
          <SkeletonRows rows={3} cols={4} />
        ) : zones.length === 0 ? (
          <EmptyState
            title="No zones yet"
            body="Every society pays the catalog price. Make a zone when one estate should pay more or less than the rest."
          />
        ) : (
          <Table head={["Zone", "Rule", "Societies", "Exact prices", ""]}>
            {zones.map((z) => (
              <Row key={z._id} onClick={() => setPreview(z)}>
                <Cell>
                  <p className="font-medium">{z.name}</p>
                  {z.description && <p className="text-xs text-ink-muted">{z.description}</p>}
                  {!z.active && <span className="mt-1 inline-block"><Badge tone="slate">Off</Badge></span>}
                </Cell>
                <Cell><Badge tone={z.adjustValue > 0 ? "amber" : z.adjustValue < 0 ? "green" : "slate"}>{z.rule}</Badge></Cell>
                <Cell className="text-[13px] text-ink-soft">
                  {(z.societies || []).map((c) => societies.find((s) => s.code === c)?.name || c).join(", ") || "—"}
                </Cell>
                <Cell className="tabular">{z.overrides?.length || 0}</Cell>
                <Cell className="text-right">
                  <span onClick={(e) => e.stopPropagation()} className="inline-flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => startEdit(z)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(z)}>Remove</Button>
                  </span>
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>

      {/* -------------------------------------------------- create / edit */}
      <Modal
        open={Boolean(draft)}
        title={editing ? `Edit ${editing.name}` : "New price zone"}
        subtitle="The rule applies to every service. Set an exact price below for the ones it does not fit."
        size="lg"
        onClose={() => setDraft(null)}
      >
        {draft && (
          <div className="grid gap-4">
            {formError && <ErrorNote>{formError}</ErrorNote>}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Premium estates" />
              </Field>
              <Field label="Code" hint="Used in records. Letters, numbers and underscores.">
                <Input
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                  placeholder="premium"
                />
              </Field>
              <Field label="Rule">
                <Select value={draft.adjustType} onChange={(e) => setDraft({ ...draft, adjustType: e.target.value as Draft["adjustType"] })}>
                  <option value="percent">A percentage of the catalog price</option>
                  <option value="flat">A flat amount per service</option>
                  <option value="none">No rule — only the exact prices below</option>
                </Select>
              </Field>
              {draft.adjustType !== "none" && (
                <Field
                  label={draft.adjustType === "percent" ? "Adjustment (%)" : "Adjustment (₹)"}
                  hint="Negative makes it cheaper, e.g. −5."
                >
                  <Input value={draft.adjustValue} onChange={(e) => setDraft({ ...draft, adjustValue: e.target.value })} />
                </Field>
              )}
              <Field label="Note" hint="For your own reference.">
                <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Field>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium text-ink">Societies in this zone</p>
              <div className="flex flex-wrap gap-2">
                {societies.map((sc) => {
                  const on = draft.societies.includes(sc.code);
                  const elsewhere = sc.zone && (!editing || sc.zone !== editing.name);
                  return (
                    <button
                      key={sc.code}
                      type="button"
                      disabled={Boolean(elsewhere) && !on}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          societies: on ? draft.societies.filter((c) => c !== sc.code) : [...draft.societies, sc.code],
                        })
                      }
                      className={`rounded-[9px] border px-3 py-1.5 text-[13px] transition-colors ${
                        on ? "border-forest-600 bg-forest-50 font-medium text-forest-800"
                          : elsewhere ? "cursor-not-allowed border-line bg-sunken text-ink-muted"
                          : "border-line-strong text-ink hover:bg-sunken"
                      }`}
                      title={elsewhere ? `Already priced by ${sc.zone}` : undefined}
                    >
                      {sc.name}
                      {elsewhere && <span className="ml-1.5 text-[11px]">· {sc.zone}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium text-ink">Prices in this zone</p>
              <div className="max-h-72 overflow-y-auto rounded-[10px] border border-line">
                <Table head={["Service", "Catalog", "Rule gives", "Exact price"]}>
                  {services.map((sv) => (
                    <Row key={sv.code}>
                      <Cell className="text-[13px]">{sv.name}</Cell>
                      <Cell className="tabular text-[13px] text-ink-muted">{rupees(sv.basePrice)}</Cell>
                      <Cell className="tabular text-[13px]">{rupees(previewPrice(sv.basePrice))}</Cell>
                      <Cell>
                        <Input
                          className="h-9 w-28"
                          placeholder="—"
                          value={draft.overrides[sv.code] ?? ""}
                          onChange={(e) =>
                            setDraft({ ...draft, overrides: { ...draft.overrides, [sv.code]: e.target.value } })
                          }
                        />
                      </Cell>
                    </Row>
                  ))}
                </Table>
              </div>
              <p className="mt-1.5 text-[12px] text-ink-muted">Leave blank to use the rule. An exact price always wins.</p>
            </div>

            <Toggle on={draft.active} onChange={(active) => setDraft({ ...draft, active })} label="In use" help="Off: these societies go back to catalog prices." />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
              <Button disabled={saving || !draft.name.trim() || !draft.code.trim()} onClick={save}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create zone"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ------------------------------------------------------- what it charges */}
      <Modal
        open={Boolean(preview)}
        title={preview?.name || "Zone"}
        subtitle={preview ? `${preview.rule} · ${(preview.societies || []).length} societ${(preview.societies || []).length === 1 ? "y" : "ies"}` : undefined}
        size="lg"
        onClose={() => setPreview(null)}
      >
        {preview && (
          <div className="grid gap-3">
            <SectionTitle title="What a customer here pays" />
            <div className="max-h-96 overflow-y-auto">
              <Table head={["Service", "Catalog", "Here", ""]}>
                {preview.prices.map((row) => (
                  <Row key={row.code}>
                    <Cell className="text-[13px]">{row.name}</Cell>
                    <Cell className="tabular text-[13px] text-ink-muted">{rupees(row.listPrice)}</Cell>
                    <Cell className="tabular text-[13px] font-medium">{rupees(row.price)}</Cell>
                    <Cell>
                      {row.source === "override" ? <Badge tone="sky">Exact price</Badge>
                        : row.source === "zone" ? <Badge tone="amber">{preview.rule}</Badge>
                        : <span className="text-[12px] text-ink-muted">Catalog</span>}
                    </Cell>
                  </Row>
                ))}
              </Table>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
