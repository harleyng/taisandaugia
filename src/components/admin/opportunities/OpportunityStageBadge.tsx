import { STAGE_LABELS, STAGE_BADGE_CLASS } from "@/lib/opportunities/opportunityStage";
import type { OpportunityStage } from "@/types/opportunities";

export function OpportunityStageBadge({ stage }: { stage: OpportunityStage }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STAGE_BADGE_CLASS[stage]}`}>
      {STAGE_LABELS[stage]}
    </span>
  );
}
