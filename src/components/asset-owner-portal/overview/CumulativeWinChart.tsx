import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDayMonth } from "@/lib/ownerPulse";
import { weekLabel, type WeekPoint } from "@/lib/ownerOverview";
import { formatMoneyFull, formatMoneyShort } from "@/utils/money";

// Kỳ này là nét chính; cùng kỳ năm trước là nền so sánh ⇒ xám, nét đứt (không dùng họ xanh thứ hai).
const CURRENT = "hsl(var(--primary))";
const PREVIOUS = "hsl(var(--muted-foreground))";

function WeekTooltip({ active, payload }: { active?: boolean; payload?: { payload: WeekPoint }[] }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className="space-y-0.5 rounded-lg border bg-popover px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-foreground">{weekLabel(p)}</p>
      {p.current !== null && <p className="tabular-nums text-foreground">Kỳ này: {formatMoneyFull(p.current)}</p>}
      <p className="tabular-nums text-muted-foreground">Cùng kỳ năm trước: {formatMoneyFull(p.previous)}</p>
    </div>
  );
}

function LegendLine({ color, dashed, children }: { color: string; dashed?: boolean; children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg aria-hidden="true" width="18" height="6" className="shrink-0">
        <line x1="1" y1="3" x2="17" y2="3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray={dashed ? "3 3" : undefined} />
      </svg>
      {children}
    </span>
  );
}

/** Giá trúng lũy kế theo tuần: kỳ này (dừng ở tuần hiện tại) so với cùng kỳ năm trước. */
export function CumulativeWinChart({ points, periodLabel }: { points: WeekPoint[]; periodLabel: string }) {
  // Năm trước không có giá trúng nào ⇒ không vẽ đường nằm ở 0 (dễ đọc thành "năm trước bằng 0").
  const hasPrevious = points.some((p) => p.previous > 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <LegendLine color={CURRENT}>{`Kỳ này (${periodLabel})`}</LegendLine>
        {hasPrevious ? (
          <LegendLine color={PREVIOUS} dashed>
            Cùng kỳ năm trước
          </LegendLine>
        ) : (
          <span>Chưa có giá trúng cùng kỳ năm trước để so sánh</span>
        )}
      </div>
      <div
        className="relative h-[240px] w-full"
        role="img"
        aria-label={`Giá trúng lũy kế theo tuần, ${periodLabel} so với cùng kỳ năm trước — số liệu trong bảng ẩn ngay sau`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="from"
              tickFormatter={(d: string) => formatDayMonth(d)}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              minTickGap={16}
            />
            <YAxis
              width={56}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v: number) => formatMoneyShort(v)}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<WeekTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
            {hasPrevious && (
              <Line
                type="monotone"
                dataKey="previous"
                stroke={PREVIOUS}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                activeDot={{ r: 4, stroke: "hsl(var(--card))", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            )}
            <Line
              type="monotone"
              dataKey="current"
              stroke={CURRENT}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "hsl(var(--card))", strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <table className="sr-only">
          <caption>Giá trúng lũy kế theo tuần</caption>
          <thead>
            <tr>
              <th scope="col">Tuần</th>
              <th scope="col">Kỳ này</th>
              <th scope="col">Cùng kỳ năm trước</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.week}>
                <th scope="row">{weekLabel(p)}</th>
                <td>{p.current !== null ? formatMoneyFull(p.current) : "—"}</td>
                <td>{formatMoneyFull(p.previous)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
