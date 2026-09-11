"use client";

import Link from "next/link";
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
    cancelledTasks: number; noHelperTasks: number; blockedAccounts: number;
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
};

export default function DashboardPage() {
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
        subtitle="Everything happening on the platform right now."
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
        <Stat label="Customers" value={s.customers} />
        <Stat
          label="Helpers"
          value={s.helpers}
          sub={`${s.onlineHelpers} online now`}
          tone={s.onlineHelpers > 0 ? "green" : "slate"}
        />
        <Stat
          label="Pending verification"
          value={s.pendingApprovals}
          sub={s.pendingApprovals > 0 ? "Needs review" : "All clear"}
          tone={s.pendingApprovals > 0 ? "amber" : "green"}
        />
        <Stat label="Bookings today" value={s.todayBookings} sub={`${s.activeTasks} in flight`} tone="sky" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Completed" value={s.completedTasks} />
        <Stat
          label="No helper available"
          value={s.noHelperTasks}
          sub={s.noHelperTasks > 0 ? "Check coverage" : "None"}
          tone={s.noHelperTasks > 0 ? "rose" : "slate"}
        />
        <Stat label="Revenue" value={rupees(s.revenue)} sub="Completed bookings" />
        <Stat label="Commission owed" value={rupees(s.outstandingCommission)} sub="From helpers" tone="amber" />
      </div>

      {/* ------------------------------------------------ verification queue */}
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
                  <Row key={t.id} onClick={() => (window.location.href = `/admin/bookings/${t.id}`)}>
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
