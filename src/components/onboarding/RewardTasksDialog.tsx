import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gift, ArrowRight, Coins, CheckCircle2, Sparkles, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useOnboardingTasks } from "@/hooks/useOnboardingTasks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export const RewardTasksDialog = ({ open, onOpenChange }: Props) => {
  const navigate = useNavigate();
  const { tasks, claimReward, availableCredits } = useOnboardingTasks();
  const [claiming, setClaiming] = useState<"basic" | "intent" | null>(null);

  const handleGo = (anchor: string) => {
    onOpenChange(false);
    navigate(anchor);
  };

  const handleClaim = async (key: "basic" | "intent") => {
    setClaiming(key);
    const r = await claimReward(key);
    setClaiming(null);
    if (r.ok) {
      toast.success(`Đã nhận +${r.credits} credit miễn phí 🎉`);
    } else {
      toast.error("Không thể nhận thưởng, vui lòng thử lại");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto h-14 w-14 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center mb-2">
            <Gift className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center">Nhiệm vụ nhận thưởng</DialogTitle>
          <DialogDescription className="text-center">
            {availableCredits > 0
              ? `Bạn đang có ${availableCredits} credit chờ nhận`
              : "Hoàn thành để nhận credit miễn phí"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {tasks.map((task) => {
            const isClaimed = task.status === "claimed";
            const isReady = task.status === "ready";

            return (
              <div
                key={task.key}
                className={cn(
                  "rounded-xl border p-4 transition-colors",
                  isClaimed
                    ? "border-border bg-muted/30 opacity-70"
                    : isReady
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-card"
                )}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    {isClaimed ? (
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    ) : isReady ? (
                      <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      <Coins className="h-3 w-3" />+{task.credits}
                    </span>
                  </div>
                </div>

                {isClaimed ? (
                  <p className="text-xs text-muted-foreground italic mt-2">Đã nhận thưởng</p>
                ) : isReady ? (
                  <Button
                    onClick={() => handleClaim(task.key)}
                    disabled={claiming === task.key}
                    className="w-full mt-2"
                    size="sm"
                  >
                    {claiming === task.key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Gift className="h-4 w-4" /> Nhận thưởng
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleGo(task.anchor)}
                    variant="outline"
                    className="w-full mt-2"
                    size="sm"
                  >
                    Đi đến {task.key === "basic" ? "hồ sơ" : "khai báo nhu cầu"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
