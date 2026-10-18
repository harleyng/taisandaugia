import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Nút trong hộp thoại hồ sơ (design `.btn` 36px). */
export const DIALOG_BTN = "h-9 gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold";

/** Thẻ của trang chi tiết hồ sơ (design `.card` + `.ch` + `.hcb`). */
export function HsCard({
  title,
  aside,
  id,
  children,
}: {
  title: string;
  aside?: ReactNode;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="rounded-2xl bg-card shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-3 px-[22px] pb-1 pt-5">
        <h2 className="text-base font-semibold tracking-[-0.005em] text-foreground">{title}</h2>
        {aside && <span className="text-[13px] text-muted-foreground">{aside}</span>}
      </div>
      <div className="px-[22px] pb-5 pt-0.5">{children}</div>
    </section>
  );
}

/** Danh sách nhãn — giá trị (design `.hkv`). */
export function KvList({ rows, narrow }: { rows: (readonly [string, ReactNode] | null | false)[]; narrow?: boolean }) {
  return (
    <dl
      className={cn(
        "m-0 grid gap-x-4 gap-y-[9px] text-[13.5px] max-sm:grid-cols-1",
        narrow ? "grid-cols-[100px_minmax(0,1fr)]" : "grid-cols-[150px_minmax(0,1fr)]",
      )}
    >
      {rows
        .filter((r): r is readonly [string, ReactNode] => !!r)
        .map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="m-0 min-w-0 font-medium [overflow-wrap:anywhere] max-sm:mb-1.5">{v}</dd>
          </div>
        ))}
    </dl>
  );
}

/** Chữ cảnh báo vàng nhỏ sau một giá trị (design `em.w`). */
export function WarnTag({ children }: { children: ReactNode }) {
  return <em className="ml-1.5 text-[12.5px] font-semibold not-italic text-[hsl(var(--tier-warn-strong))]">{children}</em>;
}
