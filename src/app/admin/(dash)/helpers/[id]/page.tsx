"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { dateTime, relative, rupees, titleCase } from "@/lib/format";
import { ComplaintsPanel, RatingsGivenPanel, RejectionsPanel, type Complaint, type GivenRating, type Rejections } from "@/components/AccountPanels";
import {
  Avatar, Badge, Button, Card, Cell, EmptyState, ErrorNote, Field, Input,
  KeyValue, Modal, PageHeader, Row, SectionTitle, Select, Spinner, StatusBadge,
  Table, Textarea,
} from "@/components/ui";

type Doc = {
  _id: string; type: string; url: string; status: string; remark?: string;
  originalName?: string; mimeType?: string; createdAt: string;
};

type Detail = {
  helper: {
    id: string; name: string; phone: string; email?: string; photoUrl?: string;
    accountStatus: string; blockReason?: string; createdAt: string;
    previousPhones?: { phone: string; changedAt: string }[];
    referral?: {
      code: string; balance: number; referrals: number;
      referredBy: { id: string; name: string; phone: string; role: string } | null;
    };
  };
  profile: {
    gender?: string; experienceYears?: number; bio?: string;
    aadhaarLast4?: string; aadhaarName?: string; kycStatus: string; kycMethod?: string; kycVerifiedAt?: string;
    approvalStatus: string; rejectionReason?: string; submittedAt?: string; reviewedAt?: string;
    services: string[]; societies?: string[];
    serviceArea?: { label?: string; lat?: number; lng?: number; radiusKm?: number };
    isOnline: boolean; dnd: boolean; ratingAvg: number; ratingCount: number; completedJobs: number;
    jobsShown?: number;
    paymentDetails?: { method?: "UPI" | "BANK"; upiId?: string; accountNo?: string; ifsc?: string };
  } | null;
  documents: Doc[];
  tasks: { id: string; code: string; status: string; statusLabel: string; services: string[]; total: number; scheduledAt: string }[];
  ratings: {
    _id: string; stars: number; comment?: string; createdAt: string;
    fromUserId?: { _id: string; name: string; role: string };
    taskId?: { _id: string; shortId: string };
  }[];
  ratingsGiven?: GivenRating[];
  rejections?: Rejections;
  complaints?: { raised: Complaint[]; about: Complaint[] };
  /** UC-C26 — the same figures the helper sees in their own app. */
  money?: {
    completedJobs: number; gross: number; commission: number; netEarning: number;
    adjustments: number; paid: number; payable: number; outstanding: number; balance: number;
  };
  ledger?: {
    id: string; txnId: string; type: string; direction: "CREDIT" | "DEBIT"; amount: number;
    source: string; status: string; note: string; taskCode: string; at: string;
  }[];
  earnings: Record<string, number>;
};

const DEFAULT_JOBS_SHOWN = 50;

/** Same rule as the API: "N+" until the real count passes it; 0 shows the real count. */
function jobsLabel(p: { completedJobs?: number; jobsShown?: number }) {
  const real = p.completedJobs ?? 0;
  const shown = p.jobsShown ?? DEFAULT_JOBS_SHOWN;
  return real >= shown ? String(real) : `${shown}+`;
}

