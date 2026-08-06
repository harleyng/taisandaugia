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
import type { CpdReport } from "@/lib/reports/cpdReport";
import ReportCard from "./ReportCard";

interface Props {
  data: CpdReport["worstOrgs"];
  loading?: boolean;
}

const tooltipStyle = {
  fontSize: 12,
  borderRadius: "0.5rem",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
};

// Một chuỗi, một màu — hổ phách vì đây là con số RỦI RO, không phải trung tính.
const BAR = "hsl(38 92% 50%)";

const shorten = (s: string) => (s.length > 34 ? `${s.slice(0, 33)}…` : s);

export default function CpdWorstOrgsChart({ data, loading }: Props) {
  const empty = !loading && data.length === 0;

  return (
    <ReportCard
      title="Tổ chức có nhiều đấu giá viên chưa hoàn thành nhất"
      subtitle="Số người chưa đủ 8 giờ và chưa thuộc diện miễn"
      loading={loading}
      empty={empty}
      emptyText="Mọi tổ chức đều đã hoàn thành nghĩa vụ trong kỳ đã chọn"
    >
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 32)}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="orgName"
            width={220}
            tickFormatter={shorten}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            formatter={(v: number, _n, p) => [
              `${v}/${(p.payload as CpdReport["worstOrgs"][number]).total} đấu giá viên`,
              "Chưa hoàn thành",
            ]}
            labelFormatter={(l: string) => l}
          />
          <Bar dataKey="pending" fill={BAR} radius={[0, 4, 4, 0]} barSize={14}>
            <LabelList
              dataKey="pending"
              position="right"
              style={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ReportCard>
  );
}
