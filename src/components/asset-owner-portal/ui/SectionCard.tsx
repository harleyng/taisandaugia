import { useId, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconTile, type OwnerTone } from "./IconTile";

interface SectionCardProps {
  title: string;
  icon?: LucideIcon;
  /** Sắc thái của ô icon — màu chỉ nằm ở icon, không phủ cả thẻ. */
  tone?: OwnerTone;
  /** Số mục, hiện dạng viên nhỏ cạnh tiêu đề khi > 0. */
  count?: number;
  /** Có ⇒ hiện nút "Xem tất cả" góc phải. */
  viewAllHref?: string;
  /** Nút phụ thêm ở góc phải, trước "Xem tất cả". */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Thẻ nội dung duy nhất của Trạm Điều Hành: viền mảnh, không đổ bóng, tiêu đề có ô icon. */
export function SectionCard({
  title,
  icon,
  tone = "primary",
  count,
  viewAllHref,
  actions,
  children,
  className,
}: SectionCardProps) {
  const navigate = useNavigate();
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={cn("space-y-4 rounded-2xl border bg-card p-4 sm:p-5", className)}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && <IconTile icon={icon} tone={tone} />}
          <h2 id={headingId} className="truncate text-base font-semibold text-foreground">
            {title}
          </h2>
          {!!count && count > 0 && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {count}
            </span>
          )}
        </div>
        {(actions || viewAllHref) && (
          <div className="flex shrink-0 items-center gap-1">
            {actions}
            {viewAllHref && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 text-xs text-muted-foreground"
                onClick={() => navigate(viewAllHref)}
              >
                Xem tất cả
                <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
              </Button>
            )}
          </div>
        )}
      </header>
      {children}
    </section>
  );
}
