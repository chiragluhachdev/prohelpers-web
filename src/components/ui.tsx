"use client";

import { initials, titleCase } from "@/lib/format";

/* ------------------------------------------------------------------- shell */

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-[14px] border border-line bg-surface shadow-[0_1px_2px_rgba(20,32,26,0.04),0_8px_24px_-16px_rgba(20,32,26,0.18)] ${
        padded ? "p-5" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-4">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.07em] text-ink-muted">{title}</h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ inputs */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "primary", size = "md", className = "", ...rest }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[9px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm" };
  const variants = {
    primary: "bg-forest-700 text-white hover:bg-forest-800",
    secondary: "border border-line-strong bg-surface text-ink hover:bg-sunken",
    ghost: "text-ink-soft hover:bg-sunken hover:text-ink",
    danger: "border border-rose-ink/25 bg-rose-bg text-rose-ink hover:bg-rose-bg/70",
  };
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest} />;
}

export function Input({ className = "", ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-10 w-full rounded-[9px] border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-forest-500 focus:outline-none ${className}`}
      {...rest}
    />
  );
}

export function Textarea({ className = "", ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-[9px] border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-forest-500 focus:outline-none ${className}`}
      {...rest}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------ status */

const TONES = {
  green: "bg-forest-100 text-forest-800 ring-forest-200",
  amber: "bg-amber-bg text-amber-ink ring-amber-ink/15",
  rose: "bg-rose-bg text-rose-ink ring-rose-ink/15",
  sky: "bg-sky-bg text-sky-ink ring-sky-ink/15",
  slate: "bg-sunken text-ink-soft ring-line-strong",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** One place that decides what colour a status is, so the whole app agrees. */
export function toneForStatus(status?: string): Tone {
  switch (status) {
    case "COMPLETED":
    case "SETTLED":
    case "APPROVED":
    case "active":
      return "green";
    case "ACCEPTED":
    case "IN_PROGRESS":
    case "COMPLETION_PENDING":
      return "sky";
    case "SEARCHING":
    case "CREATED":
    case "PENDING_VERIFICATION":
    case "PENDING":
      return "amber";
    case "CANCELLED":
    case "EXPIRED":
    case "NO_HELPER_AVAILABLE":
    case "REJECTED":
    case "blocked":
      return "rose";
    default:
      return "slate";
  }
}

export function StatusBadge({ status, label }: { status?: string; label?: string }) {
  return <Badge tone={toneForStatus(status)}>{label ?? titleCase(status)}</Badge>;
}

export function Dot({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${on ? "bg-forest-500" : "bg-line-strong"}`}
      aria-hidden
    />
  );
}

/* ------------------------------------------------------------------ avatar */

export function Avatar({ name, src, size = 36 }: { name?: string; src?: string; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name || ""}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover ring-1 ring-line"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-forest-100 font-semibold text-forest-800"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------------- table */

export function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-sunken/80 backdrop-blur">
          <tr className="border-b border-line">
            {head.map((h, i) => (
              <th
                key={i}
                className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={`group border-b border-line/70 last:border-0 ${
        onClick
          ? "cursor-pointer transition-colors hover:bg-forest-50/60 focus-within:bg-forest-50/60"
          : ""
      }`}
    >
      {children}
    </tr>
  );
}

export function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle text-ink ${className}`}>{children}</td>;
}

/* ------------------------------------------------------------------ states */

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-14 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {body && <p className="max-w-sm text-sm text-ink-muted">{body}</p>}
    </div>
  );
}

/** Placeholder rows while a table loads — keeps the layout from jumping. */
export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-line/70">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-3 animate-pulse rounded bg-line"
              style={{ width: c === 0 ? "28%" : `${14 + ((r + c) % 3) * 6}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-ink-muted">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line-strong border-t-forest-600" />
      {label}…
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-rose-ink/20 bg-rose-bg px-3.5 py-2.5 text-sm text-rose-ink">
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------- misc */

export function Stat({
  label,
  value,
  sub,
  tone = "slate",
  icon,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: Tone;
  icon?: React.ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <Card className={`min-w-0 ${onClick ? "transition-transform hover:-translate-y-0.5" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="truncate text-[13px] font-medium text-ink-soft">{label}</p>
        {icon && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-forest-50 text-forest-700">
            {icon}
          </span>
        )}
      </div>
      <p className="tabular mt-2.5 text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink">{value}</p>
      {sub && (
        <p className="mt-2.5">
          <Badge tone={tone}>{sub}</Badge>
        </p>
      )}
    </Card>
  );
  if (!onClick) return body;
  return (
    <button onClick={onClick} className="block w-full text-left">
      {body}
    </button>
  );
}

export function KeyValue({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[12px] font-medium uppercase tracking-[0.05em] text-ink-muted">{k}</dt>
          <dd className="mt-0.5 break-words text-sm text-ink">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Label/value pair for detail panels. Keeps long values from breaking layout. */
export function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-line/70 py-2.5 last:border-0">
      <dt className="shrink-0 text-[13px] text-ink-muted">{label}</dt>
      <dd className={`min-w-0 break-words text-right text-[13.5px] font-medium text-ink ${mono ? "tabular" : ""}`}>
        {value ?? "—"}
      </dd>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string; count?: number }[];
  active: T;
  onChange: (k: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-[10px] border border-line bg-surface p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`rounded-[7px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
            active === t.key ? "bg-forest-700 text-white" : "text-ink-soft hover:bg-sunken hover:text-ink"
          }`}
        >
          {t.label}
          {t.count != null && (
            <span className={`tabular ml-1.5 ${active === t.key ? "text-forest-200" : "text-ink-muted"}`}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  size = "md",
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** "lg" for anything that edits a list rather than a handful of fields. */
  size?: "md" | "lg";
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="absolute inset-0 bg-ink/25" onClick={onClose} />
      <Card
        className={`relative z-10 my-auto w-full ${size === "lg" ? "max-w-2xl" : "max-w-md"}`}
      >
        <div className="mb-4">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{subtitle}</p>}
        </div>
        {children}
      </Card>
    </div>
  );
}

export function Select({ className = "", ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={`h-10 w-full rounded-[9px] border border-line-strong bg-surface px-2.5 text-sm text-ink focus:border-forest-500 focus:outline-none ${className}`}
    />
  );
}

/** A labelled switch. The label is part of the control, so the whole row toggles. */
export function Toggle({
  on,
  onChange,
  label,
  help,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  help?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex w-full items-start gap-3 rounded-[10px] border border-line bg-sunken p-3 text-left transition hover:border-forest-300"
    >
      <span
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
          on ? "bg-forest-600" : "bg-line-strong"
        }`}
      >
        <span className={`h-4 w-4 rounded-full bg-surface shadow transition ${on ? "translate-x-4" : ""}`} />
      </span>
      <span>
        <span className="block text-[13px] font-medium text-ink">{label}</span>
        {help && <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-muted">{help}</span>}
      </span>
    </button>
  );
}
