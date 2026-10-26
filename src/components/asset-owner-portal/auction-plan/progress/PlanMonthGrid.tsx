import { cn } from "@/lib/utils";
import { PLAN_GRID_MONTHS, planGridCells, planGridMonthLabel } from "@/lib/auctionPlan/grid";
import { PLAN_ITEM_HEALTH_LABELS } from "@/lib/auctionPlan/health";
import type { PlanItemProgress } from "@/hooks/useAuctionPlanProgress";
import { PlanHealthChip } from "./PlanHealthChip";

interface PlanMonthGridProps {
  rows: readonly PlanItemProgress[];
  planYear: number;
  onOpen: (row: PlanItemProgress) => void;
}

/**
 * Lưới 12 tháng: mỗi tài sản một dòng, mỗi tháng một ô (A6 "Detail Tiến độ").
 * Luật vẽ ô ở `src/lib/auctionPlan/grid.ts`; ở đây chỉ gắn class token.
 *
 * Cuộn NGANG trên màn hẹp với cột đầu dính — 12 tháng không xếp dọc được. Không
 * đặt `sr-only` bên trong vùng cuộn (bẫy 2026-09-26: cả trang cuộn ngang theo).
 */
export function PlanMonthGrid({ rows, planYear, onOpen }: PlanMonthGridProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] border-separate border-spacing-0 text-[13.5px]">
        <caption className="caption-top pb-2 text-left text-xs text-muted-foreground">
          Lưới tiến độ năm {planYear} — bấm một dòng để xem mốc công việc.
        </caption>
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th scope="col" className="sticky left-0 z-10 bg-card pb-2 pr-3 pt-1 font-medium">
              Tài sản
            </th>
            {PLAN_GRID_MONTHS.map((m) => (
              <th key={m} scope="col" className="w-10 pb-2 pt-1 text-center font-medium tabular-nums">
                {planGridMonthLabel(m)}
              </th>
            ))}
            <th scope="col" className="whitespace-nowrap pb-2 pl-3 pt-1 font-medium">
              Mốc
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const cells = planGridCells({
              baselineMonth: row.baselineMonth,
              forecastMonth: row.item.forecast_month,
              health: row.health,
              outcomeDate: row.outcome?.auction_date ?? null,
            });
            return (
              <tr
                key={row.item.id}
                tabIndex={0}
                role="button"
                aria-label={`${row.item.item_code} · ${row.item.title} · ${PLAN_ITEM_HEALTH_LABELS[row.health]}`}
                onClick={() => onOpen(row)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(row);
                  }
                }}
                className="cursor-pointer border-t border-border transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
              >
                <td className="sticky left-0 z-10 min-w-[14rem] max-w-[20rem] bg-card py-2.5 pr-3 align-middle">
                  <p
                    className={cn(
                      "truncate font-medium",
                      row.item.exec_status === "dropped" ? "text-muted-foreground line-through" : "text-foreground",
                    )}
                  >
                    {row.item.title}
                  </p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    {row.item.item_code}
                    <PlanHealthChip health={row.health} />
                  </p>
                </td>
                {cells.map((cell) => (
                  <td key={cell.month} className="px-0.5 py-2.5 text-center align-middle">
                    <span
                      className={cn(
                        "mx-auto flex h-6 w-8 items-center justify-center rounded border",
                        cell.baseline && !cell.late && "border-primary",
                        cell.late && "border-destructive",
                        cell.forecast && "border-primary/30 bg-primary/15",
                        !cell.baseline && !cell.forecast && !cell.late && "border-transparent",
                      )}
                    >
                      {cell.done && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
                    </span>
                  </td>
                ))}
                <td className="whitespace-nowrap pl-3 text-xs tabular-nums text-muted-foreground">
                  {row.progress.done}/{row.progress.total}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
