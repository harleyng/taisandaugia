import { useState } from "react";
import { PencilRuler, Stamp, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReadOnlyNote } from "@/components/asset-owner-portal/pulse/PulseListParts";
import { usePlanReviewerOk } from "@/hooks/useAuctionPlanApproval";
import type { AuctionPlan } from "@/lib/auctionPlan/types";
import { RecordApprovalDialog } from "./RecordApprovalDialog";
import { ReturnPlanDialog } from "./ReturnPlanDialog";
import { StartAdjustmentDialog } from "./StartAdjustmentDialog";

interface PlanReviewActionsProps {
  plan: AuctionPlan;
  /** Quyền `ke-hoach:finalize` trong chi nhánh CỦA KẾ HOẠCH — điều kiện mở điều chỉnh. */
  canFinalize: boolean;
}

/**
 * Hành động của hai phía ở đầu trang chi tiết, cho hai trạng thái mà Phase 3 để
 * trống: `submitted` (cấp trên: Ghi nhận phê duyệt / Trả lại) và `approved`
 * (đơn vị lập: Điều chỉnh kế hoạch).
 *
 * Component tự hỏi `auction_plan_reviewer_ok` (một RPC, cache theo kế hoạch) để
 * trang chi tiết không phải truyền thêm props — Phase 5 đang sửa cùng trang đó.
 * Giữ ĐÚNG MỘT nút chính mỗi trạng thái (§A8.10).
 */
export function PlanReviewActions({ plan, canFinalize }: PlanReviewActionsProps) {
  const { data: reviewerOk, isLoading } = usePlanReviewerOk(plan.id);
  const [returning, setReturning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  if (plan.status === "submitted") {
    if (isLoading || !reviewerOk) return <ReadOnlyNote>Đang chờ cấp trên xem xét.</ReadOnlyNote>;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="gap-1.5" onClick={() => setReturning(true)}>
          <Undo2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Trả lại
        </Button>
        <Button className="gap-1.5" onClick={() => setRecording(true)}>
          <Stamp className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Ghi nhận phê duyệt
        </Button>
        <ReturnPlanDialog open={returning} onOpenChange={setReturning} plan={plan} />
        <RecordApprovalDialog open={recording} onOpenChange={setRecording} plan={plan} />
      </div>
    );
  }

  if (!canFinalize) return <ReadOnlyNote>Đã duyệt — danh mục đang khoá.</ReadOnlyNote>;
  return (
    <>
      <Button className="gap-1.5" onClick={() => setAdjusting(true)}>
        <PencilRuler className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        Điều chỉnh kế hoạch
      </Button>
      <StartAdjustmentDialog open={adjusting} onOpenChange={setAdjusting} plan={plan} />
    </>
  );
}
