import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import ReportCard from "@/components/admin/reports/ReportCard";
import { formatVnd } from "@/lib/advertising/slug";
import { formatVndCompact } from "@/lib/reports/transactionReport";
import type { DistSlice, LegalFlags, MonthPoint } from "@/lib/prospects/types";

const tooltipStyle = {
  fontSize: 12,
  borderRadius: "0.5rem",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
};

const BAR = "hsl(210 90% 30%)";

// Bảng màu phân loại — dùng chung cho các donut, đủ tương phản ở cả light/dark.
const SLICE_COLORS = [
  "hsl(210 90% 30%)", "hsl(43 96% 56%)", "hsl(142 76% 36%)", "hsl(25 95% 53%)",
  "hsl(199 89% 48%)", "hsl(280 60% 50%)", "hsl(0 72% 51%)", "hsl(215 16% 60%)",
];

const sliceTooltip = (value: number, _n: unknown, item: { payload?: DistSlice }) => {
  const p = item?.payload;
  return [`${value} tài sản · ${p?.pct ?? 0}% · ${formatVnd(p?.value ?? 0)}`, p?.label ?? ""];
};

/** Nhãn trục Y phải nằm gọn MỘT dòng. Recharts tự xuống dòng nhãn dài nhưng
 *  không nới chiều cao hàng, nên tên chi nhánh ngân hàng (5–6 dòng) đè lên nhau.
 *  Cắt đuôi ở đây; tên đầy đủ vẫn còn trong tooltip. */
const MAX_LABEL_CHARS = 24;
const truncateLabel = (v: string) =>
  v.length > MAX_LABEL_CHARS ? `${v.slice(0, MAX_LABEL_CHARS - 1).trimEnd()}…` : v;

/** Bar ngang — dùng cho tỉnh/thành và loại tài sản (nhiều nhãn dài). */
export function DistBarChart({
  title, subtitle, data, loading, max = 12,
}: { title: string; subtitle?: string; data: DistSlice[]; loading?: boolean; max?: number }) {
  const rows = data.slice(0, max);
  return (
    <ReportCard title={title} subtitle={subtitle} loading={loading} empty={!loading && data.length === 0}>
      <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 36)}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis
            type="number" allowDecimals={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            type="category" dataKey="label"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false} tickLine={false} width={170}
            interval={0} tickFormatter={truncateLabel}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} formatter={sliceTooltip} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16} fill={BAR} />
        </BarChart>
      </ResponsiveContainer>
    </ReportCard>
  );
}

/** Donut — dùng cho pháp lý và trạng thái đấu giá (ít nhóm). */
export function DistDonutChart({
  title, subtitle, data, loading,
}: { title: string; subtitle?: string; data: DistSlice[]; loading?: boolean }) {
  return (
    <ReportCard title={title} subtitle={subtitle} loading={loading} empty={!loading && data.length === 0}>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2}>
            {data.map((d, i) => (
              <Cell key={d.label} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={sliceTooltip} />
          <Legend
            verticalAlign="bottom" height={48}
            wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ReportCard>
  );
}

/** Số tài sản đưa ra đấu giá theo tháng. */
export function MonthTrendChart({ data, loading }: { data: MonthPoint[]; loading?: boolean }) {
  return (
    <ReportCard
      title="Tài sản theo tháng"
      subtitle="Theo ngày tin được đưa lên sàn"
      loading={loading}
      empty={!loading && data.length === 0}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false} tickLine={false} width={32}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "hsl(var(--muted))" }}
            formatter={(value: number, _n, item) => {
              const p = item?.payload as MonthPoint;
              return [`${value} tài sản · ${formatVndCompact(p?.value ?? 0)}`, p?.month ?? ""];
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={22} fill={BAR} />
        </BarChart>
      </ResponsiveContainer>
    </ReportCard>
  );
}

/** 4 cờ pháp lý của tài sản user tự đăng. Thang đo KHÁC legal_status của tin
 *  đấu giá nên hiển thị riêng, dạng đếm — không trộn vào donut pháp lý. */
export function LegalFlagsPanel({ flags }: { flags: LegalFlags | null }) {
  const total = flags?.total ?? 0;
  const items = [
    { label: "Không vướng mắc", value: flags?.clean ?? 0, tone: "text-success" },
    { label: "Đang thế chấp", value: flags?.has_mortgage ?? 0, tone: "text-warning" },
    { label: "Đang tranh chấp", value: flags?.has_dispute ?? 0, tone: "text-destructive" },
    { label: "Bị kê biên", value: flags?.is_seized ?? 0, tone: "text-destructive" },
  ];

  return (
    <ReportCard
      title="Pháp lý — tài sản tự đăng"
      subtitle={
        total > 0
          ? `${total} tài sản khách tự số hoá trên sàn`
          : "Chỉ có dữ liệu sau khi khách onboard và tự đăng tài sản"
      }
      empty={total === 0}
      emptyText="Khách chưa tự đăng tài sản nào"
    >
      <div className="grid grid-cols-2 gap-3">
        {items.map((it) => (
          <div key={it.label} className="rounded-lg border border-border p-3">
            <p className={`text-2xl font-semibold tabular-nums ${it.tone}`}>{it.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{it.label}</p>
          </div>
        ))}
      </div>
    </ReportCard>
  );
}
