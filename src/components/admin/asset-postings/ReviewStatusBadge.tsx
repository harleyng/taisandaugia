import { REVIEW_STATUS_LABELS, REVIEW_STATUS_BADGE_CLASS } from "@/lib/asset-posting/reviewStatus";
import type { AssetPostingReviewStatus } from "@/types/asset-posting";

export function ReviewStatusBadge({ status }: { status: AssetPostingReviewStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${REVIEW_STATUS_BADGE_CLASS[status]}`}
    >
      {REVIEW_STATUS_LABELS[status]}
    </span>
  );
}
