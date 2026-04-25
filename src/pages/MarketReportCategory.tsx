import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ReportTopNav } from "@/components/report/ReportTopNav";
import { CategoryFilterTabs } from "@/components/report/CategoryFilterTabs";
import { BdsReportContent } from "@/components/report/bds/BdsReportContent";
import { DeepReportGate } from "@/components/report/DeepReportGate";
import { ReportLockedCTA } from "@/components/report/ReportLockedCTA";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { bdsHighlights, bdsMeta, bdsTocSections } from "@/lib/mockBdsReport";

const SUPPORTED_SLUGS = ["bds"];
const CATEGORY_LABELS: Record<string, string> = {
  bds: "Bất động sản",
  oto: "Ô tô",
  "tai-san-cong": "Tài sản công",
  npl: "Nợ xấu (NPL)",
};

const ComingSoonState = ({ slug }: { slug: string }) => (
  <div className="container py-12 md:py-20">
    <Card className="max-w-2xl mx-auto p-8 md:p-10 text-center">
      <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles className="h-7 w-7 text-primary" />
      </div>
      <Badge variant="secondary" className="mb-3">
        Sắp ra mắt
      </Badge>
      <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">
        Báo cáo chuyên sâu: {CATEGORY_LABELS[slug] ?? "Danh mục này"}
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
        Phân tích chi tiết cho danh mục này đang được hoàn thiện và sẽ có mặt trong bản cập nhật
        sắp tới. Hiện tại bạn có thể xem báo cáo Bất động sản hoặc quay về báo cáo tổng quan.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Button asChild>
          <Link to="/report/bds">Xem báo cáo Bất động sản</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/report">Quay về báo cáo tổng quan</Link>
        </Button>
      </div>
    </Card>
  </div>
);

const MarketReportCategory = () => {
  const { slug = "" } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const label = CATEGORY_LABELS[slug] ?? "Danh mục";
    document.title = `Báo cáo chuyên sâu: ${label} đấu giá`;
    const meta = document.querySelector('meta[name="description"]');
    const desc = `Báo cáo chuyên sâu thị trường đấu giá ${label.toLowerCase()} tại Việt Nam.`;
    if (meta) meta.setAttribute("content", desc);
  }, [slug]);

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

  const isSupported = SUPPORTED_SLUGS.includes(slug);

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

      <CategoryFilterTabs currentSlug={slug} />

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
        ) : !isSupported ? (
          <ComingSoonState slug={slug} />
        ) : (
          <DeepReportGate
            reportSlug="bds"
            reportLabel="Bất động sản"
            highlights={bdsHighlights}
            tocSections={bdsTocSections}
            meta={`${bdsMeta.sessionCount.toLocaleString("vi-VN")} phiên · ${bdsMeta.periodDays} ngày · ${bdsMeta.totalValue.toLocaleString("vi-VN")} tỷ VND`}
            renderContent={() => <BdsReportContent />}
          />
        )}

        {session && isSupported && (
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

export default MarketReportCategory;
