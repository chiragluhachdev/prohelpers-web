"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePartnerAuth, partnerApi } from "@/lib/partnerAuth";
import { rupees, relative } from "@/lib/format";
import { Button, Card, ErrorNote, Field, Input, Modal, Spinner, StatusBadge, SectionTitle } from "@/components/ui";
import { Logo } from "@/components/logo";

// --- Icons ---
const HomeIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} className={active ? "text-forest-600" : "text-ink-soft"} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const WalletIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} className={active ? "text-forest-600" : "text-ink-soft"} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5m-9 0h9m-9 0a2 2 0 110-4h9m-9 4a2 2 0 100-4m0 4v2m0-6V7" />
  </svg>
);

const ProfileIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} className={active ? "text-forest-600" : "text-ink-soft"} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const CameraIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-white" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

type DashboardData = {
  code: string;
  enabled: boolean;
  rewardAmount: number;
  balance: number;
  totals: { totalReferrals: number; successfulReferrals: number; earned: number; redeemed: number; pendingRewards: number; };
  history: Array<{ id: string; date: string; name: string; role: string; status: string; reward: number; }>;
  ledger: Array<{ id: string; date: string; type: string; amount: number; name: string; note: string; }>;
  redemptions: Array<{ id: string; date: string; amount: number; status: string; }>;
};

