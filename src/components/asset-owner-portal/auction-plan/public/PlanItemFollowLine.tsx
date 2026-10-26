import { Users } from "lucide-react";
import { usePlanItemFollowCounts } from "@/hooks/useAuctionPlanPublic";

interface Props {
  planId: string;
  itemId: string;
}

/**
 * "12 người đang theo dõi" cho một tài sản trong kế hoạch (Phase 10).
 *
 * Chỉ SỐ ĐẾM: `auction_plan_item_follow_counts` là hàm tổng hợp, đơn vị KHÔNG
 * BAO GIỜ thấy ai đang theo dõi (bảng `auction_plan_item_follows` không cấp
 * quyền đọc cho client, và RLS của nó là "own rows").
 *
 * Chưa có lượt nào thì không hiện gì — đừng làm nhiễu ngăn chi tiết bằng "0".
 */
export function PlanItemFollowLine({ planId, itemId }: Props) {
  const { data: counts } = usePlanItemFollowCounts(planId);
  const count = counts?.get(itemId) ?? 0;
  if (count <= 0) return null;

  return (
    <p className="flex items-center gap-1.5 text-sm text-primary">
      <Users className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      {count} người đang theo dõi tài sản này
    </p>
  );
}
