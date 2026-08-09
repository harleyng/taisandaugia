import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatVnd } from "@/lib/advertising/slug";
import type { LabeledStat } from "@/lib/reports/listingsReport";
import ReportCard from "./ReportCard";

interface Props {
  data: LabeledStat[];
  loading?: boolean;
}

const tooltipStyle = {
  fontSize: 12,
  borderRadius: "0.5rem",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
};

const BAR = "hsl(152 60% 26%)";
const PEAK = "hsl(43 96% 56%)";
const UNKNOWN = "hsl(215 16% 75%)";

export default function ListingsPriceBucketChart({ data, loading }: Props) {
  const total = data.reduce((s, d) => s + d.listings, 0);
  const empty = !loading && total === 0;
  const peak = Math.max(0, ...data.filter((d) => d.key !== "unknown").map((d) => d.listings));

  return (
    <ReportCard
      title="Phân bố theo khoảng giá khởi điểm"
      subtitle="Giá quy đổi ra tổng — tin niêm yết giá thuê/tháng xếp vào 'Chưa quy đổi'"
      loading={loading}
      empty={empty}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "hsl(var(--muted))" }}
            formatter={(value: number, _name, item) => {
              const d = item?.payload as LabeledStat;
              const share = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
              return [
                `${value.toLocaleString("vi-VN")} tin · ${share}% · ${formatVnd(d.value)}`,
                d.label,
              ];
            }}
          />
          <Bar dataKey="listings" radius={[6, 6, 0, 0]} maxBarSize={56}>
            {data.map((d) => (
              <Cell
                key={d.key}
                fill={
                  d.key === "unknown" ? UNKNOWN : d.listings === peak && peak > 0 ? PEAK : BAR
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ReportCard>
  );
}
