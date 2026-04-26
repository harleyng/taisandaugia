import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, Check, Coins, Loader2, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useDemandSubscription, DemandTierKey, DEMAND_TIERS } from "@/hooks/useDemandSubscription";
import { useCredits } from "@/hooks/useCredits";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** override default title (e.g. "Gia hạn theo dõi nhu cầu") */
  title?: string;
  /** show after successful subscribe */
  onSubscribed?: () => void;
}

export const DemandPaywallDialog = ({ open, onOpenChange, title, onSubscribed }: Props) => {
  const { balance } = useCredits();
  const { subscribeDemand, status } = useDemandSubscription();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<DemandTierKey>("monthly");
  const [submitting, setSubmitting] = useState(false);

  const tier = DEMAND_TIERS.find((t) => t.key === selected)!;
  const enough = balance >= tier.cost;

  const handleConfirm = async () => {
    if (!enough) {
      onOpenChange(false);
      navigate("/profile?tab=credits");
      return;
    }
    setSubmitting(true);
    const r = subscribeDemand(selected);
    setSubmitting(false);
    if (r.ok) {
      toast.success(
        status === "EXPIRED" ? "Đã gia hạn theo dõi nhu cầu" : "Đã bật theo dõi nhu cầu",
        { description: "Chúng tôi sẽ thông báo ngay khi có tài sản phù hợp xuất hiện." }
      );
      onOpenChange(false);
      onSubscribed?.();
    } else if (r.reason === "insufficient") {
      toast.error("Không đủ credit");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            {title ?? "Theo dõi nhu cầu — Không bỏ lỡ tài sản phù hợp"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Value props */}
          <ul className="space-y-2 px-1">
            {[
              "Tự động thông báo khi có tài sản mới đúng nhu cầu",
              "Không cần tìm lại mỗi ngày",
              "Hủy bất cứ lúc nào",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{t}</span>
              </li>
            ))}
          </ul>

          {/* Tier cards */}
          <div className="grid grid-cols-3 gap-2">
            {DEMAND_TIERS.map((t) => {
              const active = selected === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSelected(t.key)}
                  className={cn(
                    "relative rounded-xl border p-3 text-left transition-all",
                    active
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30 shadow-sm"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  {t.badge && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold whitespace-nowrap">
                      {t.badge}
                    </span>
                  )}
                  <p className="text-xs text-muted-foreground">{t.shortLabel}</p>
                  <p className="text-base font-bold text-foreground mt-1 flex items-center gap-1">
                    <Coins className="h-3.5 w-3.5 text-primary" />
                    {t.cost}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t.label}</p>
                  {t.savingText && (
                    <p className="text-[10px] text-primary font-medium mt-1 inline-flex items-center gap-0.5">
                      <Sparkles className="h-2.5 w-2.5" />
                      {t.savingText}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Balance */}
          <div className="flex items-center justify-between rounded-lg bg-secondary/40 px-4 py-3">
            <div>
              <p className="text-xs text-muted-foreground">Phí gói</p>
              <p className="text-base font-bold text-foreground flex items-center gap-1">
                <Coins className="h-4 w-4 text-primary" />
                {tier.cost} credit
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Số dư</p>
              <p
                className={cn(
                  "text-base font-bold",
                  enough ? "text-foreground" : "text-destructive"
                )}
              >
                {balance} credit
              </p>
            </div>
          </div>

          <Button onClick={handleConfirm} disabled={submitting} className="w-full" size="lg">
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : enough ? (
              <>
                <Zap className="h-4 w-4" />
                {status === "EXPIRED" ? "Gia hạn ngay" : "Đăng ký theo dõi"}
              </>
            ) : (
              "Mua thêm credit"
            )}
          </Button>

          <p className="text-[11px] text-center text-muted-foreground">
            Áp dụng cho nhu cầu đã khai báo trong hồ sơ. Hủy bất cứ lúc nào trong Cài đặt thông báo.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
