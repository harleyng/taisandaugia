import { ArrowRight, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ReportSection } from "../ReportSection";
import { bdsPriceHeatmap, bdsPriceHeatmapColumns } from "@/lib/mockBdsReport";

const formatPrice = (n: number) => (n >= 10 ? n.toString() : n.toFixed(1));

export const BdsSectionPriceMap = () => {
  const { toast } = useToast();

  // Compute max per column to scale color independently per land type
  const maxPerCol = bdsPriceHeatmapColumns.reduce<Record<string, number>>((acc, col) => {
    acc[col.key] = Math.max(...bdsPriceHeatmap.map((r) => r.prices[col.key]));
    return acc;
  }, {});

  return (
    <ReportSection
      id="bds-b1"
      label="B1"
      title="Giá/m² theo khu vực"
      keyInsight="Giá/m² đất ở TP.HCM Q.1 cao gấp ~5× Bình Dương; chênh lệch giữa đất ở và đất nông nghiệp cùng khu vực có thể lên tới 38×."
      deepDiveLabel=""
      hideDeepDive
    >
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Heatmap giá trung vị /m² đất ở (theo Quận/Huyện) — đơn vị: triệu VND
        </h3>
        <p className="text-xs text-muted-foreground mb-5">
          Màu càng đậm = giá càng cao trong cùng loại đất.
        </p>

        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground">
                  Khu vực
                </th>
                {bdsPriceHeatmapColumns.map((col) => (
                  <th
                    key={col.key}
                    className="text-center py-2 px-1 text-xs font-medium text-muted-foreground min-w-[88px]"
                  >
                    {col.label}
                    <div className="text-[10px] font-normal opacity-70">tr/m²</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bdsPriceHeatmap.map((row) => (
                <tr key={row.region} className="border-t border-border/60">
                  <td className="py-2 pr-3 font-medium text-foreground whitespace-nowrap">
                    {row.region}
                  </td>
                  {bdsPriceHeatmapColumns.map((col) => {
                    const val = row.prices[col.key];
                    const intensity = Math.min(1, val / maxPerCol[col.key]);
                    const opacity = 0.15 + intensity * 0.75;
                    const textDark = intensity < 0.55;
                    return (
                      <td key={col.key} className="px-1 py-1.5">
                        <div
                          className="h-9 rounded flex items-center justify-center text-xs font-semibold tabular-nums"
                          style={{
                            backgroundColor: `hsl(var(--primary) / ${opacity})`,
                            color: textDark ? "hsl(var(--foreground))" : "hsl(var(--primary-foreground))",
                          }}
                        >
                          {formatPrice(val)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button
          variant="link"
          className="px-0 mt-3"
          onClick={() =>
            toast({
              title: "Sắp ra mắt",
              description: "Bảng đầy đủ 63 tỉnh sẽ có trong gói Pro.",
            })
          }
        >
          Xem đầy đủ 63 tỉnh
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>

        <div className="mt-5 rounded-lg bg-accent/10 border-l-4 border-l-accent p-3 flex gap-2">
          <Lightbulb className="h-4 w-4 text-accent shrink-0 mt-0.5" />
          <p className="text-xs md:text-sm text-foreground leading-relaxed">
            <span className="font-semibold">Insight:</span> Đất nông nghiệp giữ chênh lệch giá
            khổng lồ với đất ở ngay trong cùng tỉnh — cơ hội arbitrage qua chuyển đổi mục đích
            sử dụng (cho người đủ điều kiện pháp lý).
          </p>
        </div>
      </Card>
    </ReportSection>
  );
};
