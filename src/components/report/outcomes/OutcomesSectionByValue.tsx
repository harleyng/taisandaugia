import { Card } from "@/components/ui/card";
import { ReportSection } from "../ReportSection";
import { failureByValue } from "@/lib/mockOutcomesReport";

export const OutcomesSectionByValue = () => {
  const max = Math.max(...failureByValue.map((d) => d.value));

  return (
    <ReportSection
      id="outcomes-c4"
      label="C4"
      title="Theo khoảng giá trị"
      keyInsight="Phiên giá trị > 10 tỷ có tỷ lệ không thành cao gần gấp đôi phiên < 1 tỷ — vì ít nhà đầu tư đủ vốn tham gia."
      deepDiveLabel=""
      hideDeepDive
    >
      <Card className="p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Tỷ lệ KHÔNG THÀNH theo giá trị tài sản
        </p>
        <div className="space-y-3">
          {failureByValue.map((d) => (
            <div key={d.name} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-foreground">{d.name}</span>
                <span className="text-sm font-bold tabular-nums text-foreground">{d.value}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${(d.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </ReportSection>
  );
};
