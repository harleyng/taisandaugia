import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { PortfolioMetrics } from "@/hooks/useOwnerPortfolioMetrics";

interface Props {
  metrics: PortfolioMetrics;     // filtered view
  allMetrics: PortfolioMetrics;  // full portfolio (default filter)
  filterLabel: string;
}

function DeltaBadge({ a, b, unit = "%" }: { a: number; b: number; unit?: string }) {
  const diff = a - b;
  if (Math.abs(diff) < 1) return <Minus className="w-3.5 h-3.5 text-muted-foreground inline" />;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${diff > 0 ? "text-[hsl(142,76%,36%)]" : "text-destructive"}`}>
      {diff > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {Math.abs(diff).toFixed(0)}{unit}
    </span>
  );
}

export function ReportLayer3({ metrics, allMetrics, filterLabel }: Props) {
  const anomalyThreshold = allMetrics.avgRounds * 3;
  const anomalies = metrics.allListings.filter((l) => l.roundCount >= Math.max(anomalyThreshold, 3));

  return (
    <div className="space-y-5">
      <h2 className="text-base font-bold text-foreground">Lớp 3 — So sánh ngữ cảnh</h2>

      {/* Comparison table */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          {filterLabel} vs Toàn danh mục
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border text-muted-foreground">
                <th className="pb-2 pr-6 font-medium">Chỉ số</th>
                <th className="pb-2 pr-6 font-medium text-right">{filterLabel}</th>
                <th className="pb-2 pr-6 font-medium text-right">Toàn danh mục</th>
                <th className="pb-2 font-medium text-right">So sánh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr>
                <td className="py-2 pr-6 text-foreground">Tổng tài sản</td>
                <td className="py-2 pr-6 text-right font-semibold">{metrics.totalAssets}</td>
                <td className="py-2 pr-6 text-right">{allMetrics.totalAssets}</td>
                <td className="py-2 text-right">
                  <Badge variant="outline" className="text-xs">
                    {allMetrics.totalAssets ? Math.round((metrics.totalAssets / allMetrics.totalAssets) * 100) : 0}%
                  </Badge>
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-6 text-foreground">Tỷ lệ thành công</td>
                <td className="py-2 pr-6 text-right font-semibold">{metrics.successRate}%</td>
                <td className="py-2 pr-6 text-right">{allMetrics.successRate}%</td>
                <td className="py-2 text-right">
                  <DeltaBadge a={metrics.successRate} b={allMetrics.successRate} />
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-6 text-foreground">Số lần đấu TB</td>
                <td className="py-2 pr-6 text-right font-semibold">{metrics.avgRounds}</td>
                <td className="py-2 pr-6 text-right">{allMetrics.avgRounds}</td>
                <td className="py-2 text-right">
                  <DeltaBadge a={allMetrics.avgRounds} b={metrics.avgRounds} unit=" lần" />
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-6 text-foreground">Tồn đọng</td>
                <td className="py-2 pr-6 text-right font-semibold">{metrics.pendingCount}</td>
                <td className="py-2 pr-6 text-right">{allMetrics.pendingCount}</td>
                <td className="py-2 text-right">
                  {metrics.totalAssets > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {Math.round((metrics.pendingCount / metrics.totalAssets) * 100)}%
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <Card className="p-5 border-warning/30 bg-warning/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <h3 className="text-sm font-semibold text-foreground">
              Điểm bất thường — Tài sản đấu nhiều lần bất thường
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Ngưỡng: ≥{Math.ceil(anomalyThreshold)} lần đấu (3× trung bình toàn danh mục)
          </p>
          <div className="space-y-2">
            {anomalies.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-4 text-sm">
                <span className="text-foreground line-clamp-1 flex-1">{a.title}</span>
                <Badge variant="destructive" className="shrink-0">{a.roundCount} lần</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {anomalies.length === 0 && (
        <Card className="p-5">
          <p className="text-sm text-muted-foreground text-center py-4">
            Không phát hiện điểm bất thường trong tổ hợp này.
          </p>
        </Card>
      )}
    </div>
  );
}
