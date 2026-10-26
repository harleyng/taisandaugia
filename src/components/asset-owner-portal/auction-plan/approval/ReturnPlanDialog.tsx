import { useEffect, useState } from "react";
import { Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PLAN_RETURN_MIN_COMMENT, useReturnPlan } from "@/hooks/useAuctionPlanApproval";
import type { AuctionPlan } from "@/lib/auctionPlan/types";

interface ReturnPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: AuctionPlan;
}

const Star = () => <span className="text-destructive">*</span>;

/**
 * "Trả lại" kế hoạch cho đơn vị lập — BẮT BUỘC nêu góp ý (server chặn dưới 10
 * ký tự, ở đây chặn trước để không mất một vòng gọi mạng).
 *
 * Góp ý hiện lại ở đầu trang chi tiết và trên thẻ "việc cần làm" của đơn vị, nên
 * nó phải đủ cụ thể để sửa được.
 */
export function ReturnPlanDialog({ open, onOpenChange, plan }: ReturnPlanDialogProps) {
  const [comment, setComment] = useState("");
  const returnM = useReturnPlan(plan);
  const trimmed = comment.trim();
  const tooShort = trimmed.length < PLAN_RETURN_MIN_COMMENT;

  useEffect(() => {
    if (open) setComment("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !returnM.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Trả lại kế hoạch cho đơn vị lập</DialogTitle>
          <DialogDescription>
            Đơn vị sẽ thấy góp ý của bạn, mở lại kế hoạch về bản nháp để sửa rồi trình lại.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="plan-return-comment" className="text-sm font-medium text-foreground">
            Góp ý / lý do trả lại <Star />
          </label>
          <Textarea
            id="plan-return-comment"
            rows={5}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ví dụ: Bổ sung diện tích và giá khởi điểm cho các lô LK2; dời 3 lô quý I sang quý II vì chưa xong hồ sơ pháp lý."
          />
          <p className="text-xs text-muted-foreground">
            Ít nhất {PLAN_RETURN_MIN_COMMENT} ký tự. Nêu rõ tài sản nào, cần sửa gì.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" disabled={returnM.isPending} onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button
            className="gap-1.5"
            disabled={tooShort || returnM.isPending}
            onClick={() => returnM.mutate(trimmed, { onSuccess: () => onOpenChange(false) })}
          >
            {returnM.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Undo2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            )}
            Trả lại kế hoạch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
