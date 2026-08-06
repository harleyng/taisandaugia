import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketStatusBadge, TicketPriorityBadge } from "@/components/admin/tickets/TicketStatusBadge";
import { sourceLabel } from "@/components/admin/tickets/ticketLabels";
import { RelationCell } from "@/components/admin/crm/RelationCell";
import type { Ticket } from "@/types/tickets";

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";

interface Props {
  tickets: Ticket[];
  isLoading: boolean;
  hideRelation?: boolean;
  onEdit: (t: Ticket) => void;
  onDelete: (t: Ticket) => void;
}

export function TicketTable({ tickets, isLoading, hideRelation, onEdit, onDelete }: Props) {
  const cols = hideRelation ? 6 : 7;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className={TH}>Mã</th>
              <th className={TH}>Nội dung</th>
              <th className={TH}>Người gửi</th>
              {!hideRelation && <th className={TH}>Liên quan</th>}
              <th className={TH}>Nguồn</th>
              <th className={TH}>Ưu tiên</th>
              <th className={TH}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: cols }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={cols} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  Chưa có ticket nào.
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr
                  key={t.id}
                  className="group cursor-pointer border-b border-border transition-colors hover:bg-muted/30"
                  onClick={() => onEdit(t)}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono text-xs text-primary group-hover:underline">{t.code ?? "—"}</span>
                    <span className="block text-[10px] text-muted-foreground/70">
                      {format(new Date(t.created_at), "dd/MM/yyyy")}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[280px]">
                    <span className="font-medium text-foreground line-clamp-1">{t.subject}</span>
                    {t.body && (
                      <span className="block text-xs text-muted-foreground line-clamp-1">{t.body}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {t.requester_name || "—"}
                    {t.requester_phone && <span className="block">{t.requester_phone}</span>}
                  </td>
                  {!hideRelation && (
                    <td className="px-4 py-3"><RelationCell row={t} /></td>
                  )}
                  <td className="px-4 py-3 text-muted-foreground text-xs">{sourceLabel(t.source)}</td>
                  <td className="px-4 py-3"><TicketPriorityBadge priority={t.priority} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <TicketStatusBadge status={t.status} />
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(t)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => onDelete(t)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
