import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Chữ phụ góc phải tiêu đề thẻ ("Chủ tài sản tự khai", "14 ảnh · 1 video"). */
export function CardAux({ children }: { children: ReactNode }) {
  return <span className="text-[12.5px] text-muted-foreground">{children}</span>;
}

/** Nhãn nhóm nhỏ viết hoa trong thẻ. */
export function SubLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground", className)}>
      {children}
    </p>
  );
}

/** Danh sách "nhãn — giá trị" ngăn bằng đường kẻ mảnh (cột phải của trang chi tiết). */
export function KvList({ rows }: { rows: { k: string; v: ReactNode }[] }) {
  return (
    <dl className="flex flex-col">
      {rows.map((r) => (
        <div key={r.k} className="flex justify-between gap-3 border-t border-border py-[9px] text-[13.5px]">
          <dt className="text-muted-foreground">{r.k}</dt>
          <dd className="text-right font-semibold text-foreground">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Thẻ trống ở giữa — tab chưa có yêu cầu nào (tư vấn pháp lý / đấu giá). */
export function EmptyServiceCard({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-card px-5 py-9 text-center shadow-card">
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      <p className="mx-auto mb-4 mt-1.5 max-w-[46ch] text-[13.5px] text-foreground/70">{description}</p>
      {action}
    </div>
  );
}
