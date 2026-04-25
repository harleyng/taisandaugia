import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LockedBlur } from "@/components/paywall/LockedBlur";
import {
  formatPeriodLabel,
  parsePeriod,
} from "@/lib/reportPeriods";
import { useCredits } from "@/hooks/useCredits";
import { Coins } from "lucide-react";

interface DeepReportPreviewProps {
  reportSlug: string;
  reportLabel: string;
  periodId: string;
  highlights: string[];
  tocSections: { id: string; label: string }[];
  meta: string;
  onUnlockClick: () => void;
}

export const DeepReportPreview = ({
  reportSlug: _slug,
  reportLabel,
  periodId,
  highlights,
  tocSections,
  meta,
  onUnlockClick,
}: DeepReportPreviewProps) => {
  const { DEEP_REPORT_PERIOD_PRICES } = useCredits();
  const parsed = parsePeriod(periodId);
  const cost = parsed ? DEEP_REPORT_PERIOD_PRICES[parsed.kind] : 0;
  const periodLabel = formatPeriodLabel(periodId);

  return (
    <div className="space-y-6">
      <Card className="p-6 md:p-8 border-l-4 border-l-primary">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
              {reportLabel}
            </p>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">
              {periodLabel}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{meta}</p>
          </div>
          <Button onClick={onUnlockClick} size="lg" className="shrink-0">
            <Lock className="h-4 w-4" />
            Mở khóa{" "}
            <span className="inline-flex items-center gap-1 ml-1">
              <Coins className="h-4 w-4" />
              {cost.toLocaleString("vi-VN")}
            </span>
          </Button>
        </div>
      </Card>

      <Card className="p-6 md:p-7">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          5 điểm nổi bật trong báo cáo
        </h3>
        <ul className="space-y-2.5">
          {highlights.slice(0, 5).map((h, idx) => (
            <li key={idx} className="flex gap-3 text-sm text-foreground">
              <span className="text-primary font-bold tabular-nums w-5 shrink-0">
                {idx + 1}.
              </span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-6 md:p-7">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Nội dung đầy đủ ({tocSections.length} mục)
        </h3>
        <LockedBlur
          teaser={`Mở khóa ${periodLabel} để xem ${tocSections.length} mục phân tích chi tiết`}
          ctaLabel={`Mở khóa ${cost.toLocaleString("vi-VN")} credit`}
          onUnlockClick={onUnlockClick}
          futureNote="Bao gồm biểu đồ, dữ liệu chi tiết, bảng Hall of Fame và xu hướng theo thời gian."
        >
          <div className="space-y-3">
            {tocSections.map((s) => (
              <div
                key={s.id}
                className="rounded-md bg-muted/40 p-4 border border-border/60"
              >
                <p className="text-sm font-semibold text-foreground">{s.label}</p>
                <div className="mt-3 space-y-1.5">
                  <div className="h-2 rounded-full bg-muted w-[88%]" />
                  <div className="h-2 rounded-full bg-muted w-[72%]" />
                  <div className="h-2 rounded-full bg-muted w-[55%]" />
                </div>
              </div>
            ))}
          </div>
        </LockedBlur>
      </Card>
    </div>
  );
};
