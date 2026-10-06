import { cn } from "@/lib/utils";
import type { PlanTier } from "@/lib/ownerSubscription/types";

/** Màu kiểu thẻ — cùng bảng token --tier-* của thẻ gói phía chủ tài sản. */
const SWATCH: Record<PlanTier, string> = {
  basic: "bg-[hsl(var(--tier-basic-art))] ring-1 ring-inset ring-[hsl(var(--tier-basic-edge))]",
  standard: "bg-primary",
  premium: "bg-[hsl(var(--tier-gold-deep))]",
};

export function TierSwatch({ tier, className }: { tier: PlanTier; className?: string }) {
  return <span aria-hidden className={cn("inline-block w-1.5 shrink-0 rounded-sm", SWATCH[tier], className ?? "h-3")} />;
}

export function SellBadge({ active, className }: { active: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {active ? "Đang bán" : "Ngừng bán"}
    </span>
  );
}

export function DefaultTag() {
  return <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">Mặc định</span>;
}
