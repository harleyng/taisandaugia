import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ContractSide } from "@/types/consignment-contract";

const MIN_REASON = 10;

const CONSEQUENCES: Record<ContractSide, string[]> = {
  owner: [
    "Tổ chức này không đưa được tài sản vào phiên đấu giá.",
    "Các báo giá bạn đã nhận trước đó mở lại để chọn tổ chức khác.",
    "Không gửi lại yêu cầu cho chính tổ chức này được.",
  ],
  org: [
    "Chủ tài sản sẽ chọn tổ chức khác cho hồ sơ này.",
    "Bạn không còn xem được thông tin và giấy tờ của chủ tài sản.",
  ],
};

interface CancelContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  side: ContractSide;
  onConfirm: (reason: string) => void;
}

/** Huỷ hợp đồng chưa ký — bắt buộc lý do, lý do hiện cho bên còn lại. */
export function CancelContractDialog({ open, onOpenChange, isPending, side, onConfirm }: CancelContractDialogProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const valid = reason.trim().length >= MIN_REASON;

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Huỷ hợp đồng dịch vụ?</DialogTitle>
          <DialogDescription>Thao tác không hoàn tác được. Lý do sẽ hiển thị cho bên còn lại.</DialogDescription>
        </DialogHeader>

        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          {CONSEQUENCES[side].map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>

        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">Lý do huỷ</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: Hai bên không thống nhất được mức phí dịch vụ…"
            className="min-h-[90px]"
          />
          {!valid && reason.length > 0 && (
            <p className="text-xs text-muted-foreground">Ít nhất {MIN_REASON} ký tự.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Giữ hợp đồng
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(reason.trim())} disabled={!valid || isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Huỷ hợp đồng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
