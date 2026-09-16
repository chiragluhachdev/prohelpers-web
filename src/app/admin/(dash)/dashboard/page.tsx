"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { rupees, dateTime, relative } from "@/lib/format";
import {
  Avatar, Button, Card, Cell, EmptyState, ErrorNote, PageHeader,
  Row, SectionTitle, Spinner, Stat, StatusBadge, Table,
} from "@/components/ui";

type Dashboard = {
  stats: {
    customers: number; helpers: number; pendingApprovals: number; activeHelpers: number;
    onlineHelpers: number; todayBookings: number; activeTasks: number; completedTasks: number;
    cancelledTasks: number; noHelperTasks: number; blockedAccounts: number; overdueTasks: number; openComplaints: number;
    revenue: number; outstandingCommission: number;
  };
  recentTasks: {
    id: string; code: string; status: string; statusLabel: string; services: string[];
    total: number; scheduledAt: string; createdAt: string; area: string;
    customer: { name: string } | null; helper: { name: string } | null;
  }[];
  pendingHelpers: {
    id: string; name: string; phone: string; photoUrl?: string;
    submittedAt: string; services: string[]; kycStatus: string;
  }[];
  trend: { date: string; bookings: number; completed: number; revenue: number }[];
};

/**
 * Seven days of bookings, drawn from the same aggregate the numbers above come
 * from. Bars are relative to the busiest day, so the shape is readable whether
 * the week saw three bookings or three hundred.
 */
