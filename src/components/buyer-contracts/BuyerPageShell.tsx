import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { cn } from "@/lib/utils";

/** Khung trang sàn (nền xám, rộng 1280) — cùng khung với /sessions. */
export function BuyerPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <Header />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-20 pt-6">{children}</main>
      <Footer />
    </div>
  );
}

export function PageTitle({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-[28px] font-bold leading-tight text-foreground">{title}</h1>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Lưới 2 cột: nội dung chính + cột phải dính (design `.dg` / `.rt`). */
export function TwoColumn({ main, aside, className }: { main: ReactNode; aside: ReactNode; className?: string }) {
  return (
    <div className={cn("grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]", className)}>
      <div className="flex min-w-0 flex-col gap-6">{main}</div>
      <aside className="flex flex-col gap-4 lg:sticky lg:top-24">{aside}</aside>
    </div>
  );
}

/** Thanh tab dạng viên (design `.tabs`). `onWhite` = nằm trên nền thẻ trắng. */
export function PillTabs<T extends string>({
  value,
  onChange,
  items,
  onWhite,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { key: T; label: string; count?: number; icon?: ReactNode }[];
  onWhite?: boolean;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex w-max max-w-full gap-1 overflow-x-auto rounded-[10px] p-1",
        onWhite ? "bg-muted" : "bg-card",
        className,
      )}
    >
      {items.map((it) => {
        const on = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(it.key)}
            className={cn(
              "flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 font-medium transition-colors",
              on
                ? onWhite
                  ? "bg-card text-foreground shadow-sm"
                  : "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {it.icon}
            {it.label}
            {it.count != null && (
              <i
                className={cn(
                  "rounded-full px-1.5 text-xs not-italic",
                  on ? "bg-primary/10 text-primary" : "bg-border text-muted-foreground",
                )}
              >
                {it.count}
              </i>
            )}
          </button>
        );
      })}
    </div>
  );
}
