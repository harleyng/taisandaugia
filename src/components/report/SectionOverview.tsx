import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ReportSection } from "./ReportSection";
import { provinceDistribution, topProvinces } from "@/lib/mockMarketReport";

export const SectionOverview = () => {
  const maxCount = Math.max(...provinceDistribution.map((p) => p.count));

  return (
    <ReportSection
      id="overview"
      label="A"
      title="Tổng quan thị trường"
      keyInsight="Thị trường đấu giá tài sản VN tăng 8% YoY, dẫn dắt bởi BĐS (62% tổng giá trị)."
      deepDiveLabel="Tổng quan thị trường"
    >
      <Card className="p-6">
        <div className="grid md:grid-cols-[1.2fr_1fr] gap-6">
          {/* "Map" — bubble cloud */}
          <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg p-6 min-h-[280px] flex flex-wrap items-center justify-center gap-3 content-center border border-border/60">
            {provinceDistribution.map((p) => {
              const ratio = p.count / maxCount;
              const size = 36 + ratio * 56;
              const opacity = 0.4 + ratio * 0.6;
              return (
                <button
                  key={p.name}
                  type="button"
                  title={`${p.name}: ${p.count} phiên`}
                  className="rounded-full flex items-center justify-center text-primary-foreground font-semibold text-xs hover:scale-110 transition-transform cursor-pointer shadow-sm"
                  style={{
                    width: size,
                    height: size,
                    backgroundColor: `hsl(var(--primary) / ${opacity})`,
                  }}
                >
                  {ratio > 0.55 ? p.count : ""}
                </button>
              );
            })}
          </div>

          {/* Top 5 list */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Top 5 tỉnh có nhiều phiên nhất
              </h3>
            </div>
            <ul className="space-y-2.5">
              {topProvinces.map((p, idx) => (
                <li
                  key={p.name}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-foreground">{p.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-primary">{p.count} phiên</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-4 italic">
              → Click tỉnh để filter cơ sở dữ liệu
            </p>
          </div>
        </div>
      </Card>
    </ReportSection>
  );
};
