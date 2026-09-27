import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Nút nhỏ của hộp Cần xử lý (design `.btn.sm`: cao 30px, chữ 12.5px). */
export const INBOX_BTN = "h-[30px] rounded-lg px-[11px] text-[12.5px] font-semibold";

interface InboxItemProps {
  tag: string;
  tone: "warning" | "destructive";
  title: string;
  /** "Tổ chức ĐG · địa chỉ". */
  desc: string | null;
  /** Các mẩu "Đấu …", "Vòng …"; phần tử `late` in đỏ. */
  meta: { text: string; late?: boolean }[];
  actions: ReactNode;
  /** Hàng phụ trải hết bề ngang (ô so sánh số liệu). */
  children?: ReactNode;
}

/** Một việc trong hộp Cần xử lý: nhãn + tên, mô tả, dòng mốc; nút xử lý bên phải (xuống dưới trên mobile). */
export function InboxItem({ tag, tone, title, desc, meta, actions, children }: InboxItemProps) {
  return (
    <li className="grid grid-cols-1 items-center gap-x-5 gap-y-2 border-t py-3.5 first:border-t-0 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <p className="text-[14.5px] font-semibold text-foreground">
          <span
            className={cn(
              "mr-2 inline-block rounded-md px-[7px] align-[1px] text-[11.5px] font-bold",
              tone === "warning" ? "bg-warning/15 text-foreground" : "bg-destructive/10 text-destructive",
            )}
          >
            {tag}
          </span>
          {title}
        </p>
        {desc && <p className="mt-0.5 text-[13px] text-muted-foreground">{desc}</p>}
        {meta.length > 0 && (
          <p className="mt-1 flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] tabular-nums text-muted-foreground">
            {meta.map((m) => (
              <span key={m.text} className={cn(m.late && "font-semibold text-destructive")}>
                {m.text}
              </span>
            ))}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-start gap-1.5 md:justify-end">{actions}</div>
      {children && <div className="md:col-span-2">{children}</div>}
    </li>
  );
}
