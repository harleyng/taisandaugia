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
import { formatVnd } from "@/lib/advertising/slug";
import { formatVndCompact, type TimeBucket } from "@/lib/reports/transactionReport";
import ReportCard from "./ReportCard";

interface Props {
  data: TimeBucket[];
  loading?: boolean;
}

const tooltipStyle = {
  fontSize: 12,
  borderRadius: "0.5rem",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
};

const VND = "hsl(152 60% 26%)";
const CREDIT = "hsl(43 96% 56%)";

export default function RevenueTrendChart({ data, loading }: Props) {
  const empty = !loading && data.every((d) => d.vnd === 0 && d.credits === 0);
  const tickInterval = Math.max(1, Math.ceil(data.length / 6));
  const ticks = data.filter((_, i) => i % tickInterval === 0 || i === data.length - 1).map((d) => d.label);

  return (
    <ReportCard
      title="Doanh thu & credit bán ra theo thời gian"
      subtitle="Cột trục trái: doanh thu (VND) · trục phải: credit bán ra"
      loading={loading}
      empty={empty}
    >
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={VND} stopOpacity={0.18} />
              <stop offset="95%" stopColor={VND} stopOpacity={0} />
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
            tickFormatter={(v: number) => formatVndCompact(v)}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            width={48}
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
            formatter={(value: number, name: string) =>
              name === "Doanh thu" ? [formatVnd(value), name] : [value.toLocaleString("vi-VN"), name]
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="vnd"
            name="Doanh thu"
            stroke={VND}
            strokeWidth={2}
            fill="url(#fillRevenue)"
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="credits"
            name="Credit bán ra"
            stroke={CREDIT}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ReportCard>
  );
}
