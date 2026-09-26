import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sắc thái icon — chỉ token có sẵn; màu mang nghĩa (docs/owner-control-tower-plan.md §A8.4). */
export type OwnerTone = "primary" | "success" | "warning" | "destructive" | "muted";

const TONE_CLASS: Record<OwnerTone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

// 16px cạnh chữ · 20px ở tiêu đề thẻ · 40px trong trạng thái trống (§A8.5).
const ICON_SIZE = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-10 w-10" } as const;

interface IconTileProps {
  icon: LucideIcon;
  tone?: OwnerTone;
  size?: keyof typeof ICON_SIZE;
  className?: string;
}

/** Ô vuông bo góc chứa một icon lucide nét mảnh — dùng chung cho mọi khối của Trạm Điều Hành. */
export function IconTile({ icon: Icon, tone = "primary", size = "md", className }: IconTileProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl p-2",
        TONE_CLASS[tone],
        className,
      )}
    >
      <Icon className={ICON_SIZE[size]} strokeWidth={1.5} />
    </span>
  );
}
