import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Thẻ mục trên trang phiên: nền trắng, bo 2xl, tiêu đề có icon xanh (design `.card` + `.ch`). */
export function SectionCard({
  icon: Icon,
  title,
  aside,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl bg-card", className)}>
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <Icon className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} aria-hidden />
        <h3 className="flex-1 text-[15px] font-semibold text-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Các khối đếm ngược "02 ngày · 17 giờ · 39 phút". */
export function Countdown({ caption, parts }: { caption: string; parts: { value: string; unit: string }[] }) {
  return (
    <div>
      <span className="block text-xs text-muted-foreground">{caption}</span>
      <div className="mt-1.5 flex gap-1.5">
        {parts.map((p) => (
          <span key={p.unit} className="flex-1 rounded-lg bg-muted py-1.5 text-center text-[11px] text-muted-foreground">
            <b className="block font-mono text-lg font-bold leading-tight text-foreground">{p.value}</b>
            {p.unit}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Hộp cặp nhãn–giá trị nền xám (design `.kv`). */
export function KvBox({ rows }: { rows: { label: ReactNode; value: ReactNode }[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-muted p-3 text-[13px]">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{r.label}</span>
          <span className="text-right text-foreground">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Pill({ tone, children }: { tone: "ok" | "amber" | "muted" | "red"; children: ReactNode }) {
  const cls = {
    ok: "bg-success/10 text-success",
    amber: "bg-accent/20 text-[hsl(var(--tier-warn-fg))]",
    muted: "bg-muted text-muted-foreground",
    red: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <span className={cn("inline-flex h-[22px] items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold", cls)}>
      {children}
    </span>
  );
}

/** Ô thông báo nhỏ trong thẻ hành động (design `.info`). */
export function Note({ tone = "muted", children }: { tone?: "muted" | "amber" | "plain"; children: ReactNode }) {
  const cls = {
    muted: "bg-muted text-muted-foreground",
    amber: "bg-accent/20 text-[hsl(var(--tier-warn-fg))]",
    plain: "bg-muted text-foreground",
  }[tone];
  return <div className={cn("rounded-xl p-3 text-[13px]", cls)}>{children}</div>;
}

/** Số báo danh cỡ lớn (design `.sbd`). */
export function BidderNoBox({ no, caption }: { no: string; caption: string }) {
  return (
    <div className="rounded-xl bg-muted p-3 text-center">
      <span className="text-xs text-muted-foreground">Số báo danh</span>
      <b className="block font-mono text-4xl font-bold leading-tight tracking-[.12em] text-primary">{no}</b>
      <span className="text-xs text-muted-foreground">{caption}</span>
    </div>
  );
}
