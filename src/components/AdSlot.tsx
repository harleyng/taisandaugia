/**
 * AdSlot — placeholder component for advertisement positions.
 * Replace the inner content with real ad code (Google AdSense, etc.) when ready.
 *
 * Variants:
 *  "rectangle"      300×250  — sidebar standard (IAB Medium Rectangle)
 *  "mobile-banner"  320×50   — mobile in-feed strip (IAB Mobile Leaderboard)
 *  "native"         auto     — matches article card height, used in-feed grid
 */

import { Megaphone } from "lucide-react";

type AdSlotVariant = "rectangle" | "mobile-banner" | "native";

interface AdSlotProps {
  variant?: AdSlotVariant;
  className?: string;
  label?: string;
}

export function AdSlot({ variant = "rectangle", className = "", label = "Quảng cáo" }: AdSlotProps) {
  const sizeClass: Record<AdSlotVariant, string> = {
    rectangle: "w-full max-w-[300px] h-[250px]",
    "mobile-banner": "w-full h-[50px]",
    native: "w-full h-full min-h-[220px]",
  };

  return (
    <div
      className={[
        "relative flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 overflow-hidden",
        sizeClass[variant],
        className,
      ].join(" ")}
    >
      {/* Subtle watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span className="text-[80px] font-black text-muted/20 rotate-[-12deg] leading-none">AD</span>
      </div>

      <div className="relative flex flex-col items-center gap-1.5 text-center px-3">
        <div className="flex items-center gap-1.5 bg-muted/60 backdrop-blur-sm rounded-full px-2.5 py-1">
          <Megaphone className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
        </div>

        {variant === "rectangle" && (
          <p className="text-[11px] text-muted-foreground/70">300 × 250</p>
        )}
        {variant === "mobile-banner" && (
          <p className="text-[11px] text-muted-foreground/70">320 × 50</p>
        )}
      </div>
    </div>
  );
}

/** Full-width native ad card that blends into the article grid. */
export function NativeAdCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={[
        "relative group flex flex-col rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/20 overflow-hidden",
        className,
      ].join(" ")}
    >
      {/* Image placeholder */}
      <div className="aspect-video bg-muted/40 flex items-center justify-center">
        <span className="text-[32px] font-black text-muted/30 select-none">AD</span>
      </div>
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground border border-muted-foreground/30 rounded-full px-2 py-0.5">
            <Megaphone className="h-2.5 w-2.5" />
            Được tài trợ
          </span>
        </div>
        <div className="h-4 bg-muted/50 rounded animate-pulse w-4/5" />
        <div className="h-3 bg-muted/40 rounded animate-pulse w-3/5" />
      </div>
    </div>
  );
}
