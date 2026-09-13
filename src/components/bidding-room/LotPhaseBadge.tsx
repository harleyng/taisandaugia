import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LOT_PHASE_LABELS, type LotPhase } from "@/lib/bidding/lotPhase";

/** Nhãn giai đoạn của một lô. Dùng ở bảng lô, thẻ lô đang xem và lịch sử. */

const PHASE_CLASS: Record<LotPhase, string> = {
  pending: "bg-muted text-muted-foreground",
  open: "bg-success/10 text-success border-success/20",
  extended: "bg-success/10 text-success border-success/20",
  paused: "bg-warning/10 text-warning-foreground border-warning/30",
  closed: "bg-muted text-muted-foreground",
  withdrawn: "bg-destructive/10 text-destructive border-destructive/20",
};

interface Props {
  phase: LotPhase;
  /** > 0 thì hiện thêm nhãn "Gia hạn ×N" bên cạnh. */
  extensionCount?: number;
  className?: string;
}

export function LotPhaseBadge({ phase, extensionCount = 0, className }: Props) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      <Badge variant="outline" className={cn("border", PHASE_CLASS[phase])}>
        {phase === "open" || phase === "extended" ? (
          <span className="mr-1.5 inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-current" />
        ) : null}
        {/* "extended" vốn là "Đang trả giá (đã gia hạn)" — dài và trùng với
            nhãn ×N bên cạnh, nên ở đây rút gọn. */}
        {phase === "extended" ? LOT_PHASE_LABELS.open : LOT_PHASE_LABELS[phase]}
      </Badge>
      {extensionCount > 0 && (
        <Badge variant="outline" className="border-accent/30 bg-accent/10 text-accent-foreground">
          Gia hạn ×{extensionCount}
        </Badge>
      )}
    </span>
  );
}
