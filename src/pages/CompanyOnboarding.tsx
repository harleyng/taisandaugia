import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { M2KYC } from "@/components/company-onboarding/M2KYC";
import { Step5PendingReview } from "@/components/company-onboarding/M2/Step5PendingReview";
import { supabase } from "@/integrations/supabase/client";
import type { AuctionCompany } from "@/lib/mockAuctionCompanies";

type Stage = "form" | "pending";

const CompanyOnboarding = () => {
  const [stage, setStage] = useState<Stage>("form");
  const [accountEmail, setAccountEmail] = useState("");
  const [pendingCompany, setPendingCompany] = useState<AuctionCompany | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setAccountEmail(session.user.email ?? "");
    });
  }, []);

  const handleComplete = async (companyId: string, companyName: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

    const userId = session.user.id;

    // 1. Insert organizations row with PENDING_KYC
    await supabase.from("organizations").insert({
      name: companyName,
      owner_id: userId,
      kyc_status: "PENDING_KYC",
      license_info: { auction_org_id: companyId } as never,
    });

    // 2. Mark profile as company_pending so CompanyTab knows a submission exists
    const { data: profile } = await supabase
      .from("profiles")
      .select("agent_info")
      .eq("id", userId)
      .single();

    const agentInfo = (profile?.agent_info as Record<string, unknown>) || {};
    const basic = (agentInfo.basic as Record<string, unknown>) || {};
    await supabase
      .from("profiles")
      .update({
        agent_info: {
          ...agentInfo,
          basic: { ...basic, role: "company_pending", auction_org_id: companyId },
        } as never,
      })
      .eq("id", userId);

    // 3. Show pending screen
    setPendingCompany({ id: companyId, name: companyName, taxCode: "", address: "", province: "", phone: "", linkedAccountId: null });
    setStage("pending");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {stage === "form" && (
          <M2KYC accountEmail={accountEmail} onComplete={handleComplete} />
        )}
        {stage === "pending" && pendingCompany && (
          <div className="py-12 px-4">
            <div className="max-w-lg mx-auto">
              <Step5PendingReview company={pendingCompany} />
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default CompanyOnboarding;
