import { useEffect, useState } from "react";
import { Gift, ArrowRight, X, Coins, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingTasks } from "@/hooks/useOnboardingTasks";
import { RewardTasksDialog } from "@/components/onboarding/RewardTasksDialog";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "onboarding.banner.dismissed";

export const HomepageRewardBanner = () => {
  const { isAuthed, availableCredits, tasks } = useOnboardingTasks();
  const hasIncompleteTasks = tasks.some((t) => t.status !== "claimed");
  const [dismissed, setDismissed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    }
  }, []);

  if (!isAuthed || !hasIncompleteTasks || dismissed) return null;

  const totalTokens = tasks
    .filter((t) => t.status === "ready")
    .reduce((sum, t) => sum + t.tokens, 0);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <>
      <section className="container px-4 pt-4">
        <button
          onClick={() => setDialogOpen(true)}
          className={cn(
            "group relative w-full overflow-hidden rounded-2xl border border-primary/30",
            "bg-gradient-to-r from-primary/15 via-primary/8 to-primary/15",
            "px-5 py-4 md:px-6 md:py-5 text-left transition-all hover:border-primary/50 hover:shadow-md"
          )}
        >
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <div className="shrink-0 h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
              <Gift className="h-6 w-6 md:h-7 md:w-7 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm md:text-base font-semibold text-foreground">
                Hoàn thành hồ sơ — Nhận{" "}
                <span className="text-primary">{availableCredits} credit miễn phí</span>
                {totalTokens > 0 && (
                  <>
                    {" "}+ <span className="text-primary">{totalTokens} vé mở khóa</span>
                  </>
                )}
              </p>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5 hidden sm:block">
                Cập nhật thông tin & khai báo nhu cầu để nhận thưởng — chỉ mất 2 phút
              </p>
            </div>
            <div className="hidden md:flex shrink-0">
              <Button asChild size="sm" className="pointer-events-none">
                <span>
                  Khám phá ngay
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Button>
            </div>
            <ArrowRight className="md:hidden h-5 w-5 text-primary shrink-0" />
            <button
              onClick={handleDismiss}
              className="absolute right-1 top-1 md:relative md:right-auto md:top-auto h-7 w-7 rounded-full hover:bg-foreground/5 inline-flex items-center justify-center text-muted-foreground"
              aria-label="Đóng"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </button>
      </section>

      <RewardTasksDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
};
