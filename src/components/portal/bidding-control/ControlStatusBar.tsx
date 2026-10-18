import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LOT_VIEW_LABELS, type LotViewKey } from "@/lib/bidding/controlView";

/**
 * Thanh trạng thái đầu tab Điều hành (design `.ox-bar`): dòng trên là mốc thời
 * gian + thao tác, dòng dưới là thanh tiến độ mỗi lô một đoạn màu, số lô đã
 * đóng và số người có mặt.
 */

const SEG: Record<LotViewKey, string> = {
  wait: "bg-border",
  live: "bg-destructive",
  paused: "bg-warning",
  won: "bg-primary",
  unsold: "bg-warning",
  pulled: "bg-muted-foreground/60",
  closed: "bg-muted-foreground/60",
};

interface Props {
  label: string;
  value: string;
  /** Phần phụ sau giá trị, vd "· kết thúc 11:30". */
  meta?: string;
  actions: ReactNode;
  lots: { lotNo: number; key: LotViewKey }[];
  done: number;
  /** null ⇒ chưa điểm danh, hiện "—". */
  present: number | null;
  eligible: number;
}

export function ControlStatusBar({ label, value, meta, actions, lots, done, present, eligible }: Props) {
  return (
    <section className="flex flex-col gap-3.5 rounded-2xl bg-card px-5 py-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="text-[13px] text-muted-foreground">{label}</span>
          <b className="text-xl font-bold tabular-nums tracking-[-0.01em] text-foreground">{value}</b>
          {meta && <span className="text-[13px] tabular-nums text-muted-foreground">{meta}</span>}
        </div>
        <div className="flex gap-2">{actions}</div>
      </div>
      <div className="flex min-w-0 items-center gap-3 whitespace-nowrap text-[12.5px] text-muted-foreground">
        <div className="flex min-w-[60px] flex-1 gap-[3px]">
          {lots.map((l) => (
            <i
              key={l.lotNo}
              className={cn("h-1.5 flex-1 rounded-full", SEG[l.key])}
              title={`Lô ${l.lotNo} · ${LOT_VIEW_LABELS[l.key]}`}
            />
          ))}
        </div>
        <span className="tabular-nums">
          <b className="text-foreground">{done}</b>/{lots.length} lô đã đóng
        </span>
        <span className="h-3.5 w-px bg-border" />
        <span className="tabular-nums">
          <b className="text-foreground">{present ?? "—"}</b>/{eligible} có mặt
        </span>
      </div>
    </section>
  );
}
