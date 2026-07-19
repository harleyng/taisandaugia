import type { TaskStatus, TaskType, TaskPriority } from "@/types/tasks";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Cần làm",
  in_progress: "Đang làm",
  done: "Hoàn thành",
  cancelled: "Đã hủy",
};

export const STATUS_BADGE_CLASS: Record<TaskStatus, string> = {
  todo: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
  cancelled: "bg-gray-200 text-gray-600",
};

export const TYPE_LABELS: Record<TaskType, string> = {
  call: "Gọi điện",
  email: "Gửi email",
  meeting: "Gặp mặt",
  followup: "Theo dõi",
  other: "Khác",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Thấp",
  normal: "Bình thường",
  high: "Cao",
  urgent: "Khẩn",
};

export const PRIORITY_BADGE_CLASS: Record<TaskPriority, string> = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-slate-100 text-slate-600",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export interface StatusTab { key: TaskStatus | "all" | "overdue"; label: string }

export const STATUS_TABS: StatusTab[] = [
  { key: "all", label: "Tất cả" },
  { key: "todo", label: "Cần làm" },
  { key: "in_progress", label: "Đang làm" },
  { key: "overdue", label: "Quá hạn" },
  { key: "done", label: "Hoàn thành" },
];

export const isTerminal = (s: TaskStatus): boolean => s === "done" || s === "cancelled";

/** Quá hạn tính phía client — now() không IMMUTABLE nên không làm generated column được. */
export const isOverdue = (status: TaskStatus, dueAt: string | null): boolean =>
  !isTerminal(status) && !!dueAt && new Date(dueAt) < new Date();
