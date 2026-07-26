import { groupByDate } from "@/lib/tasks/taskBuckets";
import { TaskRowCard, type TaskActions } from "../list/TaskRowCard";
import type { Task } from "@/types/tasks";

/** Lịch trình: toàn bộ công việc (đã lọc) gom theo ngày, tăng dần. */
export function TaskAgendaView({ tasks, actions }: { tasks: Task[]; actions: TaskActions }) {
  const { dated, undated } = groupByDate(tasks);

  if (dated.length === 0 && undated.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
        Chưa có công việc nào.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {dated.map((g) => (
        <section key={g.key}>
          <h3 className="mb-2 text-sm font-semibold capitalize text-foreground">{g.label}</h3>
          <div className="space-y-2">
            {g.tasks.map((t) => (
              <TaskRowCard key={t.id} task={t} actions={actions} />
            ))}
          </div>
        </section>
      ))}
      {undated.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Chưa xếp lịch</h3>
          <div className="space-y-2">
            {undated.map((t) => (
              <TaskRowCard key={t.id} task={t} actions={actions} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
