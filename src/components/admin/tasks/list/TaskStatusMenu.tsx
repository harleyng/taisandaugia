import { ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUS_LABELS, STATUS_BADGE_CLASS } from "@/lib/tasks/taskStatus";
import type { Task, TaskStatus } from "@/types/tasks";

const ORDER: TaskStatus[] = ["todo", "in_progress", "done", "cancelled"];

/** Đổi trạng thái inline ngay trên thẻ — như dropdown "Mới tạo ▾" ở mockup. */
export function TaskStatusMenu({
  task,
  onSetStatus,
}: {
  task: Task;
  onSetStatus: (t: Task, status: TaskStatus) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${STATUS_BADGE_CLASS[task.status]}`}
      >
        {STATUS_LABELS[task.status]}
        <ChevronDown className="h-3 w-3 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {ORDER.map((s) => (
          <DropdownMenuItem
            key={s}
            disabled={s === task.status}
            onClick={(e) => {
              e.stopPropagation();
              onSetStatus(task, s);
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
