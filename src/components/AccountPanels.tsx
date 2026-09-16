"use client";

import Link from "next/link";
import { dateTime, titleCase } from "@/lib/format";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";

export type Rejections = {
  count: number;
  threshold: number;
  lifetime: Record<string, number>;
  recent: {
    id: string; kind: string; taskId: string | null; taskCode: string;
    reason: string; count: number; threshold: number; blocked: boolean; at: string;
  }[];
};

export type GivenRating = {
  _id: string; stars: number; comment?: string; tags?: string[]; createdAt: string;
  toUserId?: { _id: string; name: string; role: string };
  taskId?: { _id: string; code?: string };
};

export type Complaint = {
  id: string; code: string; category: string; message: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";
  resolution: string; at: string; handledAt: string | null;
  escalated?: boolean; escalatedAt?: string | null; escalationReason?: string;
  assignedTo?: { id: string; name: string; email: string } | null;
  assignedAt?: string | null;
  notes?: { kind: string; text: string; byName: string; at: string }[];
  by: { id: string; name: string; phone: string; email?: string; role: string } | null;
  against: { id: string; name: string; phone: string } | null;
  task: { id: string; code: string; status: string } | null;
  taskCode: string;
};

const COMPLAINT_TONE: Record<string, "rose" | "amber" | "green" | "slate"> = {
  OPEN: "rose", IN_REVIEW: "amber", RESOLVED: "green", DISMISSED: "slate",
};

/** UC-C40 / UC-C41 — what this account reported, and what was reported about them. */
export function ComplaintsPanel({ complaints }: { complaints?: { raised: Complaint[]; about: Complaint[] } }) {
  const raised = complaints?.raised ?? [];
  const about = complaints?.about ?? [];
  const rows = [
    ...raised.map((c) => ({ ...c, side: "Reported by them" })),
    ...about.map((c) => ({ ...c, side: "Reported about them" })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <Card padded={false}>
      <div className="px-5 pt-5">
        <SectionTitle
          title="Complaints"
          action={
            <Link href="/admin/complaints" className="text-[12px] font-medium text-forest-700 hover:underline">
              Open the queue
            </Link>
          }
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No complaints" />
      ) : (
        <div className="mt-2 divide-y divide-line">
          {rows.map((c) => (
            <div key={c.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-ink">
                    {titleCase(c.category)}
                    <span className="ml-2 font-normal text-ink-muted">{c.side}</span>
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-soft">{c.message}</p>
                  {c.resolution && <p className="mt-1 text-[12.5px] text-forest-700">Outcome: {c.resolution}</p>}
                  <p className="mt-1 text-[11.5px] text-ink-muted">
                    {c.code} · {dateTime(c.at)}
                    {c.task && (
                      <>
                        {" · "}
                        <Link href={`/admin/bookings/${c.task.id}`} className="hover:underline">{c.task.code}</Link>
                      </>
                    )}
                  </p>
                </div>
                <Badge tone={COMPLAINT_TONE[c.status]}>{c.status === "IN_REVIEW" ? "Looking" : titleCase(c.status)}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const KIND_LABEL: Record<string, string> = {
  JOB_DECLINED: "Declined a request",
  HELPER_CANCELLED: "Dropped a job they had accepted",
  CUSTOMER_CANCELLED: "Cancelled after a helper was assigned",
};

/**
 * UC-C23 — what this account has turned down, and how close that is to the
 * automatic block. The count resets whenever an admin unblocks them.
 */
export function RejectionsPanel({ rejections, blocked }: { rejections?: Rejections; blocked?: boolean }) {
  const r = rejections ?? { count: 0, threshold: 0, lifetime: {}, recent: [] };
  const off = !r.threshold;
  const pct = off ? 0 : Math.min(100, Math.round((r.count / r.threshold) * 100));

  return (
    <Card padded={false}>
      <div className="px-5 pt-5">
        <SectionTitle
          title="Rejections"
          action={
            blocked ? <Badge tone="rose">Blocked</Badge>
              : off ? <Badge tone="slate">Auto-block off</Badge>
              : <Badge tone={pct >= 100 ? "rose" : pct >= 60 ? "amber" : "green"}>{r.count} of {r.threshold}</Badge>
          }
        />
        <p className="text-[13px] text-ink-soft">
          {off
            ? "Automatic blocking is switched off in Settings, but every rejection is still recorded."
            : `The account is blocked automatically at ${r.threshold}. Unblocking resets the count to zero.`}
        </p>
        {!off && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-sunken">
            <div
              className={`h-full rounded-full ${pct >= 100 ? "bg-rose-ink" : pct >= 60 ? "bg-amber-ink" : "bg-forest-500"}`}
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
          </div>
        )}
        {Object.keys(r.lifetime).length > 0 && (
          <p className="mt-3 text-[12.5px] text-ink-muted">
            All time: {Object.entries(r.lifetime).map(([k, n]) => `${KIND_LABEL[k] || k} — ${n}`).join(" · ")}
          </p>
        )}
      </div>

      {r.recent.length === 0 ? (
        <EmptyState title="Nothing turned down yet" />
      ) : (
        <div className="mt-4 divide-y divide-line">
          {r.recent.map((row) => (
            <div key={row.id} className="flex items-start justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-ink">
                  {KIND_LABEL[row.kind] || row.kind}
                  {row.blocked && <span className="ml-2"><Badge tone="rose">Blocked here</Badge></span>}
                </p>
                <p className="text-[12px] text-ink-muted">
                  {dateTime(row.at)}
                  {row.taskId && (
                    <>
                      {" · "}
                      <Link href={`/admin/bookings/${row.taskId}`} className="hover:underline">{row.taskCode || "booking"}</Link>
                    </>
                  )}
                </p>
                {row.reason && <p className="mt-0.5 text-[12.5px] text-ink-soft">“{row.reason}”</p>}
              </div>
              <span className="tabular shrink-0 text-[12px] text-ink-muted">
                {row.count}/{row.threshold || "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** The other half of UC-C20 / UC-C21: what this account said about the people it worked with. */
export function RatingsGivenPanel({ ratings, otherRole }: { ratings?: GivenRating[]; otherRole: "helpers" | "customers" }) {
  const rows = ratings ?? [];
  return (
    <Card padded={false}>
      <div className="px-5 pt-5">
        <SectionTitle title={`Ratings given (${rows.length})`} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="None given yet" />
      ) : (
        <div className="mt-2 divide-y divide-line">
          {rows.map((r) => (
            <div key={r._id} className="px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span className="rounded-[6px] bg-amber-bg px-2 py-0.5 text-[13px] font-semibold text-amber-ink">{r.stars} ★</span>
                  <span className="text-[12px] text-ink-muted">{dateTime(r.createdAt)}</span>
                </span>
                {r.toUserId && (
                  <Link href={`/admin/${otherRole}/${r.toUserId._id}`} className="text-[13px] font-medium text-forest-600 hover:underline">
                    To: {r.toUserId.name || "—"}
                  </Link>
                )}
              </div>
              {r.comment && <p className="mt-1 text-[13.5px] text-ink-soft">“{r.comment}”</p>}
              {!!r.tags?.length && <p className="mt-1 text-[12px] text-ink-muted">{r.tags.join(" · ")}</p>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
