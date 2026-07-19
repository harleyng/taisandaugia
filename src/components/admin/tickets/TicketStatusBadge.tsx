import {
  STATUS_LABELS, STATUS_BADGE_CLASS,
  PRIORITY_LABELS, PRIORITY_BADGE_CLASS,
  SOURCE_LABELS,
} from "@/lib/tickets/ticketStatus";
import type { TicketStatus, TicketPriority, TicketSource } from "@/types/tickets";

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_BADGE_CLASS[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export const sourceLabel = (s: TicketSource): string => SOURCE_LABELS[s] ?? s;
