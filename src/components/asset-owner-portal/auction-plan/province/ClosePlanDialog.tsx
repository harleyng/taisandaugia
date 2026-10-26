import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useClosePlan } from "@/hooks/useAuctionPlanProvince";
import { unitStatusLabel, type ProvinceRollupRow } from "@/lib/auctionPlan/province";

interface ClosePlanDialogProps {
  row: ProvinceRollupRow | null;
  workspaceId: string | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Đóng kế hoạch" (`approved | adjusting → closed`).
 *
 * RPC `auction_plan_close` có từ Phase 4 nhưng chưa có mặt UI nào; Phase 4 đã nói
 * nhà của nó là màn cấp tỉnh, vì cổng của nó là `auction_plan_reviewer_ok` — đóng
 * một kế hoạch đã duyệt là việc của cấp duyệt, không phải của xã.
 *
 * Đóng là MỘT CHIỀU: kế hoạch đã đóng không mở lại được, và không điều chỉnh
 * được nữa. Câu chữ phải nói rõ điều đó trước khi bấm.
 */
export function ClosePlanDialog({ row, workspaceId, onOpenChange }: ClosePlanDialogProps) {
  const closePlan = useClosePlan(workspaceId);
  const status = row ? unitStatusLabel(row) : "";

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="size-5 text-primary" strokeWidth={1.5} aria-hidden="true" />
            Đóng kế hoạch
          </DialogTitle>
          <DialogDescription>
            Đóng kế hoạch của {row?.unit_name ?? "đơn vị"} ({status}). Sau khi đóng, đơn vị không trình bản điều
            chỉnh được nữa và kế hoạch không còn trong danh sách việc của tháng. Thao tác này không mở lại được.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={closePlan.isPending}>
            Huỷ
          </Button>
          <Button
            onClick={() =>
              row?.plan_id &&
              closePlan.mutate(row.plan_id, { onSuccess: () => onOpenChange(false) })
            }
            disabled={closePlan.isPending || !row?.plan_id}
          >
            {closePlan.isPending ? "Đang đóng…" : "Đóng kế hoạch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
