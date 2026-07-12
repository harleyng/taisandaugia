import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { FeatureUsageStat } from "@/lib/reports/accessAnalytics";
import ReportCard from "./ReportCard";

interface Props {
  data: FeatureUsageStat[];
  loading?: boolean;
}

const tooltipStyle = {
  fontSize: 12,
  borderRadius: "0.5rem",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
};

const COLORS = [
  "hsl(210 90% 30%)",
  "hsl(43 96% 56%)",
  "hsl(142 76% 36%)",
  "hsl(262 60% 55%)",
  "hsl(199 89% 48%)",
  "hsl(0 72% 55%)",
  "hsl(215 16% 60%)",
];

export default function FeatureUsageChart({ data, loading }: Props) {
  const empty = !loading && data.length === 0;
  const rows = data.slice(0, 10);

  return (
    <ReportCard
      title="Tính năng được dùng nhiều nhất"
      subtitle="Xếp theo số lượt dùng"
      loading={loading}
      empty={empty}
    >
      <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 34)}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            width={140}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "hsl(var(--muted))" }}
            formatter={(value: number, _name, item) => {
              const p = item?.payload as FeatureUsageStat;
              return [`${value.toLocaleString("vi-VN")} lượt · ${p.uniqueUsers.toLocaleString("vi-VN")} người`, p.label];
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
            {rows.map((d, i) => (
              <Cell key={d.key} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ReportCard>
  );
}
