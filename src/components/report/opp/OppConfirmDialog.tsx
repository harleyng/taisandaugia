import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Coins } from "lucide-react";

interface OppConfirmDialogProps {
  open: boolean;
  matchCount: number;
  balance: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const OppConfirmDialog = ({
  open, matchCount, balance, onConfirm, onCancel,
}: OppConfirmDialogProps) => {
  const balanceAfter = Math.max(0, balance - 1);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden gap-0">
        {/* Dark header */}
        <div className="bg-gradient-to-br from-[#1f3a2a] to-[#15291d] text-white px-6 py-6 text-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 flex items-center justify-center text-xl mx-auto mb-3 shadow-lg">
            <Coins className="h-5 w-5 text-yellow-950" />
          </div>
          <DialogHeader>
            <h3 className="text-lg font-semibold text-white font-serif">Xác nhận tạo báo cáo</h3>
            <p className="text-xs text-green-300 mt-1">Phân tích riêng theo tiêu chí của bạn</p>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="divide-y divide-border">
            <div className="flex justify-between py-2.5 text-sm">
              <span className="text-muted-foreground">Phiên khớp tiêu chí</span>
              <span className="font-mono font-semibold">{matchCount} phiên</span>
            </div>
            <div className="flex justify-between py-2.5 text-sm">
              <span className="text-muted-foreground">Chi phí</span>
              <span className="font-mono font-semibold text-amber-600">1 credit</span>
            </div>
            <div className="flex justify-between py-2.5 text-sm">
              <span className="text-muted-foreground">Số dư sau khi tạo</span>
              <span className="font-mono font-semibold text-primary">{balanceAfter} credit</span>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 text-sm font-semibold rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted transition-colors"
            >
              Để sau
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Tạo báo cáo · ⊛1
            </button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center mt-3 leading-relaxed">
            Báo cáo lưu và xem lại miễn phí 24 giờ.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
