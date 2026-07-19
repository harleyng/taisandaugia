import {
  STATUS_LABELS, STATUS_BADGE_CLASS,
  PRIORITY_LABELS, PRIORITY_BADGE_CLASS,
} from "@/lib/tasks/taskStatus";
import type { TaskStatus, TaskPriority } from "@/types/tasks";

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_BADGE_CLASS[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
