import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconTile, type OwnerTone } from "./IconTile";

interface EmptyStateProps {
  icon: LucideIcon;
  /** Ngắn, giọng tích cực ("Không có việc tồn — tốt lắm."). */
  title: string;
  description?: ReactNode;
  /** Tối đa một hành động tiếp theo. */
  action?: ReactNode;
  /** Một dòng gọn trong thẻ — giữ chỗ cho vùng trống thay vì để khoảng trắng. */
  compact?: boolean;
  tone?: OwnerTone;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  tone = "primary",
  className,
}: EmptyStateProps) {
  if (compact) {
    return (
      <div className={cn("flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-3", className)}>
        <IconTile icon={icon} tone={tone} size="sm" className="p-1.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center px-4 py-10 text-center", className)}>
      <IconTile icon={icon} tone={tone} size="lg" />
      <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
