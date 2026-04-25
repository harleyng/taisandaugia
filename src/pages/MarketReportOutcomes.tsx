import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ReportTopNav } from "@/components/report/ReportTopNav";
import { ReportLockedCTA } from "@/components/report/ReportLockedCTA";
import { OutcomesContent } from "@/components/report/outcomes/OutcomesContent";
import { DeepReportGate } from "@/components/report/DeepReportGate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { outcomesHighlights, outcomesMeta, outcomesTocSections } from "@/lib/mockOutcomesReport";

const MarketReportOutcomes = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    document.title = "Báo cáo chuyên sâu: Kết quả & Nguyên nhân không thành";
    const meta = document.querySelector('meta[name="description"]');
    const desc =
      "Phân tích chi tiết tỷ lệ phiên đấu giá không thành theo loại tài sản, khu vực, giá trị và pattern đấu lại.";
    if (meta) meta.setAttribute("content", desc);
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

      <div className="container pt-4">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link to="/report">
            <ArrowLeft className="h-4 w-4" />
            Quay về Báo cáo tổng quan
          </Link>
        </Button>
      </div>

      <main>
        {authLoading ? (
          <div className="container py-12 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !session ? (
          <div className="container py-12">
            <ReportLockedCTA />
          </div>
        ) : (
          <DeepReportGate
            reportSlug="outcomes"
            reportLabel="Kết quả & không thành"
            highlights={outcomesHighlights}
            tocSections={outcomesTocSections}
            meta={`${outcomesMeta.sessionCount.toLocaleString("vi-VN")} phiên · ${outcomesMeta.periodDays} ngày · cập nhật ${outcomesMeta.updatedAt}`}
            renderContent={() => <OutcomesContent />}
          />
        )}

        {session && (
          <div className="container pb-10">
            <Button asChild variant="ghost" size="sm" className="-ml-3">
              <Link to="/report">
                <ArrowLeft className="h-4 w-4" />
                Quay lại Báo cáo tổng quan
              </Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default MarketReportOutcomes;
