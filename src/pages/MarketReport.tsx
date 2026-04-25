import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Gavel } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ReportTopNav } from "@/components/report/ReportTopNav";
import { ReportHero } from "@/components/report/ReportHero";
import { ReportTOC } from "@/components/report/ReportTOC";
import { ReportHighlights } from "@/components/report/ReportHighlights";
import { PeriodPickerCompact } from "@/components/report/PeriodPickerCompact";
import { reportMeta } from "@/lib/mockMarketReport";
import { latestPeriodId } from "@/lib/reportPeriods";
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
  const [periodId, setPeriodId] = useState<string>(() => latestPeriodId("month"));

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

            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <PeriodPickerCompact
                  value={periodId}
                  onChange={setPeriodId}
                  className="flex-1 min-w-[260px]"
                />
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Gavel className="h-4 w-4" />
                  <span className="font-semibold text-foreground">
                    {reportMeta.sessionCount.toLocaleString("vi-VN")}
                  </span>
                  phiên
                </span>
              </div>

              <ReportHighlights periodId={periodId} />

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
                <div className="pt-4 space-y-6">
                  <ReportLockedCTA />
                  <div aria-hidden className="pointer-events-none select-none opacity-30 blur-[3px] space-y-2">
                    <SectionOverview />
                    <SectionCompetition />
                    <SectionOutcomes />
                    <SectionPriceTrend />
                    <SectionCategories />
                  </div>
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
