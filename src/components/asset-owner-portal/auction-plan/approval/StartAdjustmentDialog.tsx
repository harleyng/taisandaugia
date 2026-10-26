import { Loader2, PencilRuler } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStartPlanAdjustment } from "@/hooks/useAuctionPlanApproval";
import type { AuctionPlan } from "@/lib/auctionPlan/types";

interface StartAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: AuctionPlan;
}

/**
 * "Điều chỉnh kế hoạch" (`approved → adjusting`): mở lại trường mốc để sửa.
 *
 * Nói rõ hai điều người dùng hay nhầm: (1) bản mốc đã duyệt vẫn còn nguyên để
 * so kế hoạch với thực tế; (2) sửa xong PHẢI trình lại — kế hoạch chỉ "đã duyệt"
 * trở lại khi cấp trên ghi nhận phê duyệt bản mới (luật D4 / A4.6).
 */
export function StartAdjustmentDialog({ open, onOpenChange, plan }: StartAdjustmentDialogProps) {
  const startM = useStartPlanAdjustment(plan);

  return (
    <Dialog open={open} onOpenChange={(v) => !startM.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Mở điều chỉnh kế hoạch</DialogTitle>
          <DialogDescription>
            Danh mục tài sản mở lại để sửa. Bản mốc v{plan.baseline_version} vẫn được giữ nguyên để so kế hoạch với thực
            tế.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-1.5 rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <li>Thêm / bỏ tài sản, dời sang quý khác, đổi giá trị khởi điểm quá 10% đều cần cấp trên duyệt lại.</li>
          <li>Trong lúc điều chỉnh, kế hoạch không còn ở trạng thái “Đã duyệt”.</li>
          <li>Sửa xong hãy bấm “Trình kế hoạch” — màn trình sẽ liệt kê đúng những gì đã thay đổi.</li>
        </ul>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" disabled={startM.isPending} onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button
            className="gap-1.5"
            disabled={startM.isPending}
            onClick={() => startM.mutate(undefined, { onSuccess: () => onOpenChange(false) })}
          >
            {startM.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PencilRuler className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            )}
            Mở điều chỉnh
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
