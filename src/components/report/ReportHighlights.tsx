import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { highlights, reportMeta } from "@/lib/mockMarketReport";
import { formatPeriodLabel } from "@/lib/reportPeriods";

const numberLabels = ["❶", "❷", "❸", "❹", "❺"];

interface ReportHighlightsProps {
  periodId?: string;
}

export const ReportHighlights = ({ periodId }: ReportHighlightsProps) => {
  const periodLabel = periodId
    ? formatPeriodLabel(periodId)
    : `tháng ${reportMeta.updatedAt.slice(3)}`;
  return (
    <Card className="p-6 md:p-7 border-l-4 border-l-accent">
      <div className="flex items-center gap-2 mb-5">
        <Sparkles className="h-5 w-5 text-accent" />
        <h2 className="text-base md:text-lg font-semibold text-foreground">
          3 điểm nổi bật {periodLabel}
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {highlights.map((h, idx) => (
          <div
            key={h.id}
            className="rounded-lg bg-muted/50 p-4 border border-border/60 hover:border-accent/40 transition-colors"
          >
            <div className="text-2xl text-accent mb-2 font-bold leading-none">
              {numberLabels[idx]}
            </div>
            <p className="text-sm text-foreground leading-relaxed">{h.text}</p>
          </div>
        ))}
      </div>
    </Card>
  );
};
