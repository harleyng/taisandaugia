import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CpdProvinceStat } from "@/lib/reports/cpdReport";
import ReportCard from "./ReportCard";

interface Props {
  data: CpdProvinceStat[];
  loading?: boolean;
}

const tooltipStyle = {
  fontSize: 12,
  borderRadius: "0.5rem",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
};

// MỘT chuỗi, MỘT màu. Không tô theo trạng thái: xanh cạnh hổ phách trong cùng
// một cột không phân biệt được với người mù màu đỏ-lục (ΔE 7.5 protan).
// Phân bố trạng thái đã nằm ở dải thẻ KPI phía trên, kèm icon và nhãn.
const BAR = "hsl(210 90% 30%)";

export default function CpdByProvinceChart({ data, loading }: Props) {
  const empty = !loading && data.length === 0;
  // Xếp tỉnh yếu nhất lên đầu — báo cáo này để TÌM CHỖ CÓ VẤN ĐỀ.
  const rows = data.slice(0, 12);

  return (
    <ReportCard
      title="Tỉ lệ tuân thủ theo tỉnh/thành"
      subtitle={
        data.length > rows.length
          ? `${rows.length}/${data.length} tỉnh có tỉ lệ thấp nhất — tổ chức thiếu địa chỉ xếp vào 'Không rõ'`
          : "Tỉnh có tỉ lệ thấp nhất xếp trước"
      }
      loading={loading}
      empty={empty}
    >
      <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 32)}>
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 44, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis
            type="number"
            domain={[0, 100]}
            unit="%"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="province"
            width={132}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            formatter={(v: number, _n, p) => [
              `${v}% — ${(p.payload as CpdProvinceStat).compliant}/${(p.payload as CpdProvinceStat).total} đấu giá viên`,
              "Tuân thủ",
            ]}
          />
          <Bar dataKey="rate" fill={BAR} radius={[0, 4, 4, 0]} barSize={14}>
            <LabelList
              dataKey="rate"
              position="right"
              formatter={(v: number) => `${v}%`}
              style={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ReportCard>
  );
}
