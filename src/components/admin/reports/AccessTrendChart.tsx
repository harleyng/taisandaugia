import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { AccessTimeBucket } from "@/lib/reports/accessAnalytics";
import ReportCard from "./ReportCard";

interface Props {
  data: AccessTimeBucket[];
  loading?: boolean;
}

const tooltipStyle = {
  fontSize: 12,
  borderRadius: "0.5rem",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
};

const VISITS = "hsl(210 90% 30%)";
const PAGEVIEWS = "hsl(43 96% 56%)";

export default function AccessTrendChart({ data, loading }: Props) {
  const empty = !loading && data.every((d) => d.visits === 0 && d.pageViews === 0);
  const tickInterval = Math.max(1, Math.ceil(data.length / 6));
  const ticks = data.filter((_, i) => i % tickInterval === 0 || i === data.length - 1).map((d) => d.label);

  return (
    <ReportCard
      title="Lượt truy cập & xem trang theo thời gian"
      subtitle="Vùng: lượt truy cập (phiên) · đường: lượt xem trang"
      loading={loading}
      empty={empty}
    >
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="fillVisits" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={VISITS} stopOpacity={0.18} />
              <stop offset="95%" stopColor={VISITS} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            ticks={ticks}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string) => [value.toLocaleString("vi-VN"), name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="visits"
            name="Lượt truy cập"
            stroke={VISITS}
            strokeWidth={2}
            fill="url(#fillVisits)"
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="pageViews"
            name="Lượt xem trang"
            stroke={PAGEVIEWS}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ReportCard>
  );
}
