import { GitBranch, Link2, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { cn } from "@/lib/utils";
import { formatMoneyFull, formatMoneyShort } from "@/utils/money";
import { formatPlanDate } from "@/lib/auctionPlan/print";
import { AUCTION_PLAN_STATUS_LABELS, type AuctionPlanStatus } from "@/lib/auctionPlan/types";
import type { PlanCycleBoardRow } from "@/hooks/useAuctionPlanProvince";

const SUBMITTED: readonly string[] = ["submitted", "approved", "adjusting", "closed"];

/** Nhãn tình trạng CỦA ĐỢT: trống = xã chưa lập kế hoạch nào cho đợt này. */
function cycleStatusLabel(row: PlanCycleBoardRow): { label: string; style: string } {
  if (!row.plan_id) return { label: "Chưa lập kế hoạch", style: "bg-warning/10 text-foreground" };
  const status = row.plan_status as AuctionPlanStatus;
  const label = AUCTION_PLAN_STATUS_LABELS[status] ?? status;
  if (status === "returned") return { label, style: "bg-destructive/10 text-destructive" };
  if (status === "submitted" || status === "adjusting") return { label, style: "bg-warning/10 text-warning" };
  if (status === "approved") return { label, style: "bg-success/10 text-success" };
  return { label, style: "bg-muted text-muted-foreground" };
}

interface CycleBoardTableProps {
  rows: readonly PlanCycleBoardRow[];
  onOpenPlan: (planId: string) => void;
}

/**
 * Bảng theo dõi MỘT đợt: ai đã trình, ai còn nợ, chỉ tiêu giao cho từng xã.
 *
 * "Chưa lập kế hoạch" ở đây là tình trạng ĐỐI VỚI ĐỢT NÀY — một xã đã có kế hoạch
 * năm được duyệt vẫn đọc "Chưa lập kế hoạch" trong đợt bổ sung, đúng việc đang nợ.
 */
export function CycleBoardTable({ rows, onOpenPlan }: CycleBoardTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Map}
        compact
        title="Đợt này chưa giao cho đơn vị nào."
        description="Giao danh sách xã, phường và chỉ tiêu thu ở khối bên dưới."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th scope="col" className="py-2 text-left font-medium">Đơn vị</th>
            <th scope="col" className="py-2 text-left font-medium">Tình trạng</th>
            <th scope="col" className="py-2 text-right font-medium">Chỉ tiêu thu</th>
            <th scope="col" className="py-2 text-right font-medium">Chỉ tiêu tài sản</th>
            <th scope="col" className="py-2 text-right font-medium">Đã lập</th>
            <th scope="col" className="py-2 text-left font-medium">Ngày trình</th>
            <th scope="col" className="py-2 text-right font-medium">
              <span className="sr-only">Hành động</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = cycleStatusLabel(row);
            return (
              <tr key={row.admin_unit_code} className="border-b last:border-0">
                <td className="py-2.5 pr-3">
                  <span className="font-medium text-foreground">{row.unit_name}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    {row.shape === "child" ? (
                      <Link2 className="size-3" strokeWidth={1.5} aria-hidden="true" />
                    ) : (
                      <GitBranch className="size-3" strokeWidth={1.5} aria-hidden="true" />
                    )}
                    {row.shape === "child" ? "Trạm con" : "Chi nhánh"} · {row.admin_unit_code}
                  </span>
                </td>
                <td className="py-2.5 pr-3">
                  <span
                    className={cn(
                      "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
                      status.style,
                    )}
                  >
                    {status.label}
                  </span>
                  {row.plan_id && !row.linked_to_cycle && (
                    <span className="ml-2 text-xs text-muted-foreground">(không gắn đợt)</span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums" title={formatMoneyFull(row.assigned_revenue ?? 0)}>
                  {row.assigned_revenue ? formatMoneyShort(row.assigned_revenue) : "—"}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{row.assigned_count ?? "—"}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  {row.plan_id ? (
                    <>
                      {row.item_count}
                      <span className="ml-1 text-xs text-muted-foreground">
                        · {formatMoneyShort(row.expected_total)}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                  {row.submitted_at && SUBMITTED.includes(row.plan_status ?? "")
                    ? formatPlanDate(row.submitted_at)
                    : "chưa trình"}
                </td>
                <td className="py-2.5 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!row.plan_id}
                    onClick={() => row.plan_id && onOpenPlan(row.plan_id)}
                  >
                    {row.plan_id ? "Xem kế hoạch" : "Chưa có"}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
