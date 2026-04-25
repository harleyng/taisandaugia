import { Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ReportSection } from "../ReportSection";
import { bdsDeltaByArea, bdsDeltaByType } from "@/lib/mockBdsReport";

interface DeltaItem {
  label: string;
  delta: number;
  n: number;
}

const DeltaBars = ({ data }: { data: DeltaItem[] }) => {
  const max = Math.max(...data.map((d) => d.delta));
  return (
    <div className="space-y-3">
      {data.map((d, idx) => {
        const widthPct = (d.delta / max) * 100;
        const opacity = 1 - idx * 0.16;
        return (
          <div key={d.label} className="grid grid-cols-[120px_1fr_auto] items-center gap-3">
            <div className="text-sm font-medium text-foreground truncate">{d.label}</div>
            <div className="relative h-7 bg-muted/60 rounded-md overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-md flex items-center px-2.5"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: `hsl(var(--primary) / ${opacity})`,
                }}
              >
                <span className="text-xs font-semibold text-primary-foreground whitespace-nowrap">
                  +{d.delta}%
                </span>
              </div>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
              n = {d.n}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const BdsSectionDelta = () => (
  <ReportSection
    id="bds-b2"
    label="B2"
    title="Chênh lệch giá trúng vs khởi điểm (theo phân khúc)"
    keyInsight="Lô < 100 m² và nhà phố thu hút bidding war (chênh ~20%); lô lớn và đất nông nghiệp gần như trúng đúng giá khởi điểm."
    deepDiveLabel=""
    hideDeepDive
  >
    <div className="space-y-4">
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Theo khoảng diện tích</h3>
        <DeltaBars data={bdsDeltaByArea} />
        <div className="mt-5 rounded-lg bg-primary/5 border-l-4 border-l-primary p-3 flex gap-2">
          <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs md:text-sm text-foreground leading-relaxed">
            Lô nhỏ thu hút nhiều người tham gia (cạnh tranh cao). Lô lớn thường chỉ có 1–2 nhà
            đầu tư đủ vốn → ít chênh lệch.
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Theo loại đất / nhà</h3>
        <DeltaBars data={bdsDeltaByType} />
        <div className="mt-5 rounded-lg bg-primary/5 border-l-4 border-l-primary p-3 flex gap-2">
          <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs md:text-sm text-foreground leading-relaxed">
            Nhà phố có cạnh tranh cao nhất do nhu cầu ở thực + đầu tư. Đất nông nghiệp thường
            trúng gần khởi điểm — ít người tham gia.
          </p>
        </div>
      </Card>
    </div>
  </ReportSection>
);
