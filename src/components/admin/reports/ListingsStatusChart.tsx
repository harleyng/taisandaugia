import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatVnd } from "@/lib/advertising/slug";
import type { LabeledStat } from "@/lib/reports/listingsReport";
import ReportCard from "./ReportCard";

interface Props {
  data: LabeledStat[];
  mode: "status" | "session";
  loading?: boolean;
}

// Màu bám theo vòng đời chứ không theo thứ hạng: nháp/chờ duyệt là trạng thái
// nội bộ (xám/hổ phách), đang hiển thị là xanh thương hiệu, đã xong là tím.
const STATUS_COLORS: Record<string, string> = {
  DRAFT: "hsl(215 16% 75%)",
  PENDING_APPROVAL: "hsl(43 96% 56%)",
  ACTIVE: "hsl(152 60% 26%)",
  INACTIVE: "hsl(215 16% 55%)",
  SOLD_RENTED: "hsl(262 60% 55%)",
};

const SESSION_COLORS: Record<string, string> = {
  registration_open: "hsl(152 60% 26%)",
  upcoming: "hsl(43 96% 56%)",
  ongoing: "hsl(199 89% 48%)",
  ended: "hsl(215 16% 65%)",
};

const COPY = {
  status: {
    title: "Trạng thái tin",
    subtitle: "Gồm cả tin nội bộ (nháp / chờ duyệt) mà người dùng cuối không thấy",
    unit: "tin",
  },
  session: {
    title: "Trạng thái phiên đấu giá",
    subtitle: "Suy diễn từ ngày tổ chức & hạn nộp hồ sơ trong tin",
    unit: "tin",
  },
} as const;

export default function ListingsStatusChart({ data, mode, loading }: Props) {
  const colors = mode === "status" ? STATUS_COLORS : SESSION_COLORS;
  const copy = COPY[mode];
  const total = data.reduce((s, d) => s + d.listings, 0);
  const empty = !loading && total === 0;

  return (
    <ReportCard title={copy.title} subtitle={copy.subtitle} loading={loading} empty={empty}>
      <div className="grid sm:grid-cols-[1fr_1fr] gap-4 items-center">
        <div className="h-[200px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={82}
                paddingAngle={2}
                dataKey="listings"
                nameKey="label"
              >
                {data.map((d) => (
                  <Cell key={d.key} fill={colors[d.key] ?? "hsl(215 16% 65%)"} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number, name: string) => [
                  `${v.toLocaleString("vi-VN")} ${copy.unit}`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-2xl font-bold text-foreground">{total.toLocaleString("vi-VN")}</p>
            <p className="text-xs text-muted-foreground">{copy.unit}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          {data.map((d) => (
            <div key={d.key} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: colors[d.key] ?? "hsl(215 16% 65%)" }}
                />
                <span className="text-foreground truncate">{d.label}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-medium text-foreground tabular-nums">
                  {d.listings.toLocaleString("vi-VN")}
                </span>
                <span className="text-muted-foreground/70 ml-1 tabular-nums">
                  {total > 0 ? ((d.listings / total) * 100).toFixed(0) : "0"}%
                </span>
                <p className="text-[11px] text-muted-foreground/70 tabular-nums">
                  {formatVnd(d.value)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ReportCard>
  );
}
