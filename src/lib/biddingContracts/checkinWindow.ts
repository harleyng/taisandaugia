// Cửa sổ điểm danh + kênh điểm danh của một phiên.
//
// BẢN SAO PHÍA CLIENT của _checkin_block_reason / _checkin_window_json
// (supabase/migrations/20261008100300_session_checkin.sql) — sửa một bên phải sửa
// cả bên kia. Server vẫn là nguồn sự thật; đây chỉ để hiện giờ mở / đóng và ẩn
// nút chắc chắn lỗi.

import type { AuctionFormat } from "@/types/asset-posting";

/** onsite = nhân viên quét phiếu tại chỗ; online = người mua tự điểm danh + OTP. */
export type CheckinChannel = "onsite" | "online";

export type CheckinWindowPhase = "before" | "open" | "closed";

/** Mặc định của cột auction_sessions.checkin_lead_minutes / checkin_grace_minutes. */
export const DEFAULT_CHECKIN_LEAD_MINUTES = 60;
export const DEFAULT_CHECKIN_GRACE_MINUTES = 0;

export interface CheckinWindowSession {
  starts_at: string;
  /** Tuỳ chọn để dùng được trước khi types.ts có cột — thiếu ⇒ mặc định DB. */
  checkin_lead_minutes?: number | null;
  checkin_grace_minutes?: number | null;
}

export interface CheckinWindow {
  opensAt: Date;
  closesAt: Date;
}

const MINUTE = 60_000;

/** [starts_at − lead, starts_at + grace], hai đầu đều tính là "đang mở". */
export function checkinWindowOf(s: CheckinWindowSession): CheckinWindow {
  const start = Date.parse(s.starts_at);
  const lead = s.checkin_lead_minutes ?? DEFAULT_CHECKIN_LEAD_MINUTES;
  const grace = s.checkin_grace_minutes ?? DEFAULT_CHECKIN_GRACE_MINUTES;
  return { opensAt: new Date(start - lead * MINUTE), closesAt: new Date(start + grace * MINUTE) };
}

export function checkinWindowPhase(s: CheckinWindowSession, now: Date = new Date()): CheckinWindowPhase {
  const { opensAt, closesAt } = checkinWindowOf(s);
  const t = now.getTime();
  if (t < opensAt.getTime()) return "before";
  if (t > closesAt.getTime()) return "closed";
  return "open";
}

/** Kênh suy từ hình thức phiên; ca_hai (tạm bỏ) / chưa đặt ⇒ null = không điểm danh được. */
export function checkinChannelOf(format: AuctionFormat | null | undefined): CheckinChannel | null {
  if (format === "truc_tiep") return "onsite";
  if (format === "truc_tuyen") return "online";
  return null;
}

export const CHECKIN_CHANNEL_LABELS: Record<CheckinChannel, string> = {
  onsite: "Điểm danh tại địa điểm tổ chức",
  online: "Tự điểm danh trực tuyến",
};
