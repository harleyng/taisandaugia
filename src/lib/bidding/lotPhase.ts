// Giai đoạn của một LÔ trong phiên đấu giá trực tuyến — suy diễn từ dòng
// auction_lot_states + giờ máy chủ.
//
// KHÁC sessionPhaseOf() (src/lib/auctionSessions/phase.ts): hàm đó nói về cả
// PHIÊN theo mốc thời gian đã công bố, còn đây nói về một lô đang được điều hành.
//
// Hai điểm bắt buộc đúng:
//   1. KHÔNG có dòng trạng thái ⇒ lô đang `pending`. Dòng chỉ được tạo lười bởi
//      org_open_lot / org_withdraw_lot, nên `null` là trạng thái hợp lệ chứ
//      không phải "chưa tải xong".
//   2. Lô `open` đã quá ends_at phải hiện là ĐÃ ĐÓNG ngay, không chờ pg_cron.
//      place_bid cũng tự đóng lười rồi trả `lot_closed` (20260913000001:869-874),
//      nên hiện "đang trả giá" lúc này là bày ra một ô nhập chắc chắn lỗi.

import type { LotState } from "@/types/auction-bidding";

export type LotPhase = "pending" | "open" | "extended" | "paused" | "closed" | "withdrawn";

export const LOT_PHASE_LABELS: Record<LotPhase, string> = {
  pending: "Chưa mở",
  open: "Đang trả giá",
  extended: "Đang trả giá (đã gia hạn)",
  paused: "Tạm dừng",
  closed: "Đã đóng",
  withdrawn: "Đã rút",
};

/**
 * Bản TS của lot_is_open() trong SQL — hàm đó bị REVOKE khỏi anon/authenticated
 * (20260913000001:681) nên client không gọi được, phải tự tính.
 */
export function lotIsOpen(state: LotState | null, now: Date = new Date()): boolean {
  if (!state || state.status !== "open" || !state.ends_at) return false;
  const ends = Date.parse(state.ends_at);
  return !Number.isNaN(ends) && now.getTime() < ends;
}

export function lotPhaseOf(state: LotState | null, now: Date = new Date()): LotPhase {
  if (!state) return "pending";
  if (state.status === "withdrawn") return "withdrawn";
  if (state.status === "closed") return "closed";
  if (state.status === "pending") return "pending";
  if (state.status === "paused") return "paused";

  // Còn lại là 'open': hết giờ thì coi như đã đóng dù cron chưa chạy.
  if (!lotIsOpen(state, now)) return "closed";
  // `extended` là trạng thái DẪN XUẤT, không phải cột trong DB.
  return state.extension_count > 0 ? "extended" : "open";
}

/**
 * Số mili-giây còn lại trước khi lô đóng. `null` khi lô chưa có mốc đóng (chưa
 * mở / đã rút). Không bao giờ âm — hết giờ trả về 0.
 */
export function remainingMs(state: LotState | null, now: Date = new Date()): number | null {
  if (!state?.ends_at) return null;
  const ends = Date.parse(state.ends_at);
  if (Number.isNaN(ends)) return null;
  return Math.max(0, ends - now.getTime());
}

/** Lô đang nhận được lượt trả giá mới (dùng để bật/tắt ô nhập). */
export function lotAcceptsBids(state: LotState | null, now: Date = new Date()): boolean {
  const phase = lotPhaseOf(state, now);
  return phase === "open" || phase === "extended";
}
