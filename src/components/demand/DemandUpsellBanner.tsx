import { useEffect, useState } from "react";
import { Bell, ArrowRight, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DemandPaywallDialog } from "./DemandPaywallDialog";

const DISMISS_KEY = "demand.upsell.dismissed";

interface Props {
  matchCount: number;
}

export const DemandUpsellBanner = ({ matchCount }: Props) => {
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    }
  }, []);

  if (dismissed) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <>
      <div
        className={cn(
          "relative rounded-2xl border border-primary/30",
          "bg-gradient-to-r from-primary/15 via-primary/8 to-primary/15",
          "px-4 py-4 md:px-5 md:py-4 mb-4 overflow-hidden"
        )}
      >
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="relative flex items-start gap-3 md:items-center">
          <div className="shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/30">
            <Bell className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm md:text-base font-semibold text-foreground leading-snug">
              Bạn có thể bỏ lỡ tài sản phù hợp mà không hề biết
            </p>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
              Hệ thống sẽ tự động thông báo khi có tài sản đúng nhu cầu của bạn
            </p>
            {matchCount > 0 && (
              <p className="text-xs text-primary font-medium mt-1.5 inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Có {matchCount} tài sản phù hợp với nhu cầu hiện tại
              </p>
            )}
          </div>
          <div className="hidden md:flex shrink-0">
            <Button size="sm" onClick={() => setOpen(true)}>
              Theo dõi nhu cầu này
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <button
            onClick={handleDismiss}
            className="absolute right-1 top-1 md:relative md:right-auto md:top-auto h-7 w-7 rounded-full hover:bg-foreground/5 inline-flex items-center justify-center text-muted-foreground"
            aria-label="Đóng"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="md:hidden mt-3">
          <Button size="sm" className="w-full" onClick={() => setOpen(true)}>
            Theo dõi nhu cầu này
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <DemandPaywallDialog open={open} onOpenChange={setOpen} />
    </>
  );
};
