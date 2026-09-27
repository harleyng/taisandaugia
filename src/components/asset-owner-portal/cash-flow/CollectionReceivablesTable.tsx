import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ReadOnlyNote } from "@/components/asset-owner-portal/pulse/PulseListParts";
import { collectionBucketOf, daysUntilDue, type Receivable } from "@/lib/ownerCashFlow";
import { formatDayFull } from "@/lib/ownerPulse";
import { formatMoneyShort } from "@/utils/money";
import type { CanWriteRow, CashDialogState } from "./cashFlowDialogState";
import { AssetLine } from "./AssetLine";

const PAGE = 20;
const GRID = "md:grid md:grid-cols-[minmax(0,1fr)_8rem_9.5rem_15rem] md:items-center md:gap-4";

interface CollectionReceivablesTableProps {
  items: Receivable[];
  asOf: string;
  unitNames: ReadonlyMap<string, string> | null;
  canWrite: CanWriteRow;
  onAction: (d: CashDialogState) => void;
}

/** Nhãn hạn: trễ / sắp tới hạn / ngày hạn — màu nằm ở chấm, chữ luôn đủ tương phản. */
function DueChip({ item, asOf }: { item: Receivable; asOf: string }) {
  const bucket = collectionBucketOf(item, asOf);
  const days = daysUntilDue(item, asOf);
  const text =
    bucket === "overdue"
      ? `Trễ ${item.daysOverdue} ngày`
      : bucket === "soon"
        ? days === 0
          ? "Hạn hôm nay"
          : `Còn ${days} ngày`
        : item.dueOn
          ? formatDayFull(item.dueOn)
          : "Chưa có hạn";
  const sub = [
    bucket !== "later" && item.dueOn ? formatDayFull(item.dueOn) : null,
    item.dueIsDefault && item.dueOn ? "mặc định" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="tabular-nums">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
          bucket === "overdue" && "bg-destructive/10 text-foreground",
          bucket === "soon" && "bg-warning/15 text-foreground",
          bucket === "later" && "bg-muted text-muted-foreground",
        )}
      >
        {bucket !== "later" && (
          <span
            aria-hidden="true"
            className={cn("h-1.5 w-1.5 rounded-full", bucket === "overdue" ? "bg-destructive" : "bg-warning")}
          />
        )}
        {text}
      </span>
      {sub && <span className="mt-0.5 block text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

/** "Còn phải thu" của trang Thu tiền: mỗi tài sản đã bán còn tiền chưa về, trễ nhất trước. */
export function CollectionReceivablesTable({ items, asOf, unitNames, canWrite, onAction }: CollectionReceivablesTableProps) {
  const [limit, setLimit] = useState(PAGE);
  const shown = items.slice(0, limit);

  return (
    <div className="text-sm">
      <div className={cn("hidden border-b pb-2 text-xs text-muted-foreground", GRID)}>
        <span>Tài sản</span>
        <span className="text-right">Còn phải thu</span>
        <span>Hạn</span>
        <span className="sr-only">Thao tác</span>
      </div>
      <ul className="divide-y">
        {shown.map((r) => {
          const own = r.row.ownOutcomeId !== null;
          const canRecord = own && canWrite(r.row.unitId, r.row.branchId, "create");
          const canEditRow = own && canWrite(r.row.unitId, r.row.branchId, "update");
          const writable = canRecord || canEditRow;
          return (
            <li key={`${r.row.unitId}|${r.row.rowKey}`} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 py-3", GRID)}>
              <AssetLine
                className="basis-full md:basis-auto"
                title={r.row.title}
                code={r.row.assetCode}
                sub={[unitNames?.get(r.row.unitId), r.row.branchName, r.row.date ? `Phiên ${formatDayFull(r.row.date)}` : null]}
              />
              <p className="whitespace-nowrap font-semibold tabular-nums text-foreground md:text-right">
                <span className="sr-only">Còn phải thu </span>
                {formatMoneyShort(r.remaining)}
              </p>
              <DueChip item={r} asOf={asOf} />
              <div className="flex basis-full items-center justify-start gap-1 md:basis-auto md:justify-end">
                {writable ? (
                  <>
                    {canEditRow && (
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => onAction({ kind: "due", row: r.row })}>
                        Đổi hạn
                      </Button>
                    )}
                    {canRecord && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() =>
                          onAction({
                            kind: "record",
                            outcomeId: r.row.ownOutcomeId,
                            presetKind: "payment",
                          })
                        }
                      >
                        Ghi thu
                      </Button>
                    )}
                    {/* modal={false}: mục menu mở hộp thoại — menu modal có thể để lại pointer-events:none trên body. */}
                    {canEditRow && (
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Thao tác khác — ${r.row.title}`}>
                            <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => onAction({ kind: "default", row: r.row })}
                          >
                            Người trúng bỏ cọc
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
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