function TrendChart({ data }: { data: Dashboard["trend"] }) {
  const peak = Math.max(...data.map((d) => d.bookings), 1);
  const total = data.reduce((sum, d) => sum + d.bookings, 0);
  const completed = data.reduce((sum, d) => sum + d.completed, 0);
  const earned = data.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <Card>
      <SectionTitle title="Last 7 days" />
      <div className="-mt-1 mb-4 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-muted">
        <span><span className="font-semibold text-ink">{total}</span> booked</span>
        <span><span className="font-semibold text-ink">{completed}</span> completed</span>
        <span><span className="font-semibold text-forest-700">{rupees(earned)}</span> earned</span>
      </div>

      <div className="flex h-28 items-end gap-1.5">
        {data.map((d) => {
          const day = new Date(`${d.date}T00:00:00`);
          const height = d.bookings === 0 ? 3 : Math.max(8, Math.round((d.bookings / peak) * 100));
          return (
            <div key={d.date} className="group flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[11px] font-semibold text-ink-muted opacity-0 transition group-hover:opacity-100">
                {d.bookings}
              </span>
              <div
                className={`w-full rounded-t-[4px] transition ${
                  d.bookings === 0 ? "bg-line" : "bg-forest-500 group-hover:bg-forest-600"
                }`}
                style={{ height: `${height}%` }}
                title={`${day.toDateString()} — ${d.bookings} booked, ${d.completed} completed`}
              />
              <span className="text-[11px] text-ink-muted">
                {day.toLocaleDateString("en-IN", { weekday: "short" })}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  // Bookings move on their own — refresh quietly so the numbers stay honest.
  const { data, error, loading } = useApi<Dashboard>("/api/admin/dashboard", { pollMs: 10_000 });

  if (loading) return <Spinner label="Loading the dashboard" />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return null;

  const s = data.stats;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Everything happening on the platform right now. Refreshes every 10 seconds."
        action={
          s.pendingApprovals > 0 ? (
            <Link href="/admin/helpers?status=PENDING_VERIFICATION">
              <Button>
                Review {s.pendingApprovals} pending {s.pendingApprovals === 1 ? "helper" : "helpers"}
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Customers"
          value={s.customers}
          onClick={() => router.push("/admin/customers")}
          icon={<Glyph d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />}
        />
        <Stat
          label="Helpers"
          value={s.helpers}
          sub={`${s.onlineHelpers} online now`}
          tone={s.onlineHelpers > 0 ? "green" : "slate"}
          onClick={() => router.push("/admin/helpers")}
          icon={<Glyph d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87" />}
        />
        <Stat
          label="Pending verification"
          value={s.pendingApprovals}
          sub={s.pendingApprovals > 0 ? "Needs review" : "All clear"}
          tone={s.pendingApprovals > 0 ? "amber" : "green"}
          onClick={() => router.push("/admin/helpers?status=PENDING_VERIFICATION")}
          icon={<Glyph d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3-10 2 2 4-4" />}
        />
        <Stat
          label="Bookings today"
          value={s.todayBookings}
          sub={`${s.activeTasks} in flight`}
          tone="sky"
          onClick={() => router.push("/admin/bookings")}
          icon={<Glyph d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Completed" value={s.completedTasks} sub={`${s.cancelledTasks} cancelled`} />
        <Stat
          label="Complaints"
          value={s.openComplaints ?? 0}
          sub={s.openComplaints > 0 ? "Waiting on you" : "None open"}
          tone={s.openComplaints > 0 ? "rose" : "green"}
          onClick={() => router.push("/admin/complaints")}
        />
        <Stat
          label="Overdue jobs"
          value={s.overdueTasks ?? 0}
          sub={s.overdueTasks > 0 ? "Open past their finish" : "All on time"}
          tone={s.overdueTasks > 0 ? "rose" : "green"}
          onClick={() => router.push("/admin/open-tasks")}
        />
        <Stat
          label="No helper available"
          value={s.noHelperTasks}
          sub={s.noHelperTasks > 0 ? "Check coverage" : "None"}
          tone={s.noHelperTasks > 0 ? "rose" : "slate"}
        />
        <Stat label="Revenue" value={rupees(s.revenue)} sub="From completed bookings" tone="green" />
        <Stat label="Commission owed" value={rupees(s.outstandingCommission)} sub="From helpers" tone="amber" />
      </div>

      {/* ------------------------------------------------ verification queue */}
      {s.customers === 0 && s.helpers === 0 && (
        <div className="mt-6">
          <Card>
            <SectionTitle title="Nothing here yet" />
            <p className="text-sm leading-relaxed text-ink-soft">
              No customers or helpers have registered. Sign up through the app and
              they will appear here — helpers land in the verification queue first.
            </p>
          </Card>
        </div>
      )}

      {data.trend?.length ? (
        <div className="mt-6">
          <TrendChart data={data.trend} />
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <SectionTitle
            title="Recent requests"
            action={
              <Link href="/admin/bookings" className="text-[13px] font-medium text-forest-700 hover:underline">
                View all
              </Link>
            }
          />
          <Card padded={false}>
            {data.recentTasks.length === 0 ? (
              <EmptyState title="No bookings yet" body="Requests will appear here as customers create them." />
            ) : (
              <Table head={["Booking", "Customer", "Helper", "When", "Status", "Value"]}>
                {data.recentTasks.map((t) => (
                  <Row key={t.id} onClick={() => router.push(`/admin/bookings/${t.id}`)}>
                    <Cell>
                      <span className="font-medium">{t.code}</span>
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">
                        {t.services.join(", ")}
                      </span>
                    </Cell>
                    <Cell className="text-ink-soft">{t.customer?.name || "—"}</Cell>
                    <Cell className="text-ink-soft">{t.helper?.name || <span className="text-ink-muted">Unassigned</span>}</Cell>
                    <Cell className="whitespace-nowrap text-ink-soft">{dateTime(t.scheduledAt)}</Cell>
                    <Cell><StatusBadge status={t.status} label={t.statusLabel} /></Cell>
                    <Cell className="tabular whitespace-nowrap font-medium">{rupees(t.total)}</Cell>
                  </Row>
                ))}
              </Table>
            )}
          </Card>
        </div>

        <div>
          <SectionTitle title="Awaiting verification" />
          <Card padded={false}>
            {data.pendingHelpers.length === 0 ? (
              <EmptyState title="Nothing to review" body="New helper submissions land here." />
            ) : (
              <ul>
                {data.pendingHelpers.map((h) => (
                  <li key={h.id} className="border-b border-line/70 last:border-0">
                    <Link
                      href={`/admin/helpers/${h.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-sunken"
                    >
                      <Avatar name={h.name} src={h.photoUrl} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{h.name}</p>
                        <p className="truncate text-xs text-ink-muted">
                          {h.phone} · submitted {relative(h.submittedAt)}
                        </p>
                      </div>
                      <StatusBadge status={h.kycStatus === "VERIFIED" ? "APPROVED" : "PENDING"} label={h.kycStatus === "VERIFIED" ? "KYC ok" : "KYC"} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

/** Compact 24×24 stroke icon for the stat tiles. */
function Glyph({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
