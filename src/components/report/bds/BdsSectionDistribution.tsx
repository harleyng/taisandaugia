import { Card } from "@/components/ui/card";
import { ReportSection } from "../ReportSection";
import { bdsDistribution } from "@/lib/mockBdsReport";

export const BdsSectionDistribution = () => {
  const max = Math.max(...bdsDistribution.map((d) => d.count));
  const total = bdsDistribution.reduce((sum, d) => sum + d.count, 0);

  return (
    <ReportSection
      id="bds-b3"
      label="B3"
      title="Phân phối chênh lệch (toàn thị trường BĐS)"
      keyInsight="Phân phối lệch phải rõ rệt: 50% phiên có chênh dưới 12% (median), nhưng 10% phiên chênh trên 50% — bidding war thực sự."
      deepDiveLabel=""
      hideDeepDive
    >
      <Card className="p-6">
        <p className="text-sm font-semibold text-foreground mb-1">Số phiên theo khoảng chênh lệch</p>
        <p className="text-xs text-muted-foreground mb-6">
          Tổng {total.toLocaleString("vi-VN")} phiên — phân phối theo bucket 10%.
        </p>

        <div className="flex items-end gap-2 h-48 border-b border-border pb-1">
          {bdsDistribution.map((d) => {
            const heightPct = (d.count / max) * 100;
            return (
              <div key={d.bucket} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-semibold text-foreground tabular-nums">
                  {d.count}
                </span>
                <div
                  className="w-full rounded-t transition-all hover:bg-primary"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: "hsl(var(--primary) / 0.7)",
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex items-start gap-2 mt-2">
          {bdsDistribution.map((d) => (
            <div key={d.bucket} className="flex-1 text-center text-[10px] text-muted-foreground">
              {d.bucket}
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-3 text-sm">
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="text-xs text-muted-foreground mb-0.5">Median</div>
            <div className="font-semibold text-foreground">50% phiên chênh &lt; 12%</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="text-xs text-muted-foreground mb-0.5">Bidding war</div>
            <div className="font-semibold text-foreground">10% phiên chênh &gt; 50%</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="text-xs text-muted-foreground mb-0.5">Deal hiếm</div>
            <div className="font-semibold text-foreground">12% phiên ≤ giá khởi điểm</div>
          </div>
        </div>
      </Card>
    </ReportSection>
  );
};
