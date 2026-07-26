import { format, isSameMonth, isToday } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WEEKDAY_LABELS, monthCells, tasksForDay } from "@/lib/tasks/taskBuckets";
import { STATUS_DOT_CLASS, STATUS_LABELS } from "@/lib/tasks/taskStatus";
import type { TaskActions } from "../list/TaskRowCard";
import type { Task } from "@/types/tasks";

const MAX_DOTS = 3;

/** Tháng: lưới 6 tuần, mỗi ô có chấm trạng thái + popover liệt kê công việc. */
export function TaskMonthView({
  tasks,
  cursor,
  actions,
}: {
  tasks: Task[];
  cursor: Date;
  actions: TaskActions;
}) {
  const cells = monthCells(cursor);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day) => {
          const items = tasksForDay(tasks, day);
          const inMonth = isSameMonth(day, cursor);
          const today = isToday(day);
          const cell = (
            <div className={`h-24 border-b border-r border-border p-1.5 text-left ${inMonth ? "" : "bg-muted/20"}`}>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  today ? "bg-primary font-semibold text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/50"
                }`}
              >
                {format(day, "d")}
              </span>
              {items.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {items.slice(0, MAX_DOTS).map((t) => (
                    <span key={t.id} className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASS[t.status]}`} />
                  ))}
                  {items.length > MAX_DOTS && (
                    <span className="text-[10px] text-muted-foreground">+{items.length - MAX_DOTS}</span>
                  )}
                </div>
              )}
            </div>
          );

          if (items.length === 0) {
            return <div key={day.toISOString()}>{cell}</div>;
          }
          return (
            <Popover key={day.toISOString()}>
              <PopoverTrigger className="block w-full hover:bg-muted/30">{cell}</PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-2">
                <p className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">{format(day, "dd/MM/yyyy")}</p>
                <div className="space-y-1">
                  {items.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => actions.onEdit(t)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASS[t.status]}`} />
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{t.title}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{STATUS_LABELS[t.status]}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}
