import { formatMoneyFull } from "@/utils/money";
import { OUTCOME_KIND_LABEL, type ResolvedAssetOutcome } from "@/lib/ownerOutcomes";
import { OutcomeSourceBadge } from "./OutcomeSourceBadge";

interface OutcomeResultCellProps {
  outcome: ResolvedAssetOutcome | undefined;
}

/** Ô "Kết quả" của bảng tài sản: giá trúng (hoặc kết quả) + nhãn nguồn. */
export function OutcomeResultCell({ outcome }: OutcomeResultCellProps) {
  if (!outcome?.outcome || !outcome.confidence) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const sold = outcome.outcome === "sold";
  return (
    <div className="space-y-1">
      {sold && outcome.price !== null ? (
        <p className="whitespace-nowrap text-sm font-medium tabular-nums text-foreground">
          {formatMoneyFull(outcome.price)}
        </p>
      ) : (
        <p className={sold ? "text-sm text-foreground" : "text-sm text-muted-foreground"}>
          {OUTCOME_KIND_LABEL[outcome.outcome]}
        </p>
      )}
      <OutcomeSourceBadge
        confidence={outcome.confidence}
        sources={outcome.sources}
        hasConflict={outcome.hasConflict}
      />
    </div>
  );
}
