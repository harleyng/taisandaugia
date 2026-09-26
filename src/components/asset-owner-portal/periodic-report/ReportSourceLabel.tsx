import { OutcomeSourceBadge } from "@/components/asset-owner-portal/outcomes/OutcomeSourceBadge";
import { OUTCOME_CONFIDENCE_META, type OutcomeConfidence } from "@/lib/ownerOutcomes";
import { cn } from "@/lib/utils";
import type { ReportVariant } from "./ReportTable";

interface ReportSourceLabelProps {
  confidence: OutcomeConfidence | null;
  hasConflict?: boolean;
  variant: ReportVariant;
}

/**
 * Nhãn nguồn của một con số (§A3). Màn hình: badge có tooltip; bản in: chữ thường (§A8.9).
 * Link chia sẻ: badge trên màn hình, chữ thường khi người nhận in ra.
 */
export function ReportSourceLabel({ confidence, hasConflict = false, variant }: ReportSourceLabelProps) {
  if (!confidence) return <span className="text-muted-foreground">—</span>;
  const label = OUTCOME_CONFIDENCE_META[confidence].label;
  const text = (className?: string) => (
    <span className={cn("whitespace-nowrap text-[11px] text-muted-foreground", className)}>
      {hasConflict ? `${label} · lệch số liệu` : label}
    </span>
  );
  if (variant === "print") return text();
  const badge = <OutcomeSourceBadge confidence={confidence} hasConflict={hasConflict} />;
  if (variant === "shared") {
    return (
      <>
        <span className="print:hidden">{badge}</span>
        {text("hidden print:inline")}
      </>
    );
  }
  return badge;
}
