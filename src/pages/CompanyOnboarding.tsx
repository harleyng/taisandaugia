import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { M2KYC } from "@/components/company-onboarding/M2KYC";
import { Step5PendingReview } from "@/components/company-onboarding/M2/Step5PendingReview";
import { supabase } from "@/integrations/supabase/client";
import type { AuctionCompany } from "@/lib/mockAuctionCompanies";
import type { KYCSubmitData } from "@/components/company-onboarding/M2/KYCForm";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function dbFetch(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      Authorization: `Bearer ${token}`,
      Prefer: "return=minimal",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${body}`);
  }
  return res;
}

type Stage = "form" | "pending";

const CompanyOnboarding = () => {
  const [stage, setStage] = useState<Stage>("form");
  const [accountEmail, setAccountEmail] = useState("");
  const [pendingCompany, setPendingCompany] = useState<AuctionCompany | null>(null);

  useEffect(() => {
    const PROJECT_REF = "bcusbpkfnydqcvxxjvew";
    const raw = localStorage.getItem(`sb-${PROJECT_REF}-auth-token`);
    const session = raw ? JSON.parse(raw) : null;
    if (session?.user?.email) setAccountEmail(session.user.email);
  }, []);

  const handleComplete = async (data: KYCSubmitData) => {
    const { companyId, companyName, role, fullName, idType, idNumber, phone, contactEmail, idFront, idBack, docDkdn, docLicense, docAuth } = data;
    // Read session directly from localStorage — avoids supabase client network hang
    const PROJECT_REF = "bcusbpkfnydqcvxxjvew";
    const raw = localStorage.getItem(`sb-${PROJECT_REF}-auth-token`);
    const session = raw ? JSON.parse(raw) : null;
    const userId: string | undefined = session?.user?.id;
    const token: string | undefined = session?.access_token;

    console.log("[handleComplete] userId:", userId, "token:", token ? "ok" : "missing");
    if (!userId || !token) {
      console.warn("[handleComplete] No valid session — aborting");
      return;
    }

    // 1. Insert organizations row with PENDING_KYC
    await dbFetch("organizations", token, {
      method: "POST",
      body: JSON.stringify({
        name: companyName,
        owner_id: userId,
        kyc_status: "PENDING_KYC",
        license_info: {
          auction_org_id: companyId,
          representative_role: role,
          full_name: fullName,
          id_type: idType,
          id_number: idNumber,
          phone,
          contact_email: contactEmail,
          id_front_uploaded: idFront,
          id_back_uploaded: idBack,
          doc_dkdn: docDkdn,
          doc_license: docLicense,
          doc_auth: docAuth,
        },
      }),
    });

    // 2. Read current agent_info then patch it
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=agent_info`,
      {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.pgrst.object+json",
        },
      }
    );
    const profile = profileRes.ok ? await profileRes.json() : null;
    const agentInfo = (profile?.agent_info as Record<string, unknown>) || {};
    const basic = (agentInfo.basic as Record<string, unknown>) || {};

    await dbFetch(`profiles?id=eq.${userId}`, token, {
      method: "PATCH",
      body: JSON.stringify({
        agent_info: {
          ...agentInfo,
          basic: { ...basic, role: "company_pending", auction_org_id: companyId },
        },
      }),
    });

    // 3. Show pending screen
    setPendingCompany({ id: companyId, name: companyName, taxCode: "", address: "", province: "", phone: phone || "", linkedAccountId: null });
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
