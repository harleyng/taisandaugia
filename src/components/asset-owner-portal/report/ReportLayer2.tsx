import { Card } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatPrice } from "@/utils/formatters";
import type { PortfolioMetrics } from "@/hooks/useOwnerPortfolioMetrics";

interface Props {
  metrics: PortfolioMetrics;
}

export function ReportLayer2({ metrics }: Props) {
  const maxOrg = metrics.byOrg[0]?.count ?? 1;

  return (
    <div className="space-y-5">
      <h2 className="text-base font-bold text-foreground">Lớp 2 — Phân tích sâu</h2>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{metrics.successRate}%</p>
          <p className="text-xs text-muted-foreground mt-1">Tỷ lệ đấu thành công</p>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-[hsl(142,76%,36%)]"
              style={{ width: `${metrics.successRate}%` }}
            />
          </div>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{metrics.avgRounds}</p>
          <p className="text-xs text-muted-foreground mt-1">Số lần đấu trung bình</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{metrics.pendingCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Tài sản tồn đọng (≥2 lần)</p>
        </Card>
      </div>

      {/* Pending assets table */}
      {metrics.pendingAssets.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Tài sản tồn đọng</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-2 pr-4 font-medium">Tài sản</th>
                  <th className="pb-2 pr-4 font-medium text-right">Lần đấu</th>
                  <th className="pb-2 pr-4 font-medium text-right">Giá KĐ</th>
                  <th className="pb-2 font-medium">TCDG</th>
                </tr>
              </thead>
              <tbody>
                {metrics.pendingAssets.slice(0, 10).map((a) => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 pr-4 max-w-[220px]">
                      <p className="font-medium text-foreground line-clamp-1">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.province}</p>
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold tabular-nums">
                      {a.roundCount}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-foreground">
                      {formatPrice(a.price, a.priceUnit)}
                    </td>
                    <td className="py-2 text-muted-foreground text-xs line-clamp-1">
                      {a.auctionOrgName ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {metrics.pendingAssets.length > 10 && (
              <p className="text-xs text-muted-foreground mt-2">
                Và {metrics.pendingAssets.length - 10} tài sản khác…
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Price trend line chart */}
      {metrics.priceByMonth.length >= 3 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Diễn biến giá khởi điểm trung bình (theo tháng)
          </h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.priceByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v: number) => `${(v / 1_000_000_000).toFixed(0)}B`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => formatPrice(v, "TOTAL")}
                />
                <Line
                  type="monotone"
                  dataKey="avgPrice"
                  name="Giá KĐ TB"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* By org bar chart */}
      {metrics.byOrg.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Phân bố theo Tổ chức đấu giá</h3>
          <div className="space-y-3">
            {metrics.byOrg.slice(0, 8).map((o, i) => (
              <div key={o.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground truncate max-w-[60%]">{o.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {o.count} tài sản · {o.pct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(o.count / maxOrg) * 100}%`,
                      background: i === 0
                        ? "hsl(var(--accent))"
                        : "hsl(var(--primary) / 0.7)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
