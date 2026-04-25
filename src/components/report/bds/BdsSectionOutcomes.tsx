import { Card } from "@/components/ui/card";
import { ReportSection } from "../ReportSection";
import { bdsOutcomeFunnel, bdsOutcomes } from "@/lib/mockBdsReport";

export const BdsSectionOutcomes = () => {
  const top = bdsOutcomeFunnel[0].count;

  return (
    <ReportSection
      id="bds-b6"
      label="B6"
      title="Tỷ lệ thành công & phiên tổ chức lại"
      keyInsight={`${bdsOutcomes.successRate}% phiên BĐS đấu giá thành công; ${bdsOutcomes.reauctionedRate}% phiên không thành được tổ chức lại trong vòng ${bdsOutcomes.reauctionWindowDays} ngày.`}
      deepDiveLabel=""
      hideDeepDive
    >
      <Card className="p-6">
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg p-4 bg-accent/10 border-l-4 border-l-accent">
            <div className="text-xs text-muted-foreground mb-1">Thành công</div>
            <div className="text-2xl font-bold text-accent">{bdsOutcomes.successRate}%</div>
          </div>
          <div className="rounded-lg p-4 bg-destructive/5 border-l-4 border-l-destructive">
            <div className="text-xs text-muted-foreground mb-1">Không thành</div>
            <div className="text-2xl font-bold text-destructive">{bdsOutcomes.failureRate}%</div>
          </div>
          <div className="rounded-lg p-4 bg-primary/5 border-l-4 border-l-primary">
            <div className="text-xs text-muted-foreground mb-1">
              Tổ chức lại trong {bdsOutcomes.reauctionWindowDays} ngày
            </div>
            <div className="text-2xl font-bold text-primary">{bdsOutcomes.reauctionedRate}%</div>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-foreground mb-3">Funnel phiên BĐS</h3>
        <div className="space-y-2.5">
          {bdsOutcomeFunnel.map((stage, idx) => {
            const widthPct = (stage.count / top) * 100;
            const opacity = 1 - idx * 0.18;
            return (
              <div key={stage.stage} className="grid grid-cols-[200px_1fr_auto] items-center gap-3">
                <div className="text-sm text-foreground truncate">{stage.stage}</div>
                <div className="relative h-7 bg-muted/60 rounded-md overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-md flex items-center px-2.5"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: `hsl(var(--primary) / ${opacity})`,
                    }}
                  >
                    <span className="text-xs font-semibold text-primary-foreground">
                      {stage.count.toLocaleString("vi-VN")}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                  {Math.round((stage.count / top) * 100)}%
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </ReportSection>
  );
};
