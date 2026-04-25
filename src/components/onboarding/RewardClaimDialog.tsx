import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coins, Loader2, PartyPopper, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const [state, setState] = useState<"claiming" | "success" | "error">("claiming");
  const [grantedCredits, setGrantedCredits] = useState<number>(
    taskKey === "basic" ? REWARD_BASIC_CREDITS : REWARD_INTENT_CREDITS
  );
  const claimedRef = useRef(false);

  const taskName = taskKey === "basic" ? "hồ sơ cá nhân" : "nhu cầu đấu giá";

  // Auto-claim the reward as soon as the dialog opens
  useEffect(() => {
    if (!open) {
      claimedRef.current = false;
      setState("claiming");
      return;
    }
    if (claimedRef.current) return;
    claimedRef.current = true;

    (async () => {
      const r = await claimReward(taskKey);
      if (r.ok) {
        setGrantedCredits(r.credits);
        setState("success");
        toast.success(`Đã cộng +${r.credits} credit vào tài khoản 🎉`);
      } else {
        setState("error");
        toast.error("Không thể cộng thưởng, vui lòng thử lại");
      }
    })();
  }, [open, claimReward, taskKey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center mb-2 relative">
            <PartyPopper className="h-8 w-8 text-primary" />
            {state === "success" && (
              <>
                <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-primary animate-pulse" />
                <Sparkles className="absolute -bottom-1 -left-1 h-3 w-3 text-primary animate-pulse" />
              </>
            )}
          </div>
          <DialogTitle className="text-center text-xl">
            {state === "claiming"
              ? `Đang xử lý phần thưởng…`
              : state === "success"
                ? `Chúc mừng! Bạn vừa hoàn thành ${taskName}`
                : `Có lỗi xảy ra`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <Coins className="h-4 w-4 text-primary" />
                {state === "success" ? "Đã cộng vào tài khoản" : "Phần thưởng"}
              </span>
              <span className="font-bold text-primary">+{grantedCredits} credit</span>
            </div>
          </div>

          <Button
            onClick={() => onOpenChange(false)}
            disabled={state === "claiming"}
            size="lg"
            className="w-full"
          >
            {state === "claiming" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang cộng credit…
              </>
            ) : state === "success" ? (
              "Tuyệt vời!"
            ) : (
              "Đóng"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
