import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Thẻ của trang Hồ sơ online — nền trắng, bo 2xl, bóng nhẹ (design "Ho So Online Tai San v2"). */
export function ShareCard({
  title,
  icon: Icon,
  aux,
  children,
  className,
}: {
  title?: string;
  icon?: LucideIcon;
  aux?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl bg-card p-[18px] shadow-card sm:p-[22px]", className)}>
      {title && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex min-w-0 items-center gap-2.5 text-[17px] font-semibold text-foreground">
            {Icon && <Icon className="h-[18px] w-[18px] shrink-0 text-primary" strokeWidth={1.6} aria-hidden="true" />}
            <span className="truncate">{title}</span>
          </h2>
          {aux && <span className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">{aux}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Ô chữ viết tắt thay logo khi đơn vị / người chưa có ảnh. */
export function InitialsMark({ text, className }: { text: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("grid shrink-0 place-items-center font-bold", className)}>
      {text}
    </span>
  );
}
