import { Card } from "@/components/ui/card";
import { ReportSection } from "./ReportSection";
import { competitionData } from "@/lib/mockMarketReport";

export const SectionCompetition = () => {
  const maxDelta = Math.max(...competitionData.map((d) => d.delta));

  return (
    <ReportSection
      id="competition"
      label="B"
      title="Cạnh tranh & chênh lệch giá"
      keyInsight="Mức chênh lệch giá trúng vs khởi điểm dao động 6× theo loại tài sản — từ +6% với BĐS đến +34% với ô tô."
      deepDiveLabel="Cạnh tranh & chênh lệch"
    >
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Chênh lệch giá trúng vs khởi điểm
        </h3>
        <p className="text-xs text-muted-foreground mb-6">
          Theo 5 loại tài sản chính · 90 ngày qua
        </p>
        <ul className="space-y-4">
          {competitionData.map((item, idx) => {
            const widthPct = (item.delta / maxDelta) * 100;
            const isHighlight = idx === 0;
            return (
              <li key={item.category} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{item.category}</span>
                  <span
                    className={`font-bold tabular-nums ${
                      isHighlight ? "text-accent" : "text-primary"
                    }`}
                  >
                    +{item.delta.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isHighlight
                        ? "bg-gradient-to-r from-accent to-accent/70"
                        : "bg-gradient-to-r from-primary to-primary/70"
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </ReportSection>
  );
};
