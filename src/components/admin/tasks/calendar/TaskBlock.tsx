import { format } from "date-fns";
import { STATUS_DOT_CLASS } from "@/lib/tasks/taskStatus";
import { hasTime } from "@/lib/tasks/taskBuckets";
import type { Task } from "@/types/tasks";
import type { TaskActions } from "../list/TaskRowCard";

/** Chip công việc gọn cho view Tuần. Click mở dialog chỉnh sửa. */
export function TaskBlock({ task, actions }: { task: Task; actions: TaskActions }) {
  const time = task.due_at && hasTime(task.due_at) ? format(new Date(task.due_at), "HH:mm") : null;
  return (
    <button
      onClick={() => actions.onEdit(task)}
      className="flex w-full items-start gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
    >
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASS[task.status]}`} />
      <span className="min-w-0">
        {time && <span className="mr-1 text-[10px] font-medium text-muted-foreground">{time}</span>}
        <span className="line-clamp-2 text-xs text-foreground">{task.title}</span>
      </span>
    </button>
  );
}
