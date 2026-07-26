import { bucketTasks } from "@/lib/tasks/taskBuckets";
import { TaskGroupSection } from "./TaskGroupSection";
import type { TaskActions } from "./TaskRowCard";
import type { Task } from "@/types/tasks";

/** Danh sách dạng thẻ, nhóm theo mốc hạn (tham khảo mockup). */
export function TaskListView({ tasks, actions }: { tasks: Task[]; actions: TaskActions }) {
  const { overdue, today, upcoming, done } = bucketTasks(tasks);

  return (
    <div className="space-y-3">
      <TaskGroupSection title="Quá hạn xử lý" tasks={overdue} actions={actions} accent defaultOpen />
      <TaskGroupSection title="Hôm nay" tasks={today} actions={actions} defaultOpen />
      <TaskGroupSection title="Sắp tới" tasks={upcoming} actions={actions} defaultOpen />
      <TaskGroupSection title="Đã đóng" tasks={done} actions={actions} defaultOpen={false} />
    </div>
  );
}
