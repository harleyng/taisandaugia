import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { MonoTone } from "@/lib/outreach/channels";

// Phần tử nhỏ dùng chung của tab Tiếp thị (design pdg.css `.mk-mono`, `.card`, `.btn`).
// Design có tông tím (vio) cho Facebook — không có token ⇒ dùng xanh dương.

const MONO_TONE: Record<MonoTone, string> = {
  pri: "bg-primary/10 text-primary",
  blu: "bg-[hsl(var(--tier-info-bg))] text-[hsl(var(--tier-info))]",
  warn: "bg-[hsl(var(--tier-warn-bg))] text-[hsl(var(--tier-warn-strong))]",
};

/** Ô chữ viết tắt của kênh (design `.mk-mono`). */
export function Mono({ tone, size = "md", children }: { tone: MonoTone; size?: "md" | "sm"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-lg font-bold leading-none tracking-[0.02em] [&>svg]:h-[15px] [&>svg]:w-[15px]",
        size === "md" ? "h-[34px] w-[34px] text-xs" : "h-[30px] w-[30px] text-[10.5px]",
        MONO_TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Thẻ trắng (design `.card`). */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-2xl bg-card shadow-card", className)}>{children}</section>;
}

/** Nút design `.btn` (viền) / `.btn.pr` (chính) / `.btn.gh` (trong suốt) — kích thước 36 / 32px. */
export function DButton({
  variant = "outline",
  size = "md",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "outline" | "primary" | "ghost" | "danger"; size?: "md" | "sm" }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-semibold disabled:cursor-not-allowed disabled:opacity-45 [&>svg]:h-4 [&>svg]:w-4",
        size === "md" ? "h-9 px-3.5 text-[13px]" : "h-8 px-[11px] text-[12.5px]",
        variant === "outline" && "bg-card text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))] hover:bg-muted",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-hover))]",
        variant === "ghost" && "bg-transparent text-foreground hover:bg-muted",
        variant === "danger" && "bg-transparent text-destructive hover:bg-destructive/10",
        className,
      )}
      {...rest}
    />
  );
}
