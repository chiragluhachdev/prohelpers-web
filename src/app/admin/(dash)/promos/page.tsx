"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { dateTime, rupees, shortDate } from "@/lib/format";
import {
  Badge, Button, Card, Cell, Detail, EmptyState, ErrorNote, Field, Input,
  Modal, PageHeader, Row, SectionTitle, Select, SkeletonRows, Table, Tabs, Textarea, Toggle,
} from "@/components/ui";

type Promo = {
  _id: string;
  code: string;
  description?: string;
  type: "FLAT" | "PERCENT";
  value: number;
  maxDiscount: number;
  minBill: number;
  startsAt?: string | null;
  endsAt?: string | null;
  maxUses: number;
  maxUsesPerCustomer: number;
  eligibility: "ALL" | "NEW" | "SELECTED";
  taskNumbers: number[];
  active: boolean;
  createdAt: string;
  usage: { used: number; reversed: number; discountGiven: number };
};

type Redemption = {
  id: string; amount: number; status: "APPLIED" | "REVERSED"; at: string;
  customer: { id: string; name: string; phone: string } | null;
  task: { id: string; code: string; status: string } | null;
};

type Draft = {
  code: string; description: string; type: "FLAT" | "PERCENT"; value: string;
  maxDiscount: string; minBill: string; startsAt: string; endsAt: string;
  maxUses: string; maxUsesPerCustomer: string; eligibility: "ALL" | "NEW" | "SELECTED";
  taskNumbers: number[]; active: boolean;
};

const blank: Draft = {
  code: "", description: "", type: "FLAT", value: "50",
  maxDiscount: "0", minBill: "0", startsAt: "", endsAt: "",
  maxUses: "0", maxUsesPerCustomer: "1", eligibility: "ALL", taskNumbers: [], active: true,
};

const forInput = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

const draftOf = (p: Promo): Draft => ({
  code: p.code, description: p.description || "", type: p.type, value: String(p.value),
  maxDiscount: String(p.maxDiscount || 0), minBill: String(p.minBill || 0),
  startsAt: forInput(p.startsAt), endsAt: forInput(p.endsAt),
  maxUses: String(p.maxUses || 0), maxUsesPerCustomer: String(p.maxUsesPerCustomer ?? 1),
  eligibility: p.eligibility, taskNumbers: p.taskNumbers || [], active: p.active,
});

/** "₹50 off", "10% off, up to ₹40" */
const discountText = (p: Pick<Promo, "type" | "value" | "maxDiscount">) =>
  p.type === "FLAT" ? `${rupees(p.value)} off` : `${p.value}% off${p.maxDiscount ? `, up to ${rupees(p.maxDiscount)}` : ""}`;

/** The rules in a sentence, the way they will actually be applied. */
function rulesText(p: Promo) {
  const bits: string[] = [];
  if (p.minBill > 0) bits.push(`bookings over ${rupees(p.minBill)}`);
  if (p.eligibility === "NEW") bits.push("customers who have never booked");
  if (p.eligibility === "SELECTED") bits.push("chosen customers");
  if (p.taskNumbers?.length) {
    bits.push(p.taskNumbers.map((n) => (n === 1 ? "first booking" : n === 2 ? "second booking" : `booking ${n}`)).join(" or "));
  }
  if (p.maxUsesPerCustomer > 0) bits.push(`${p.maxUsesPerCustomer} per customer`);
  if (p.maxUses > 0) bits.push(`${p.maxUses} in all`);
  return bits.length ? bits.join(" · ") : "Any booking, any customer";
}

