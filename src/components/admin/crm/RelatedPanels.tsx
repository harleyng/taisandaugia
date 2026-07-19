import { useState } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRelatedTasks } from "@/hooks/useTasks";
import { useRelatedTickets } from "@/hooks/useTickets";
import { TaskFormDialog } from "@/components/admin/tasks/TaskFormDialog";
import { TicketFormDialog } from "@/components/admin/tickets/TicketFormDialog";
import { TaskStatusBadge } from "@/components/admin/tasks/TaskStatusBadge";
import { TicketStatusBadge } from "@/components/admin/tickets/TicketStatusBadge";
import { isOverdue } from "@/lib/tasks/taskStatus";
import type { CrmRelation } from "@/lib/crm/relation";
import type { Task } from "@/types/tasks";
import type { Ticket } from "@/types/tickets";

/**
 * Một CẶP panel dùng chung, nhúng vào trang chi tiết Lead / Khách hàng / Cơ hội
 * / Đơn hàng. Tham số hóa bằng quan hệ nên không phải viết lại cho từng nơi.
 */
interface PanelProps {
  relation: Partial<CrmRelation>;
}

function Shell({
  title, count, onAdd, children,
}: { title: string; count: number; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">
          {title} ({count})
        </h2>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Thêm
        </Button>
      </div>
      {children}
    </div>
  );
}

export function RelatedTasksPanel({ relation }: PanelProps) {
  const { data: tasks, isLoading } = useRelatedTasks(relation);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  return (
    <>
      <Shell
        title="Công việc liên quan"
        count={tasks?.length ?? 0}
        onAdd={() => { setEditing(null); setOpen(true); }}
      >
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (tasks ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Chưa có công việc nào.</p>
        ) : (
          <div className="divide-y divide-border">
            {(tasks ?? []).map((t) => (
              <button
                key={t.id}
                onClick={() => { setEditing(t); setOpen(true); }}
                className="w-full text-left py-2.5 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{t.title}</p>
                  {t.due_at && (
                    <p className={`text-xs ${isOverdue(t.status, t.due_at) ? "text-destructive" : "text-muted-foreground"}`}>
                      Hạn {format(new Date(t.due_at), "dd/MM/yyyy")}
                    </p>
                  )}
                </div>
                <TaskStatusBadge status={t.status} />
              </button>
            ))}
          </div>
        )}
      </Shell>

      <TaskFormDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        defaultRelation={relation}
      />
    </>
  );
}

export function RelatedTicketsPanel({ relation }: PanelProps) {
  const { data: tickets, isLoading } = useRelatedTickets(relation);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);

  return (
    <>
      <Shell
        title="Ticket liên quan"
        count={tickets?.length ?? 0}
        onAdd={() => { setEditing(null); setOpen(true); }}
      >
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (tickets ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Chưa có ticket nào.</p>
        ) : (
          <div className="divide-y divide-border">
            {(tickets ?? []).map((t) => (
              <button
                key={t.id}
                onClick={() => { setEditing(t); setOpen(true); }}
                className="w-full text-left py-2.5 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.code} · {format(new Date(t.created_at), "dd/MM/yyyy")}
                  </p>
                </div>
                <TicketStatusBadge status={t.status} />
              </button>
            ))}
          </div>
        )}
      </Shell>

      <TicketFormDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        defaultRelation={relation}
      />
    </>
  );
}
