"use client";

import { Field, Input, Select } from "@/components/ui";

export type OptionType = "select" | "multiselect" | "number" | "boolean" | "text" | "textarea" | "time" | "date";

/** One service-specific question, exactly as the server stores it (backend/src/lib/serviceOptions.js). */
export type ServiceOption = {
  key: string;
  label: string;
  help?: string;
  placeholder?: string;
  type: OptionType;
  choices?: string[];
  choicePrices?: number[];
  choiceMinutes?: number[];
  unit?: string;
  min?: number | null;
  max?: number | null;
  step?: number;
  required?: boolean;
  defaultValue?: string | number | boolean | string[];
  pricePerUnit?: number;
  minutesPerUnit?: number;
};

export const OPTION_TYPES: { value: OptionType; label: string; hint: string }[] = [
  { value: "select", label: "One choice", hint: "Pick one from a list — each choice can add its own price and time." },
  { value: "multiselect", label: "Several choices", hint: "Tick any number — each ticked choice adds its price and time." },
  { value: "number", label: "Number", hint: "A count (people, rooms, pets) — price and time are per unit." },
  { value: "boolean", label: "Yes / no", hint: "A switch — the price and time apply when the answer is yes." },
  { value: "text", label: "Short text", hint: "A line of text, like where the car is parked." },
  { value: "textarea", label: "Long text", hint: "Notes and additional requirements." },
  { value: "time", label: "Time", hint: "A time of day, like when food should be ready." },
  { value: "date", label: "Date", hint: "A calendar date." },
];

export const blankOption = (): ServiceOption => ({
  key: "", label: "", type: "select",
  choices: ["", ""], choicePrices: [0, 0], choiceMinutes: [0, 0],
  required: false, defaultValue: "", pricePerUnit: 0, minutesPerUnit: 0,
});

const num = (v: string) => (v === "" ? 0 : Number(v));
const hasChoices = (t: OptionType) => t === "select" || t === "multiselect";

/** Grows the per-choice arrays so every choice has a price and a duration. */
function withAlignedChoices(o: ServiceOption): ServiceOption {
  const n = o.choices?.length ?? 0;
  const pad = <T,>(arr: T[] | undefined, fill: T) => Array.from({ length: n }, (_, i) => arr?.[i] ?? fill);
  return { ...o, choicePrices: pad(o.choicePrices, 0), choiceMinutes: pad(o.choiceMinutes, 0) };
}

/**
 * The question list for one service. Every part of a question the customer
 * sees — wording in both languages, how it is answered, what each answer adds
 * to the price and to the time — is set here; nothing about it is in the apps.
 */
