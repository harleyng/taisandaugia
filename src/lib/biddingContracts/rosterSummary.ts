// Chốt danh sách điểm danh + cảnh báo "dưới 2 người có mặt" (S6).
//
// closeRosterBlockOf là BẢN SAO PHÍA CLIENT của các nhánh chặn trong
// org_close_roster_now (supabase/migrations/20261008100300_session_checkin.sql)
// — sửa một bên phải sửa cả bên kia. Quyền (dieu-hanh-dau-gia:operate) xét
// riêng ở component; server vẫn là cổng thật.

import type { AuctionFormat } from "@/types/asset-posting";
import type { CheckinSummary } from "@/types/bidding-contract";
import { checkinChannelOf, checkinWindowPhase, type CheckinWindowSession } from "./checkinWindow";

/** Phiên cần ít nhất 2 người có mặt mới cạnh tranh được. */
export const MIN_PRESENT = 2;

export type RosterAlertLevel = "critical" | "warning";

export interface RosterAlert {
  level: RosterAlertLevel;
  title: string;
  body: string;
}

type SummaryCounts = Pick<CheckinSummary, "eligible" | "checked_in" | "awaiting" | "roster_closed_at">;

const LEGAL_HINT =
  "Đấu giá viên xử lý theo quy định về trường hợp chỉ có một người tham gia cuộc đấu giá, hoặc lập biên bản đấu giá không thành.";

const presentText = (n: number) => (n === 0 ? "Không có ai" : `Chỉ có ${n} người`);

/**
 * Cảnh báo theo số đếm công khai (auction_session_checkin_summary):
 * - đã chốt + có mặt < 2 ⇒ critical;
 * - đang mở / hết giờ chờ chốt: kể cả mọi người còn lại điểm danh vẫn < 2 ⇒
 *   critical; mới có < 2 người điểm danh ⇒ warning;
 * - chưa mở: số người đủ điều kiện < 2 ⇒ warning (còn kịp duyệt hồ sơ / ghi
 *   nhận tiền đặt trước).
 */
export function rosterAlertOf(
  summary: SummaryCounts,
  session: CheckinWindowSession,
  now: Date = new Date(),
): RosterAlert | null {
  const { checked_in, awaiting, eligible } = summary;

  if (summary.roster_closed_at) {
    if (checked_in >= MIN_PRESENT) return null;
    return {
      level: "critical",
      title: `${presentText(checked_in)} có mặt`,
      body: `Danh sách đã chốt với dưới ${MIN_PRESENT} người có mặt. ${LEGAL_HINT}`,
    };
  }

  if (checkinWindowPhase(session, now) === "before") {
    if (eligible >= MIN_PRESENT) return null;
    return {
      level: "warning",
      title: `Mới có ${eligible} người đủ điều kiện điểm danh`,
      body: "Người đủ điều kiện = hồ sơ đã duyệt và đã ghi nhận tiền đặt trước. Kiểm tra hồ sơ chờ duyệt và tiền đặt trước trước giờ mở điểm danh.",
    };
  }

  if (checked_in >= MIN_PRESENT) return null;
  if (checked_in + awaiting < MIN_PRESENT) {
    return {
      level: "critical",
      title: `Tối đa ${checked_in + awaiting} người có mặt`,
      body: `Kể cả khi mọi người còn lại đều điểm danh, phiên vẫn dưới ${MIN_PRESENT} người. ${LEGAL_HINT}`,
    };
  }
  return {
    level: "warning",
    title: `Mới có ${checked_in} người điểm danh`,
    body: `Cần ít nhất ${MIN_PRESENT} người có mặt. Còn ${awaiting} người chưa điểm danh.`,
  };
}

export type CloseRosterBlock = "closed" | "not_published" | "format_unsupported" | "too_early";

export interface CloseRosterSession extends CheckinWindowSession {
  status: string;
  auction_format: AuctionFormat | null;
  roster_closed_at: string | null;
}

/** null = được chốt sớm ngay; ngược lại là lý do ẩn / khoá nút. */
export function closeRosterBlockOf(s: CloseRosterSession, now: Date = new Date()): CloseRosterBlock | null {
  if (s.status !== "published") return "not_published";
  if (!checkinChannelOf(s.auction_format)) return "format_unsupported";
  if (s.roster_closed_at) return "closed";
  if (now.getTime() < Date.parse(s.starts_at)) return "too_early";
  return null;
}
