import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

interface LockedBlurProps {
  children: ReactNode;
  teaser?: string;
  ctaLabel: string;
  onUnlockClick: () => void;
  futureNote?: string;
  minHeight?: string;
}

export const LockedBlur = ({
  children,
  teaser = "Mở khóa để xem đầy đủ dữ liệu",
  ctaLabel,
  onUnlockClick,
  futureNote,
  minHeight,
}: LockedBlurProps) => {
  return (
    <div className="relative" style={minHeight ? { minHeight } : undefined}>
      <div
        className="select-none pointer-events-none blur-[6px] opacity-70"
        aria-hidden="true"
      >
        {children}
      </div>
      <button
        type="button"
        onClick={onUnlockClick}
        className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[2px] rounded-lg cursor-pointer group"
        aria-label={ctaLabel}
      >
        <div className="flex flex-col items-center gap-3 px-6 py-5 max-w-sm text-center bg-card/95 border border-border rounded-xl shadow-lg group-hover:shadow-xl transition-shadow">
          <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">{teaser}</p>
          {futureNote && (
            <p className="text-xs text-muted-foreground leading-relaxed">{futureNote}</p>
          )}
          <Button size="sm" className="mt-1">
            {ctaLabel}
          </Button>
        </div>
      </button>
    </div>
  );
};
