import { ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUS_LABELS, STATUS_BADGE_CLASS } from "@/lib/tickets/ticketStatus";
import type { Ticket, TicketStatus } from "@/types/tickets";

const ORDER: TicketStatus[] = ["new", "open", "pending", "resolved", "closed"];

/** Đổi trạng thái inline ngay trên thẻ — đối xứng với TaskStatusMenu. */
export function TicketStatusMenu({
  ticket,
  onSetStatus,
}: {
  ticket: Ticket;
  onSetStatus: (t: Ticket, status: TicketStatus) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${STATUS_BADGE_CLASS[ticket.status]}`}
      >
        {STATUS_LABELS[ticket.status]}
        <ChevronDown className="h-3 w-3 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {ORDER.map((s) => (
          <DropdownMenuItem
            key={s}
            disabled={s === ticket.status}
            onClick={(e) => {
              e.stopPropagation();
              onSetStatus(ticket, s);
            }}
          >
            <span className={`mr-2 inline-block h-2 w-2 rounded-full ${STATUS_BADGE_CLASS[s]}`} />
            {STATUS_LABELS[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
