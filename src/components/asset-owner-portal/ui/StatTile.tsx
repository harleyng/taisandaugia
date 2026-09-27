import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconTile, type OwnerTone } from "./IconTile";

interface StatTileProps {
  label: string;
  value: string;
  /** Đơn vị in nhỏ, mờ cạnh số ("tỷ", "%"). */
  unit?: string;
  /** Đúng một dòng bối cảnh dưới con số. */
  context?: ReactNode;
  icon?: LucideIcon;
  tone?: OwnerTone;
  /** Góc phải trên — dành cho nhãn nguồn số liệu (SourceBadge). */
  badge?: ReactNode;
  className?: string;
}

/** Ô chỉ số tầng L3: nhãn mờ, số lớn — xếp lưới 4 cột desktop, 2×2 mobile. */
export function StatTile({ label, value, unit, context, icon, tone = "primary", badge, className }: StatTileProps) {
  return (
    <div className={cn("min-w-0 rounded-2xl bg-card p-4 shadow-card sm:p-5 print:border print:shadow-none", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">{label}</p>
        {(badge || icon) && (
          <div className="flex shrink-0 items-center gap-1.5">
            {badge}
            {icon && <IconTile icon={icon} tone={tone} size="sm" className="p-1.5" />}
          </div>
        )}
      </div>
      <p className="mt-2 flex min-w-0 items-baseline gap-1">
        <span className="truncate text-2xl font-semibold tabular-nums text-foreground">{value}</span>
        {unit && <span className="shrink-0 text-sm text-muted-foreground">{unit}</span>}
      </p>
      {context && <p className="mt-1 truncate text-xs text-muted-foreground">{context}</p>}
    </div>
  );
}
