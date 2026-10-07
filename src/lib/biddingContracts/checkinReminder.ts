// Nhắc điểm danh TRONG APP (D2): banner khi phiên còn ≤ 24 giờ mà người mua
// chưa điểm danh. Không có bảng thông báo / email — chỉ hiện khi họ mở trang.

import { attendanceStateOf, type AttendanceContract, type AttendanceSession } from "./eligibility";
import { checkinChannelOf, checkinWindowOf, type CheckinChannel } from "./checkinWindow";

export const CHECKIN_REMINDER_HORIZON_MS = 24 * 60 * 60_000;

export interface CheckinReminder {
  /** ticket_ready = chưa tới giờ mở; open = đang mở điểm danh. */
  phase: "upcoming" | "open";
  channel: CheckinChannel;
  opensAt: Date;
  closesAt: Date;
  startsAt: Date;
}

/** null = không có gì để nhắc (chưa đủ điều kiện, đã điểm danh, phiên còn xa…). */
export function checkinReminderOf(
  contract: AttendanceContract,
  session: AttendanceSession,
  now: Date = new Date(),
): CheckinReminder | null {
  const state = attendanceStateOf(contract, session, now);
  if (state !== "ticket_ready" && state !== "checkin_open") return null;
  const channel = checkinChannelOf(session.auction_format);
  if (!channel) return null;

  const startsAt = new Date(session.starts_at);
  if (startsAt.getTime() - now.getTime() > CHECKIN_REMINDER_HORIZON_MS) return null;

  const { opensAt, closesAt } = checkinWindowOf(session);
  return { phase: state === "checkin_open" ? "open" : "upcoming", channel, opensAt, closesAt, startsAt };
}

/** "3 giờ 20 phút" / "45 phút" / "dưới 1 phút" — khoảng cách tới một mốc. */
export function formatDurationVi(ms: number): string {
  const totalMin = Math.floor(Math.max(ms, 0) / 60_000);
  if (totalMin < 1) return "dưới 1 phút";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} phút`;
  return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
}
