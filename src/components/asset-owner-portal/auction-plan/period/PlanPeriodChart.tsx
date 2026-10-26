import { BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { formatMoneyFull, formatMoneyShort } from "@/utils/money";
import type { PlanMonthPoint } from "@/lib/auctionPlan/period";

// Loạt THỨ HAI phải khác hệ xanh: `--primary` và `--success` nay đều là xanh lá
// (ghi chú biểu đồ trong CLAUDE.md), nên "thực tế" lấy tím — đúng gam mà
// src/components/admin/reports/ đã dùng cho loạt thứ hai.
const PLANNED = "hsl(var(--primary))";
const ACTUAL = "hsl(262 60% 55%)";

const Swatch = ({ fill }: { fill: string }) => (
  <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: fill }} />
);

function MonthTooltip({ active, payload }: { active?: boolean; payload?: { payload?: PlanMonthPoint }[] }) {
  const p = active ? payload?.[0]?.payload : null;
  if (!p) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-foreground">Tháng {p.label.slice(1)}</p>
      <p className="text-muted-foreground">
        Kế hoạch: {p.plannedCount} tài sản · {formatMoneyShort(p.plannedStartValue)}
      </p>
      <p className="text-muted-foreground">
        Thực tế: {p.soldCount} đấu thành · {formatMoneyShort(p.winningTotal)}
      </p>
    </div>
  );
}

/**
 * Kế hoạch (giá trị khởi điểm dự kiến của bản mốc) so thực tế (tổng giá trúng)
 * theo từng tháng của năm kế hoạch — tầng L3.
 *
 * Có bảng `sr-only` ngay sau biểu đồ (đặt trong hộp `relative`, bẫy 26/09: đừng
 * để `sr-only` trong vùng cuộn ngang).
 */
export function PlanPeriodChart({ series, planYear }: { series: readonly PlanMonthPoint[]; planYear: number }) {
  const any = series.some((p) => p.plannedStartValue > 0 || p.winningTotal > 0);

  return (
    <SectionCard title={`Kế hoạch so thực tế từng tháng năm ${planYear}`} icon={BarChart3}>
      {!any ? (
        <EmptyState
          compact
          icon={BarChart3}
          tone="muted"
          title="Chưa có số liệu để vẽ."
          description="Khi kế hoạch có tài sản theo tháng hoặc đã có kết quả phiên, biểu đồ sẽ hiện ở đây."
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Swatch fill={PLANNED} /> Kế hoạch · giá trị khởi điểm dự kiến
            </span>
            <span className="flex items-center gap-1.5">
              <Swatch fill={ACTUAL} /> Thực tế · tổng giá trúng
            </span>
          </div>
          <div
            className="relative h-[240px] w-full"
            role="img"
            aria-label="Biểu đồ kế hoạch so thực tế theo tháng — số liệu trong bảng ẩn ngay sau"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...series]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="24%">
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={56}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v: number) => formatMoneyShort(v)}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<MonthTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
                <Bar dataKey="plannedStartValue" name="Kế hoạch" fill={PLANNED} isAnimationActive={false} radius={[4, 4, 0, 0]} />
                <Bar dataKey="winningTotal" name="Thực tế" fill={ACTUAL} isAnimationActive={false} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <table className="sr-only">
              <caption>Kế hoạch so thực tế theo tháng năm {planYear}</caption>
              <thead>
                <tr>
                  <th scope="col">Tháng</th>
                  <th scope="col">Tài sản theo kế hoạch</th>
                  <th scope="col">Giá trị khởi điểm dự kiến</th>
                  <th scope="col">Tài sản đấu thành</th>
                  <th scope="col">Tổng giá trúng</th>
                </tr>
              </thead>
              <tbody>
                {series.map((p) => (
                  <tr key={p.key}>
                    <th scope="row">{p.label}</th>
                    <td>{p.plannedCount}</td>
                    <td>{formatMoneyFull(p.plannedStartValue)}</td>
                    <td>{p.soldCount}</td>
                    <td>{formatMoneyFull(p.winningTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
