"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { rupees, titleCase } from "@/lib/format";
import { FilterBar, SearchFilter, SelectFilter } from "@/components/filters";
import {
  Badge, Button, Card, Cell, EmptyState, ErrorNote, Field, Input,
  Modal, PageHeader, Row, Select, SkeletonRows, Table, Textarea, Toggle,
} from "@/components/ui";

export type ServiceOption = {
  key: string;
  label: string;
  type: "number" | "text" | "select" | "boolean";
  choices?: string[];
  unit?: string;
  required?: boolean;
  defaultValue?: string | number | boolean;
  pricePerUnit?: number;
};

type Service = {
  _id: string;
  options?: ServiceOption[];
  optionsEnabled?: boolean;
  code: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  basePrice: number;
  inclusions?: string[];
  nameHi?: string;
  descriptionHi?: string;
  durationLabelHi?: string;
  inclusionsHi?: string[];
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

  /* The questions live in their own dialog: they are a list with their own
     rules, not another field on the service form. */
  const [optionsFor, setOptionsFor] = useState<Service | null>(null);
  const [optDraft, setOptDraft] = useState<ServiceOption[]>([]);
  const [optEnabled, setOptEnabled] = useState(false);
  const [optError, setOptError] = useState("");

  useEffect(() => {
    if (optionsFor) {
      setOptDraft((optionsFor.options ?? []).map((o) => ({ ...o })));
      setOptEnabled(Boolean(optionsFor.optionsEnabled));
      setOptError("");
    }
  }, [optionsFor]);

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

  const patchOption = (i: number, patch: Partial<ServiceOption>) =>
    setOptDraft((list) => list.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  async function saveOptions() {
    if (!optionsFor) return;
    setBusy("options");
    setOptError("");
    try {
      await api(`/api/admin/services/${optionsFor.code}`, {
        method: "PATCH",
        body: { options: optDraft, optionsEnabled: optEnabled },
      });
      await reload();
      setOptionsFor(null);
    } catch (err) {
      setOptError(err instanceof Error ? err.message : "Could not save.");
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

  const allServices = data?.services ?? [];
  const liveCount = allServices.filter((s) => s.active).length;

  // A handful of services, so they are filtered right here rather than on the server.
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [questions, setQuestions] = useState("");
  const [sort, setSort] = useState("order");
  const categories = [...new Set(allServices.map((s) => s.category).filter(Boolean))].sort();
  const needle = q.toLowerCase();
  const services = allServices
    .filter((s) =>
      !needle ||
      [s.name, s.nameHi, s.code, s.description].some((v) => String(v || "").toLowerCase().includes(needle)),
    )
    .filter((s) => (status === "live" ? s.active : status === "retired" ? !s.active : true))
    .filter((s) => !category || s.category === category)
    .filter((s) => (questions === "on" ? s.optionsEnabled : questions === "off" ? !s.optionsEnabled : true))
    .sort((a, b) =>
      sort === "priceLow" ? a.basePrice - b.basePrice
        : sort === "priceHigh" ? b.basePrice - a.basePrice
          : sort === "name" ? a.name.localeCompare(b.name)
            : (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
  const activeFilters = [q, status, category, questions].filter(Boolean).length;

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

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone="green">{liveCount} bookable</Badge>
        {allServices.length - liveCount > 0 && (
          <Badge tone="slate">{allServices.length - liveCount} retired</Badge>
        )}
      </div>

      <FilterBar
        activeCount={activeFilters}
        onReset={() => { setQ(""); setStatus(""); setCategory(""); setQuestions(""); }}
        summary={`${services.length} of ${allServices.length}`}
      >
        <SearchFilter value={q} onChange={setQ} placeholder="Name, code or description…" />
        <SelectFilter
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: "Any" },
            { value: "live", label: "Bookable" },
            { value: "retired", label: "Retired" },
          ]}
        />
        {categories.length > 1 && (
          <SelectFilter
            label="Category"
            value={category}
            onChange={setCategory}
            options={[{ value: "", label: "Any" }, ...categories.map((c) => ({ value: c, label: titleCase(c) }))]}
          />
        )}
        <SelectFilter
          label="Questions"
          value={questions}
          onChange={setQuestions}
          options={[
            { value: "", label: "Any" },
            { value: "on", label: "Switched on" },
            { value: "off", label: "Switched off" },
          ]}
        />
        <SelectFilter
          label="Sort"
          value={sort}
          neutral="order"
          onChange={setSort}
          options={[
            { value: "order", label: "Display order" },
            { value: "name", label: "Name A–Z" },
            { value: "priceLow", label: "Price: low to high" },
            { value: "priceHigh", label: "Price: high to low" },
          ]}
        />
      </FilterBar>

      <Card padded={false}>
        {loading ? (
          <SkeletonRows rows={6} cols={6} />
        ) : services.length === 0 ? (
          allServices.length === 0 ? (
            <EmptyState title="No services yet" body="Add the first service customers can book." />
          ) : (
            <EmptyState title="No services match" body="Try clearing a filter." />
          )
        ) : (
          <Table head={["Service", "Code", "Price", "Duration", "Questions", "Status", ""]}>
            {services.map((s) => (
              <Row key={s.code}>
                <Cell>
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-sunken text-lg">
                      {s.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">
                        {s.name}
                        {!s.nameHi && (
                          <span className="ml-2 align-middle text-[11px] font-medium text-amber-ink">No Hindi</span>
                        )}
                      </p>
                      {s.nameHi && <p lang="hi" className="text-[12px] text-ink-soft">{s.nameHi}</p>}
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
                  {s.optionsEnabled ? (
                    <Badge tone="sky">{(s.options ?? []).length} asked</Badge>
                  ) : (s.options ?? []).length ? (
                    <Badge tone="slate">{(s.options ?? []).length} off</Badge>
                  ) : (
                    <span className="text-[13px] text-ink-muted">—</span>
                  )}
                </Cell>
                <Cell>
                  <Badge tone={s.active ? "green" : "slate"}>{s.active ? "Bookable" : "Retired"}</Badge>
                </Cell>
                <Cell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(s)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setOptionsFor(s)}>
                      Questions
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

      {/* ------------------------------------------------------- questions */}
      <Modal
        open={Boolean(optionsFor)}
        size="lg"
        title={`Questions for ${optionsFor?.name ?? ""}`}
        subtitle="Asked at checkout under “Customise your booking”. A question with a price adds to the bill the moment the customer answers it."
        onClose={() => setOptionsFor(null)}
      >
        <div className="mb-4">
          <Toggle
            on={optEnabled}
            onChange={setOptEnabled}
            label="Ask these at checkout"
            help={
              optDraft.length === 0
                ? "Add a question first — there is nothing to ask yet."
                : "Off by default. While it is off the questions are kept but never shown, and nothing they price is charged."
            }
          />
        </div>

        <div className="max-h-[46vh] space-y-3 overflow-y-auto pr-1">
          {optDraft.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-line-strong p-6 text-center">
              <p className="text-sm font-medium text-ink">No questions yet</p>
              <p className="mt-1 text-[13px] text-ink-muted">
                Room size, extra bathrooms, a balcony — anything that changes the work or the price.
              </p>
            </div>
          ) : (
            optDraft.map((o, i) => (
              <div key={i} className="rounded-[10px] border border-line bg-sunken p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
                    Question {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOptDraft((list) => list.filter((_, idx) => idx !== i))}
                    className="text-[12px] font-medium text-rose-ink hover:underline"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Label" hint="What the customer reads">
                    <Input
                      value={o.label ?? ""}
                      placeholder="How much is there?"
                      onChange={(e) => patchOption(i, { label: e.target.value })}
                    />
                  </Field>
                  <Field label="Key" hint="Stored on the booking. Letters, digits, underscores.">
                    <Input
                      value={o.key ?? ""}
                      placeholder="load"
                      onChange={(e) => patchOption(i, { key: e.target.value })}
                    />
                  </Field>
                  <Field label="Type">
                    <Select
                      value={o.type}
                      onChange={(e) =>
                        patchOption(i, {
                          type: e.target.value as ServiceOption["type"],
                          defaultValue: e.target.value === "boolean" ? false : e.target.value === "number" ? 0 : "",
                        })
                      }
                    >
                      <option value="select">Choice</option>
                      <option value="number">Number</option>
                      <option value="boolean">Yes / no</option>
                      <option value="text">Free text</option>
                    </Select>
                  </Field>
                  <Field label="Price per unit" hint="₹ added per unit. Leave 0 for free.">
                    <Input
                      type="number"
                      value={String(o.pricePerUnit ?? 0)}
                      onChange={(e) => patchOption(i, { pricePerUnit: Number(e.target.value) })}
                    />
                  </Field>

                  {o.type === "select" && (
                    <div className="sm:col-span-2">
                      <Field label="Choices" hint="Comma separated — at least two.">
                        <Input
                          value={(o.choices ?? []).join(", ")}
                          placeholder="Light, Medium, Heavy"
                          onChange={(e) =>
                            patchOption(i, { choices: e.target.value.split(",").map((c) => c.trim()) })
                          }
                        />
                      </Field>
                    </div>
                  )}

                  {o.type === "number" && (
                    <Field label="Unit" hint="Shown next to the price, e.g. “bathrooms”.">
                      <Input
                        value={o.unit ?? ""}
                        placeholder="bathrooms"
                        onChange={(e) => patchOption(i, { unit: e.target.value })}
                      />
                    </Field>
                  )}

                  <Field label="Default answer">
                    {o.type === "boolean" ? (
                      <Select
                        value={o.defaultValue ? "true" : "false"}
                        onChange={(e) => patchOption(i, { defaultValue: e.target.value === "true" })}
                      >
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </Select>
                    ) : o.type === "select" ? (
                      <Select
                        value={String(o.defaultValue ?? "")}
                        onChange={(e) => patchOption(i, { defaultValue: e.target.value })}
                      >
                        {(o.choices ?? []).filter(Boolean).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        type={o.type === "number" ? "number" : "text"}
                        value={String(o.defaultValue ?? "")}
                        onChange={(e) =>
                          patchOption(i, {
                            defaultValue: o.type === "number" ? Number(e.target.value) : e.target.value,
                          })
                        }
                      />
                    )}
                  </Field>
                </div>
              </div>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            setOptDraft((list) => [
              ...list,
              { key: "", label: "", type: "select", choices: ["", ""], defaultValue: "", pricePerUnit: 0 },
            ])
          }
          className="mt-3 w-full rounded-[10px] border border-dashed border-line-strong py-2.5 text-[13px] font-medium text-forest-700 transition hover:border-forest-400 hover:bg-forest-50"
        >
          + Add question
        </button>

        {optError && <div className="mt-3"><ErrorNote>{optError}</ErrorNote></div>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOptionsFor(null)}>Cancel</Button>
          <Button disabled={busy === "options"} onClick={saveOptions}>
            {busy === "options" ? "Saving…" : "Save questions"}
          </Button>
        </div>
      </Modal>

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

          <Field
            label="What's included"
            hint="One line per item — this is the checklist the customer reads before booking."
          >
            <Textarea
              rows={6}
              value={(draft.inclusions ?? []).join("\n")}
              onChange={(e) =>
                setDraft((d) => ({ ...d, inclusions: e.target.value.split("\n") }))
              }
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

          {/* Hindi copy. Anything left empty falls back to the English above. */}
          <div className="rounded-[10px] border border-line bg-sunken p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-ink">हिंदी · Hindi</p>
              <span className="text-[12px] text-ink-muted">Shown when the app is set to Hindi</span>
            </div>
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name in Hindi" hint={draft.name ? `English: ${draft.name}` : undefined}>
                  <Input
                    lang="hi"
                    value={draft.nameHi ?? ""}
                    placeholder="जैसे: किचन की सफ़ाई"
                    onChange={(e) => setDraft((d) => ({ ...d, nameHi: e.target.value }))}
                  />
                </Field>
                <Field label="Duration in Hindi" hint={draft.durationLabel ? `English: ${draft.durationLabel}` : undefined}>
                  <Input
                    lang="hi"
                    value={draft.durationLabelHi ?? ""}
                    placeholder="जैसे: 1 - 2 घंटे"
                    onChange={(e) => setDraft((d) => ({ ...d, durationLabelHi: e.target.value }))}
                  />
                </Field>
              </div>
              <Field label="Description in Hindi">
                <Textarea
                  lang="hi"
                  rows={2}
                  value={draft.descriptionHi ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, descriptionHi: e.target.value }))}
                />
              </Field>
              <Field label="What's included, in Hindi" hint="One line per item, in the same order as the English list.">
                <Textarea
                  lang="hi"
                  rows={5}
                  value={(draft.inclusionsHi ?? []).join("\n")}
                  onChange={(e) => setDraft((d) => ({ ...d, inclusionsHi: e.target.value.split("\n") }))}
                />
              </Field>
            </div>
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
