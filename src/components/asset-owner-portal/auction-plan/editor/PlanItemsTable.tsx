import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoneyFull, formatMoneyShort } from "@/utils/money";
import { monthLabel } from "@/lib/auctionPlan/totals";
import { AUCTION_PLAN_EXEC_STATUS_LABELS, type AuctionPlanItem } from "@/lib/auctionPlan/types";
import { PlanHealthChip } from "../progress/PlanHealthChip";
import type { PlanItemHealth } from "@/lib/auctionPlan/health";

interface PlanItemsTableProps {
  items: readonly AuctionPlanItem[];
  canEdit: boolean;
  canDelete: boolean;
  /** Sức khoẻ của từng tài sản (A5) — cùng nguồn với lưới tab "Tiến độ". */
  healthOf?: (itemId: string) => PlanItemHealth | undefined;
  onOpen: (item: AuctionPlanItem) => void;
  onDelete: (item: AuctionPlanItem) => void;
}

const area = (v: number | null) => (v === null ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 1 }));

const dropped = (item: AuctionPlanItem) => item.exec_status === "dropped";

/**
 * Danh mục tài sản theo ĐÚNG bảy cột của biểu mẫu chính thức (A9): STT · Tên lô
 * đất · Số lô · Diện tích · Đặc điểm, vị trí · Giá khởi điểm (đồng/m²) · Thời
 * gian dự kiến. Desktop là bảng, màn hẹp xếp thành thẻ-dòng (§A8.7).
 */
export function PlanItemsTable({ items, canEdit, canDelete, healthOf, onOpen, onDelete }: PlanItemsTableProps) {
  const rowActions = (item: AuctionPlanItem) => (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2 text-xs"
        onClick={() => onOpen(item)}
        aria-label={canEdit ? `Sửa ${item.item_code}` : `Xem ${item.item_code}`}
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        {canEdit ? "Sửa" : "Xem"}
      </Button>
      {canDelete && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-destructive hover:text-destructive"
          onClick={() => onDelete(item)}
          aria-label={`Xoá ${item.item_code}`}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        </Button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[60rem] text-[13.5px]">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="w-12 whitespace-nowrap pb-2 pr-2.5 pt-3 font-medium">STT</th>
              <th className="whitespace-nowrap px-2.5 pb-2 pt-3 font-medium">Tên lô đất</th>
              <th className="whitespace-nowrap px-2.5 pb-2 pt-3 font-medium">Số lô</th>
              <th className="whitespace-nowrap px-2.5 pb-2 pt-3 text-right font-medium">Diện tích (m²)</th>
              <th className="whitespace-nowrap px-2.5 pb-2 pt-3 font-medium">Đặc điểm, vị trí</th>
              <th className="whitespace-nowrap px-2.5 pb-2 pt-3 text-right font-medium">Giá khởi điểm (đồng/m²)</th>
              <th className="whitespace-nowrap px-2.5 pb-2 pt-3 font-medium">Thời gian dự kiến</th>
              <th className="w-24 pb-2 pt-3" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className="border-b last:border-0 align-top">
                <td className="py-3 pr-2.5 tabular-nums text-muted-foreground">{i + 1}</td>
                <td className="px-2.5 py-3">
                  <p className={dropped(item) ? "font-medium text-muted-foreground line-through" : "font-medium text-foreground"}>
                    {item.title}
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {item.item_code}
                    {dropped(item) && ` · ${AUCTION_PLAN_EXEC_STATUS_LABELS.dropped}`}
                    {healthOf?.(item.id) && <PlanHealthChip health={healthOf(item.id)!} />}
                  </p>
                </td>
                <td className="px-2.5 py-3 text-muted-foreground">{item.lot_labels ?? "—"}</td>
                <td className="px-2.5 py-3 text-right tabular-nums">{area(item.area_m2)}</td>
                <td className="max-w-[18rem] px-2.5 py-3 text-muted-foreground">{item.location ?? "—"}</td>
                <td className="px-2.5 py-3 text-right tabular-nums">
                  {item.unit_start_price === null ? "—" : formatMoneyFull(item.unit_start_price)}
                  {item.expected_start_value !== null && (
                    <span className="block text-xs text-muted-foreground">
                      Giá trị {formatMoneyShort(item.expected_start_value)}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-2.5 py-3 tabular-nums">{monthLabel(item.planned_month)}</td>
                <td className="px-2.5 py-3">{rowActions(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet */}
      <ul className="space-y-2 lg:hidden">
        {items.map((item, i) => (
          <li key={item.id} className="rounded-xl border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={dropped(item) ? "text-sm font-medium text-muted-foreground line-through" : "text-sm font-medium text-foreground"}>
                  <span className="tabular-nums text-muted-foreground">{i + 1}. </span>
                  {item.title}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {item.item_code}
                  {item.lot_labels && ` · Lô ${item.lot_labels}`}
                  {dropped(item) && ` · ${AUCTION_PLAN_EXEC_STATUS_LABELS.dropped}`}
                  {healthOf?.(item.id) && <PlanHealthChip health={healthOf(item.id)!} />}
                </p>
              </div>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div>
                <dt className="text-muted-foreground">Diện tích</dt>
                <dd className="tabular-nums text-foreground">{area(item.area_m2)} m²</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Thời gian dự kiến</dt>
                <dd className="tabular-nums text-foreground">{monthLabel(item.planned_month)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Giá khởi điểm</dt>
                <dd className="tabular-nums text-foreground">
                  {item.unit_start_price === null ? "—" : `${formatMoneyShort(item.unit_start_price)}/m²`}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Giá trị khởi điểm</dt>
                <dd className="tabular-nums text-foreground">
                  {item.expected_start_value === null ? "—" : formatMoneyShort(item.expected_start_value)}
                </dd>
              </div>
            </dl>
            {item.location && <p className="mt-2 text-xs text-muted-foreground">{item.location}</p>}
            <div className="mt-2">{rowActions(item)}</div>
          </li>
        ))}
      </ul>
    </>
  );
}
