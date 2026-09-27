import { cn } from "@/lib/utils";
import type { KpiDelta, OverviewKpis } from "@/lib/ownerOverview";
import { moneyShortParts } from "@/utils/money";

const count = (n: number | null) => (n ?? 0).toLocaleString("en-US");

/** "▲ 12% so với cùng kỳ năm trước" — màu theo TỐT / XẤU, không theo chiều tăng giảm. */
function DeltaLine({ delta }: { delta: KpiDelta }) {
  const { change } = delta;
  if (change === null) return <>Chưa có số cùng kỳ năm trước</>;
  if (change === 0) return <>Không đổi so với cùng kỳ năm trước</>;
  const up = change > 0;
  const good = up === delta.higherIsBetter;
  const amount = delta.kind === "points" ? `${Math.abs(change)} điểm %` : `${Math.abs(change).toLocaleString("en-US")}%`;
  return (
    <>
      <span className={cn("font-medium tabular-nums", good ? "text-success" : "text-destructive")}>
        <span aria-hidden="true">{up ? "▲" : "▼"}</span>
        <span className="sr-only">{up ? "tăng" : "giảm"}</span> {amount}
      </span>{" "}
      so với cùng kỳ năm trước
    </>
  );
}

interface Cell {
  label: string;
  value: string;
  unit?: string;
  delta: KpiDelta;
}

/** 4 KPI xếp 2×2, ngăn bằng đường kẻ hình chữ thập. */
export function OverviewKpiGrid({ kpis }: { kpis: OverviewKpis }) {
  const win = moneyShortParts(kpis.winValue.current);
  const cells: Cell[] = [
    { label: "Tài sản đã đấu", value: count(kpis.auctioned.current), unit: "tài sản", delta: kpis.auctioned },
    {
      label: "Tỷ lệ thành công",
      value: kpis.successRate.current === null ? "—" : String(kpis.successRate.current),
      unit: kpis.successRate.current === null ? undefined : "%",
      delta: kpis.successRate,
    },
    { label: "Giá trúng", value: win.value, unit: win.unit, delta: kpis.winValue },
    { label: "Đang tồn đọng", value: count(kpis.stuck.current), unit: "tài sản", delta: kpis.stuck },
  ];

  return (
    <dl className="grid h-full grid-cols-2">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={cn(
            "flex min-w-0 flex-col justify-center gap-1.5 p-3 sm:p-4",
            i % 2 === 0 && "border-r",
            i < 2 && "border-b",
          )}
        >
          <dt className="text-xs text-muted-foreground">{c.label}</dt>
          <dd className="flex min-w-0 items-baseline gap-1">
            <span className="truncate text-2xl font-semibold tabular-nums text-foreground">{c.value}</span>
            {c.unit && <span className="shrink-0 text-sm text-muted-foreground">{c.unit}</span>}
          </dd>
          <dd className="text-xs text-muted-foreground">
            <DeltaLine delta={c.delta} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
