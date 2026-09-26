import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface OwnerPageHeaderProps {
  title: string;
  /** Một dòng — câu trả lời ngắn cho câu hỏi chính của trang. */
  subtitle?: ReactNode;
  /** Tối đa MỘT nút chính; còn lại là outline/ghost. */
  actions?: ReactNode;
  className?: string;
}

/** Tiêu đề trang (tầng L1) — mọi trang Trạm Điều Hành mở đầu bằng khối này. */
export function OwnerPageHeader({ title, subtitle, actions, className }: OwnerPageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
