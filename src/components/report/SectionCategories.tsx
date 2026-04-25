import { ArrowRight, Banknote, Building2, Car, Landmark, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ReportSection } from "./ReportSection";
import { categoryByValue, deepDiveLinks } from "@/lib/mockMarketReport";

const iconMap = {
  Building2,
  Car,
  Landmark,
  Banknote,
} as const;

// Slugs that already have a deep-dive report page
const AVAILABLE_SLUGS = new Set(["bds"]);

const formatValue = (v: number) => `${v.toLocaleString("vi-VN")} tỷ`;

export const SectionCategories = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const maxValue = Math.max(...categoryByValue.map((c) => c.value));

  const handleDetail = (slug: string, label: string) => {
    if (AVAILABLE_SLUGS.has(slug)) {
      navigate(`/report/${slug}`);
      return;
    }
    toast({
      title: "Báo cáo chuyên sâu sắp ra mắt",
      description: `Phân tích chi tiết cho danh mục "${label}" sẽ có trong bản cập nhật tới.`,
    });
  };

  return (
    <ReportSection
      id="categories"
      label="E"
      title="Danh mục phổ biến"
      keyInsight="Bất động sản dẫn dắt thị trường với 18.420 tỷ VND (62% tổng giá trị), nhưng Ô tô có mức chênh lệch lớn nhất (+34.2%)."
      deepDiveLabel=""
      hideDeepDive
    >
      <Card className="p-6 space-y-8">
        {/* CHART — Danh mục có giá trị đấu giá lớn nhất */}
        <div>
          <div className="flex items-start gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Danh mục có giá trị đấu giá lớn nhất
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tổng giá trị tài sản đã đấu giá trong 90 ngày qua (tỷ VND)
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {categoryByValue.map((c, idx) => {
              const widthPct = (c.value / maxValue) * 100;
              const opacity = 1 - idx * 0.18;
              return (
                <div key={c.name} className="grid grid-cols-[140px_1fr_auto] items-center gap-3">
                  <div className="text-sm font-medium text-foreground truncate">{c.name}</div>
                  <div className="relative h-7 bg-muted/60 rounded-md overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-md transition-all flex items-center px-2.5"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: `hsl(var(--primary) / ${opacity})`,
                      }}
                    >
                      <span className="text-xs font-semibold text-primary-foreground whitespace-nowrap">
                        {formatValue(c.value)}
                      </span>
                    </div>
                  </div>
                  <div className="inline-flex items-center justify-center min-w-[52px] h-6 px-2 rounded-full bg-accent/15 text-accent text-xs font-semibold">
                    {c.share}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border" />

        {/* 4 deep-dive cards */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Đào sâu theo danh mục
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {deepDiveLinks.map((d) => {
              const Icon = iconMap[d.iconName as keyof typeof iconMap] ?? Building2;
              return (
                <div
                  key={d.slug}
                  className="rounded-lg border border-border p-4 flex flex-col gap-3 hover:border-primary/40 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground leading-tight">
                      {d.label}
                    </h4>
                  </div>

                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{d.sessionCount}</span> phiên
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      Δ{" "}
                      <span className="font-semibold text-accent">
                        +{d.avgDelta}%
                      </span>
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                    {d.desc}
                  </p>

                  <Button
                    variant="outline"
                    size="sm"
                    className="group justify-between"
                    onClick={() => handleDetail(d.label)}
                  >
                    Xem chi tiết
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </ReportSection>
  );
};
