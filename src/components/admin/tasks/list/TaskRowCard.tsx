import { format } from "date-fns";
import { User, CalendarClock, AlertTriangle, ChevronsUp, ChevronsDown } from "lucide-react";
import { RelationCell } from "@/components/admin/crm/RelationCell";
import { TYPE_LABELS, isOverdue, PRIORITY_LABELS } from "@/lib/tasks/taskStatus";
import { hasTime } from "@/lib/tasks/taskBuckets";
import { TaskStatusMenu } from "./TaskStatusMenu";
import { TaskRowMenu } from "./TaskRowMenu";
import type { Task, TaskStatus, TaskPriority } from "@/types/tasks";

export interface TaskActions {
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onSetStatus: (t: Task, status: TaskStatus) => void;
}

function PriorityIcon({ priority }: { priority: TaskPriority }) {
  if (priority === "urgent")
    return <ChevronsUp className="h-4 w-4 text-red-600" aria-label={PRIORITY_LABELS.urgent} />;
  if (priority === "high")
    return <ChevronsUp className="h-4 w-4 text-orange-500" aria-label={PRIORITY_LABELS.high} />;
  if (priority === "low")
    return <ChevronsDown className="h-4 w-4 text-slate-400" aria-label={PRIORITY_LABELS.low} />;
  return null;
}

export function TaskRowCard({
  task,
  actions,
  hideRelation,
}: {
  task: Task;
  actions: TaskActions;
  /** Ẩn badge "Liên quan" khi thẻ đã nằm trong trang của chính đối tượng đó. */
  hideRelation?: boolean;
}) {
  const overdue = isOverdue(task.status, task.due_at);
  const assignee = task.assignee?.name || task.assignee?.email || "Chưa giao";
  const dueFmt = task.due_at
    ? format(new Date(task.due_at), hasTime(task.due_at) ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy")
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => actions.onEdit(task)}
      onKeyDown={(e) => e.key === "Enter" && actions.onEdit(task)}
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/30"
    >
      <span className="font-mono text-xs font-medium text-primary whitespace-nowrap">{task.code ?? "—"}</span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex shrink-0 items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {TYPE_LABELS[task.task_type]}
          </span>
          <span className="truncate font-medium text-foreground">{task.title}</span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <PriorityIcon priority={task.priority} />
            <User className="h-3.5 w-3.5" />
            {assignee}
          </span>
          {dueFmt && (
            <span className={`flex items-center gap-1 ${overdue ? "font-medium text-destructive" : ""}`}>
              {overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
              {dueFmt}
            </span>
          )}
          {!hideRelation && <RelationCell row={task} />}
        </div>
      </div>

      <TaskStatusMenu task={task} onSetStatus={actions.onSetStatus} />
      <TaskRowMenu task={task} onEdit={actions.onEdit} onDelete={actions.onDelete} />
    </div>
  );
}
