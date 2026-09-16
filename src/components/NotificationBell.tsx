"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { relative } from "@/lib/format";

type AdminNotification = {
  _id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  readAt: string | null;
  createdAt: string;
};

/** Where a notification leads: the booking it is about, or the account. */
function hrefFor(n: AdminNotification) {
  const d = n.data || {};
  if (d.taskId) return `/admin/bookings/${d.taskId}`;
  if (d.userId) return d.role === "customer" ? `/admin/customers/${d.userId}` : `/admin/helpers/${d.userId}`;
  if (d.helperId) return `/admin/helpers/${d.helperId}`;
  return null;
}

const TONE: Record<string, string> = {
  ACCOUNT_AUTO_BLOCKED: "bg-rose-ink",
  HELPER_AUTO_BLOCKED: "bg-rose-ink",
  TASK_OVERDUE_ADMIN: "bg-amber-ink",
};

/**
 * What the system tells admins (UC-C18, UC-C23): accounts it blocked, jobs
 * running late. Checked every half minute; opening one goes to what it's about.
 */
export function NotificationBell({ align = "left" }: { align?: "left" | "right" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const { data, reload } = useApi<{ notifications: AdminNotification[]; unread: number }>("/api/notifications", { pollMs: 30_000 });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const unread = data?.unread ?? 0;

  async function openOne(n: AdminNotification) {
    setOpen(false);
    if (!n.readAt) {
      await api(`/api/notifications/${n._id}/read`, { method: "POST" }).catch(() => {});
      reload();
    }
    const href = hrefFor(n);
    if (href) router.push(href);
  }

  async function readAll() {
    await api("/api/notifications/read-all", { method: "POST" }).catch(() => {});
    reload();
  }

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
        className="relative grid h-8 w-8 place-items-center rounded-[9px] text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="tabular absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-ink px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute top-10 z-40 w-[340px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[12px] border border-line bg-surface shadow-[0_12px_32px_-12px_rgba(20,32,26,0.35)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-[13px] font-semibold text-ink">Notifications</p>
            {unread > 0 && (
              <button onClick={readAll} className="text-[12px] font-medium text-forest-700 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {!data?.notifications.length ? (
              <p className="px-4 py-8 text-center text-[13px] text-ink-muted">Nothing yet.</p>
            ) : (
              data.notifications.map((n) => (
                <button
                  key={n._id}
                  onClick={() => openOne(n)}
                  className={`flex w-full gap-3 border-b border-line/70 px-4 py-3 text-left last:border-0 hover:bg-sunken ${n.readAt ? "" : "bg-forest-50/50"}`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : TONE[n.type] || "bg-forest-600"}`} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-ink">{n.title}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-soft">{n.body}</span>
                    <span className="mt-1 block text-[11px] text-ink-muted">{relative(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
