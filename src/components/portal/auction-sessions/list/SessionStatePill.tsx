import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ROW_STATE_LABELS, type SessionRowState } from "@/lib/auctionSessions/sessionList";

export type PillTone = "muted" | "info" | "warning" | "live" | "ok" | "bad";

// Design dùng xanh dương / tím cho "nhận hồ sơ" / "sắp đấu". Xanh dương lấy token
// --tier-info sẵn có; tím không có token ⇒ "sắp đấu" dùng tông cảnh báo (vàng).
// "Đang diễn ra / đang trả giá" (live) cũng xanh dương theo yêu cầu 18/10; đỏ
// chỉ còn cho trạng thái xấu (bad).
const TONES: Record<PillTone, string> = {
  muted: "bg-muted text-muted-foreground",
  info: "bg-[hsl(var(--tier-info-bg))] text-[hsl(var(--tier-info))]",
  warning: "bg-warning/15 text-[hsl(var(--tier-warn-strong))]",
  live: "bg-[hsl(var(--tier-info-bg))] text-[hsl(var(--tier-info))]",
  ok: "bg-primary/10 text-primary",
  bad: "bg-destructive/10 text-destructive",
};

const STATE_TONE: Record<SessionRowState, PillTone> = {
  draft: "muted",
  reg: "info",
  upcoming: "warning",
  ongoing: "live",
  ended: "ok",
  finalized: "ok",
  cancelled: "muted",
};

/** Viên có chấm tròn đầu dòng (design `.pill`). */
export function DotPill({ tone, className, children }: { tone: PillTone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-[9px] py-0.5 text-xs font-semibold",
        "before:h-1.5 before:w-1.5 before:rounded-full before:bg-current before:content-['']",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SessionStatePill({ state, className }: { state: SessionRowState; className?: string }) {
  return (
    <DotPill tone={STATE_TONE[state]} className={className}>
      {ROW_STATE_LABELS[state]}
    </DotPill>
  );
}
