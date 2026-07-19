import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from "recharts";
import { formatVnd } from "@/lib/advertising/slug";
import { formatVndCompact } from "@/lib/reports/transactionReport";
import type { AudienceStat } from "@/lib/reports/revenueReport";
import ReportCard from "./ReportCard";

interface Props {
  data: AudienceStat[];
  loading?: boolean;
}

const COLORS: Record<string, string> = {
  buyer: "hsl(199 89% 48%)",
  owner: "hsl(262 83% 58%)",
  company: "hsl(25 95% 53%)",
  direct: "hsl(210 90% 45%)",
  // Không lấy violet — trùng byte với `owner`.
  commission: "hsl(160 84% 39%)",
  all: "hsl(215 16% 47%)",
  unknown: "hsl(215 16% 60%)",
};

const tooltipStyle = {
  fontSize: 12,
  borderRadius: "0.5rem",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
};

export default function RevenueByAudienceChart({ data, loading }: Props) {
  const empty = !loading && data.every((d) => d.vnd === 0);

  return (
    <ReportCard title="Doanh thu theo đối tượng" subtitle="Người mua · Chủ tài sản · Công ty · Dịch vụ trực tiếp" loading={loading} empty={empty}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v: number) => formatVndCompact(v)} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={48} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatVnd(value), "Doanh thu"]} cursor={{ fill: "hsl(var(--muted)/0.3)" }} />
          <Bar dataKey="vnd" radius={[6, 6, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.audience} fill={COLORS[d.audience] ?? COLORS.unknown} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ReportCard>
  );
}
