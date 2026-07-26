import { format, isToday } from "date-fns";
import { WEEKDAY_LABELS, weekDays, tasksForDay } from "@/lib/tasks/taskBuckets";
import { TaskBlock } from "./TaskBlock";
import type { TaskActions } from "../list/TaskRowCard";
import type { Task } from "@/types/tasks";

/**
 * Tuần: bảng 7 cột (T2→CN). Task xếp theo NGÀY hạn (dữ liệu chỉ có mốc ngày nên
 * dùng bảng ngày thay vì lưới giờ). Task không hạn nằm ở dải "Chưa xếp lịch".
 */
export function TaskWeekView({
  tasks,
  cursor,
  actions,
}: {
  tasks: Task[];
  cursor: Date;
  actions: TaskActions;
}) {
  const days = weekDays(cursor);
  const undated = tasks.filter((t) => !t.due_at);

  return (
    <div className="space-y-3">
      {undated.length > 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-2">
          <p className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">Chưa xếp lịch ({undated.length})</p>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {undated.map((t) => (
              <TaskBlock key={t.id} task={t} actions={actions} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {days.map((day, i) => {
          const items = tasksForDay(tasks, day);
          const today = isToday(day);
          return (
            <div key={day.toISOString()} className="rounded-xl border border-border bg-card">
              <div className={`flex items-center justify-between px-2 py-1.5 ${today ? "text-primary" : "text-muted-foreground"}`}>
                <span className="text-xs font-medium">{WEEKDAY_LABELS[i]}</span>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${today ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                  {format(day, "d")}
                </span>
              </div>
              <div className="min-h-[80px] space-y-1.5 p-1.5">
                {items.map((t) => (
                  <TaskBlock key={t.id} task={t} actions={actions} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
