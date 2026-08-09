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
import type { ProvinceListingStat } from "@/lib/reports/listingsReport";
import ReportCard from "./ReportCard";

interface Props {
  data: ProvinceListingStat[];
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

export default function ListingsByProvinceChart({ data, loading }: Props) {
  const empty = !loading && data.length === 0;
  const rows = data.slice(0, 12);
  const total = data.reduce((s, d) => s + d.listings, 0);

  return (
    <ReportCard
      title="Phân bố theo tỉnh/thành"
      subtitle={
        data.length > rows.length
          ? `Top ${rows.length}/${data.length} tỉnh có tin — tin thiếu địa chỉ xếp vào 'Không rõ'`
          : "Tin thiếu địa chỉ xếp vào 'Không rõ'"
      }
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
              const p = item?.payload as ProvinceListingStat;
              const share = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
              return [
                `${value.toLocaleString("vi-VN")} tin · ${share}% · ${formatVnd(p.value)}`,
                p.province,
              ];
            }}
          />
          <Bar dataKey="listings" radius={[0, 4, 4, 0]} barSize={16}>
            {rows.map((d) => (
              <Cell key={d.province} fill={d.province === "Không rõ" ? UNKNOWN : BAR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ReportCard>
  );
}
