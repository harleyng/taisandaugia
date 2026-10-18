import type { ReactNode } from "react";

/** Thẻ trắng có tiêu đề của trang chi tiết phiên (design `.card` + `.ch`). */
export function DetailCard({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-card shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-3 px-[22px] pb-1 pt-5">
        <h2 className="text-base font-semibold tracking-[-0.005em] text-foreground">{title}</h2>
        {aside && <span className="text-[13px] text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** Tiêu đề khu vực của một tab (design `.th`): tên + mô tả, thao tác bên phải. */
export function TabHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-[17px] font-semibold tracking-[-0.005em] text-foreground">{title}</h2>
        <p className="mt-0.5 max-w-[680px] text-[13px] text-muted-foreground [text-wrap:pretty]">{description}</p>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

/** Dải ghi chú vàng / xám (design `.note`). */
export function DetailNote({ tone = "warn", icon, children }: { tone?: "warn" | "muted"; icon: ReactNode; children: ReactNode }) {
  return (
    <div
      className={
        tone === "warn"
          ? "flex items-start gap-2.5 rounded-[10px] bg-[hsl(var(--tier-warn-bg))] px-3.5 py-3 text-[13px] font-medium text-[hsl(var(--tier-warn-strong))]"
          : "flex items-start gap-2.5 rounded-[10px] bg-muted px-3.5 py-3 text-[13px] font-medium text-muted-foreground"
      }
    >
      <span className="mt-px shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Danh sách dòng trong thẻ (design `.rows`). */
export function DetailRows({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={`px-[22px] pb-1 pt-2 ${className ?? ""}`}>{children}</div>;
}

/** Một dòng tiêu đề + phụ đề bên trái, giá trị bên phải (design `.rw`). */
export function DetailRow({ lead, title, sub, value }: { lead?: ReactNode; title: ReactNode; sub?: ReactNode; value?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t py-3 first:border-t-0">
      <div className="flex min-w-0 items-center gap-3">
        {lead}
        <div className="min-w-0">
          <b className="block text-[13.5px] font-semibold text-foreground">{title}</b>
          {sub && <small className="mt-px block text-[12.5px] text-muted-foreground">{sub}</small>}
        </div>
      </div>
      <div className="whitespace-nowrap text-right font-semibold tabular-nums">{value}</div>
    </div>
  );
}

/** Chân thẻ có viền trên (design `.cf`). */
export function DetailCardFooter({ children }: { children: ReactNode }) {
  return <div className="mt-2 flex flex-wrap items-center gap-2.5 border-t px-[22px] pb-[18px] pt-3.5">{children}</div>;
}

/** Thẻ trống giữa tab (design `emptyCard`). */
export function DetailEmpty({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-10 text-center text-muted-foreground shadow-card">
      <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-muted [&>svg]:h-[18px] [&>svg]:w-[18px]">
        {icon}
      </span>
      <b className="mb-1 block text-[15px] text-foreground">{title}</b>
      {children}
    </section>
  );
}

/** Ô số báo danh xanh (design `.sbd`); thiếu số thì gạch ngang. */
export function BidderNoChip({ no }: { no: number | null | undefined }) {
  if (no == null) return <span className="text-muted-foreground/70">—</span>;
  return (
    <span className="inline-block min-w-[44px] rounded-md bg-primary/10 px-[7px] py-0.5 text-center font-mono text-[13px] font-bold text-primary">
      {String(no).padStart(3, "0")}
    </span>
  );
}
