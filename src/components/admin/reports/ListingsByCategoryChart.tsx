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

const BAR = "hsl(210 90% 30%)";
const UNKNOWN = "hsl(215 16% 75%)";

export default function ListingsByCategoryChart({ data, loading }: Props) {
  const empty = !loading && data.length === 0;
  const total = data.reduce((s, d) => s + d.listings, 0);

  return (
    <ReportCard
      title="Cơ cấu theo nhóm tài sản"
      subtitle="Slug con đã gom về nhóm cha — nhóm 'Khác' là slug chưa nằm trong danh mục"
      loading={loading}
      empty={empty}
    >
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 42)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
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
              const d = item?.payload as LabeledStat;
              const share = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
              return [
                `${value.toLocaleString("vi-VN")} tin · ${share}% · ${formatVnd(d.value)}`,
                d.label,
              ];
            }}
          />
          <Bar dataKey="listings" radius={[0, 4, 4, 0]} barSize={18}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.key === "khac" ? UNKNOWN : BAR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ReportCard>
  );
}
