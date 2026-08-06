import { bucketTasks } from "@/lib/tasks/taskBuckets";
import { TaskGroupSection } from "./TaskGroupSection";
import type { TaskActions } from "./TaskRowCard";
import type { Task } from "@/types/tasks";

/** Danh sách dạng thẻ, nhóm theo mốc hạn (tham khảo mockup). */
export function TaskListView({
  tasks,
  actions,
  hideRelation,
  pageSize,
}: {
  tasks: Task[];
  actions: TaskActions;
  /** Ẩn badge "Liên quan" — panel nhúng trong trang của chính đối tượng. */
  hideRelation?: boolean;
  /** Bật phân trang trong từng nhóm. Bỏ trống (cổng tập trung) = liệt kê hết. */
  pageSize?: number;
}) {
  const { overdue, today, upcoming, done } = bucketTasks(tasks);
  const shared = { actions, hideRelation, pageSize };

  return (
    <div className="space-y-3">
      <TaskGroupSection title="Quá hạn xử lý" tasks={overdue} accent defaultOpen {...shared} />
      <TaskGroupSection title="Hôm nay" tasks={today} defaultOpen {...shared} />
      <TaskGroupSection title="Sắp tới" tasks={upcoming} defaultOpen {...shared} />
      <TaskGroupSection title="Đã đóng" tasks={done} defaultOpen={false} {...shared} />
    </div>
  );
}
