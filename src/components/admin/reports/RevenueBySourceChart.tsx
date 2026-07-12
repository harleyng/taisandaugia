import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatVnd } from "@/lib/advertising/slug";
import type { SourceStat } from "@/lib/reports/revenueReport";
import ReportCard from "./ReportCard";

interface Props {
  data: SourceStat[];
  loading?: boolean;
}

const COLORS: Record<string, string> = {
  credit: "hsl(43 96% 56%)",
  direct: "hsl(210 90% 45%)",
};

const tooltipStyle = {
  fontSize: 12,
  borderRadius: "0.5rem",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
};

export default function RevenueBySourceChart({ data, loading }: Props) {
  const total = data.reduce((s, d) => s + d.vnd, 0);
  const empty = !loading && total === 0;

  return (
    <ReportCard title="Doanh thu theo nguồn" subtitle="Tỷ trọng Credit vs Dịch vụ trực tiếp" loading={loading} empty={empty}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} dataKey="vnd" nameKey="label" innerRadius={55} outerRadius={80} paddingAngle={2}>
              {data.map((d) => (
                <Cell key={d.source} fill={COLORS[d.source]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatVnd(value)} />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-3">
          {data.map((d) => (
            <div key={d.source} className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: COLORS[d.source] }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{d.label}</p>
                <p className="text-xs text-muted-foreground">{Math.round(d.share * 100)}% tổng doanh thu</p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">{formatVnd(d.vnd)}</span>
            </div>
          ))}
        </div>
      </div>
    </ReportCard>
  );
}
