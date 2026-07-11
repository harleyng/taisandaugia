import { cn } from "@/lib/utils";
import { STATUS_BADGE_CLASS, STATUS_LABELS } from "@/lib/marketing/campaignStatus";
import type { CampaignStatus } from "@/types/marketing";

export function CampaignStatusBadge({
  status,
  className,
}: {
  status: CampaignStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap",
        STATUS_BADGE_CLASS[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
