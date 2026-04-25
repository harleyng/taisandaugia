import { Card } from "@/components/ui/card";
import { ReportSection } from "../ReportSection";
import { failureByCategory } from "@/lib/mockOutcomesReport";

export const OutcomesSectionByCategory = () => {
  const max = Math.max(...failureByCategory.map((d) => d.value));

  return (
    <ReportSection
      id="outcomes-c2"
      label="C2"
      title="Theo loại tài sản"
      keyInsight="Nợ xấu (NPL) gần như cứ 2 phiên có 1 không thành — phản ánh mức giá khởi điểm thường được set theo giá sổ sách của ngân hàng, không phải giá thị trường."
      deepDiveLabel=""
      hideDeepDive
    >
      <Card className="p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Tỷ lệ KHÔNG THÀNH theo loại tài sản
        </p>
        <div className="space-y-3">
          {failureByCategory.map((d) => (
            <div key={d.name} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-foreground">{d.name}</span>
                <span className="text-sm font-bold tabular-nums text-foreground">{d.value}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(d.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-5 border-t border-border text-sm text-muted-foreground leading-relaxed">
          → Phân khúc <span className="font-medium text-foreground">NPL</span> là cơ hội lớn nhất
          cho người mua kiên nhẫn — nhiều tài sản sẽ quay lại lần 2, lần 3 với giá thấp hơn.
        </div>
      </Card>
    </ReportSection>
  );
};