export default function HelperDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<Detail>(`/api/admin/helpers/${id}`);

  const [busy, setBusy] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustDirection, setAdjustDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [adjustNote, setAdjustNote] = useState("");
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsDraft, setStatsDraft] = useState({ experienceYears: "", jobsShown: "" });
  const [statsError, setStatsError] = useState("");
  const [actionError, setActionError] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setActionError("");
    try {
      await fn();
      await reload();
      setRejectOpen(false);
      setBlockOpen(false);
      setReason("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy("");
    }
  }

  if (loading) return <Spinner label="Loading helper" />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data?.profile) return <ErrorNote>This helper has no profile yet.</ErrorNote>;

  const { helper, profile, documents } = data;
  const blocked = helper.accountStatus === "blocked";

  return (
    <>
      <Link href="/admin/helpers" className="mb-4 inline-block text-[13px] font-medium text-ink-muted hover:text-ink">
        ← All helpers
      </Link>

      <PageHeader
        title={helper.name || "Unnamed helper"}
        subtitle={`${helper.phone} · joined ${relative(helper.createdAt)}`}
        action={
          <div className="flex flex-wrap gap-2">
            {profile.approvalStatus !== "APPROVED" && (
              <Button disabled={!!busy} onClick={() => run("approve", () => api(`/api/admin/helpers/${id}/approve`, { method: "POST" }))}>
                {busy === "approve" ? "Approving…" : "Approve helper"}
              </Button>
            )}
            {profile.approvalStatus !== "REJECTED" && (
              <Button variant="secondary" disabled={!!busy} onClick={() => setRejectOpen(true)}>
                Reject
              </Button>
            )}
            <Button variant="secondary" disabled={!!busy} onClick={() => setAdjustOpen(true)}>
              Adjust money
            </Button>
            {profile.approvalStatus !== "APPROVED" && (
              <Button variant="secondary" disabled={!!busy} onClick={() => setCorrectionOpen(true)}>
                Ask for a correction
              </Button>
            )}
            {blocked ? (
              <Button variant="secondary" disabled={!!busy} onClick={() => run("unblock", () => api(`/api/admin/users/${id}/unblock`, { method: "POST" }))}>
                {busy === "unblock" ? "Unblocking…" : "Unblock account"}
              </Button>
            ) : (
              <Button variant="danger" disabled={!!busy} onClick={() => setBlockOpen(true)}>
                Block
              </Button>
            )}
          </div>
        }
      />

      {actionError && <div className="mb-4"><ErrorNote>{actionError}</ErrorNote></div>}

      {blocked && (
        <div className="mb-5">
          <ErrorNote>
            <strong className="font-semibold">Account blocked.</strong> {helper.blockReason}
          </ErrorNote>
        </div>
      )}
      {profile.approvalStatus === "REJECTED" && profile.rejectionReason && (
        <div className="mb-5 rounded-[10px] border border-amber-ink/20 bg-amber-bg px-3.5 py-2.5 text-sm text-amber-ink">
          <strong className="font-semibold">Rejected.</strong> {profile.rejectionReason}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-5">
          {/* ------------------------------------------------- identity */}
          <Card>
            <SectionTitle title="Identity verification" />
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge status={profile.kycStatus === "VERIFIED" ? "APPROVED" : "PENDING"} label={profile.kycStatus === "VERIFIED" ? "Aadhaar verified" : "Not verified"} />
              {profile.kycMethod && <Badge>{titleCase(profile.kycMethod)}</Badge>}
            </div>
            <KeyValue
              items={[
                ["Phone", helper.phone],
                ["Previous numbers", (() => {
                  const past = helper.previousPhones ?? [];
                  if (!past.length) return "—";
                  return past
                    .slice()
                    .reverse()
                    .map((p) => `${p.phone} (until ${dateTime(p.changedAt)})`)
                    .join(", ");
                })()],
                ["Name on Aadhaar", profile.aadhaarName],
                ["Aadhaar number", profile.aadhaarLast4 ? `XXXX XXXX ${profile.aadhaarLast4}` : "—"],
                ["Method", profile.kycMethod ? titleCase(profile.kycMethod) : "—"],
                ["Registered on", dateTime(helper.createdAt)],
                ["Reviewed on", profile.reviewedAt ? dateTime(profile.reviewedAt) : "Not yet reviewed"],
                ["Referral code", helper.referral ? <span key="rc" className="font-mono font-semibold tracking-[0.12em]">{helper.referral.code}</span> : "—"],
                ["Referral balance", helper.referral ? `${rupees(helper.referral.balance)} · ${helper.referral.referrals} referral${helper.referral.referrals === 1 ? "" : "s"}` : "—"],
                ["Joined with code of", helper.referral?.referredBy ? (
                  <Link key="rb" href={`/admin/${helper.referral.referredBy.role === "helper" ? "helpers" : "customers"}/${helper.referral.referredBy.id}`} className="font-medium text-forest-700 hover:underline">
                    {helper.referral.referredBy.name || helper.referral.referredBy.phone}
                  </Link>
                ) : "—"],
              ]}
            />
          </Card>

          {/* ------------------------------------------------ documents */}
          <Card>
            <SectionTitle title={`Documents (${documents.length})`} />
            {documents.length === 0 ? (
              <EmptyState title="No documents uploaded" body="The helper has not submitted any files yet." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {documents.map((doc) => (
                  <div key={doc._id} className="overflow-hidden rounded-[11px] border border-line">
                    <a href={doc.url} target="_blank" rel="noreferrer" className="block bg-sunken">
                      {doc.mimeType === "application/pdf" ? (
                        <div className="flex h-32 items-center justify-center text-sm text-ink-muted">
                          PDF — open to view
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={doc.url} alt={doc.type} className="h-32 w-full object-cover" />
                      )}
                    </a>
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink">{titleCase(doc.type)}</p>
                        <p className="truncate text-xs text-ink-muted">{relative(doc.createdAt)}</p>
                      </div>
                      <StatusBadge status={doc.status} />
                    </div>
                    {doc.status === "PENDING" && (
                      <div className="flex gap-2 border-t border-line px-3 py-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!!busy}
                          onClick={() => run(doc._id, () => api(`/api/admin/documents/${doc._id}/review`, { method: "POST", body: { status: "APPROVED" } }))}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!!busy}
                          onClick={() =>
                            run(doc._id, () =>
                              api(`/api/admin/documents/${doc._id}/review`, {
                                method: "POST",
                                body: { status: "REJECTED", remark: "Not readable — please re-upload." },
                              }),
                            )
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                    {doc.remark && <p className="border-t border-line px-3 py-2 text-xs text-ink-muted">{doc.remark}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* --------------------------------------------------- history */}
          <Card padded={false}>
            <div className="flex items-center justify-between px-5 pt-5">
              <SectionTitle title="Recent bookings" />
              <Link href={`/admin/bookings?helper=${id}`} className="-mt-3 text-[13px] font-medium text-forest-700 hover:underline">
                See all & filter →
              </Link>
            </div>
            {data.tasks.length === 0 ? (
              <EmptyState title="No jobs yet" />
            ) : (
              <Table head={["Booking", "Services", "When", "Status", "Value"]}>
                {data.tasks.map((t) => (
                  <Row key={t.id} onClick={() => router.push(`/admin/bookings/${t.id}`)}>
                    <Cell className="font-medium">{t.code}</Cell>
                    <Cell className="text-[13px] text-ink-soft">{t.services.join(", ")}</Cell>
                    <Cell className="whitespace-nowrap text-[13px] text-ink-soft">{dateTime(t.scheduledAt)}</Cell>
                    <Cell><StatusBadge status={t.status} label={t.statusLabel} /></Cell>
                    <Cell className="tabular font-medium">{rupees(t.total)}</Cell>
                  </Row>
                ))}
              </Table>
            )}
          </Card>

          {!!data.ledger?.length && (
            <Card padded={false}>
              <div className="px-5 pt-5">
                <SectionTitle title="Wallet transactions" />
              </div>
              <div className="max-h-96 overflow-y-auto">
                <Table head={["Transaction", "Type", "Amount", "Status"]}>
                  {data.ledger.map((row) => (
                    <Row key={row.id}>
                      <Cell>
                        <p className="tabular text-[12.5px]">{row.txnId}</p>
                        <p className="text-xs text-ink-muted">
                          {dateTime(row.at)}{row.taskCode ? ` · ${row.taskCode}` : ""}
                        </p>
                      </Cell>
                      <Cell className="text-[13px]">
                        {titleCase(row.type)}
                        {row.note && <p className="text-xs text-ink-muted">{row.note}</p>}
                      </Cell>
                      <Cell className={`tabular whitespace-nowrap font-medium ${row.direction === "CREDIT" ? "text-forest-700" : "text-rose-ink"}`}>
                        {row.direction === "CREDIT" ? "+" : "−"}{rupees(row.amount)}
                      </Cell>
                      <Cell><Badge tone={row.status === "SETTLED" ? "green" : row.status === "REVERSED" ? "slate" : "amber"}>{titleCase(row.status)}</Badge></Cell>
                    </Row>
                  ))}
                </Table>
              </div>
            </Card>
          )}

          {/* --------------------------------------------------- ratings */}
          <Card padded={false}>
            <div className="px-5 pt-5">
              <SectionTitle title="Ratings & Reviews" />
            </div>
            {data.ratings.length === 0 ? (
              <EmptyState title="No ratings yet" body="This helper has not received any reviews." />
            ) : (
              <div className="divide-y divide-line">
                {data.ratings.map((r) => (
                  <div key={r._id} className="p-5">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5 rounded-[6px] bg-amber-bg px-2 py-0.5 text-[13px] font-semibold text-amber-ink">
                          {r.stars} ★
                        </span>
                        <span className="text-[13px] text-ink-muted">{dateTime(r.createdAt)}</span>
                      </div>
                      {r.fromUserId && (
                        <Link
                          href={`/admin/customers/${r.fromUserId._id}`}
                          className="text-[13px] font-medium text-forest-600 hover:underline"
                        >
                          From: {r.fromUserId.name || "Customer"}
                        </Link>
                      )}
                    </div>
                    {r.comment ? (
                      <p className="text-[14px] text-ink-soft">{r.comment}</p>
                    ) : (
                      <p className="text-[14px] italic text-ink-muted">No comment left</p>
                    )}
                    {r.taskId && (
                      <Link href={`/admin/bookings/${r.taskId._id}`} className="mt-2 inline-block text-[12px] text-ink-muted hover:text-ink">
                        Booking: #{r.taskId.shortId}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <RatingsGivenPanel ratings={data.ratingsGiven} otherRole="customers" />

          <ComplaintsPanel complaints={data.complaints} />

          <RejectionsPanel rejections={data.rejections} blocked={helper.accountStatus === "blocked"} />

          <Modal
            open={adjustOpen}
            title="Adjust this helper's money"
            subtitle="Written as its own wallet transaction with a reason — balances are never edited."
            onClose={() => setAdjustOpen(false)}
          >
            <div className="grid gap-4">
              <Field label="Direction">
                <Select value={adjustDirection} onChange={(e) => setAdjustDirection(e.target.value as "CREDIT" | "DEBIT")}>
                  <option value="CREDIT">Pay the helper more (credit)</option>
                  <option value="DEBIT">Take back from the helper (debit)</option>
                </Select>
              </Field>
              <Field label="Amount (₹)">
                <Input type="number" min={1} value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
              </Field>
              <Field label="What is it for?" hint="The helper is told this.">
                <Textarea rows={2} value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="Travel allowance for a long journey" />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setAdjustOpen(false)}>Cancel</Button>
                <Button
                  disabled={!!busy || !adjustNote.trim() || !(Number(adjustAmount) > 0)}
                  onClick={() =>
                    run("adjust", async () => {
                      await api(`/api/admin/helpers/${id}/adjustment`, {
                        method: "POST",
                        body: { amount: Number(adjustAmount), direction: adjustDirection, note: adjustNote.trim() },
                      });
                      setAdjustOpen(false);
                      setAdjustAmount("");
                      setAdjustNote("");
                    })
                  }
                >
                  {busy === "adjust" ? "Saving…" : "Post adjustment"}
                </Button>
              </div>
            </div>
          </Modal>

          <Modal
            open={correctionOpen}
            title="Ask for a correction"
            subtitle="The application goes back to the helper to fix and submit again. Nothing is rejected."
            onClose={() => setCorrectionOpen(false)}
          >
            <div className="grid gap-4">
              <Field label="What needs fixing?">
                <Textarea
                  rows={3}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="The Aadhaar photo is blurred — please upload a clearer one."
                />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setCorrectionOpen(false)}>Cancel</Button>
                <Button
                  disabled={!!busy || correctionReason.trim().length < 3}
                  onClick={() =>
                    run("correction", async () => {
                      await api(`/api/admin/helpers/${id}/request-correction`, { method: "POST", body: { reason: correctionReason.trim() } });
                      setCorrectionOpen(false);
                      setCorrectionReason("");
                    })
                  }
                >
                  {busy === "correction" ? "Sending…" : "Send back for correction"}
                </Button>
              </div>
            </div>
          </Modal>
        </div>

        {/* ------------------------------------------------------ sidebar */}
        <div className="grid content-start gap-5">
          <Card>
            <div className="mb-4 flex items-center gap-3">
              <Avatar name={helper.name} src={helper.photoUrl} size={52} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={profile.approvalStatus} />
                  {profile.isOnline && <Badge tone="green">Online</Badge>}
                  {profile.dnd && <Badge tone="amber">DND</Badge>}
                </div>
                <p className="mt-1.5 text-[13px] text-ink-muted">
                  {profile.ratingCount ? `${profile.ratingAvg.toFixed(1)} ★ · ${profile.ratingCount} ratings` : "No ratings yet"}
                </p>
              </div>
            </div>
            <KeyValue
              items={[
                ["Experience", profile.experienceYears ? `${profile.experienceYears} years` : "—"],
                [
                  "Jobs shown to customers",
                  <span key="jobs" className="tabular font-semibold">{jobsLabel(profile)}</span>,
                ],
                ["Completed on Pro Helper", <span key="real" className="tabular">{profile.completedJobs}</span>],
                ["Gender", titleCase(profile.gender)],
                ["Account", <StatusBadge key="s" status={helper.accountStatus} />],
              ]}
            />
            <div className="mt-4 flex justify-end border-t border-line pt-4">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setStatsDraft({
                    experienceYears: String(profile.experienceYears ?? 0),
                    jobsShown: String(profile.jobsShown ?? DEFAULT_JOBS_SHOWN),
                  });
                  setStatsError("");
                  setStatsOpen(true);
                }}
              >
                Edit experience &amp; jobs
              </Button>
            </div>
            {profile.bio && <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-ink-soft">{profile.bio}</p>}
          </Card>

          <Card>
            <SectionTitle title="Services &amp; coverage" />
            <div className="mb-4 flex flex-wrap gap-1.5">
              {profile.services?.length ? (
                profile.services.map((s) => <Badge key={s} tone="green">{titleCase(s)}</Badge>)
              ) : (
                <span className="text-sm text-ink-muted">No services selected</span>
              )}
            </div>
            <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.05em] text-ink-muted">
              Societies
            </p>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {profile.societies?.length ? (
                profile.societies.map((s) => (
                  <Badge key={s} tone="sky">{titleCase(s.replace(/_/g, " "))}</Badge>
                ))
              ) : (
                <span className="text-sm text-ink-muted">None chosen</span>
              )}
            </div>
            <KeyValue
              items={[
                [
                  "Availability",
                  profile.dnd
                    ? "Do not disturb"
                    : profile.isOnline
                      ? "Online — taking jobs"
                      : "Offline",
                ],
                ["Coverage", profile.serviceArea?.label || "—"],
              ]}
            />
          </Card>

          <Card>
            <SectionTitle title="Money" />
            {/* UC-C26 — read off the bookings and the ledger, never a stored balance. */}
            <KeyValue
              items={[
                ["Completed jobs", String(data.money?.completedJobs ?? 0)],
                ["Gross", rupees(data.money?.gross)],
                ["Platform commission", rupees(data.money?.commission)],
                ["Adjustments", rupees(data.money?.adjustments)],
                ["Already paid", rupees(data.money?.paid)],
                ["Payable to helper", rupees(data.money?.payable)],
                ["Outstanding from helper", rupees(data.money?.outstanding)],
                ["Net earning", rupees(data.money?.netEarning)],
              ]}
            />

            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.05em] text-ink-muted">
                Payout details
              </p>
              {(() => {
                const pay = profile.paymentDetails;
                const hasUpi = Boolean(pay?.upiId);
                const hasBank = Boolean(pay?.accountNo && pay?.ifsc);
                if (!hasUpi && !hasBank) {
                  return (
                    <p className="text-sm text-ink-muted">
                      Not provided. Optional today — payment is collected directly by the helper.
                    </p>
                  );
                }
                return (
                  <KeyValue
                    items={[
                      ["Preferred", <Badge key="m" tone="sky">{pay?.method === "BANK" ? "Bank transfer" : "UPI"}</Badge>],
                      ...(hasUpi ? ([["UPI ID", pay!.upiId!]] as [string, React.ReactNode][]) : []),
                      ...(hasBank
                        ? ([
                            ["Account", `••••${pay!.accountNo!.slice(-4)}`],
                            ["IFSC", pay!.ifsc!],
                          ] as [string, React.ReactNode][])
                        : []),
                    ]}
                  />
                );
              })()}
            </div>
          </Card>
        </div>
      </div>

      {/* -------------------------------------------------------- modals */}
      <Modal
        open={statsOpen}
        title="Experience and jobs"
        subtitle="What customers see on this helper's card when they are assigned. The real completed count is kept separately and never changes here."
        onClose={() => setStatsOpen(false)}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Years of experience" hint="0 – 60. Half-years are fine.">
            <Input
              type="number"
              min={0}
              max={60}
              step={0.5}
              value={statsDraft.experienceYears}
              onChange={(e) => setStatsDraft((d) => ({ ...d, experienceYears: e.target.value }))}
            />
          </Field>
          <Field label="Jobs shown to customers" hint="Shows as “N+” until real jobs pass it. 0 shows the real count.">
            <Input
              type="number"
              min={0}
              step={1}
              value={statsDraft.jobsShown}
              onChange={(e) => setStatsDraft((d) => ({ ...d, jobsShown: e.target.value }))}
            />
          </Field>
        </div>

        <div className="mt-3 rounded-[10px] bg-sunken px-3 py-2.5 text-[13px] text-ink-soft">
          Customers will see{" "}
          <span className="font-semibold text-ink">
            {jobsLabel({ completedJobs: profile.completedJobs, jobsShown: Number(statsDraft.jobsShown) || 0 })} jobs
          </span>
          {Number(statsDraft.experienceYears) > 0 && (
            <>
              {" "}and{" "}
              <span className="font-semibold text-ink">{Number(statsDraft.experienceYears)} yrs experience</span>
            </>
          )}
          . Real completed on Pro Helper: <span className="tabular">{profile.completedJobs}</span>.
        </div>

        {statsError && <div className="mt-3"><ErrorNote>{statsError}</ErrorNote></div>}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setStatsOpen(false)}>Cancel</Button>
          <Button
            disabled={busy === "stats"}
            onClick={async () => {
              setBusy("stats");
              setStatsError("");
              try {
                await api(`/api/admin/helpers/${id}/profile`, {
                  method: "PATCH",
                  body: {
                    experienceYears: Number(statsDraft.experienceYears),
                    jobsShown: Number(statsDraft.jobsShown),
                  },
                });
                await reload();
                setStatsOpen(false);
              } catch (err) {
                setStatsError(err instanceof Error ? err.message : "Could not save.");
              } finally {
                setBusy("");
              }
            }}
          >
            {busy === "stats" ? "Saving…" : "Save"}
          </Button>
        </div>
      </Modal>

      <Modal open={rejectOpen} title="Reject this helper" onClose={() => setRejectOpen(false)}>
        <div className="grid gap-4">
          <Field label="Reason" hint="The helper sees this, so say what they need to fix.">
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Address proof is blurred — please re-upload." />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={!reason.trim() || !!busy}
              onClick={() => run("reject", () => api(`/api/admin/helpers/${id}/reject`, { method: "POST", body: { reason } }))}
            >
              {busy === "reject" ? "Rejecting…" : "Reject"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={blockOpen} title="Block this account" onClose={() => setBlockOpen(false)}>
        <div className="grid gap-4">
          <p className="text-sm text-ink-soft">
            The helper is taken offline immediately and any pending job alerts are withdrawn.
          </p>
          <Field label="Reason">
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Repeated no-shows." />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setBlockOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={!reason.trim() || !!busy}
              onClick={() => run("block", () => api(`/api/admin/users/${id}/block`, { method: "POST", body: { reason } }))}
            >
              {busy === "block" ? "Blocking…" : "Block account"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
