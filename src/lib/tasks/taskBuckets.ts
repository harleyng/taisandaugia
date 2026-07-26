// Phân nhóm & lịch cho cổng Công việc.
//
// Task chỉ có MỘT mốc `due_at` (không start/end). Form lưu theo NGÀY nên phần
// lớn due_at là nửa đêm — vì vậy mọi so sánh "quá hạn / hôm nay / sắp tới" ở đây
// dùng mốc ĐẦU NGÀY (startOfDay) cho ổn định, không lệ thuộc giờ trong ngày.

import {
  addDays, addMonths, addWeeks, endOfMonth, endOfWeek,
  format, isSameDay, isToday, parseISO, startOfDay, startOfMonth, startOfWeek,
} from "date-fns";
import { vi } from "date-fns/locale";
import { isTerminal } from "./taskStatus";
import type { Task } from "@/types/tasks";

export type TaskView = "list" | "agenda" | "week" | "month";

export interface TaskBuckets {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  done: Task[];
}

/** Có giờ cụ thể (khác nửa đêm) — dùng để quyết định hiện HH:mm hay không. */
export function hasTime(dueAt: string | null): boolean {
  if (!dueAt) return false;
  const d = new Date(dueAt);
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

/** Chia công việc thành 4 nhóm theo mốc hạn. Terminal (xong/hủy) → `done`. */
export function bucketTasks(tasks: Task[]): TaskBuckets {
  const todayStart = startOfDay(new Date());
  const out: TaskBuckets = { overdue: [], today: [], upcoming: [], done: [] };
  for (const t of tasks) {
    if (isTerminal(t.status)) {
      out.done.push(t);
      continue;
    }
    if (!t.due_at) {
      out.upcoming.push(t);
      continue;
    }
    const d = startOfDay(new Date(t.due_at));
    if (d < todayStart) out.overdue.push(t);
    else if (isSameDay(d, todayStart)) out.today.push(t);
    else out.upcoming.push(t);
  }
  return out;
}

export interface DateGroup {
  key: string;
  date: Date;
  label: string;
  tasks: Task[];
}

const dateLabel = (date: Date): string =>
  isToday(date)
    ? `Hôm nay, ${format(date, "dd/MM/yyyy")}`
    : format(date, "EEEE, dd/MM/yyyy", { locale: vi });

/** Gom công việc theo ngày (cho view Lịch trình). Trả kèm nhóm không có hạn. */
export function groupByDate(tasks: Task[]): { dated: DateGroup[]; undated: Task[] } {
  const map = new Map<string, Task[]>();
  const undated: Task[] = [];
  for (const t of tasks) {
    if (!t.due_at) {
      undated.push(t);
      continue;
    }
    const key = format(new Date(t.due_at), "yyyy-MM-dd");
    const arr = map.get(key) ?? [];
    arr.push(t);
    map.set(key, arr);
  }
  const dated = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, ts]) => {
      const date = parseISO(key);
      return { key, date, label: dateLabel(date), tasks: ts };
    });
  return { dated, undated };
}

/** Công việc rơi vào một ngày cụ thể (view Tuần/Tháng). */
export function tasksForDay(tasks: Task[], day: Date): Task[] {
  return tasks.filter((t) => t.due_at && isSameDay(new Date(t.due_at), day));
}

// ─── Điều hướng lịch ─────────────────────────────────────────────────────────

export function shiftCursor(view: TaskView, cursor: Date, dir: 1 | -1): Date {
  if (view === "week") return addWeeks(cursor, dir);
  if (view === "month") return addMonths(cursor, dir);
  return addDays(cursor, dir);
}

export function navigatorLabel(view: TaskView, cursor: Date): string {
  if (view === "week") {
    const s = startOfWeek(cursor, { weekStartsOn: 1 });
    const e = endOfWeek(cursor, { weekStartsOn: 1 });
    return `${format(s, "dd/MM")} – ${format(e, "dd/MM/yyyy")}`;
  }
  if (view === "month") return format(cursor, "'Tháng' M, yyyy");
  return dateLabel(cursor);
}

/** 7 ngày của tuần chứa `cursor`, bắt đầu Thứ 2. */
export function weekDays(cursor: Date): Date[] {
  const s = startOfWeek(cursor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

/** Ma trận 6 tuần phủ trọn tháng chứa `cursor` (đầu tuần Thứ 2). */
export function monthCells(cursor: Date): Date[] {
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const cells: Date[] = [];
  let c = start;
  while (c <= end) {
    cells.push(c);
    c = addDays(c, 1);
  }
  return cells;
}

export const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
