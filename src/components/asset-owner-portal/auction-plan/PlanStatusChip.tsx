import { cn } from "@/lib/utils";
import { AUCTION_PLAN_STATUS_LABELS, type AuctionPlanStatus } from "@/lib/auctionPlan/types";

/** Màu mang nghĩa (§A8.4): vàng = đang có việc, xanh = đã chốt, đỏ = bị trả lại. */
const STYLE: Record<AuctionPlanStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-warning/10 text-warning",
  returned: "bg-destructive/10 text-destructive",
  approved: "bg-success/10 text-success",
  adjusting: "bg-warning/10 text-warning",
  closed: "bg-muted text-muted-foreground",
};

/** Viên trạng thái kế hoạch — dùng chung ở thẻ danh sách và đầu trang chi tiết. */
export function PlanStatusChip({ status, className }: { status: AuctionPlanStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
        STYLE[status],
        className,
      )}
    >
      {AUCTION_PLAN_STATUS_LABELS[status]}
    </span>
  );
}
