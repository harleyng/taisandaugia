// Đặt giá xuống phía client — BẢN SAO của _descending_price / _lot_open_ends /
// _lot_open_reject / accept_descending_price (20261018190000_descending_sealed_methods.sql).
// Sửa một bên phải sửa cả bên kia. Server vẫn là nguồn sự thật: người dùng bấm
// "Chấp nhận" ở giá họ đang thấy, server ghi GIÁ CỦA SERVER (≤ giá đó vì giá chỉ
// giảm), hoặc trả price_changed nếu đồng hồ client chạy trước.
//
// Giá tại thời điểm t:
//   max(giá sàn, anchor_amount − ⌊(t − anchor_at) / nhịp⌋ × bước giá)
// Tạm dừng: t đứng ở paused_at. Tiếp tục: server dời anchor_at đúng bằng khoảng dừng.
//
// THỨ TỰ KIỂM TRA của accept_descending_price:
//   not_authenticated → lot_not_found → method_mismatch → session_not_live → lot_not_open
//   → lot_paused → lot_closed → not_eligible → lot_not_registered → invalid_nonce → price_changed

import { lotGateOf, nonceInvalid, type BidRejectReason, type ValidateBidInput } from "./rules";
import type { LotState } from "@/types/auction-bidding";

export interface DescendingLot {
  starting_price: number | null;
  bid_step: number | null;
  floor_price: number | null;
}

type PriceState = Pick<LotState, "status" | "paused_at" | "price_anchor_at" | "price_anchor_amount">;

function elapsedSteps(state: PriceState, dropSeconds: number, now: Date): number | null {
  if (!state.price_anchor_at || dropSeconds <= 0) return null;
  const anchor = Date.parse(state.price_anchor_at);
  const at = state.status === "paused" && state.paused_at ? Date.parse(state.paused_at) : now.getTime();
  if (Number.isNaN(anchor) || Number.isNaN(at)) return null;
  return Math.floor(Math.max(0, at - anchor) / 1000 / dropSeconds);
}

/** Giá đang chào. `null` khi lô chưa mở theo đặt giá xuống (thiếu mốc / thiếu giá sàn). */
export function descendingPriceAt(
  state: PriceState | null,
  lot: DescendingLot,
  dropSeconds: number,
  now: Date,
): number | null {
  if (!state || state.price_anchor_amount == null || lot.floor_price == null || !lot.bid_step) return null;
  const steps = elapsedSteps(state, dropSeconds, now);
  if (steps == null) return null;
  return Math.max(lot.floor_price, state.price_anchor_amount - steps * lot.bid_step);
}

/** Mốc giảm giá kế tiếp; `null` khi đang tạm dừng hoặc đã chạm giá sàn. */
export function nextDropAt(state: PriceState | null, lot: DescendingLot, dropSeconds: number, now: Date): Date | null {
  if (!state || state.status !== "open" || !state.price_anchor_at) return null;
  const price = descendingPriceAt(state, lot, dropSeconds, now);
  if (price == null || lot.floor_price == null || price <= lot.floor_price) return null;
  const steps = elapsedSteps(state, dropSeconds, now) ?? 0;
  return new Date(Date.parse(state.price_anchor_at) + (steps + 1) * dropSeconds * 1000);
}

/** Số lần giảm còn lại tới giá sàn. */
export function dropsLeft(price: number | null, lot: DescendingLot): number | null {
  if (price == null || lot.floor_price == null || !lot.bid_step) return null;
  return Math.max(0, Math.round((price - lot.floor_price) / lot.bid_step));
}

/** Thời lượng lô: hạ hết tới giá sàn rồi giữ giá sàn thêm một nhịp. */
export function descendingDurationSeconds(lot: DescendingLot, dropSeconds: number): number | null {
  if (lot.starting_price == null || lot.floor_price == null || !lot.bid_step) return null;
  return ((lot.starting_price - lot.floor_price) / lot.bid_step + 1) * dropSeconds;
}

/** Bản TS của `LEAST(session.ends_at, now + thời lượng)` khi mở lô đặt giá xuống. */
export function previewDescendingEndsAt(
  now: Date,
  lot: DescendingLot,
  dropSeconds: number,
  sessionEndsAt: string,
): { endsAt: string; clamped: boolean } | null {
  const duration = descendingDurationSeconds(lot, dropSeconds);
  const sessionEnd = Date.parse(sessionEndsAt);
  if (duration == null || Number.isNaN(sessionEnd)) return null;
  const candidate = now.getTime() + duration * 1000;
  return { endsAt: new Date(Math.min(candidate, sessionEnd)).toISOString(), clamped: candidate > sessionEnd };
}

/**
 * Câu lỗi của giá sàn (khớp _lot_open_reject). `null` = hợp lệ.
 * Chưa có giá khởi điểm / bước giá thì chưa kiểm được — trả null.
 */
export function floorPriceError(
  startingPrice: number | null,
  bidStep: number | null,
  floor: number | null,
): string | null {
  if (floor == null) return "Đặt giá xuống cần giá sàn.";
  if (!Number.isInteger(floor) || floor <= 0) return "Giá sàn phải là số nguyên dương.";
  if (startingPrice == null || !bidStep) return null;
  if (floor > startingPrice) return "Giá sàn không được cao hơn giá khởi điểm.";
  if ((startingPrice - floor) % bidStep !== 0) return "Giá sàn phải cách giá khởi điểm một số tròn bước giá.";
  return null;
}

/** Chốt trước khi gọi accept_descending_price — mọi lý do trừ price_changed (chỉ server biết). */
export function validateAccept(input: Omit<ValidateBidInput, "amount">): BidRejectReason | null {
  const gate = lotGateOf(input, "descending");
  if (gate) return gate;
  if (nonceInvalid(input.nonce)) return "invalid_nonce";
  return null;
}
