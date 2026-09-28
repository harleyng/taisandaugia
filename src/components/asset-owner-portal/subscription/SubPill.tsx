import { cn } from "@/lib/utils";

export type SubPillTone = "ok" | "warn" | "info" | "muted";

/** Nhãn trạng thái có chấm tròn (.pill trong design). Trên nền hạng tối đổi sang chữ trắng. */
const LIGHT: Record<SubPillTone, string> = {
  ok: "bg-primary/10 text-primary",
  warn: "bg-[hsl(var(--tier-warn-bg))] text-[hsl(var(--tier-warn-strong))]",
  info: "bg-[hsl(var(--tier-info-bg))] text-[hsl(var(--tier-info))]",
  muted: "bg-muted text-muted-foreground",
};

const DARK: Record<SubPillTone, string> = {
  ok: "bg-white/15 text-white",
  warn: "bg-[hsl(var(--tier-warn-pill))] text-[hsl(var(--tier-warn-pill-fg))]",
  info: "bg-white/15 text-white",
  muted: "bg-white/15 text-white",
};

export function SubPill({ tone, onDark, children }: { tone: SubPillTone; onDark?: boolean; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold",
        (onDark ? DARK : LIGHT)[tone],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}
