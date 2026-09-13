// Đấu giá trực tuyến: trạng thái lô, sổ trả giá, nhật ký, sổ tiền đặt trước,
// biên bản. Bảng + RPC + RLS: supabase/migrations/20260913000001_online_bidding.sql.
//
// Cả 5 bảng đều bị REVOKE INSERT/UPDATE/DELETE khỏi anon + authenticated và
// KHÔNG có một policy ghi nào. Vì vậy type `Insert` / `Update` sinh tự động ở
// integrations/supabase/types.ts là ẢO: compile được nhưng chạy sẽ lỗi quyền.
// Mọi thay đổi đi qua RPC trả `{ ok, reason }` — xem src/lib/bidding/errors.ts.

import type { Tables } from "@/integrations/supabase/types";

export type LotStatus = "pending" | "open" | "paused" | "closed" | "withdrawn";
export type LotResult = "sold" | "unsold";
export type LotPaymentStatus = "pending" | "paid" | "defaulted";

export type LotEventKind =
  | "open"
  | "pause"
  | "resume"
  | "bid"
  | "bid_rejected"
  | "extend"
  | "withdraw_bid"
  | "close"
  | "withdraw_lot"
  | "finalize"
  | "minutes"
  | "payment";

/** `reversed` = tổ chức đưa tiền đặt trước ngược về "chưa nhận". */
export type DepositEventKind =
  | "received"
  | "applied"
  | "pending_refund"
  | "refunded"
  | "forfeited"
  | "reversed";

type LotStateRow = Tables<"auction_lot_states">;
type LotEventRow = Tables<"auction_lot_events">;
type DepositEventRow = Tables<"auction_deposit_events">;

/** Khoá chính là `lot_id`, KHÔNG phải `id`. Không có dòng ⇒ lô đang `pending`. */
export type LotState = Omit<LotStateRow, "status" | "result" | "payment_status"> & {
  status: LotStatus;
  result: LotResult | null;
  payment_status: LotPaymentStatus | null;
};

export type LotBid = Tables<"auction_bids">;
export type LotEvent = Omit<LotEventRow, "kind"> & { kind: LotEventKind };
export type DepositEvent = Omit<DepositEventRow, "kind"> & { kind: DepositEventKind };
export type SessionMinutes = Tables<"auction_session_minutes">;

export const LOT_STATUS_LABELS: Record<LotStatus, string> = {
  pending: "Chưa mở",
  open: "Đang trả giá",
  paused: "Tạm dừng",
  closed: "Đã đóng",
  withdrawn: "Đã rút",
};

export const LOT_RESULT_LABELS: Record<LotResult, string> = {
  sold: "Đấu giá thành",
  unsold: "Không thành",
};

export const LOT_PAYMENT_STATUS_LABELS: Record<LotPaymentStatus, string> = {
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  defaulted: "Không thanh toán",
};

export const LOT_EVENT_LABELS: Record<LotEventKind, string> = {
  open: "Mở lô",
  pause: "Tạm dừng",
  resume: "Tiếp tục",
  bid: "Trả giá",
  bid_rejected: "Trả giá bị từ chối",
  extend: "Gia hạn",
  withdraw_bid: "Rút giá đã trả",
  close: "Đóng lô",
  withdraw_lot: "Rút lô khỏi phiên",
  finalize: "Chốt kết quả phiên",
  minutes: "Phát hành biên bản",
  payment: "Xác nhận thanh toán",
};

export const DEPOSIT_EVENT_LABELS: Record<DepositEventKind, string> = {
  received: "Đã nhận tiền đặt trước",
  applied: "Chuyển vào tiền mua tài sản",
  pending_refund: "Chờ hoàn trả",
  refunded: "Đã hoàn trả",
  forfeited: "Không hoàn trả",
  reversed: "Đảo về chưa nhận",
};

// ─── Envelope của RPC ───────────────────────────────────────────────────────
// types.ts khai mọi RPC này là `Returns: Json` nên không có trợ giúp kiểu nào ở
// compile-time — phải tự khai union rồi ép kiểu ở biên (trong hook).

export interface RpcFail {
  ok: false;
  reason: string;
  [key: string]: unknown;
}

/**
 * `duplicate` = gửi lại đúng `client_nonce` cũ, server trả về lượt đã ghi thay
 * vì tạo lượt mới. CẨN THẬN: nhánh này chạy TRƯỚC kiểm tra phiên còn sống, nên
 * `ok:true` KHÔNG chứng minh phiên đang diễn ra.
 */
export interface PlaceBidOk {
  ok: true;
  bid_id: string;
  seq: number;
  amount: number;
  current_price: number | null;
  ends_at: string | null;
  extended: boolean;
  bidder_no: number;
  duplicate?: true;
}

/** Trả về của org_open_lot — `ends_at` là mốc đóng ĐÃ CHỐT, có thể bị giờ kết
 *  thúc phiên cắt ngắn so với thời lượng người dùng chọn. */
export interface OpenLotOk {
  ok: true;
  ends_at: string;
}

export interface WithdrawBidOk {
  ok: true;
  current_price: number | null;
  leading_bidder_no: number | null;
  deposit_forfeited: boolean;
}

export interface FinalizeSessionOk {
  ok: true;
  finalized_at: string;
  applied: number;
  pending_refund: number;
  sold: number;
  unsold: number;
  withdrawn: number;
}

/**
 * Trả về của org_issue_minutes. `sequence_no` do SERVER cấp (max+1) SAU khi tệp
 * đã nằm trong storage — client không đoán trước được, nên biên bản không in số
 * này lên giấy (xem chú thích đầu src/lib/bidding/minutes-pdf/document.ts).
 */
export interface IssueMinutesOk {
  ok: true;
  id: string;
  sequence_no: number;
}

/** Trả về của org_confirm_winner_payment. `_paid = false` ⇒ tịch thu tiền đặt trước. */
export interface ConfirmWinnerPaymentOk {
  ok: true;
  payment_status: "paid" | "defaulted";
  deposit_forfeited: boolean;
}
