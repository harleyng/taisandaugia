import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCount, formatRate, pointLabel, pointTitle, type SharePoint, type ShareSeries } from "@/lib/shareLinks/series";

// Một trục số đếm (không trục kép): cột = lượt xem, đường = lượt bấm "Mua hồ sơ". Tỷ lệ chuyển
// đổi nằm ở tooltip + dải tổng. Màu đã qua validate_palette (sáng lẫn tối): xanh lá 152° sáng hơn
// --primary (primary quá tối, đọc thành xám trên biểu đồ) + tím 262° — không dùng họ xanh thứ hai.
const VIEWS = "hsl(152 55% 40%)";
const DOSSIER = "hsl(262 60% 55%)";

function PointTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: SharePoint }[]; unit: ShareSeries["unit"] }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  const row = (color: string, label: string, value: string) => (
    <p className="flex items-center justify-between gap-6 tabular-nums">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
        {label}
      </span>
      <span className="font-medium text-foreground">{value}</span>
    </p>
  );
  return (
    <div className="min-w-[200px] space-y-1 rounded-lg border bg-popover px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-foreground">{pointTitle(p.date, unit)}</p>
      {row(VIEWS, "Lượt xem", formatCount(p.views))}
      {row(DOSSIER, "Bấm “Mua hồ sơ”", formatCount(p.dossier))}
      <p className="flex items-center justify-between gap-6 tabular-nums">
        <span className="pl-3.5 text-muted-foreground">Tỷ lệ chuyển đổi</span>
        <span className="font-medium text-foreground">{formatRate(p.conversion)}</span>
      </p>
      <p className="pl-3.5 text-[11px] text-muted-foreground">{formatCount(p.viewers)} người xem</p>
    </div>
  );
}

function LegendKey({ kind, color, children }: { kind: "bar" | "line"; color: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg aria-hidden="true" width="14" height="10" className="shrink-0">
        {kind === "bar" ? (
          <rect x="3" y="1" width="8" height="9" rx="2" fill={color} />
        ) : (
          <line x1="1" y1="5" x2="13" y2="5" stroke={color} strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>
      {children}
    </span>
  );
}

/** Lượt xem theo ngày (tuần khi khoảng dài) + lượt bấm "Mua hồ sơ" của một link / một chiến dịch. */
export function ShareLinkTrafficChart({ series }: { series: ShareSeries }) {
  const empty = series.points.every((p) => p.views === 0 && p.dossier === 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <LegendKey kind="bar" color={VIEWS}>
          Lượt xem
        </LegendKey>
        <LegendKey kind="line" color={DOSSIER}>
          Bấm “Mua hồ sơ”
        </LegendKey>
        {series.unit === "week" && <span>· gộp theo tuần</span>}
      </div>
      <div
        className="relative h-[280px] w-full"
        role="img"
        aria-label={`Lượt xem và lượt bấm Mua hồ sơ theo ${series.unit === "week" ? "tuần" : "ngày"} — số liệu trong bảng ẩn ngay sau`}
      >
        {empty && (
          <p className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground">
            Chưa có lượt xem nào trong khoảng này.
          </p>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series.points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => pointLabel(d, series.unit)}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              minTickGap={20}
            />
            <YAxis
              width={40}
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v: number) => formatCount(v)}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<PointTooltip unit={series.unit} />}
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
            />
            <Bar dataKey="views" fill={VIEWS} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            <Line
              type="monotone"
              dataKey="dossier"
              stroke={DOSSIER}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "hsl(var(--card))", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <table className="sr-only">
          <caption>Lượt xem và lượt bấm Mua hồ sơ</caption>
          <thead>
            <tr>
              <th scope="col">{series.unit === "week" ? "Tuần" : "Ngày"}</th>
              <th scope="col">Lượt xem</th>
              <th scope="col">Người xem</th>
              <th scope="col">Bấm Mua hồ sơ</th>
              <th scope="col">Tỷ lệ chuyển đổi</th>
            </tr>
          </thead>
          <tbody>
            {series.points.map((p) => (
              <tr key={p.date}>
                <th scope="row">{pointTitle(p.date, series.unit)}</th>
                <td>{p.views}</td>
                <td>{p.viewers}</td>
                <td>{p.dossier}</td>
                <td>{formatRate(p.conversion)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
