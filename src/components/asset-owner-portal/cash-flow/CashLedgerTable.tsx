import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CASH_KIND_LABEL, CASH_KIND_SIGN } from "@/lib/ownerCashEvent";
import type { CashEvent } from "@/lib/ownerCashFlow";
import { formatDayFull } from "@/lib/ownerPulse";
import { formatMoneyFull } from "@/utils/money";
import type { CanWriteRow, CashDialogState } from "./cashFlowDialogState";
import { AssetLine } from "./AssetLine";

const PAGE = 30;
const GRID =
  "md:grid md:grid-cols-[6.5rem_minmax(0,2.2fr)_8.5rem_minmax(0,1.2fr)_minmax(0,1.4fr)_6.5rem] md:items-center md:gap-4";

interface CashLedgerTableProps {
  events: CashEvent[];
  unitNames: ReadonlyMap<string, string> | null;
  canWrite: CanWriteRow;
  onAction: (d: CashDialogState) => void;
}

/** Tab "Đã ghi" của Thu tiền: mọi khoản đã ghi, mới nhất trước — sửa / xoá được (quyết định 2026-09-26). */
export function CashLedgerTable({ events, unitNames, canWrite, onAction }: CashLedgerTableProps) {
  const [limit, setLimit] = useState(PAGE);
  const shown = events.slice(0, limit);

  return (
    <div className="text-sm">
      <div className={cn("hidden border-b pb-2 text-xs text-muted-foreground", GRID)}>
        <span>Ngày</span>
        <span>Tài sản</span>
        <span>Loại</span>
        <span className="text-right">Số tiền</span>
        <span>Ghi chú</span>
        <span className="sr-only">Thao tác</span>
      </div>
      <ul className="divide-y">
        {shown.map((e) => {
          const sign = CASH_KIND_SIGN[e.kind];
          const stale = e.kind === "payment" && e.outcome !== "sold";
          const by = e.updatedByName ?? e.createdByName;
          return (
            <li key={e.id} className={cn("flex flex-wrap items-start gap-x-3 gap-y-1 py-3", GRID)}>
              <p className="tabular-nums text-muted-foreground">{formatDayFull(e.occurredOn)}</p>
              <AssetLine
                className="basis-full md:basis-auto"
                title={e.title}
                code={e.assetCode}
                sub={[unitNames?.get(e.unitId), e.branchName, e.roundNo ? `lượt ${e.roundNo}` : null]}
              />
              <p className="text-muted-foreground">
                {CASH_KIND_LABEL[e.kind]}
                {stale && (
                  <span className="mt-0.5 block w-fit rounded-full bg-warning/15 px-1.5 py-0.5 text-[11px] text-foreground">
                    Kết quả đã đổi
                  </span>
                )}
              </p>
              <p className={cn("font-medium tabular-nums md:text-right", sign < 0 ? "text-muted-foreground" : "text-foreground")}>
                {sign < 0 ? "−" : "+"}
                {formatMoneyFull(e.amount)}
              </p>
              <p className="min-w-0 basis-full text-xs text-muted-foreground md:basis-auto">
                {e.note && <span className="line-clamp-2 text-foreground/80">{e.note}</span>}
                {by && <span className="block truncate">{e.updatedByName ? `Sửa bởi ${by}` : `Ghi bởi ${by}`}</span>}
              </p>
              <div className="flex gap-0.5 md:justify-end">
                {e.outcomeId && (
                  <>
                    {canWrite(e.unitId, e.branchId, "update") && (
                      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => onAction({ kind: "edit", event: e })}>
                        Sửa
                      </Button>
                    )}
                    {canWrite(e.unitId, e.branchId, "delete") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onAction({ kind: "delete", event: e })}
                      >
                        Xoá
                      </Button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {events.length > limit && (
        <div className="pt-3 text-center">
          <Button variant="ghost" size="sm" onClick={() => setLimit((n) => n + PAGE)}>
            Xem thêm {Math.min(PAGE, events.length - limit)} khoản
          </Button>
        </div>
      )}
    </div>
  );
}
