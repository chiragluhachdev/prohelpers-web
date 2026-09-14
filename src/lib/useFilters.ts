"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type FilterValues<K extends string> = Record<K, string>;

/**
 * A list page's filters, kept in the URL: a filtered view survives a refresh,
 * the back button and being pasted to a colleague. Values equal to their
 * default are left out, so a clean page has a clean URL.
 *
 * Pages using this must render inside <Suspense> (useSearchParams).
 *
 * @param defaults every filter the page has, with its default value — declare
 *                 it at module level so it is the same object on every render
 */
export function useFilters<K extends string>(defaults: FilterValues<K>) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const values = useMemo(() => {
    const out = { ...defaults };
    for (const key of Object.keys(defaults) as K[]) {
      const got = params.get(key);
      if (got !== null) out[key] = got;
    }
    return out;
  }, [params, defaults]);

  const write = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  /** Change some filters. Any change other than the page itself goes back to page 1. */
  const set = useCallback(
    (patch: Partial<FilterValues<K>>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch) as [K, string | undefined][]) {
        if (value === undefined || value === "" || value === defaults[key]) next.delete(key);
        else next.set(key, value);
      }
      if (!("page" in patch)) next.delete("page");
      write(next);
    },
    [params, defaults, write],
  );

  const reset = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    for (const key of Object.keys(defaults)) if (key !== "sort") next.delete(key);
    write(next);
  }, [params, defaults, write]);

  /** How many filters differ from their defaults — sort and page are not filters. */
  const activeCount = (Object.keys(defaults) as K[]).filter(
    (key) => !["page", "sort", "to", "from"].includes(key) && values[key] !== defaults[key],
  ).length;

  return { values, set, reset, activeCount };
}

/* ---------------------------------------------------------------- dates */

export const RANGE_OPTIONS = [
  { value: "", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range" },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/**
 * A date filter as the ISO bounds the API takes, worked out on the admin's own
 * calendar — "today" is their today, whatever timezone the server runs in.
 */
export function rangeBounds(range: string, from = "", to = ""): { from?: string; to?: string } {
  const now = new Date();
  const daysAgo = (n: number) => startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
  switch (range) {
    case "today":
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
    case "yesterday":
      return { from: daysAgo(1).toISOString(), to: endOfDay(daysAgo(1)).toISOString() };
    case "7d":
      return { from: daysAgo(6).toISOString() };
    case "30d":
      return { from: daysAgo(29).toISOString() };
    case "90d":
      return { from: daysAgo(89).toISOString() };
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString() };
    case "custom": {
      const out: { from?: string; to?: string } = {};
      if (/^\d{4}-\d{2}-\d{2}$/.test(from)) out.from = startOfDay(new Date(`${from}T00:00:00`)).toISOString();
      if (/^\d{4}-\d{2}-\d{2}$/.test(to)) out.to = endOfDay(new Date(`${to}T00:00:00`)).toISOString();
      return out;
    }
    default:
      return {};
  }
}

/** The API query for a set of filter values: empties dropped, the date preset turned into bounds. */
export function apiQuery(values: Record<string, string>, { rename = {} as Record<string, string> } = {}) {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (!value || ["range", "from", "to"].includes(key)) continue;
    out.set(rename[key] ?? key, value);
  }
  if ("range" in values) {
    const bounds = rangeBounds(values.range, values.from, values.to);
    if (bounds.from) out.set("from", bounds.from);
    if (bounds.to) out.set("to", bounds.to);
  }
  return out;
}
