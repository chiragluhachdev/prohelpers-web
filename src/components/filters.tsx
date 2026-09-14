"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import { RANGE_OPTIONS } from "@/lib/useFilters";

/**
 * The strip of filters above a list. Everything in it applies immediately;
 * "Clear" appears only once something is actually filtered.
 */
export function FilterBar({
  children,
  activeCount = 0,
  onReset,
  summary,
}: {
  children: React.ReactNode;
  activeCount?: number;
  onReset?: () => void;
  /** e.g. "24 bookings" — what the filters currently match. */
  summary?: React.ReactNode;
}) {
  return (
    <div className="mb-4 rounded-[12px] border border-line bg-surface p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <div className="ml-auto flex items-center gap-2 pl-1">
          {summary != null && <span className="whitespace-nowrap text-[12.5px] text-ink-muted">{summary}</span>}
          {activeCount > 0 && onReset && (
            <Button size="sm" variant="ghost" onClick={onReset}>
              Clear {activeCount} filter{activeCount === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A search box that waits for a pause in typing before it searches, so each
 * keystroke is not a request. It follows the filter from outside too — when
 * "Clear" empties it, the box empties.
 */
export function SearchFilter({
  value,
  onChange,
  placeholder = "Search…",
  className = "w-60",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The filter changed from outside (cleared, back button): show that.
  if (value !== seen) {
    setSeen(value);
    setText(value);
  }

  return (
    <div className={`relative ${className}`}>
      <svg
        width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            setSeen(next.trim());
            onChange(next.trim());
          }, 300);
        }}
        className="h-9 w-full rounded-[9px] border border-line-strong bg-surface pl-8 pr-3 text-[13px] text-ink placeholder:text-ink-muted focus:border-forest-500 focus:outline-none"
      />
    </div>
  );
}

/** A labelled dropdown; it turns green while it is filtering something. */
export function SelectFilter({
  label,
  value,
  onChange,
  options,
  neutral = "",
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string }[];
  /** The value that means "not filtering" — highlighted only when different. */
  neutral?: string;
}) {
  const active = value !== neutral;
  return (
    <label
      className={`inline-flex h-9 items-center gap-1 rounded-[9px] border pl-2.5 text-[13px] transition-colors ${
        active ? "border-forest-300 bg-forest-50" : "border-line-strong bg-surface"
      }`}
    >
      <span className={`whitespace-nowrap ${active ? "text-forest-800" : "text-ink-muted"}`}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-full cursor-pointer rounded-r-[9px] bg-transparent pr-2 font-medium focus:outline-none ${
          active ? "text-forest-800" : "text-ink"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Any time / today / last N days / custom from–to. */
export function DateFilter({
  label = "Date",
  range,
  from,
  to,
  onChange,
}: {
  label?: string;
  range: string;
  from: string;
  to: string;
  onChange: (patch: { range?: string; from?: string; to?: string }) => void;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <SelectFilter
        label={label}
        value={range}
        options={RANGE_OPTIONS}
        onChange={(next) => onChange(next === "custom" ? { range: next } : { range: next, from: "", to: "" })}
      />
      {range === "custom" && (
        <>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => onChange({ from: e.target.value })}
            className="h-9 rounded-[9px] border border-line-strong bg-surface px-2 text-[13px] text-ink focus:border-forest-500 focus:outline-none"
            aria-label="From"
          />
          <span className="text-[12px] text-ink-muted">to</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => onChange({ to: e.target.value })}
            className="h-9 rounded-[9px] border border-line-strong bg-surface px-2 text-[13px] text-ink focus:border-forest-500 focus:outline-none"
            aria-label="To"
          />
        </>
      )}
    </div>
  );
}

/** Previous / next with where you are. Hidden when everything fits on one page. */
export function Pagination({
  page,
  pages,
  total,
  noun = "results",
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  noun?: string;
  onPage: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-between text-[13px] text-ink-muted">
      <span>
        Page {page} of {pages} · {total} {noun}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export type FilterOptions = {
  services: { code: string; name: string; active: boolean; category?: string }[];
  categories: { id: string; name: string }[];
  societies: { code: string; name: string }[];
  auditActions: string[];
  auditEntities: string[];
};
