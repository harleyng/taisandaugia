import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { orgInitials } from "@/lib/consignment/ownerConsignmentView";

interface KgCardProps {
  title: ReactNode;
  /** Chữ phụ / nút nhỏ góc phải tiêu đề. */
  aux?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
  bodyClassName?: string;
}

/** Thẻ của trang chi tiết ký gửi: tiêu đề + chữ phụ góc phải, thân đệm 20px. */
export function KgCard({ title, aux, children, id, className, bodyClassName }: KgCardProps) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className={cn("scroll-mt-6 rounded-2xl bg-card shadow-card", className)}>
      <header className="flex items-center gap-2.5 px-5 pt-[15px]">
        <h2 id={headingId} className="flex-1 text-[15.5px] font-bold tracking-[-0.01em] text-foreground">
          {title}
        </h2>
        {typeof aux === "string" ? <span className="text-[12.5px] text-muted-foreground">{aux}</span> : aux}
      </header>
      <div className={cn("px-5 pb-5 pt-3.5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Nhãn nhóm nhỏ viết hoa trong thẻ. */
export function KgSubLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground", className)}>
      {children}
    </p>
  );
}

interface KgOrgProps {
  name: string;
  logoUrl?: string | null;
  /** Dòng phụ: tỉnh · thành tích, hoặc câu riêng của nơi dùng. */
  sub?: string | null;
}

/** Logo (hoặc chữ viết tắt) + tên + một dòng phụ của tổ chức đấu giá. */
export function KgOrg({ name, logoUrl, sub }: KgOrgProps) {
  return (
    <div className="flex min-w-0 items-center gap-[11px]">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-[9px] border border-primary/15 object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-primary/15 bg-primary/5 text-xs font-bold text-primary"
        >
          {orgInitials(name)}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold leading-[1.3] text-foreground">{name}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
