import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, Coins, Sparkles } from "lucide-react";
import { useCredits, ASSET_COST } from "@/hooks/useCredits";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface AssetPaywallDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  listingId: string | null;
  returnPath?: string;
}

export const AssetPaywallDialog = ({ open, onOpenChange, listingId, returnPath }: AssetPaywallDialogProps) => {
  const { balance, unlockAsset } = useCredits();
  const navigate = useNavigate();
  const { toast } = useToast();
  const enough = balance >= ASSET_COST;

  const handleUnlock = () => {
    if (!listingId) return;
    const r = unlockAsset(listingId);
    if (r.ok) {
      toast({ title: "Đã mở khóa tài sản", description: `Đã trừ ${ASSET_COST} credit.` });
      onOpenChange(false);
    } else {
      toast({ title: "Không đủ credit", variant: "destructive" });
    }
  };

  const handleBuy = () => {
    onOpenChange(false);
    const params = new URLSearchParams();
    if (returnPath) params.set("return", returnPath);
    if (listingId) params.set("unlock", `asset:${listingId}`);
    params.set("tab", "credits");
    navigate(`/profile?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Mở khóa thông tin tài sản</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Xem đầy đủ lịch trình đấu giá, tài liệu đính kèm và thông tin liên hệ đơn vị tổ chức.
          </p>

          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <span>Dữ liệu sẽ được cập nhật và phân tích sâu hơn trong thời gian tới — mở khóa để truy cập các thông tin nâng cao khi được cập nhật.</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-secondary/40 px-4 py-3">
            <div>
              <p className="text-xs text-muted-foreground">Chi phí</p>
              <p className="text-lg font-bold text-foreground flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-primary" />
                {ASSET_COST} credit
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Số dư</p>
              <p className={`text-lg font-bold ${enough ? "text-foreground" : "text-destructive"}`}>{balance} credit</p>
            </div>
          </div>

          {enough ? (
            <Button onClick={handleUnlock} className="w-full" size="lg">
              Dùng credit để mở
            </Button>
          ) : (
            <Button onClick={handleBuy} className="w-full" size="lg">
              Mua credit
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
