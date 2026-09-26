import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReadOnlyNote } from "@/components/asset-owner-portal/pulse/PulseListParts";
import type { Receivable } from "@/lib/ownerCashFlow";
import { formatDayFull } from "@/lib/ownerPulse";
import { formatMoneyFull } from "@/utils/money";
import type { CanWriteRow, CashDialogState } from "./cashFlowDialogState";
import { AssetLine } from "./AssetLine";

const PAGE = 20;
const GRID =
  "md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)_9.5rem] md:items-center md:gap-4";

interface ReceivablesTableProps {
  items: Receivable[];
  unitNames: ReadonlyMap<string, string> | null;
  canWrite: CanWriteRow;
  onAction: (d: CashDialogState) => void;
}

/** L4 "Khoản phải thu": mọi tài sản đã bán còn tiền chưa về, tính tới hôm nay. */
export function ReceivablesTable({ items, unitNames, canWrite, onAction }: ReceivablesTableProps) {
  const [limit, setLimit] = useState(PAGE);
  const shown = items.slice(0, limit);

  return (
    <div className="text-sm">
      <div className={cn("hidden border-b pb-2 text-xs text-muted-foreground", GRID)}>
        <span>Tài sản</span>
        <span className="text-right">Giá trúng</span>
        <span className="text-right">Đã thu</span>
        <span className="text-right">Còn phải thu</span>
        <span>Hạn</span>
        <span className="sr-only">Thao tác</span>
      </div>
      <ul className="divide-y">
        {shown.map((r) => {
          const writable = r.row.ownOutcomeId !== null && canWrite(r.row.unitId, r.row.branchId);
          return (
            <li key={`${r.row.unitId}|${r.row.rowKey}`} className={cn("flex flex-wrap items-start gap-x-4 gap-y-1 py-3", GRID)}>
              <AssetLine
                className="basis-full md:basis-auto"
                title={r.row.title}
                code={r.row.assetCode}
                sub={[unitNames?.get(r.row.unitId), r.row.branchName, r.row.date ? `Phiên ${formatDayFull(r.row.date)}` : null]}
              />
              <p className="tabular-nums text-muted-foreground md:text-right">
                <span className="md:hidden">Giá trúng </span>
                {formatMoneyFull(r.row.price)}
              </p>
              <p className="tabular-nums text-muted-foreground md:text-right">
                <span className="md:hidden">· Đã thu </span>
                {formatMoneyFull(r.row.paidAmount ?? 0)}
              </p>
              <p className="basis-full font-medium tabular-nums text-foreground md:basis-auto md:text-right">
                <span className="font-normal text-muted-foreground md:hidden">Còn phải thu </span>
                {formatMoneyFull(r.remaining)}
              </p>
              <p className={cn("tabular-nums", r.daysOverdue ? "text-foreground" : "text-muted-foreground")}>
                {r.dueOn ? formatDayFull(r.dueOn) : "—"}
                {r.daysOverdue > 0 && (
                  <span className="ml-1.5 rounded-full bg-warning/15 px-1.5 py-0.5 text-[11px] text-foreground">
                    trễ {r.daysOverdue} ngày
                  </span>
                )}
                {r.dueIsDefault && r.dueOn && <span className="block text-[11px] text-muted-foreground">mặc định</span>}
              </p>
              <div className="flex basis-full justify-start gap-1 md:basis-auto md:justify-end">
                {writable ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => onAction({ kind: "record", outcomeId: r.row.ownOutcomeId, presetKind: "payment" })}
                    >
                      Ghi thu
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8" onClick={() => onAction({ kind: "due", row: r.row })}>
                      Đặt hạn
                    </Button>
                  </>
                ) : (
                  <ReadOnlyNote />
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {items.length > limit && (
        <div className="pt-3 text-center">
          <Button variant="ghost" size="sm" onClick={() => setLimit((n) => n + PAGE)}>
            Xem thêm {Math.min(PAGE, items.length - limit)} tài sản
          </Button>
        </div>
      )}
    </div>
  );
}