export function QuestionEditor({
  options,
  onChange,
}: {
  options: ServiceOption[];
  onChange: (next: ServiceOption[]) => void;
}) {
  const patch = (i: number, p: Partial<ServiceOption>) =>
    onChange(options.map((o, idx) => (idx === i ? withAlignedChoices({ ...o, ...p }) : o)));
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {options.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-line-strong p-6 text-center">
          <p className="text-sm font-medium text-ink">No questions yet</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            Number of people, which meals, type of pet, how long — anything that changes the work or the price.
          </p>
        </div>
      ) : (
        options.map((raw, i) => {
          const o = withAlignedChoices(raw);
          const typeHint = OPTION_TYPES.find((t) => t.value === o.type)?.hint;
          return (
            <div key={i} className="rounded-[10px] border border-line bg-sunken p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
                  Question {i + 1}
                </span>
                <div className="flex items-center gap-3 text-[12px] font-medium">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="text-ink-soft hover:text-ink disabled:opacity-30">↑</button>
                  <button type="button" disabled={i === options.length - 1} onClick={() => move(i, 1)} className="text-ink-soft hover:text-ink disabled:opacity-30">↓</button>
                  <button
                    type="button"
                    onClick={() => onChange(options.filter((_, idx) => idx !== i))}
                    className="text-rose-ink hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Question" hint="What the customer reads">
                  <Input value={o.label ?? ""} placeholder="Number of people" onChange={(e) => patch(i, { label: e.target.value })} />
                </Field>
                <Field label="Answer type" hint={typeHint}>
                  <Select
                    value={o.type}
                    onChange={(e) => {
                      const type = e.target.value as OptionType;
                      patch(i, {
                        type,
                        defaultValue: type === "boolean" ? false : type === "number" ? 0 : type === "multiselect" ? [] : "",
                        choices: hasChoices(type) ? (o.choices?.length ? o.choices : ["", ""]) : [],
                      });
                    }}
                  >
                    {OPTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </Select>
                </Field>
                <Field label="Key" hint="Stored on the booking. Left empty, it is made from the question.">
                  <Input value={o.key ?? ""} placeholder="people" onChange={(e) => patch(i, { key: e.target.value })} />
                </Field>
              </div>

              <label className="mt-3 flex items-center gap-2 text-[13px] text-ink">
                <input type="checkbox" checked={Boolean(o.required)} onChange={(e) => patch(i, { required: e.target.checked })} />
                The customer must answer this
              </label>

              {/* ------------------------------------------------ choices */}
              {hasChoices(o.type) && (
                <div className="mt-3">
                  <div className="mb-1.5 grid grid-cols-[1fr_72px_72px_24px] gap-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
                    <span>Choice</span><span>+ ₹</span><span>+ min</span><span />
                  </div>
                  <div className="space-y-1.5">
                    {(o.choices ?? []).map((c, ci) => (
                      <div key={ci} className="grid grid-cols-[1fr_72px_72px_24px] items-center gap-2">
                        <Input
                          value={c}
                          placeholder={`Choice ${ci + 1}`}
                          onChange={(e) => patch(i, { choices: o.choices!.map((x, xi) => (xi === ci ? e.target.value : x)) })}
                        />
                        <Input
                          type="number" min={0}
                          value={String(o.choicePrices?.[ci] ?? 0)}
                          onChange={(e) => patch(i, { choicePrices: o.choicePrices!.map((x, xi) => (xi === ci ? num(e.target.value) : x)) })}
                        />
                        <Input
                          type="number" min={0}
                          value={String(o.choiceMinutes?.[ci] ?? 0)}
                          onChange={(e) => patch(i, { choiceMinutes: o.choiceMinutes!.map((x, xi) => (xi === ci ? num(e.target.value) : x)) })}
                        />
                        <button
                          type="button"
                          aria-label="Remove choice"
                          disabled={(o.choices?.length ?? 0) <= 2}
                          onClick={() =>
                            patch(i, {
                              choices: o.choices!.filter((_, xi) => xi !== ci),
                              choicePrices: o.choicePrices!.filter((_, xi) => xi !== ci),
                              choiceMinutes: o.choiceMinutes!.filter((_, xi) => xi !== ci),
                            })
                          }
                          className="text-[16px] leading-none text-ink-muted hover:text-rose-ink disabled:opacity-30"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => patch(i, { choices: [...(o.choices ?? []), ""] })}
                      className="text-[12.5px] font-medium text-forest-700 hover:underline"
                    >
                      + Add choice
                    </button>
                    {o.type === "select" && (
                      <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
                        Pre-selected
                        <Select
                          className="h-8 w-44"
                          value={String(o.defaultValue ?? "")}
                          onChange={(e) => patch(i, { defaultValue: e.target.value })}
                        >
                          <option value="">Nothing</option>
                          {(o.choices ?? []).filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
                        </Select>
                      </label>
                    )}
                  </div>
                  {o.type === "multiselect" && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label="₹ for each choice ticked" hint="On top of each choice's own price.">
                        <Input type="number" min={0} value={String(o.pricePerUnit ?? 0)} onChange={(e) => patch(i, { pricePerUnit: num(e.target.value) })} />
                      </Field>
                      <Field label="Minutes for each choice ticked">
                        <Input type="number" min={0} value={String(o.minutesPerUnit ?? 0)} onChange={(e) => patch(i, { minutesPerUnit: num(e.target.value) })} />
                      </Field>
                    </div>
                  )}
                </div>
              )}

              {/* ------------------------------------------------- number */}
              {o.type === "number" && (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Field label="Unit" hint="e.g. people">
                    <Input value={o.unit ?? ""} onChange={(e) => patch(i, { unit: e.target.value })} />
                  </Field>
                  <Field label="Starts at">
                    <Input type="number" value={String(o.defaultValue ?? 0)} onChange={(e) => patch(i, { defaultValue: num(e.target.value) })} />
                  </Field>
                  <Field label="Lowest">
                    <Input type="number" value={o.min == null ? "" : String(o.min)} onChange={(e) => patch(i, { min: e.target.value === "" ? null : Number(e.target.value) })} />
                  </Field>
                  <Field label="Highest">
                    <Input type="number" value={o.max == null ? "" : String(o.max)} onChange={(e) => patch(i, { max: e.target.value === "" ? null : Number(e.target.value) })} />
                  </Field>
                  <div />
                  <Field label="₹ per unit" hint="Added for every unit.">
                    <Input type="number" min={0} value={String(o.pricePerUnit ?? 0)} onChange={(e) => patch(i, { pricePerUnit: num(e.target.value) })} />
                  </Field>
                  <Field label="Minutes per unit" hint="Added to the job's duration.">
                    <Input type="number" min={0} value={String(o.minutesPerUnit ?? 0)} onChange={(e) => patch(i, { minutesPerUnit: num(e.target.value) })} />
                  </Field>
                </div>
              )}

              {/* ------------------------------------------------ yes / no */}
              {o.type === "boolean" && (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Field label="₹ when yes">
                    <Input type="number" min={0} value={String(o.pricePerUnit ?? 0)} onChange={(e) => patch(i, { pricePerUnit: num(e.target.value) })} />
                  </Field>
                  <Field label="Minutes when yes">
                    <Input type="number" min={0} value={String(o.minutesPerUnit ?? 0)} onChange={(e) => patch(i, { minutesPerUnit: num(e.target.value) })} />
                  </Field>
                  <Field label="Starts as">
                    <Select value={o.defaultValue ? "true" : "false"} onChange={(e) => patch(i, { defaultValue: e.target.value === "true" })}>
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </Select>
                  </Field>
                </div>
              )}

              {/* ------------------------------------------------- text */}
              {(o.type === "text" || o.type === "textarea") && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Example text" hint="Shown faintly in the empty box">
                    <Input value={o.placeholder ?? ""} onChange={(e) => patch(i, { placeholder: e.target.value })} />
                  </Field>
                </div>
              )}

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Help line" hint="Optional, under the question">
                  <Input value={o.help ?? ""} onChange={(e) => patch(i, { help: e.target.value })} />
                </Field>
              </div>
            </div>
          );
        })
      )}

      <button
        type="button"
        onClick={() => onChange([...options, blankOption()])}
        className="w-full rounded-[10px] border border-dashed border-line-strong py-2.5 text-[13px] font-medium text-forest-700 transition hover:border-forest-400 hover:bg-forest-50"
      >
        + Add question
      </button>
    </div>
  );
}
