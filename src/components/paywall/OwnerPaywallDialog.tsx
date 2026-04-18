import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, Coins, Check } from "lucide-react";
import { useCredits, OWNER_TIERS, OwnerTierKey } from "@/hooks/useCredits";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface OwnerPaywallDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ownerId: string | null;
  ownerLabel?: string;
  returnPath?: string;
}

export const OwnerPaywallDialog = ({ open, onOpenChange, ownerId, ownerLabel, returnPath }: OwnerPaywallDialogProps) => {
  const { balance, unlockOwner } = useCredits();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selected, setSelected] = useState<OwnerTierKey>("30d");

  const tier = OWNER_TIERS.find((t) => t.key === selected)!;
  const enough = balance >= tier.cost;

  const handleUnlock = () => {
    if (!ownerId) return;
    const r = unlockOwner(ownerId, selected, ownerLabel);
    if (r.ok) {
      toast({ title: "Đã mở khóa hồ sơ chủ tài sản", description: `Truy cập ${tier.label}. Đã trừ ${tier.cost} credit.` });
      onOpenChange(false);
    } else {
      toast({ title: "Không đủ credit", variant: "destructive" });
    }
  };

  const handleBuy = () => {
    onOpenChange(false);
    const params = new URLSearchParams();
    if (returnPath) params.set("return", returnPath);
    if (ownerId) params.set("unlock", `owner:${ownerId}:${selected}`);
    params.set("tab", "credits");
    navigate(`/profile?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">🔒 Hồ sơ chủ tài sản</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground text-center -mt-2">
          Theo dõi danh sách tài sản và lịch sử đấu giá của chủ tài sản này.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {OWNER_TIERS.map((t) => {
            const isSelected = t.key === selected;
            const isPopular = t.key === "30d";
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setSelected(t.key)}
                className={cn(
                  "relative text-left p-4 rounded-xl border-2 transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border hover:border-primary/40 bg-card"
                )}
              >
                {isPopular && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    Phổ biến
                  </span>
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-bold text-foreground">{t.label}</span>
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground leading-snug mb-3 min-h-[2.5rem]">{t.valueText}</p>
                <div className="flex items-center gap-1 text-foreground">
                  <Coins className="h-4 w-4 text-primary" />
                  <span className="text-lg font-bold">{t.cost}</span>
                  <span className="text-xs text-muted-foreground">credit</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between rounded-lg bg-secondary/40 px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Số dư hiện tại</p>
            <p className={`text-lg font-bold ${enough ? "text-foreground" : "text-destructive"}`}>{balance} credit</p>
          </div>
          {enough ? (
            <Button onClick={handleUnlock} size="lg">Dùng credit để mở</Button>
          ) : (
            <Button onClick={handleBuy} size="lg">Mua credit</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
