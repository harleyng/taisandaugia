import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconTile, type OwnerTone } from "./IconTile";

interface ActionCardProps {
  icon: LucideIcon;
  /** Mức khẩn — tô ô icon, không tô cả thẻ. */
  tone?: OwnerTone;
  title: ReactNode;
  meta?: ReactNode;
  /** 1–3 nút gọn (size="sm"); thẻ có nút thì bản thân thẻ không bấm được. */
  actions: ReactNode;
  className?: string;
}

/** Việc cần làm tầng L2: hành động nằm ngay cạnh thông tin (§A8.1). */
export function ActionCard({ icon, tone = "primary", title, meta, actions, className }: ActionCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-background p-3 sm:flex-row sm:items-center",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <IconTile icon={icon} tone={tone} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          {meta && <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}
