import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gift, Coins, Loader2, PartyPopper } from "lucide-react";
import { useState } from "react";
import { useOnboardingTasks } from "@/hooks/useOnboardingTasks";
import { toast } from "sonner";
import { REWARD_BASIC_CREDITS, REWARD_INTENT_CREDITS } from "@/lib/onboardingTasks";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  taskKey: "basic" | "intent";
}

export const RewardClaimDialog = ({ open, onOpenChange, taskKey }: Props) => {
  const { claimReward } = useOnboardingTasks();
  const [claiming, setClaiming] = useState(false);

  const credits = taskKey === "basic" ? REWARD_BASIC_CREDITS : REWARD_INTENT_CREDITS;
  const taskName = taskKey === "basic" ? "hồ sơ cá nhân" : "nhu cầu đấu giá";

  const handleClaim = async () => {
    setClaiming(true);
    const r = await claimReward(taskKey);
    setClaiming(false);
    if (r.ok) {
      toast.success(`Đã nhận +${r.credits} credit 🎉`);
      onOpenChange(false);
    } else {
      toast.error("Không thể nhận thưởng");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center mb-2">
            <PartyPopper className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">Bạn vừa hoàn thành {taskName}!</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <Coins className="h-4 w-4 text-primary" /> Credit
              </span>
              <span className="font-bold text-primary">+{credits}</span>
            </div>
          </div>

          <Button onClick={handleClaim} disabled={claiming} size="lg" className="w-full">
            {claiming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Gift className="h-4 w-4" /> Nhận thưởng ngay
              </>
            )}
          </Button>
          <Button onClick={() => onOpenChange(false)} variant="ghost" size="sm" className="w-full">
            Để sau
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
