// Trạng thái dự phiên của một hồ sơ tham gia: duyệt hồ sơ → tiền đặt trước →
// phiếu dự phiên → điểm danh / vắng.
//
// BẢN SAO PHÍA CLIENT của _checkin_block_reason
// (supabase/migrations/20261008100300_session_checkin.sql), cùng thứ tự kiểm — sửa
// một bên phải sửa cả bên kia. Server vẫn là nguồn sự thật; đây chỉ để hiện đúng
// thẻ / nút trên hồ sơ của người mua (như ctaState.ts).
//
// Kiểu đầu vào là cấu trúc tối thiểu để test và ContractWithSession /
// CheckinLookupMatch đều truyền thẳng vào được.

import type { SessionPublishStatus } from "@/lib/auctionSessions/phase";
import type { AuctionFormat } from "@/types/asset-posting";
import type { ContractStatus, DepositStatus, ReviewStatus } from "@/types/bidding-contract";
import { checkinChannelOf, checkinWindowPhase, type CheckinWindowSession } from "./checkinWindow";

export type AttendanceState =
  | "awaiting_review"
  | "needs_info"
  | "rejected"
  | "awaiting_deposit"
  | "ticket_ready"
  | "checkin_open"
  | "checked_in"
  | "absent"
  | "excused";

export interface AttendanceContract {
  status: ContractStatus;
  review_status: ReviewStatus;
  deposit_status: DepositStatus;
  checked_in_at: string | null;
  absent_at: string | null;
  absence_excused_at: string | null;
}

export interface AttendanceSession extends CheckinWindowSession {
  status: SessionPublishStatus;
  auction_format: AuctionFormat | null;
  roster_closed_at?: string | null;
}

/**
 * null = hồ sơ không có gì để hiện về dự phiên: chưa thanh toán / đã huỷ, phiên
 * không còn công bố, hình thức "cả hai" (tạm bỏ), tiền đặt trước đã xử lý theo
 * đường khác, hoặc phiên đã chốt danh sách mà hồ sơ không bị đánh vắng (chốt
 * hồi tố phiên cũ — không phạt ai).
 */
export function attendanceStateOf(
  contract: AttendanceContract,
  session: AttendanceSession,
  now: Date = new Date(),
): AttendanceState | null {
  if (contract.status === "refunded" || contract.review_status === "rejected") return "rejected";
  if (contract.status !== "paid") return null;

  // Đã điểm danh / đã bị đánh vắng là sự thật đã ghi — hiện kể cả khi phiên đổi trạng thái.
  if (contract.checked_in_at) return "checked_in";
  if (contract.absent_at) return contract.absence_excused_at ? "excused" : "absent";

  if (session.status !== "published") return null;
  if (!checkinChannelOf(session.auction_format)) return null;
  if (session.roster_closed_at) return null;

  if (contract.review_status === "pending") return "awaiting_review";
  if (contract.review_status === "needs_info") return "needs_info";

  if (contract.deposit_status === "pending") return "awaiting_deposit";
  if (contract.deposit_status !== "received") return null;

  const phase = checkinWindowPhase(session, now);
  if (phase === "before") return "ticket_ready";
  if (phase === "open") return "checkin_open";
  // Quá giờ mà cron chưa kịp chốt (≤ 1 phút): kết cục đã định là vắng.
  return "absent";
}

export const ATTENDANCE_STATE_LABELS: Record<AttendanceState, string> = {
  awaiting_review: "Chờ tổ chức duyệt hồ sơ",
  needs_info: "Cần bổ sung hồ sơ",
  rejected: "Hồ sơ bị từ chối",
  awaiting_deposit: "Chờ xác nhận tiền đặt trước",
  ticket_ready: "Đã có phiếu dự phiên",
  checkin_open: "Đang mở điểm danh",
  checked_in: "Đã điểm danh",
  absent: "Vắng mặt",
  excused: "Vắng mặt có lý do",
};
