"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { dateTime, relative, rupees, titleCase } from "@/lib/format";
import {
  Avatar, Badge, Button, Card, Cell, EmptyState, ErrorNote, Field,
  KeyValue, Modal, PageHeader, Row, SectionTitle, Spinner, StatusBadge,
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
  };
  profile: {
    gender?: string; experienceYears?: number; bio?: string;
    aadhaarLast4?: string; aadhaarName?: string; kycStatus: string; kycMethod?: string; kycVerifiedAt?: string;
    approvalStatus: string; rejectionReason?: string; submittedAt?: string; reviewedAt?: string;
    services: string[]; serviceArea?: { label?: string; lat?: number; lng?: number; radiusKm?: number };
    workDays: number[]; workStart: string; workEnd: string;
    isOnline: boolean; dnd: boolean; ratingAvg: number; ratingCount: number; completedJobs: number;
  } | null;
  documents: Doc[];
  tasks: { id: string; code: string; status: string; statusLabel: string; services: string[]; total: number; scheduledAt: string }[];
  ratings: { _id: string; stars: number; comment?: string; createdAt: string }[];
  earnings: Record<string, number>;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function HelperDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<Detail>(`/api/admin/helpers/${id}`);

  const [busy, setBusy] = useState("");
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
      <Link href="/helpers" className="mb-4 inline-block text-[13px] font-medium text-ink-muted hover:text-ink">
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
                ["Name on Aadhaar", profile.aadhaarName],
                ["Aadhaar number", profile.aadhaarLast4 ? `XXXX XXXX ${profile.aadhaarLast4}` : "—"],
                ["Verified on", profile.kycVerifiedAt ? dateTime(profile.kycVerifiedAt) : "—"],
                ["Submitted for review", profile.submittedAt ? dateTime(profile.submittedAt) : "Not submitted"],
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
            <div className="px-5 pt-5">
              <SectionTitle title="Recent bookings" />
            </div>
            {data.tasks.length === 0 ? (
              <EmptyState title="No jobs yet" />
            ) : (
              <Table head={["Booking", "Services", "When", "Status", "Value"]}>
                {data.tasks.map((t) => (
                  <Row key={t.id} onClick={() => (window.location.href = `/bookings/${t.id}`)}>
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
                ["Jobs completed", profile.completedJobs],
                ["Gender", titleCase(profile.gender)],
                ["Account", <StatusBadge key="s" status={helper.accountStatus} />],
              ]}
            />
            {profile.bio && <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-ink-soft">{profile.bio}</p>}
          </Card>

          <Card>
            <SectionTitle title="Services & availability" />
            <div className="mb-4 flex flex-wrap gap-1.5">
              {profile.services?.length ? (
                profile.services.map((s) => <Badge key={s} tone="green">{titleCase(s)}</Badge>)
              ) : (
                <span className="text-sm text-ink-muted">No services selected</span>
              )}
            </div>
            <KeyValue
              items={[
                ["Service area", profile.serviceArea?.label || "—"],
                ["Radius", profile.serviceArea?.radiusKm ? `${profile.serviceArea.radiusKm} km` : "—"],
                ["Hours", `${profile.workStart} – ${profile.workEnd}`],
                ["Days", profile.workDays?.map((d) => DAYS[d]).join(", ") || "—"],
              ]}
            />
          </Card>

          <Card>
            <SectionTitle title="Money" />
            <KeyValue
              items={[
                ["Earned", rupees(data.earnings?.JOB_EARNING)],
                ["Commission owed", rupees(data.earnings?.PLATFORM_COMMISSION)],
                ["Paid out", rupees(data.earnings?.PAYOUT)],
              ]}
            />
          </Card>
        </div>
      </div>

      {/* -------------------------------------------------------- modals */}
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