export default function PartnerDashboard() {
  const { user, loading, signOut, reloadUser, requestOtp, verifyOtpAndSignIn } = usePartnerAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"home" | "wallet" | "profile">("home");

  const [data, setData] = useState<DashboardData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  const [redeeming, setRedeeming] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState("");
  const [paymentDetails, setPaymentDetails] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [redeemSuccess, setRedeemSuccess] = useState(false);

  const [needsName, setNeedsName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameBusy, setNameBusy] = useState(false);

  // Profile Edit State
  const [editingName, setEditingName] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileLang, setProfileLang] = useState("English");

  // Phone Change State
  const [changingPhone, setChangingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState<"phone" | "otp">("phone");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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
    if (user && !user.name) {
      setNeedsName(true);
      setFetching(false);
    } else if (user) {
      loadData();
      setProfileName(user.name);
      setProfileLang(localStorage.getItem("partnerLang") || "English");
    }
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
      await loadData();
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setRedeemBusy(false);
    }
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setNameBusy(true);
    try {
      await partnerApi("/api/partner/profile", { method: "PUT", body: { name: nameInput.trim() } });
      await reloadUser();
      setNeedsName(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save name.");
    } finally {
      setNameBusy(false);
    }
  };

  const handleUpdateProfileName = async () => {
    if (!profileName.trim() || profileName === user?.name) {
      setEditingName(false);
      return;
    }
    try {
      await partnerApi("/api/partner/profile", { method: "PUT", body: { name: profileName.trim() } });
      await reloadUser();
      setEditingName(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save name.");
    }
  };

  const handleLangChange = (lang: string) => {
    setProfileLang(lang);
    localStorage.setItem("partnerLang", lang);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      // NOTE: Using a custom fetch here since our generic partnerApi currently sets Content-Type to JSON automatically
      const token = localStorage.getItem("partner_token");
      const res = await fetch("/api/partner/profile/photo", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to upload photo");
      }
      await reloadUser();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePhoneRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneBusy(true);
    setPhoneError("");
    try {
      const { devCode, dummyAuth } = await requestOtp(newPhone);
      if (devCode) setPhoneCode(devCode);
      if (dummyAuth && !devCode) setPhoneCode("123456");
      setPhoneStep("otp");
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : "Failed to send OTP.");
    } finally {
      setPhoneBusy(false);
    }
  };

  const handlePhoneVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneBusy(true);
    setPhoneError("");
    try {
      await verifyOtpAndSignIn(newPhone, phoneCode);
      await reloadUser();
      setChangingPhone(false);
      setNewPhone("");
      setPhoneCode("");
      setPhoneStep("phone");
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : "Invalid code.");
    } finally {
      setPhoneBusy(false);
    }
  };

  if (loading || fetching) return <Spinner label="Loading your dashboard…" />;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-surface md:bg-sunken pb-20 md:pb-12">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Logo size={28} />
          <span className="font-semibold text-ink">Partner Portal</span>
        </div>
        <div className="hidden sm:flex items-center gap-4">
          <span className="text-sm font-medium text-ink-soft">Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""} 👋</span>
          <Button variant="ghost" size="sm" onClick={signOut}>Sign Out</Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl p-4 sm:p-6 grid gap-6">
        {error && <ErrorNote>{error}</ErrorNote>}

        {!data ? null : (
          <>
            {/* ---------------- HOME TAB ---------------- */}
            {activeTab === "home" && (
              <div className="space-y-6 fade-in">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-forest-200 bg-forest-50 p-6 shadow-sm flex flex-col items-center justify-center text-center">
                    <p className="text-sm font-medium text-forest-800 uppercase tracking-wider">Your Referral Code</p>
                    <h2 className="mt-2 text-4xl font-black tracking-widest text-forest-700">{data.code}</h2>
                    <div className="mt-6 flex w-full gap-3">
                      <Button className="flex-1" onClick={handleShare}>Share Code</Button>
                      <Button variant="secondary" className="flex-1" onClick={handleCopy}>Copy</Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-line bg-surface p-4 text-center shadow-sm flex flex-col justify-center">
                      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Total Referrals</p>
                      <p className="text-2xl font-bold text-ink">{data.totals.totalReferrals}</p>
                    </div>
                    <div className="rounded-xl border border-line bg-surface p-4 text-center shadow-sm flex flex-col justify-center">
                      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Successful</p>
                      <p className="text-2xl font-bold text-ink">{data.totals.successfulReferrals}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <SectionTitle title="How It Works" />
                  <Card>
                    <div className="grid gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-100 text-sm font-bold text-forest-700">1</div>
                        <div>
                          <h4 className="font-semibold text-ink text-sm">Share your code</h4>
                          <p className="text-xs text-ink-soft mt-0.5">Share your unique code with anyone.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-100 text-sm font-bold text-forest-700">2</div>
                        <div>
                          <h4 className="font-semibold text-ink text-sm">First Booking</h4>
                          <p className="text-xs text-ink-soft mt-0.5">They register and complete a booking.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-100 text-sm font-bold text-forest-700">3</div>
                        <div>
                          <h4 className="font-semibold text-ink text-sm">Earn {rupees(data.rewardAmount)}</h4>
                          <p className="text-xs text-ink-soft mt-0.5">Money is added to your wallet instantly.</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>

                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800 flex items-start gap-2">
                  <span className="text-lg leading-none">⚠️</span>
                  <p><strong>Note:</strong> Rewards are credited only after the referred user completes their <strong>first booking</strong>.</p>
                </div>

                <div>
                  <SectionTitle title="Referral History" />
                  <div className="rounded-xl border border-line bg-surface shadow-sm overflow-hidden">
                    {data.history.length === 0 ? (
                      <div className="p-8 text-center text-ink-soft text-sm">No referrals yet. Share your code to get started!</div>
                    ) : (
                      <ul className="divide-y divide-line">
                        {data.history.map(h => (
                          <li key={h.id} className="p-4 flex items-center justify-between">
                            <div>
                              <p className="font-medium text-ink">{h.name}</p>
                              <p className="text-xs text-ink-muted mt-1">{relative(h.date)} &middot; <span className="capitalize">{h.role}</span></p>
                            </div>
                            <div className="text-right">
                              {h.status === 'Completed' ? (
                                <p className="font-bold text-forest-600">+{rupees(h.reward)}</p>
                              ) : (
                                <StatusBadge status={h.status} />
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- WALLET TAB ---------------- */}
            {activeTab === "wallet" && (
              <div className="space-y-6 fade-in">
                <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink-muted uppercase tracking-wider">Your Referral Earnings</p>
                    <h2 className="mt-2 text-4xl font-bold text-forest-700">{rupees(data.balance)}</h2>
                    <p className="mt-1 text-sm font-medium text-forest-600/80">Available to Redeem</p>
                  </div>
                  <div className="mt-6">
                    <Button className="w-full" disabled={data.balance <= 0} onClick={() => setRedeeming(true)}>
                      Redeem Earnings
                    </Button>
                  </div>
                </div>

                <div>
                  <SectionTitle title="Wallet Summary" />
                  <Card>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-ink-soft">Total Earned</span>
                      <span className="font-medium text-ink">{rupees(data.totals.earned)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-ink-soft">Total Redeemed</span>
                      <span className="font-medium text-ink">{rupees(data.totals.redeemed)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-3 border-t border-line">
                      <span className="text-ink-soft font-medium">Pending Rewards</span>
                      <span className="font-medium text-yellow-600">{rupees(data.totals.pendingRewards)}</span>
                    </div>
                  </div>
                  </Card>
                </div>

                <div>
                  <SectionTitle title="Redemption History" />
                  <div className="rounded-xl border border-line bg-surface shadow-sm overflow-hidden">
                    {data.redemptions.length === 0 ? (
                      <div className="p-8 text-center text-ink-soft text-sm">No redemptions yet.</div>
                    ) : (
                      <ul className="divide-y divide-line">
                        {data.redemptions.map(r => (
                          <li key={r.id} className="p-4 flex items-center justify-between">
                            <div>
                              <p className="font-medium text-ink">{rupees(r.amount)}</p>
                              <p className="text-xs text-ink-muted mt-1">{relative(r.date)}</p>
                            </div>
                            <StatusBadge status={r.status} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div>
                  <SectionTitle title="Transaction History" />
                  <div className="rounded-xl border border-line bg-surface shadow-sm overflow-hidden">
                    {data.ledger.length === 0 ? (
                      <div className="p-8 text-center text-ink-soft text-sm">No transactions yet.</div>
                    ) : (
                      <ul className="divide-y divide-line">
                        {data.ledger.map(l => (
                          <li key={l.id} className="p-4 flex items-center justify-between">
                            <div className="pr-4">
                              <p className="font-medium text-ink text-sm">
                                {l.note} {l.name && <span className="text-ink-soft ml-1 whitespace-nowrap">— {l.name}</span>}
                              </p>
                              <p className="text-xs text-ink-muted mt-1">
                                {new Date(l.date).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={`font-bold tabular ${l.amount > 0 ? 'text-forest-600' : 'text-red-600'}`}>
                                {l.amount > 0 ? `+${rupees(l.amount)}` : `−${rupees(Math.abs(l.amount))}`}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- PROFILE TAB ---------------- */}
            {activeTab === "profile" && (
              <div className="space-y-6 fade-in">
                
                {/* Profile Header Card */}
                <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm flex flex-col items-center">
                  <div className="relative group cursor-pointer mb-4" onClick={() => fileInputRef.current?.click()}>
                    <div className="h-24 w-24 rounded-full overflow-hidden bg-forest-100 flex items-center justify-center border-4 border-white shadow-sm">
                      {user.photoUrl ? (
                        <img src={user.photoUrl} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-3xl text-forest-700 font-bold">{user.name?.charAt(0) || "P"}</span>
                      )}
                      {uploadingPhoto && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Spinner />
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-0 right-0 bg-forest-600 rounded-full p-2 shadow-md hover:bg-forest-700 transition">
                      <CameraIcon />
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                  </div>
                  
                  {editingName ? (
                    <div className="flex items-center gap-2 w-full max-w-xs">
                      <Input value={profileName} onChange={e => setProfileName(e.target.value)} autoFocus />
                      <Button size="sm" onClick={handleUpdateProfileName}>Save</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-ink">{user.name}</h2>
                      <button onClick={() => setEditingName(true)} className="text-forest-600 text-sm font-medium hover:underline">Edit</button>
                    </div>
                  )}
                  <p className="text-ink-soft text-sm mt-1">Referral Partner</p>
                </div>

                {/* Settings Card */}
                <Card padded={false}>
                  <div className="divide-y divide-line">
                    
                    {/* Phone Number */}
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-ink">Mobile Number</p>
                          <p className="text-sm text-ink-soft mt-1">{user.phone}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setChangingPhone(true)}>Change</Button>
                      </div>
                    </div>

                    {/* Language Preference */}
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-ink">Language</p>
                          <p className="text-sm text-ink-soft mt-1">{profileLang}</p>
                        </div>
                        <select 
                          className="text-sm bg-sunken border border-line rounded-md px-2 py-1 text-ink focus:outline-none focus:ring-1 focus:ring-forest-500"
                          value={profileLang}
                          onChange={(e) => handleLangChange(e.target.value)}
                        >
                          <option>English</option>
                          <option>Hindi</option>
                          <option>Marathi</option>
                        </select>
                      </div>
                    </div>

                  </div>
                </Card>

                {/* Sign Out (Visible on Mobile here, visible on Header for Desktop) */}
                <div className="sm:hidden mt-8">
                  <Button variant="ghost" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={signOut}>
                    Sign Out
                  </Button>
                </div>

              </div>
            )}
          </>
        )}
      </main>

      {/* ---------------- MOBILE BOTTOM NAVBAR ---------------- */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-surface border-t border-line pb-safe pt-2 px-4 flex justify-around sm:hidden shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
        <button 
          onClick={() => setActiveTab("home")} 
          className="flex flex-col items-center gap-1 p-2 flex-1"
        >
          <HomeIcon active={activeTab === "home"} />
          <span className={`text-[10px] font-medium ${activeTab === "home" ? "text-forest-700" : "text-ink-soft"}`}>Home</span>
        </button>
        <button 
          onClick={() => setActiveTab("wallet")} 
          className="flex flex-col items-center gap-1 p-2 flex-1"
        >
          <WalletIcon active={activeTab === "wallet"} />
          <span className={`text-[10px] font-medium ${activeTab === "wallet" ? "text-forest-700" : "text-ink-soft"}`}>Wallet</span>
        </button>
        <button 
          onClick={() => setActiveTab("profile")} 
          className="flex flex-col items-center gap-1 p-2 flex-1"
        >
          <ProfileIcon active={activeTab === "profile"} />
          <span className={`text-[10px] font-medium ${activeTab === "profile" ? "text-forest-700" : "text-ink-soft"}`}>Profile</span>
        </button>
      </div>

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
               <span className="font-bold text-forest-700 text-lg">{rupees(data?.balance || 0)}</span>
            </div>

            <Field label="Amount to Redeem (₹)">
              <Input 
                type="number" 
                inputMode="numeric"
                min="1"
                max={data?.balance || 0}
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
                disabled={!redeemAmount || Number(redeemAmount) <= 0 || Number(redeemAmount) > (data?.balance || 0) || !paymentDetails.trim() || redeemBusy} 
                onClick={handleRedeem}
              >
                {redeemBusy ? "Submitting…" : "Request Redemption"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Name Setup Modal */}
      <Modal open={needsName} title="Welcome to Referral Partners" onClose={() => {}}>
        <div className="grid gap-5 py-2">
          <p className="text-sm text-ink-soft leading-relaxed">
            Please enter your full name so we can set up your account and generate your referral code.
          </p>
          <Field label="Your Full Name">
            <Input 
              autoFocus
              type="text" 
              value={nameInput} 
              onChange={e => setNameInput(e.target.value)} 
              placeholder="e.g. Ramesh Kumar" 
            />
          </Field>
          <Button 
            disabled={!nameInput.trim() || nameBusy} 
            onClick={handleSaveName}
            className="mt-2 w-full"
          >
            {nameBusy ? "Saving…" : "Complete Registration"}
          </Button>
        </div>
      </Modal>

      {/* Change Phone Modal */}
      <Modal open={changingPhone} title="Change Mobile Number" onClose={() => { if (!phoneBusy) { setChangingPhone(false); setPhoneStep("phone"); } }}>
        <div className="grid gap-5">
          {phoneError && <ErrorNote>{phoneError}</ErrorNote>}
          {phoneStep === "phone" ? (
            <form onSubmit={handlePhoneRequest} className="grid gap-4">
              <p className="text-sm text-ink-soft">Enter your new mobile number. You will need to verify it with an OTP.</p>
              <Field label="New Mobile Number">
                <Input type="tel" autoFocus value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="e.g. 9876543210" />
              </Field>
              <Button type="submit" disabled={phoneBusy || newPhone.length < 10}>{phoneBusy ? "Sending…" : "Send OTP"}</Button>
            </form>
          ) : (
            <form onSubmit={handlePhoneVerify} className="grid gap-4">
              <p className="text-sm text-ink-soft">Enter the 6-digit OTP sent to {newPhone}.</p>
              <Field label="Enter OTP">
                <Input type="text" autoFocus value={phoneCode} onChange={e => setPhoneCode(e.target.value)} placeholder="123456" maxLength={6} />
              </Field>
              <Button type="submit" disabled={phoneBusy || phoneCode.length !== 6}>{phoneBusy ? "Verifying…" : "Verify & Change"}</Button>
              <p className="text-center text-sm text-ink-soft mt-2">
                <button type="button" onClick={() => { setPhoneStep("phone"); setPhoneCode(""); }} className="font-medium text-forest-600 hover:underline">Change number</button>
              </p>
            </form>
          )}
        </div>
      </Modal>

    </div>
  );
}
