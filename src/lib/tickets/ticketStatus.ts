import type { TicketStatus, TicketSource, TicketPriority } from "@/types/tickets";

// Từ vựng cũ của hộp thư "Liên hệ & Hợp tác" đã được map khi backfill:
//   unread → new · read → open · replied → resolved
export const STATUS_LABELS: Record<TicketStatus, string> = {
  new: "Mới",
  open: "Đang xử lý",
  pending: "Chờ phản hồi",
  resolved: "Đã xử lý",
  closed: "Đã đóng",
};

export const STATUS_BADGE_CLASS: Record<TicketStatus, string> = {
  new: "bg-amber-100 text-amber-700",
  open: "bg-blue-100 text-blue-700",
  pending: "bg-violet-100 text-violet-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-200 text-gray-600",
};

export const SOURCE_LABELS: Record<TicketSource, string> = {
  contact_form: "Form liên hệ",
  partnership: "Đăng ký hợp tác",
  phone: "Điện thoại",
  email: "Email",
  manual: "Nhập tay",
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Thấp",
  normal: "Bình thường",
  high: "Cao",
  urgent: "Khẩn",
};

export const PRIORITY_BADGE_CLASS: Record<TicketPriority, string> = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-slate-100 text-slate-600",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export interface StatusTab { key: TicketStatus | "all"; label: string }

export const STATUS_TABS: StatusTab[] = [
  { key: "all", label: "Tất cả" },
  { key: "new", label: "Mới" },
  { key: "open", label: "Đang xử lý" },
  { key: "pending", label: "Chờ phản hồi" },
  { key: "resolved", label: "Đã xử lý" },
  { key: "closed", label: "Đã đóng" },
];

/** Chưa xong — dùng cho KPI "Việc cần làm" ở Tổng quan. */
export const isOpenStatus = (s: TicketStatus): boolean =>
  s === "new" || s === "open" || s === "pending";
