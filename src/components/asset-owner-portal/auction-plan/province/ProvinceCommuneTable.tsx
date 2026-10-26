import { ArrowDown, ArrowUp, Lock, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { cn } from "@/lib/utils";
import { formatMoneyFull, formatMoneyShort } from "@/utils/money";
import {
  PROVINCE_SORT_LABELS,
  unitStatusLabel,
  type ProvinceRollupRow,
  type ProvinceSortKey,
} from "@/lib/auctionPlan/province";

/** Nghĩa màu của tình trạng đơn vị — màu nằm ở VIÊN nhỏ, không phủ cả dòng (§A8.4). */
const STATUS_STYLE: Record<string, string> = {
  "Bị trả lại": "bg-destructive/10 text-destructive",
  "Chưa lập kế hoạch": "bg-warning/10 text-foreground",
  Nháp: "bg-muted text-muted-foreground",
  "Chờ xem xét": "bg-warning/10 text-warning",
  "Đang điều chỉnh": "bg-warning/10 text-warning",
  "Đã duyệt": "bg-success/10 text-success",
  "Đã đóng": "bg-muted text-muted-foreground",
};

interface Column {
  key: ProvinceSortKey;
  align: "left" | "right";
  className?: string;
}

const COLUMNS: Column[] = [
  { key: "unit", align: "left" },
  { key: "status", align: "left" },
  { key: "assigned", align: "right" },
  { key: "planned", align: "right" },
  { key: "winning", align: "right" },
  { key: "collected", align: "right" },
  { key: "done", align: "right" },
  { key: "late", align: "right" },
];

interface ProvinceCommuneTableProps {
  rows: readonly ProvinceRollupRow[];
  sortKey: ProvinceSortKey;
  sortDir: "asc" | "desc";
  onSort: (key: ProvinceSortKey) => void;
  /** Mở kế hoạch của đơn vị — chỉ gọi khi dòng có kế hoạch. */
  onOpenPlan: (planId: string) => void;
  /** Hiện nút "Đóng kế hoạch" (chỉ cấp duyệt, kế hoạch đã duyệt / đang điều chỉnh). */
  canClose?: boolean;
  onClosePlan?: (row: ProvinceRollupRow) => void;
}

/**
 * Bảng tầng L3: một dòng cho mỗi đơn vị hành chính, sắp xếp được theo mọi cột số.
 *
 * Bấm vào dòng mở kế hoạch của đơn vị đó (trang chi tiết tự xét quyền theo Trạm
 * CỦA KẾ HOẠCH, nên cấp tỉnh xem được kế hoạch của xã và thấy đúng nút của mình).
 * Đơn vị chưa lập kế hoạch thì dòng không bấm được — chưa có gì để mở.
 */
export function ProvinceCommuneTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  onOpenPlan,
  canClose = false,
  onClosePlan,
}: ProvinceCommuneTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Map}
        compact
        title="Chưa có đơn vị hành chính nào."
        description="Gắn mã xã / phường cho các chi nhánh ở Chi nhánh · AMC, hoặc mở một đợt lập kế hoạch."
      />
    );
  }

  const SortIcon = sortDir === "asc" ? ArrowUp : ArrowDown;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn("py-2 font-medium", col.align === "right" ? "text-right" : "text-left")}
              >
                <button
                  type="button"
                  onClick={() => onSort(col.key)}
                  aria-label={`Sắp xếp theo ${PROVINCE_SORT_LABELS[col.key]}`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:text-foreground",
                    sortKey === col.key && "text-foreground",
                  )}
                >
                  {PROVINCE_SORT_LABELS[col.key]}
                  {sortKey === col.key && <SortIcon className="size-3" strokeWidth={1.5} aria-hidden="true" />}
                </button>
              </th>
            ))}
            <th scope="col" className="py-2 text-right font-medium">
              <span className="sr-only">Hành động</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = unitStatusLabel(row);
            const openable = !!row.plan_id;
            return (
              <tr key={row.admin_unit_code} className="border-b last:border-0 align-middle">
                <td className="py-2.5 pr-3">
                  <span className="font-medium text-foreground">{row.unit_name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{row.admin_unit_code}</span>
                  {row.unit_level === "province" && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      Cấp tỉnh
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-3">
                  <span
                    className={cn(
                      "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
                      STATUS_STYLE[status] ?? "bg-muted text-muted-foreground",
                    )}
                  >
                    {status}
                  </span>
                  {row.plan_count > 1 && (
                    <span className="ml-2 text-xs text-muted-foreground">{row.plan_count} kế hoạch</span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums" title={formatMoneyFull(row.assigned_revenue ?? 0)}>
                  {row.assigned_revenue ? formatMoneyShort(row.assigned_revenue) : "—"}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  {row.planned_count > 0 ? (
                    <>
                      {row.planned_count}
                      <span className="ml-1 text-xs text-muted-foreground">
                        · {formatMoneyShort(row.planned_start_value)}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums" title={formatMoneyFull(row.winning_total)}>
                  {row.winning_total > 0 ? formatMoneyShort(row.winning_total) : "—"}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums" title={formatMoneyFull(row.collected)}>
                  {row.collected > 0 ? formatMoneyShort(row.collected) : "—"}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  {row.done_pct === null ? "—" : `${row.done_pct}%`}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  {row.late_count > 0 ? (
                    <span className="font-semibold text-destructive">{row.late_count}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                  {row.at_risk_count > 0 && (
                    <span className="ml-1 text-xs text-warning">+{row.at_risk_count}</span>
                  )}
                </td>
                <td className="py-2.5 text-right">
                  <div className="inline-flex items-center gap-2">
                    {canClose && onClosePlan && row.plan_id && (
                      <Button size="sm" variant="ghost" onClick={() => onClosePlan(row)}>
                        <Lock aria-hidden="true" />
                        Đóng
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!openable}
                      onClick={() => openable && onOpenPlan(row.plan_id!)}
                    >
                      {openable ? "Xem kế hoạch" : "Chưa có"}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
