import { STATUS_LABELS, STATUS_BADGE_CLASS } from "@/lib/leads/leadStatus";
import type { LeadStatus } from "@/types/leads";

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
