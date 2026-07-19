import { format } from "date-fns";
import { Check, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskStatusBadge, TaskPriorityBadge } from "./TaskStatusBadge";
import { RelationCell } from "@/components/admin/crm/RelationCell";
import { TYPE_LABELS, isOverdue, isTerminal } from "@/lib/tasks/taskStatus";
import type { Task } from "@/types/tasks";

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";

interface Props {
  tasks: Task[];
  isLoading: boolean;
  /** Ẩn cột "Liên quan" khi nhúng trong trang chi tiết của chính đối tượng đó. */
  hideRelation?: boolean;
  onEdit: (t: Task) => void;
  onComplete: (t: Task) => void;
  onDelete: (t: Task) => void;
}

export function TaskTable({ tasks, isLoading, hideRelation, onEdit, onComplete, onDelete }: Props) {
  const cols = hideRelation ? 6 : 7;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className={TH}>Mã</th>
              <th className={TH}>Công việc</th>
              {!hideRelation && <th className={TH}>Liên quan</th>}
              <th className={TH}>Hạn</th>
              <th className={TH}>Ưu tiên</th>
              <th className={TH}>Trạng thái</th>
              <th className={TH}>Thao tác</th>
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
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={cols} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  Chưa có công việc nào.
                </td>
              </tr>
            ) : (
              tasks.map((t) => {
                const overdue = isOverdue(t.status, t.due_at);
                return (
                  <tr key={t.id} className="group border-b border-border transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs text-primary">{t.code ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{t.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {TYPE_LABELS[t.task_type]}
                        {t.assignee?.name && ` · ${t.assignee.name}`}
                      </span>
                    </td>
                    {!hideRelation && (
                      <td className="px-4 py-3"><RelationCell row={t} /></td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {t.due_at ? (
                        <span className={`text-xs inline-flex items-center gap-1 ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          {overdue && <AlertTriangle className="h-3 w-3" />}
                          {format(new Date(t.due_at), "dd/MM/yyyy")}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><TaskPriorityBadge priority={t.priority} /></td>
                    <td className="px-4 py-3"><TaskStatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1">
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7 text-green-600"
                          disabled={isTerminal(t.status)}
                          title={isTerminal(t.status) ? "Đã đóng" : "Đánh dấu hoàn thành"}
                          onClick={() => onComplete(t)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
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
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
