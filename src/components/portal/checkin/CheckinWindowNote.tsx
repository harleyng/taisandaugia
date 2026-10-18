import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BoardBanner } from "@/lib/biddingContracts/checkinBoard";

const TONE: Record<BoardBanner["tone"], { box: string; accent: string; Icon: typeof Info }> = {
  muted: { box: "bg-card shadow-[0_0_0_1px_hsl(var(--border))]", accent: "text-muted-foreground", Icon: Info },
  live: { box: "bg-destructive/10", accent: "text-destructive", Icon: AlertCircle },
  ok: { box: "bg-primary/10", accent: "text-primary", Icon: CheckCircle2 },
};

/** Dải trạng thái cửa sổ điểm danh (design `.note.bn`): tên trạng thái đậm + giờ mở / chốt. */
export function CheckinWindowNote({ banner }: { banner: BoardBanner }) {
  const t = TONE[banner.tone];
  return (
    <div className={cn("flex items-center gap-2.5 rounded-[10px] px-3.5 py-3 text-[13px] text-foreground", t.box)}>
      <t.Icon className={cn("h-4 w-4 shrink-0", t.accent)} aria-hidden />
      <span>
        <b className={cn("mr-2 font-semibold", t.accent)}>{banner.title}</b>
        {banner.body}
      </span>
    </div>
  );
}
