import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ReportTopNav } from "@/components/report/ReportTopNav";
import { ReportHero } from "@/components/report/ReportHero";
import { ReportTOC } from "@/components/report/ReportTOC";
import { ReportHighlights } from "@/components/report/ReportHighlights";
import { SectionOverview } from "@/components/report/SectionOverview";
import { SectionCompetition } from "@/components/report/SectionCompetition";
import { SectionOutcomes } from "@/components/report/SectionOutcomes";
import { SectionPriceTrend } from "@/components/report/SectionPriceTrend";
import { SectionCategories } from "@/components/report/SectionCategories";
import { ReportSubscribeForm } from "@/components/report/ReportSubscribeForm";
import { ReportLockedCTA } from "@/components/report/ReportLockedCTA";
import { Skeleton } from "@/components/ui/skeleton";

const MarketReport = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    document.title = "Báo cáo thị trường đấu giá tài sản Việt Nam";
    const meta = document.querySelector('meta[name="description"]');
    const desc =
      "Báo cáo định kỳ về thị trường đấu giá tài sản Việt Nam: tổng quan, cạnh tranh, kết quả và xu hướng giá.";
    if (meta) meta.setAttribute("content", desc);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = desc;
      document.head.appendChild(m);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <ReportTopNav />
      <main>
        <ReportHero />

        <div className="container py-8 md:py-12">
          <div className="grid lg:grid-cols-[240px_1fr] gap-8 lg:gap-10">
            <ReportTOC />

            <div className="min-w-0 space-y-2">
              <ReportHighlights />

              {authLoading ? (
                <div className="space-y-4 pt-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : session ? (
                <>
                  <SectionOverview />
                  <SectionCompetition />
                  <SectionOutcomes />
                  <SectionPriceTrend />
                  <SectionCategories />
                  <ReportSubscribeForm />
                </>
              ) : (
                <div className="pt-4">
                  <ReportLockedCTA />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MarketReport;
