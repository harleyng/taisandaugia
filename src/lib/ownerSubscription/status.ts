// Nhãn, màu và phép tính ngày của gói thuê bao tổ chức chủ tài sản.
//
// Quyền lợi gói nằm ở danh mục cố định owner_sub_benefits (DB). Hai hằng dưới đây chỉ phục vụ
// màn của các quyền lợi hệ thống KIỂM (source 'enforced'). Thêm quyền lợi kiểm hạn mức: thêm
// dòng danh mục (migration) + nối _owner_sub_consume vào điểm trừ credit của tính năng.

import type { ActivationMethod, OverageMode, SubStatus, SubVariantKey } from "./types";

export const SUB_FEATURE_LABELS: Record<SubVariantKey, string> = {
  scan_3d_owner: "Quét 3D tài sản",
  report_portfolio_owner: "Báo cáo danh mục tuỳ chỉnh",
  priority_listing: "Tin đăng ưu tiên",
};

/** Đơn vị đếm của từng tính năng ("12 lượt quét"). */
export const SUB_FEATURE_UNITS: Record<SubVariantKey, string> = {
  scan_3d_owner: "lượt quét",
  report_portfolio_owner: "lượt xem",
  priority_listing: "tin",
};

export const SUB_STATUS_LABELS: Record<SubStatus, string> = {
  draft: "Nháp",
  offered: "Chờ thanh toán",
  active: "Đang hiệu lực",
  scheduled: "Chờ bắt đầu",
  expired: "Hết hạn",
  cancelled: "Đã huỷ",
};

export type SubTone = "neutral" | "info" | "success" | "warning" | "danger";

export const SUB_STATUS_TONES: Record<SubStatus, SubTone> = {
  draft: "neutral",
  offered: "info",
  active: "success",
  scheduled: "info",
  expired: "warning",
  cancelled: "danger",
};

/** Lớp Tailwind theo token cho huy hiệu trạng thái. */
export const SUB_TONE_CLASSES: Record<SubTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/10 text-destructive",
};

export const OVERAGE_LABELS: Record<OverageMode, string> = {
  block: "Chặn khi hết hạn mức",
  credits: "Trừ credit khi hết hạn mức",
};

export const OVERAGE_HINTS: Record<OverageMode, string> = {
  block: "Hết hạn mức thì thao tác bị chặn tới kỳ làm mới hoặc khi gia hạn / nâng hạn mức.",
  credits: "Hết hạn mức thì thao tác vẫn chạy và trừ credit của người thao tác như bình thường.",
};

export const ACTIVATION_METHOD_LABELS: Record<ActivationMethod, string> = {
  bank_transfer: "Chuyển khoản",
  contract: "Theo hợp đồng",
  complimentary: "Tặng / dùng thử",
  other: "Khác",
};

export const TERM_PRESETS = [3, 6, 12] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-09-27" ⇒ Date lúc 00:00 UTC (tránh lệch múi giờ khi chỉ so ngày). */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "27/09/2026". */
export function formatSubDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Ngày cuối (bao gồm) của kỳ n tháng — bản sao owner_sub_term_end():
 * start + n tháng (Postgres kẹp về ngày cuối tháng) − 1 ngày.
 */
export function termEnd(startIso: string, months: number): string {
  const s = parseIsoDate(startIso);
  const y = s.getUTCFullYear();
  const m = s.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const shifted = new Date(Date.UTC(y, m, Math.min(s.getUTCDate(), lastDay)));
  return toIsoDate(new Date(shifted.getTime() - DAY_MS));
}

/** Số ngày còn lại tính cả ngày hết hạn; âm = đã hết hạn. */
export function daysLeft(endsOnIso: string | null | undefined, todayIso: string): number | null {
  if (!endsOnIso) return null;
  return Math.round((parseIsoDate(endsOnIso).getTime() - parseIsoDate(todayIso).getTime()) / DAY_MS) + 1;
}

/** Hôm nay theo giờ Việt Nam, dạng ISO. */
export function vnToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
}

/** Cảnh báo sắp hết hạn khi còn ≤ 14 ngày. */
export const EXPIRY_WARNING_DAYS = 14;
