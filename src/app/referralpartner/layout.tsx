import { PartnerAuthProvider } from "@/lib/partnerAuth";

export const metadata = {
  title: "Referral Partner | Pro Helper",
  description: "Pro Helper Referral Partner Portal",
};

export default function ReferralPartnerLayout({ children }: { children: React.ReactNode }) {
  return <PartnerAuthProvider>{children}</PartnerAuthProvider>;
}