/** UC-C32 — promo codes: the rules, and every use of them. */
export default function PromosPage() {
  const [tab, setTab] = useState<"all" | "active" | "paused">("all");
  const { data, error, loading, reload } = useApi<{ promos: Promo[] }>(
    `/api/admin/promos${tab === "all" ? "" : `?status=${tab}`}`,
  );

  const [editing, setEditing] = useState<Promo | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const detail = useApi<{ promo: Promo; redemptions: Redemption[] }>(open ? `/api/admin/promos/${open}` : null);

  const startNew = () => { setEditing(null); setDraft({ ...blank }); setFormError(""); };
  const startEdit = (p: Promo) => { setEditing(p); setDraft(draftOf(p)); setFormError(""); };

  async function save() {
    if (!draft) return;
    setSaving(true);
    setFormError("");
    try {
      const body = {
        ...draft,
        value: Number(draft.value),
        maxDiscount: Number(draft.maxDiscount),
        minBill: Number(draft.minBill),
        maxUses: Number(draft.maxUses),
        maxUsesPerCustomer: Number(draft.maxUsesPerCustomer),
        startsAt: draft.startsAt || null,
        endsAt: draft.endsAt || null,
      };
      if (editing) await api(`/api/admin/promos/${editing._id}`, { method: "PUT", body });
      else await api("/api/admin/promos", { method: "POST", body });
      setDraft(null);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "That did not save.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Promo) {
    if (!confirm(`Remove ${p.code}? Codes that have been used are paused instead, so their history stays.`)) return;
    await api(`/api/admin/promos/${p._id}`, { method: "DELETE" }).catch(() => {});
    await reload();
  }

  const promos = data?.promos ?? [];

  return (
    <>
      <PageHeader
        title="Promo codes"
        subtitle="Discounts the platform funds. Helpers are always paid in full — a code never comes out of their earnings."
        action={<Button onClick={startNew}>New code</Button>}
      />

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      <div className="mb-3">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: "all", label: "All", count: promos.length },
            { key: "active", label: "Running" },
            { key: "paused", label: "Paused" },
          ]}
        />
      </div>

      <Card padded={false}>
        {loading && !data ? (
          <SkeletonRows rows={4} cols={5} />
        ) : promos.length === 0 ? (
          <EmptyState title="No promo codes yet" body="A code can be a flat amount or a percentage, limited to a first booking, a minimum bill, or a number of uses." />
        ) : (
          <Table head={["Code", "Discount", "Rules", "Runs", "Used", ""]}>
            {promos.map((p) => (
              <Row key={p._id} onClick={() => setOpen(p._id)}>
                <Cell>
                  <p className="font-medium tracking-wide">{p.code}</p>
                  {p.description && <p className="text-xs text-ink-muted">{p.description}</p>}
                  {!p.active && <span className="mt-1 inline-block"><Badge tone="slate">Paused</Badge></span>}
                </Cell>
                <Cell className="whitespace-nowrap">{discountText(p)}</Cell>
                <Cell className="text-[13px] text-ink-soft">{rulesText(p)}</Cell>
                <Cell className="whitespace-nowrap text-[13px] text-ink-soft">
                  {p.startsAt || p.endsAt ? `${shortDate(p.startsAt) } → ${shortDate(p.endsAt)}` : "No end date"}
                </Cell>
                <Cell className="tabular whitespace-nowrap">
                  {p.usage.used}
                  {p.maxUses > 0 ? ` / ${p.maxUses}` : ""}
                  <span className="block text-xs text-ink-muted">{rupees(p.usage.discountGiven)} given</span>
                </Cell>
                <Cell className="text-right">
                  <span onClick={(e) => e.stopPropagation()} className="inline-flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => startEdit(p)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(p)}>Remove</Button>
                  </span>
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>

      {/* ------------------------------------------------- create / edit */}
      <Modal
        open={Boolean(draft)}
        title={editing ? `Edit ${editing.code}` : "New promo code"}
        subtitle="Every rule here is checked again when the booking is made, not just when the bill is previewed."
        size="lg"
        onClose={() => setDraft(null)}
      >
        {draft && (
          <div className="grid gap-4">
            {formError && <ErrorNote>{formError}</ErrorNote>}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Code">
                <Input
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                  placeholder="FIRST50"
                />
              </Field>
              <Field label="Description" hint="Shown to the customer on their bill.">
                <Input
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="₹50 off your first booking"
                />
              </Field>
              <Field label="Discount type">
                <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Draft["type"] })}>
                  <option value="FLAT">Flat amount</option>
                  <option value="PERCENT">Percentage</option>
                </Select>
              </Field>
              <Field label={draft.type === "FLAT" ? "Amount off (₹)" : "Percentage off (%)"}>
                <Input type="number" min={0} value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
              </Field>
              {draft.type === "PERCENT" && (
                <Field label="Up to (₹)" hint="0 for no cap.">
                  <Input type="number" min={0} value={draft.maxDiscount} onChange={(e) => setDraft({ ...draft, maxDiscount: e.target.value })} />
                </Field>
              )}
              <Field label="Minimum bill (₹)" hint="Services amount needed before it applies. 0 for any.">
                <Input type="number" min={0} value={draft.minBill} onChange={(e) => setDraft({ ...draft, minBill: e.target.value })} />
              </Field>
              <Field label="Starts on" hint="Leave blank to start at once.">
                <Input type="date" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} />
              </Field>
              <Field label="Ends on" hint="Leave blank for no end date.">
                <Input type="date" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} />
              </Field>
              <Field label="Maximum uses in all" hint="0 for unlimited.">
                <Input type="number" min={0} value={draft.maxUses} onChange={(e) => setDraft({ ...draft, maxUses: e.target.value })} />
              </Field>
              <Field label="Uses per customer" hint="0 for unlimited.">
                <Input type="number" min={0} value={draft.maxUsesPerCustomer} onChange={(e) => setDraft({ ...draft, maxUsesPerCustomer: e.target.value })} />
              </Field>
              <Field label="Who can use it">
                <Select
                  value={draft.eligibility}
                  onChange={(e) => setDraft({ ...draft, eligibility: e.target.value as Draft["eligibility"] })}
                >
                  <option value="ALL">Any customer</option>
                  <option value="NEW">Customers who have never booked</option>
                </Select>
              </Field>
              <Field label="Which booking" hint="Leave both off for any booking.">
                <div className="flex gap-2">
                  {[1, 2].map((n) => {
                    const on = draft.taskNumbers.includes(n);
                    return (
                      <Button
                        key={n}
                        type="button"
                        size="sm"
                        variant={on ? "primary" : "secondary"}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            taskNumbers: on ? draft.taskNumbers.filter((x) => x !== n) : [...draft.taskNumbers, n].sort(),
                          })
                        }
                      >
                        {n === 1 ? "First booking" : "Second booking"}
                      </Button>
                    );
                  })}
                </div>
              </Field>
            </div>

            <Toggle
              on={draft.active}
              onChange={(active) => setDraft({ ...draft, active })}
              label="Running"
              help="Paused codes stop working at once; their history stays."
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
              <Button disabled={saving || !draft.code.trim()} onClick={save}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create code"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* -------------------------------------------------------- usage */}
      <Modal
        open={Boolean(open)}
        title={detail.data?.promo?.code || "Promo code"}
        subtitle={detail.data?.promo ? rulesText(detail.data.promo as Promo) : undefined}
        size="lg"
        onClose={() => setOpen(null)}
      >
        {detail.loading ? (
          <SkeletonRows rows={3} cols={3} />
        ) : detail.data ? (
          <div className="grid gap-4">
            <dl>
              <Detail label="Discount" value={discountText(detail.data.promo)} />
              <Detail label="Runs" value={`${shortDate(detail.data.promo.startsAt)} → ${shortDate(detail.data.promo.endsAt)}`} />
              <Detail label="Used" value={`${detail.data.redemptions.filter((r) => r.status === "APPLIED").length} bookings`} mono />
              <Detail label="Given back" value={`${detail.data.redemptions.filter((r) => r.status === "REVERSED").length} cancelled bookings`} mono />
            </dl>

            <div>
              <SectionTitle title="Every use" />
              {detail.data.redemptions.length === 0 ? (
                <EmptyState title="Not used yet" />
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  <Table head={["Customer", "Booking", "Discount", "When"]}>
                    {detail.data.redemptions.map((r) => (
                      <Row key={r.id}>
                        <Cell>{r.customer?.name || "—"}</Cell>
                        <Cell className="tabular">
                          {r.task?.code || "—"}
                          {r.status === "REVERSED" && <span className="ml-2"><Badge tone="slate">Given back</Badge></span>}
                        </Cell>
                        <Cell className="tabular">{rupees(r.amount)}</Cell>
                        <Cell className="whitespace-nowrap text-[13px] text-ink-muted">{dateTime(r.at)}</Cell>
                      </Row>
                    ))}
                  </Table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <ErrorNote>Could not load this code.</ErrorNote>
        )}
      </Modal>
    </>
  );
}
