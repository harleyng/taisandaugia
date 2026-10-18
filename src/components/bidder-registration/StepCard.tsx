import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Thẻ một bước của trang mua hồ sơ (design `.card.p6.stack`): tiêu đề + mô tả + nội dung. */
export function StepCard({
  title,
  sub,
  aside,
  children,
  className,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-2xl bg-card p-6", className)}>
      {title && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
            {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
          </div>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
