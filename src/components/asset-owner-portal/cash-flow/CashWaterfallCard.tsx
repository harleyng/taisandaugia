import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartColumnDecreasing } from "lucide-react";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import type { WaterfallStep, WaterfallStepKind, WaterfallTotals } from "@/lib/ownerCashFlow";
import { formatMoneyFull, formatMoneyShort } from "@/utils/money";

interface CashWaterfallCardProps {
  totals: WaterfallTotals;
  steps: WaterfallStep[];
}

// Màu theo VAI TRÒ bước (token có sẵn): tổng = primary, tăng = accent, giảm = xám trung tính.
// Không dùng success cạnh primary (cùng họ xanh — ghi chú biểu đồ trong CLAUDE.md).
const FILL: Record<WaterfallStepKind, string> = {
  total: "hsl(var(--primary))",
  up: "hsl(var(--accent))",
  down: "hsl(var(--muted-foreground) / 0.55)",
};

const signed = (s: WaterfallStep) => (s.kind === "total" ? formatMoneyShort(s.value) : `${s.value >= 0 ? "+" : ""}${formatMoneyShort(s.value)}`);

function StepTooltip({ active, payload }: { active?: boolean; payload?: { payload: WaterfallStep }[] }) {
  const s = active ? payload?.[0]?.payload : undefined;
  if (!s) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-foreground">{s.label}</p>
      <p className="tabular-nums text-muted-foreground">{formatMoneyFull(s.value)}</p>
    </div>
  );
}

/** L3: thác tiền của các phiên BÁN trong kỳ — giá khởi điểm → giá trúng → đã thu → phí → thực nhận. */
export function CashWaterfallCard({ totals, steps }: CashWaterfallCardProps) {
  const notes = [
    totals.notes.missingStart ? `${totals.notes.missingStart} tài sản chưa có giá khởi điểm — tính bằng giá trúng.` : null,
    totals.notes.defaulted ? `Không tính ${totals.notes.defaulted} tài sản người trúng bỏ cọc.` : null,
    totals.notes.overpaid ? `Có ${formatMoneyShort(totals.notes.overpaid)} thu vượt giá trúng — nên xem lại sổ thu chi.` : null,
  ].filter(Boolean);

  // Nhãn trục tự vẽ: Recharts tự xuống dòng nhãn dài ("Chênh lệch trả giá") — ở đây giữ một dòng.
  const renderCategory = (props: unknown) => {
    const { x, y, payload } = props as { x: number; y: number; payload: { value: string } };
    return (
      <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill="hsl(var(--foreground))">
        {payload.value}
      </text>
    );
  };

  // Nhãn số đặt ngay sau đầu phải của từng cột (mọi cột đều có nhãn: màu không phải kênh duy nhất).
  const renderLabel = (props: unknown) => {
    const { x, y, width, height, index } = props as { x?: number; y?: number; width?: number; height?: number; index?: number };
    const s = index !== undefined ? steps[index] : undefined;
    if (!s || x === undefined || y === undefined || width === undefined || height === undefined) return null;
    return (
      <text x={x + width + 6} y={y + height / 2} dy={4} fontSize={11} fill="hsl(var(--foreground))">
        {signed(s)}
      </text>
    );
  };

  return (
    <SectionCard title="Thác tiền các phiên bán trong kỳ" icon={ChartColumnDecreasing}>
      {totals.count === 0 ? (
        <EmptyState
          compact
          icon={ChartColumnDecreasing}
          title="Chưa có phiên bán nào đơn vị tự theo dõi tiền trong kỳ."
          description="Khai kết quả phiên thành rồi ghi các khoản thu để thấy tiền đi từ giá khởi điểm tới thực nhận."
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {totals.count} tài sản bán trong kỳ (theo ngày phiên) · số đã thu tính tới hôm nay
          </p>
          {/* relative: bảng sr-only bên trong không được làm trang rộng ra (common-pitfalls). */}
          <div className="relative h-[300px] w-full" role="img" aria-label="Biểu đồ thác tiền — số liệu chi tiết trong bảng ẩn ngay sau">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={steps} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 4 }} barCategoryGap={8}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v: number) => formatMoneyShort(v)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={124}
                  tick={renderCategory}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<StepTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
                <Bar dataKey="range" radius={4} isAnimationActive={false}>
                  {steps.map((s) => (
                    <Cell key={s.key} fill={FILL[s.kind]} />
                  ))}
                  <LabelList dataKey="value" content={renderLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <table className="sr-only">
              <caption>Thác tiền các phiên bán trong kỳ</caption>
              <tbody>
                {steps.map((s) => (
                  <tr key={s.key}>
                    <th scope="row">{s.label}</th>
                    <td>{formatMoneyFull(s.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            <li>Chỉ tiêu tính "Đã thu" theo ngày phiên và trước phí, nên có thể khác thác tiền này.</li>
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
