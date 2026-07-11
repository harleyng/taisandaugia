import { useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdDailyStats } from "@/hooks/useAdvertisements";
import type { Advertisement, StatDevice } from "@/types/advertising";

const tooltipStyle = {
  fontSize: 12,
  borderRadius: "0.5rem",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
};

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n);

function Tile({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
        {label}
      </p>
      <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
    </div>
  );
}

export function AdStatsTab({ ad }: { ad: Advertisement }) {
  const [days, setDays] = useState(30);
  const [device, setDevice] = useState<StatDevice | "all">("all");
  const { data: stats, isLoading } = useAdDailyStats(ad.id, { days, device });

  const { chartData, totalViews, totalClicks, ctr } = useMemo(() => {
    const byDate = new Map<string, { views: number; clicks: number }>();
    for (const s of stats ?? []) {
      const cur = byDate.get(s.stat_date) ?? { views: 0, clicks: 0 };
      cur.views += s.views;
      cur.clicks += s.clicks;
      byDate.set(s.stat_date, cur);
    }
    const rows = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date: format(new Date(date), "dd/MM"),
        views: v.views,
        clicks: v.clicks,
        ctr: v.views > 0 ? Number(((v.clicks / v.views) * 100).toFixed(2)) : 0,
      }));
    const tv = rows.reduce((s, r) => s + r.views, 0);
    const tc = rows.reduce((s, r) => s + r.clicks, 0);
    return {
      chartData: rows,
      totalViews: tv,
      totalClicks: tc,
      ctr: tv > 0 ? ((tc / tv) * 100).toFixed(2) : "0.00",
    };
  }, [stats]);

  const tickInterval = Math.max(1, Math.ceil(chartData.length / 6));
  const xTicks = chartData
    .filter((_, i) => i % tickInterval === 0 || i === chartData.length - 1)
    .map((d) => d.date);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-foreground">Thống kê</h3>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 ngày trước</SelectItem>
              <SelectItem value="30">30 ngày trước</SelectItem>
              <SelectItem value="90">90 ngày trước</SelectItem>
            </SelectContent>
          </Select>
          <Select value={device} onValueChange={(v) => setDevice(v as StatDevice | "all")}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả thiết bị</SelectItem>
              <SelectItem value="desktop">Desktop</SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tile label="Số lượt xem" value={compact(totalViews)} dot="#ef4444" />
        <Tile label="Số lượt Click" value={compact(totalClicks)} dot="#16a34a" />
        <Tile label="Click-Through Rate" value={`${ctr}%`} dot="hsl(210 90% 30%)" />
      </div>

      {isLoading ? (
        <div className="h-72 rounded-lg bg-muted animate-pulse" />
      ) : chartData.length === 0 ? (
        <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
          Chưa có dữ liệu thống kê trong khoảng thời gian này.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              ticks={xTicks}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="pct"
              orientation="left"
              unit="%"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="count"
              orientation="right"
              tickFormatter={compact}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number, name: string) => {
                if (name === "Click-Through Rate") return [`${value}%`, name];
                return [value.toLocaleString("vi-VN"), name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="count" dataKey="views" name="Số lượt xem" fill="hsl(210 90% 30%)" radius={[3, 3, 0, 0]} barSize={14} />
            <Line yAxisId="count" type="monotone" dataKey="clicks" name="Số lượt Click" stroke="#16a34a" strokeWidth={2} dot={false} />
            <Line yAxisId="pct" type="monotone" dataKey="ctr" name="Click-Through Rate" stroke="#ef4444" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
