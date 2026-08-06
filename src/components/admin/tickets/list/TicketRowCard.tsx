import { format } from "date-fns";
import { User, CalendarClock, ChevronsUp, ChevronsDown } from "lucide-react";
import { RelationCell } from "@/components/admin/crm/RelationCell";
import { SOURCE_LABELS, PRIORITY_LABELS } from "@/lib/tickets/ticketStatus";
import { TicketStatusMenu } from "./TicketStatusMenu";
import { TicketRowMenu } from "./TicketRowMenu";
import type { Ticket, TicketStatus, TicketPriority } from "@/types/tickets";

export interface TicketActions {
  onEdit: (t: Ticket) => void;
  onDelete: (t: Ticket) => void;
  onSetStatus: (t: Ticket, status: TicketStatus) => void;
}

function PriorityIcon({ priority }: { priority: TicketPriority }) {
  if (priority === "urgent")
    return <ChevronsUp className="h-4 w-4 text-red-600" aria-label={PRIORITY_LABELS.urgent} />;
  if (priority === "high")
    return <ChevronsUp className="h-4 w-4 text-orange-500" aria-label={PRIORITY_LABELS.high} />;
  if (priority === "low")
    return <ChevronsDown className="h-4 w-4 text-slate-400" aria-label={PRIORITY_LABELS.low} />;
  return null;
}

/** Thẻ ticket dạng dòng — song song với TaskRowCard để hai tab đọc như nhau. */
export function TicketRowCard({
  ticket,
  actions,
  hideRelation,
}: {
  ticket: Ticket;
  actions: TicketActions;
  hideRelation?: boolean;
}) {
  const assignee = ticket.assignee?.name || ticket.assignee?.email || "Chưa giao";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => actions.onEdit(ticket)}
      onKeyDown={(e) => e.key === "Enter" && actions.onEdit(ticket)}
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/30"
    >
      <span className="font-mono text-xs font-medium text-primary whitespace-nowrap">
        {ticket.code ?? "—"}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex shrink-0 items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {SOURCE_LABELS[ticket.source]}
          </span>
          <span className="truncate font-medium text-foreground">{ticket.subject}</span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <PriorityIcon priority={ticket.priority} />
            <User className="h-3.5 w-3.5" />
            {assignee}
          </span>
          <span className="flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" />
            {format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm")}
          </span>
          {!hideRelation && <RelationCell row={ticket} />}
        </div>
      </div>

      <TicketStatusMenu ticket={ticket} onSetStatus={actions.onSetStatus} />
      <TicketRowMenu ticket={ticket} onEdit={actions.onEdit} onDelete={actions.onDelete} />
    </div>
  );
}
