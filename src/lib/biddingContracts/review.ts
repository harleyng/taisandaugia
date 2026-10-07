// Tổ chức được duyệt / yêu cầu bổ sung / từ chối một hồ sơ tham gia hay không.
//
// BẢN SAO PHÍA CLIENT của hai cổng ở DB — sửa một bên phải sửa cả bên kia:
//   1. org_review_bidding_contract (20261008100200): hồ sơ đã trả, phiên đang
//      công bố, và bảng chuyển trạng thái v_ok.
//   2. trigger auction_bidding_contracts_review_lock (20261008100300): khoá duyệt
//      khi người đó đã điểm danh hoặc danh sách điểm danh đã chốt.
// Server vẫn là nguồn sự thật; đây chỉ để không bày nút mà DB chắc chắn từ chối.

import type { ContractStatus, ReviewDecision, ReviewStatus } from "@/types/bidding-contract";
import type { SessionPublishStatus } from "@/lib/auctionSessions/phase";

export interface ReviewableContract {
  status: ContractStatus;
  review_status: ReviewStatus;
  checked_in_at: string | null;
  absent_at: string | null;
  auction_sessions: { status: SessionPublishStatus; roster_closed_at: string | null } | null;
}

export interface ReviewActions {
  decisions: ReviewDecision[];
  /** Vì sao không còn thao tác nào — null khi còn thao tác. */
  blockedNote: string | null;
}

/** Bảng chuyển trạng thái của org_review_bidding_contract (v_ok). */
const TRANSITIONS: Record<ReviewStatus, ReviewDecision[]> = {
  pending: ["approved", "needs_info", "rejected"],
  needs_info: ["approved", "rejected"],
  approved: ["needs_info", "rejected"],
  rejected: [],
};

const blocked = (note: string): ReviewActions => ({ decisions: [], blockedNote: note });

export function reviewActionsFor(c: ReviewableContract): ReviewActions {
  if (c.status === "refunded" || c.review_status === "rejected") {
    return blocked("Hồ sơ đã bị từ chối và hoàn tiền hồ sơ — không duyệt lại được.");
  }
  if (c.status !== "paid") return blocked("Chỉ duyệt hồ sơ đã thanh toán.");
  if (c.auction_sessions?.status !== "published") return blocked("Phiên không còn công bố — không duyệt hồ sơ.");
  if (c.checked_in_at) return blocked("Người tham gia đã điểm danh — kết quả duyệt đã khoá.");
  if (c.absent_at || c.auction_sessions.roster_closed_at) {
    return blocked("Danh sách điểm danh đã chốt — kết quả duyệt đã khoá.");
  }
  return { decisions: TRANSITIONS[c.review_status], blockedNote: null };
}

/** Quyết định nào bắt buộc ghi lý do (CHECK abc_review_note_shape: ≥ 3 ký tự). */
export const decisionNeedsNote = (d: ReviewDecision) => d !== "approved";

export const REVIEW_NOTE_MIN = 3;
