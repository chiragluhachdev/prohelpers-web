"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePartnerAuth, partnerApi } from "@/lib/partnerAuth";
import { rupees, relative } from "@/lib/format";
import { Button, Card, Cell, ErrorNote, Field, Input, Modal, Row, Spinner, StatusBadge, Table, SectionTitle } from "@/components/ui";
import { Logo } from "@/components/logo";

type DashboardData = {
  code: string;
  enabled: boolean;
  rewardAmount: number;
  balance: number;
  totals: {
    totalReferrals: number;
    successfulReferrals: number;
    earned: number;
    redeemed: number;
    pendingRewards: number;
  };
  history: Array<{
    id: string; date: string; name: string; role: string; status: string; reward: number;
  }>;
  ledger: Array<{
    id: string; date: string; type: string; amount: number; name: string; note: string;
  }>;
  redemptions: Array<{
    id: string; date: string; amount: number; status: string;
  }>;
};

export default function PartnerDashboard() {
  const { user, loading, signOut } = usePartnerAuth();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  const [redeeming, setRedeeming] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState("");
  const [paymentDetails, setPaymentDetails] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [redeemSuccess, setRedeemSuccess] = useState(false);

  const loadData = async () => {
    try {
      const res = await partnerApi<DashboardData>("/api/partner/dashboard");
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard.");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) router.replace("/referralpartner/login");
    if (user) loadData();
  }, [user, loading, router]);

  const handleShare = async () => {
    if (!data?.code) return;
    const text = `Use my code ${data.code} to join Pro Helper!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Pro Helper', text });
      } catch (err) {
        console.error("Share failed", err);
      }
    } else {
      handleCopy();
    }
  };

  const handleCopy = () => {
    if (data?.code) {
      navigator.clipboard.writeText(data.code);
      alert("Referral code copied to clipboard!");
    }
  };

  const handleRedeem = async () => {
    setRedeemBusy(true);
    setRedeemError("");
    try {
      await partnerApi("/api/partner/redeem", {
        method: "POST",
        body: { amount: Number(redeemAmount), paymentDetails }
      });
      setRedeemSuccess(true);
      await loadData(); // refresh data
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setRedeemBusy(false);
    }
  };

  if (loading || fetching) return <Spinner label="Loading your dashboard…" />;
  if (!user || !data) return null;

  return (
    <div className="min-h-screen bg-surface md:bg-sunken pb-12">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Logo size={28} />
          <span className="font-semibold text-ink">Partner Portal</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-ink-soft hidden sm:block">Welcome, {user.name.split(" ")[0]} 👋</span>
          <Button variant="ghost" size="sm" onClick={signOut}>Sign Out</Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl p-4 sm:p-6 grid gap-6">
        
        {error && <ErrorNote>{error}</ErrorNote>}

        {/* Top Stats */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Earnings Card */}
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-sm font-medium text-ink-muted uppercase tracking-wider">Your Referral Earnings</p>
              <h2 className="mt-2 text-4xl font-bold text-forest-700">{rupees(data!.balance)}</h2>
              <p className="mt-1 text-sm font-medium text-forest-600/80">Available to Redeem</p>
            </div>
            <div className="mt-6 flex justify-between">
              <Button disabled={data!.balance <= 0} onClick={() => setRedeeming(true)}>
                Redeem Earnings
              </Button>
            </div>
          </div>

          {/* Referral Code Card */}
          <div className="rounded-2xl border border-forest-200 bg-forest-50 p-6 shadow-sm flex flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-forest-800 uppercase tracking-wider">Your Referral Code</p>
            <h2 className="mt-2 text-4xl font-black tracking-widest text-forest-700">{data!.code}</h2>
            <div className="mt-6 flex w-full gap-3">
              <Button className="flex-1" onClick={handleShare}>Share Code</Button>
              <Button variant="secondary" className="flex-1" onClick={handleCopy}>Copy</Button>
            </div>
            <p className="mt-4 text-xs font-medium text-forest-700/70">
              Share this code. You earn {rupees(data!.rewardAmount)} when the person you referred completes their first booking.
            </p>
          </div>
        </div>

        {/* Small Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-line bg-surface p-4 text-center shadow-sm">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Total Referrals</p>
            <p className="text-2xl font-bold text-ink">{data!.totals.totalReferrals}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 text-center shadow-sm">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Successful</p>
            <p className="text-2xl font-bold text-ink">{data!.totals.successfulReferrals}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 text-center shadow-sm">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Total Earned</p>
            <p className="text-2xl font-bold text-forest-600">{rupees(data!.totals.earned)}</p>
          </div>
        </div>

        {/* How It Works */}
        <div>
          <SectionTitle title="How It Works" />
          <Card>
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-4 p-2">
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-forest-100 text-xl font-bold text-forest-700">1</div>
              <h4 className="font-semibold text-ink mb-1">Share</h4>
              <p className="text-sm text-ink-soft">Share your unique referral code with a customer or helper.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-forest-100 text-xl font-bold text-forest-700">2</div>
              <h4 className="font-semibold text-ink mb-1">First Booking</h4>
              <p className="text-sm text-ink-soft">They register using your code and complete their first booking.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-forest-100 text-xl font-bold text-forest-700">3</div>
              <h4 className="font-semibold text-ink mb-1">Earn {rupees(data!.rewardAmount)}</h4>
              <p className="text-sm text-ink-soft">Once completed, {rupees(data!.rewardAmount)} is credited to your wallet.</p>
            </div>
          </div>
          </Card>
        </div>

        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          <h4 className="font-bold mb-1">Important Rule</h4>
          <p>
            Rewards are <strong>NOT</strong> credited immediately when someone registers. The referred user must successfully complete their <strong>first booking</strong> before the {rupees(data!.rewardAmount)} is added to your wallet.
          </p>
        </div>

        {/* Referral History */}
        <div>
          <SectionTitle title="Referral History" />
          <Card padded={false}>
          <div className="overflow-x-auto">
            <Table head={["Date", "Referred User", "Type", "Status", "Reward"]}>
              {data!.history.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-ink-soft">No referrals yet. Share your code to get started!</td></tr>
              ) : (
                data!.history.map(h => (
                  <Row key={h.id}>
                    <Cell className="whitespace-nowrap text-[13px] text-ink-muted">{relative(h.date)}</Cell>
                    <Cell className="font-medium text-ink whitespace-nowrap">{h.name}</Cell>
                    <Cell className="capitalize">{h.role}</Cell>
                    <Cell>
                      <StatusBadge status={h.status} />
                      {h.status === 'Pending' && <p className="text-[10px] text-ink-muted mt-0.5 whitespace-nowrap">Waiting for first booking</p>}
                    </Cell>
                    <Cell className="tabular text-right font-medium text-forest-600">{h.reward > 0 ? `+${rupees(h.reward)}` : rupees(0)}</Cell>
                  </Row>
                ))
              )}
            </Table>
          </div>
            </Card>
          </div>

        {/* Wallet & Redemption Details */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <SectionTitle title="Wallet Summary" />
            <Card>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-line">
                <span className="text-ink-soft">Available Balance</span>
                <span className="font-bold text-forest-700 text-lg">{rupees(data!.balance)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-ink-soft">Total Earned</span>
                <span className="font-medium text-ink">{rupees(data!.totals.earned)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-ink-soft">Total Redeemed</span>
                <span className="font-medium text-ink">{rupees(data!.totals.redeemed)}</span>
              </div>
              <div className="flex justify-between items-center text-sm pt-3 border-t border-line">
                <span className="text-ink-soft font-medium">Pending Rewards</span>
                <span className="font-medium text-yellow-600">{rupees(data!.totals.pendingRewards)}</span>
              </div>
            </div>
            </Card>
          </div>

          <div>
            <SectionTitle title="Redemption History" />
            <Card padded={false}>
            <div className="overflow-x-auto">
              <Table head={["Date", "Amount", "Status"]}>
                {data!.redemptions.length === 0 ? (
                  <tr><td colSpan={3} className="py-8 text-center text-sm text-ink-soft">No redemptions yet.</td></tr>
                ) : (
                  data!.redemptions.map(r => (
                    <Row key={r.id}>
                      <Cell className="whitespace-nowrap text-[13px] text-ink-muted">{relative(r.date)}</Cell>
                      <Cell className="tabular font-medium">{rupees(r.amount)}</Cell>
                      <Cell><StatusBadge status={r.status} /></Cell>
                    </Row>
                  ))
                )}
              </Table>
            </div>
            </Card>
          </div>
        </div>

        {/* Ledger */}
        <div>
          <SectionTitle title="Transaction History" />
          <Card padded={false}>
          <div className="overflow-x-auto">
            <Table head={["Date & Time", "Transaction", "Amount"]}>
              {data!.ledger.length === 0 ? (
                <tr><td colSpan={3} className="py-8 text-center text-ink-soft">No transactions yet.</td></tr>
              ) : (
                data!.ledger.map(l => (
                  <Row key={l.id}>
                    <Cell className="whitespace-nowrap text-[13px] text-ink-muted">
                      {new Date(l.date).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </Cell>
                    <Cell>
                      <span className="text-ink text-sm">{l.note}</span>
                      {l.name && <span className="text-ink-soft ml-1">— {l.name}</span>}
                    </Cell>
                    <Cell className={`tabular text-right font-medium whitespace-nowrap ${l.amount > 0 ? 'text-forest-600' : 'text-red-600'}`}>
                      {l.amount > 0 ? `+${rupees(l.amount)}` : `−${rupees(Math.abs(l.amount))}`}
                    </Cell>
                  </Row>
                ))
              )}
            </Table>
          </div>
          </Card>
        </div>

      </main>

      {/* Redeem Modal */}
      <Modal open={redeeming} title="Redeem Referral Earnings" onClose={() => {
        if (!redeemBusy && !redeemSuccess) setRedeeming(false);
        if (redeemSuccess) {
          setRedeeming(false);
          setRedeemSuccess(false);
          setRedeemAmount("");
          setPaymentDetails("");
        }
      }}>
        {redeemSuccess ? (
          <div className="text-center py-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-forest-100 text-3xl text-forest-600">✓</div>
            <h3 className="text-lg font-bold text-ink mb-2">Redemption Request Submitted</h3>
            <p className="text-sm text-ink-soft mb-6">
              Your request has been received. You can track its status in your wallet history.
            </p>
            <Button className="w-full" onClick={() => { setRedeeming(false); setRedeemSuccess(false); setRedeemAmount(""); setPaymentDetails(""); }}>
              Done
            </Button>
          </div>
        ) : (
          <div className="grid gap-5">
            {redeemError && <ErrorNote>{redeemError}</ErrorNote>}
            
            <div className="rounded-lg bg-sunken p-4 flex justify-between items-center">
              <span className="text-sm text-ink-soft">Available Balance</span>
              <span className="font-bold text-forest-700 text-lg">{rupees(data!.balance)}</span>
            </div>

            <Field label="Amount to Redeem (₹)">
              <Input 
                type="number" 
                inputMode="numeric"
                min="1"
                max={data!.balance}
                value={redeemAmount} 
                onChange={e => setRedeemAmount(e.target.value)} 
                placeholder="e.g. 500" 
              />
            </Field>

            <Field label="Payment Method Details">
              <Input 
                type="text" 
                value={paymentDetails} 
                onChange={e => setPaymentDetails(e.target.value)} 
                placeholder="e.g. UPI: 9876543210@ybl" 
              />
              <p className="text-xs text-ink-soft mt-1">Enter your UPI ID or Bank Account details where you want to receive the funds.</p>
            </Field>

            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" onClick={() => setRedeeming(false)}>Cancel</Button>
              <Button 
                disabled={!redeemAmount || Number(redeemAmount) <= 0 || Number(redeemAmount) > data!.balance || !paymentDetails.trim() || redeemBusy} 
                onClick={handleRedeem}
              >
                {redeemBusy ? "Submitting…" : "Request Redemption"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
