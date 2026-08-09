import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { ProvinceStat } from "@/lib/reports/accessAnalytics";
import ReportCard from "./ReportCard";

interface Props {
  data: ProvinceStat[];
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
const UNKNOWN = "hsl(215 16% 75%)";

export default function ProvinceBreakdownChart({ data, loading }: Props) {
  const empty = !loading && data.length === 0;
  const rows = data.slice(0, 12);
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <ReportCard
      title="Truy cập theo địa lý (tỉnh/thành)"
      subtitle="Tỉnh suy từ hồ sơ tổ chức của người dùng — khách chưa gắn tổ chức xếp vào 'Không rõ'"
      loading={loading}
      empty={empty}
    >
      <ResponsiveContainer width="100%" height={Math.max(240, rows.length * 30)}>
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
            dataKey="province"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "hsl(var(--muted))" }}
            formatter={(value: number, _name, item) => {
              const p = item?.payload as ProvinceStat;
              const share = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
              return [`${value.toLocaleString("vi-VN")} lượt · ${share}%`, p.province];
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
            {rows.map((d) => (
              <Cell key={d.province} fill={d.province === "Không rõ" ? UNKNOWN : BAR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ReportCard>
  );
}
