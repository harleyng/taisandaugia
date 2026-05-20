import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { M2KYC } from "@/components/company-onboarding/M2KYC";
import { ActivationSuccess } from "@/components/company-onboarding/ActivationSuccess";
import { supabase } from "@/integrations/supabase/client";

const CompanyOnboarding = () => {
  const [done, setDone] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setAccountEmail(session.user.email ?? "");
    });
  }, []);

  const handleComplete = () => {
    setDone(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) return;
      supabase
        .from("profiles")
        .select("agent_info")
        .eq("id", session.user.id)
        .single()
        .then(({ data: profile }) => {
          const agentInfo = (profile?.agent_info as Record<string, unknown>) || {};
          const basic = (agentInfo.basic as Record<string, unknown>) || {};
          return supabase
            .from("profiles")
            .update({
              agent_info: {
                ...agentInfo,
                basic: { ...basic, role: "company" },
              } as never,
            })
            .eq("id", session.user.id);
        })
        .catch((e) => console.error("Failed to save company role:", e));
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        {!done ? (
          <M2KYC accountEmail={accountEmail} onComplete={handleComplete} />
        ) : (
          <div className="py-12 px-4">
            <div className="max-w-md mx-auto">
              <ActivationSuccess />
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default CompanyOnboarding;
