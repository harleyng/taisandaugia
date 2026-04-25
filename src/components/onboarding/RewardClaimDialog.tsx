import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coins, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useOnboardingTasks } from "@/hooks/useOnboardingTasks";
import { toast } from "sonner";
import { REWARD_BASIC_CREDITS, REWARD_INTENT_CREDITS } from "@/lib/onboardingTasks";
import confetti from "canvas-confetti";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  taskKey: "basic" | "intent";
}

const fireSideConfetti = () => {
  const defaults = {
    spread: 60,
    ticks: 120,
    gravity: 0.9,
    decay: 0.93,
    startVelocity: 55,
    scalar: 1,
    zIndex: 9999,
    colors: ["#FFD166", "#06D6A0", "#118AB2", "#EF476F", "#F78C6B", "#8338EC"],
  };

  // Left cannon
  confetti({
    ...defaults,
    particleCount: 80,
    angle: 60,
    origin: { x: 0, y: 0.7 },
  });
  // Right cannon
  confetti({
    ...defaults,
    particleCount: 80,
    angle: 120,
    origin: { x: 1, y: 0.7 },
  });

  // Second wave for richness
  setTimeout(() => {
    confetti({ ...defaults, particleCount: 50, angle: 60, origin: { x: 0, y: 0.75 } });
    confetti({ ...defaults, particleCount: 50, angle: 120, origin: { x: 1, y: 0.75 } });
  }, 250);
};

export const RewardClaimDialog = ({ open, onOpenChange, taskKey }: Props) => {
  const { claimReward, tasks } = useOnboardingTasks();
  const [state, setState] = useState<"claiming" | "success" | "error">("claiming");
  const [grantedCredits, setGrantedCredits] = useState<number>(
    taskKey === "basic" ? REWARD_BASIC_CREDITS : REWARD_INTENT_CREDITS
  );
  const claimedRef = useRef(false);

  const taskName = taskKey === "basic" ? "hồ sơ cá nhân" : "nhu cầu đấu giá";

  useEffect(() => {
    if (!open) {
      claimedRef.current = false;
      setState("claiming");
      return;
    }
    if (claimedRef.current) return;
    claimedRef.current = true;

    (async () => {
      const expected = taskKey === "basic" ? REWARD_BASIC_CREDITS : REWARD_INTENT_CREDITS;
      const task = tasks.find((t) => t.key === taskKey);

      // Đã claim trước đó → vẫn hiện popup chúc mừng (không cộng lại)
      if (task?.status === "claimed") {
        setGrantedCredits(expected);
        setState("success");
        fireSideConfetti();
        return;
      }

      const r = await claimReward(taskKey);
      if (r.ok) {
        setGrantedCredits(r.credits);
        setState("success");
        toast.success(`Đã cộng +${r.credits} credit vào tài khoản 🎉`);
        fireSideConfetti();
      } else {
        // Fallback: vẫn hiển thị như success nếu task đã hoàn tất nhưng claim không khả dụng
        setGrantedCredits(expected);
        setState("success");
        fireSideConfetti();
      }
    })();
  }, [open, claimReward, taskKey, tasks]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm overflow-hidden p-0 border-0">
        {/* Hero gradient */}
        <div className="relative bg-gradient-to-br from-primary via-primary to-primary/80 px-6 pt-8 pb-6 text-center text-primary-foreground">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm ring-4 ring-white/20">
            <span className="text-4xl" aria-hidden>🎉</span>
          </div>
          <h2 className="text-xl font-bold leading-tight">
            {state === "claiming" ? "Đang xử lý phần thưởng…" : "Chúc mừng!"}
          </h2>
          {state !== "claiming" && (
            <p className="mt-1 text-sm text-primary-foreground/85">
              Bạn vừa hoàn thành {taskName}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="space-y-4 p-6">
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15">
                  <Coins className="h-4 w-4 text-primary" />
                </span>
                Phần thưởng
              </span>
              <span className="text-lg font-bold text-primary">
                +{grantedCredits} credit
              </span>
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang cộng credit…
              </>
            ) : (
              "Tuyệt vời!"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
