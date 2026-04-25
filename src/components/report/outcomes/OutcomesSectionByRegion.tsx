import { MapPin, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ReportSection } from "../ReportSection";
import { failureRegionBottom, failureRegionTop } from "@/lib/mockOutcomesReport";

const RegionTable = ({
  rows,
  variant,
}: {
  rows: typeof failureRegionTop;
  variant: "high" | "low";
}) => (
  <div className="space-y-1.5">
    {rows.map((r) => (
      <div
        key={r.name}
        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md bg-muted/40 hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-semibold text-muted-foreground w-4 tabular-nums">
            {r.rank}.
          </span>
          <span className="text-sm font-medium text-foreground truncate">{r.name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground tabular-nums">n={r.n}</span>
          <span
            className={`text-sm font-bold tabular-nums ${
              variant === "high" ? "text-destructive" : "text-primary"
            }`}
          >
            {r.rate}%
          </span>
        </div>
      </div>
    ))}
  </div>
);

export const OutcomesSectionByRegion = () => (
  <ReportSection
    id="outcomes-c3"
    label="C3"
    title="Theo khu vực"
    keyInsight="Các tỉnh ngoài đô thị lớn có tỷ lệ không thành cao hơn rõ rệt — phản ánh thanh khoản thấp và ít người mua chuyên nghiệp tham gia."
    deepDiveLabel=""
    hideDeepDive
  >
    <Card className="p-6">
      <div className="rounded-md border border-dashed border-border bg-muted/30 h-44 flex flex-col items-center justify-center text-center mb-6">
        <MapPin className="h-8 w-8 text-muted-foreground/60 mb-2" />
        <p className="text-sm text-muted-foreground">
          Bản đồ Việt Nam — heatmap tỷ lệ không thành
        </p>
        <Badge variant="secondary" className="mt-2">
          Sắp ra mắt
        </Badge>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-semibold text-foreground">
              Top 5 tỉnh tỷ lệ không thành CAO nhất
            </h3>
          </div>
          <RegionTable rows={failureRegionTop} variant="high" />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Top 5 tỉnh tỷ lệ không thành THẤP nhất
            </h3>
          </div>
          <RegionTable rows={failureRegionBottom} variant="low" />
        </div>
      </div>
    </Card>
  </ReportSection>
);
