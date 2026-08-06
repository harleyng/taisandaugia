import { MoreVertical, Eye, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Ticket } from "@/types/tickets";

/** Menu kebab "⋮" — Xem / Chỉnh sửa / Xóa (Xem = mở cùng dialog để chỉnh). */
export function TicketRowMenu({
  ticket,
  onEdit,
  onDelete,
}: {
  ticket: Ticket;
  onEdit: (t: Ticket) => void;
  onDelete: (t: Ticket) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
      >
        <MoreVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(ticket); }}>
          <Eye className="mr-2 h-4 w-4" /> Xem
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(ticket); }}>
          <Pencil className="mr-2 h-4 w-4" /> Chỉnh sửa
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete(ticket); }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Xóa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
