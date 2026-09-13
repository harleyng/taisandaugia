// Luật trả giá lên (ascending) phía client.
//
// BẢN SAO PHÍA CLIENT của các chốt trong place_bid
// (supabase/migrations/20260913000001_online_bidding.sql:698-803) — sửa một bên
// phải sửa cả bên kia. Server vẫn là nguồn sự thật; đây chỉ để không bày ra một
// ô nhập chắc chắn lỗi, và để báo sai ngay khi người dùng đang gõ.
//
// THỨ TỰ KIỂM TRA là chuẩn tắc, chép đúng comment của place_bid (:698-702):
//   not_authenticated → lot_not_found → session_not_live → lot_not_open
//   → lot_paused → lot_closed → not_eligible → already_leading → invalid_nonce
//   → bid_too_low → bid_step_mismatch → bid_too_many_steps
//
// Số học: mọi số tiền là SỐ NGUYÊN VNĐ (cột NUMERIC(18,0)).

import { lotIsOpen } from "./lotPhase";
import type { LotState } from "@/types/auction-bidding";
import type { SessionPublishStatus } from "@/lib/auctionSessions/phase";

/** Mã từ chối. `lot_not_configured` là của org_open_lot, client dùng lại để
 *  giải thích lô thiếu giá khởi điểm / bước giá thay vì báo chung chung. */
export type BidRejectReason =
  | "not_authenticated"
  | "lot_not_found"
  | "lot_not_configured"
  | "session_not_live"
  | "lot_not_open"
  | "lot_paused"
  | "lot_closed"
  | "not_eligible"
  | "already_leading"
  | "invalid_nonce"
  | "bid_too_low"
  | "bid_step_mismatch"
  | "bid_too_many_steps";

/** Lô: ảnh chụp giá trong auction_session_items. */
export interface BidLot {
  starting_price: number | null;
  bid_step: number | null;
}

/** Phiên: chỉ những cột quyết định việc trả giá. */
export interface BidSession {
  status: SessionPublishStatus;
  auction_format: string;
  starts_at: string;
  max_bid_steps: number;
}

export interface ValidateBidInput {
  amount: number | null;
  lot: BidLot | null;
  state: LotState | null;
  session: BidSession;
  /** Số báo danh của người đang xem; null = chưa đủ điều kiện trả giá. */
  bidderNo: number | null;
  /** Hồ sơ đã thanh toán + đã nộp tiền đặt trước + đã có số báo danh. */
  eligible: boolean;
  userId: string | null;
  /** client_nonce sẽ gửi kèm; SQL đòi độ dài 8–100. */
  nonce?: string;
  now?: Date;
}

const NONCE_MIN = 8;
const NONCE_MAX = 100;

/** Phiên đang cho phép trả giá (bỏ qua ends_at — mốc đóng nằm ở từng lô). */
function sessionIsLive(session: BidSession, now: Date): boolean {
  if (session.status !== "published") return false;
  if (session.auction_format !== "truc_tuyen" && session.auction_format !== "ca_hai") return false;
  const starts = Date.parse(session.starts_at);
  return !Number.isNaN(starts) && now.getTime() >= starts;
}

/**
 * Giá hợp lệ NHỎ NHẤT cho lượt kế tiếp.
 * Lượt đầu = ĐÚNG giá khởi điểm (không phải giá khởi điểm + 1 bước).
 */
export function nextMinBid(state: LotState | null, lot: BidLot | null): number | null {
  if (!lot || lot.starting_price == null || !lot.bid_step) return null;
  return state?.current_price == null ? lot.starting_price : state.current_price + lot.bid_step;
}

/**
 * Giá hợp lệ LỚN NHẤT. `max_bid_steps` tính CẢ lượt đang trả là bước thứ 1,
 * nên trần là min + (n − 1) bước.
 */
export function maxBid(state: LotState | null, lot: BidLot | null, maxBidSteps: number): number | null {
  const min = nextMinBid(state, lot);
  if (min == null || !lot?.bid_step) return null;
  return min + (maxBidSteps - 1) * lot.bid_step;
}

/**
 * `null` = hợp lệ. Ngược lại trả ĐÚNG chuỗi reason mà SQL sẽ trả về, để câu
 * chữ hiện ra lúc gõ và lúc server từ chối là một.
 */
export function validateBid(input: ValidateBidInput): BidRejectReason | null {
  const { amount, lot, state, session, bidderNo, eligible, userId, nonce, now = new Date() } = input;

  if (!userId) return "not_authenticated";
  if (!lot) return "lot_not_found";
  if (lot.starting_price == null || !lot.bid_step || lot.bid_step <= 0) return "lot_not_configured";
  if (!sessionIsLive(session, now)) return "session_not_live";

  if (!state || state.status === "pending" || state.status === "withdrawn") return "lot_not_open";
  if (state.status === "paused") return "lot_paused";
  if (!lotIsOpen(state, now)) return "lot_closed";

  if (!eligible || bidderNo == null) return "not_eligible";
  if (state.current_bid_id && state.leading_bidder_no === bidderNo) return "already_leading";
  if (nonce !== undefined && (nonce.length < NONCE_MIN || nonce.length > NONCE_MAX)) return "invalid_nonce";

  const min = nextMinBid(state, lot)!;
  const max = maxBid(state, lot, session.max_bid_steps)!;

  if (amount == null || !Number.isFinite(amount) || amount < min) return "bid_too_low";
  // Mốc chia hết là GIÁ KHỞI ĐIỂM, không phải giá hiện tại: mọi lượt hợp lệ đều
  // nằm trên lưới starting_price + k·bid_step.
  if (!Number.isInteger(amount) || (amount - lot.starting_price) % lot.bid_step !== 0) {
    return "bid_step_mismatch";
  }
  if (amount > max) return "bid_too_many_steps";

  return null;
}

/**
 * Các mốc bấm nhanh "+1 / +2 / +5 bước" cho BidPanel. Bước thứ k = min +
 * (k − 1)·bid_step; mốc vượt trần bị loại bỏ thay vì kẹp lại, để không hiện hai
 * nút cùng một số tiền.
 */
export function quickSteps(
  state: LotState | null,
  lot: BidLot | null,
  maxBidSteps: number,
  steps: number[] = [1, 2, 5],
): { steps: number; amount: number }[] {
  const min = nextMinBid(state, lot);
  const max = maxBid(state, lot, maxBidSteps);
  if (min == null || max == null || !lot?.bid_step) return [];
  return steps
    .map((k) => ({ steps: k, amount: min + (k - 1) * lot.bid_step! }))
    .filter((s) => s.amount <= max);
}
