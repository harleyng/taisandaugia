import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatMoneyFull } from "@/utils/money";
import { OutcomeSourceBadge } from "@/components/asset-owner-portal/outcomes/OutcomeSourceBadge";
import { OUTCOME_KIND_LABEL, OUTCOME_SOURCE_KIND_LABEL } from "@/lib/ownerOutcomes";
import type { OverviewSource } from "@/lib/ownerOutcomesOverview";

const formatDay = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : null);

function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] leading-4", className)}>{children}</span>
  );
}

interface OutcomeSourceCardProps {
  source: OverviewSource;
  /** Nguồn đang được dùng cho con số hiển thị. */
  isWinner: boolean;
  action?: ReactNode;
}

/** Một nguồn số liệu trong bảng so sánh: ai nói, nói gì, và các cờ server đã tính. */
export function OutcomeSourceCard({ source, isWinner, action }: OutcomeSourceCardProps) {
  const kind = source.kind ? OUTCOME_SOURCE_KIND_LABEL[source.kind] : "Nguồn khác";
  const value =
    source.outcome === "sold"
      ? source.price !== null
        ? formatMoneyFull(source.price)
        : OUTCOME_KIND_LABEL.sold
      : source.outcome
        ? OUTCOME_KIND_LABEL[source.outcome]
        : "—";
  const meta = [
    formatDay(source.date),
    source.roundNo !== null ? `Lượt ${source.roundNo}` : null,
    source.sessionCode,
    source.orgName,
  ].filter(Boolean);
  const flagged = source.disagrees && !source.dismissed;

  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border bg-card p-4", flagged && "border-warning/50")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{kind}</p>
        {source.label && <OutcomeSourceBadge confidence={source.label} sources={[source]} />}
      </div>
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      {meta.length > 0 && <p className="text-xs text-muted-foreground">{meta.join(" · ")}</p>}
      <div className="flex flex-wrap gap-1.5">
        {isWinner && <Chip className="border-primary/30 bg-primary/10 text-foreground">Đang dùng</Chip>}
        {flagged && <Chip className="border-warning/40 bg-warning/15 text-foreground">Lệch với số đang dùng</Chip>}
        {source.dismissed && <Chip className="text-muted-foreground">Đơn vị đã bỏ qua</Chip>}
        {!source.inRound && <Chip className="text-muted-foreground">Lượt trước</Chip>}
      </div>
      {action && <div className="mt-auto pt-1">{action}</div>}
    </div>
  );
}
