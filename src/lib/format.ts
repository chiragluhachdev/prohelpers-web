export const rupees = (n: number | undefined | null, withPaise = false) =>
  `₹${(n ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: withPaise ? 2 : 0,
    maximumFractionDigits: withPaise ? 2 : 0,
  })}`;

export const shortDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";

export const dateTime = (d?: string | Date | null) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "—";

export const timeOnly = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }) : "—";

/** "3 minutes ago", "in 2 days" — for timelines and queues. */
export function relative(d?: string | Date | null) {
  if (!d) return "—";
  const diff = new Date(d).getTime() - Date.now();
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
    ["second", 1000],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "second") return rtf.format(Math.round(diff / ms), unit);
  }
  return "—";
}

export const initials = (name?: string) =>
  (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

export const titleCase = (s?: string) =>
  (s || "").toLowerCase().replace(/_/g, " ").replace(/(^|\s)\S/g, (c) => c.toUpperCase());
