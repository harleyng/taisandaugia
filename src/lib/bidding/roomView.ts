// Số liệu HIỂN THỊ của phòng đấu giá (design "Phong Dau Gia - Redesign").
//
// Hàm thuần, nhận `now` là giờ MÁY CHỦ (useServerNow) — không gọi Date.now().
// Luật trả giá nằm ở rules.ts, giai đoạn lô ở lotPhase.ts; file này chỉ gom
// những phép tính mà bảng giá / cột tài sản / thẻ thông báo cùng cần.

import { groupNumber } from "@/lib/advertising/slug";
import { lotPhaseOf, type LotPhase } from "./lotPhase";
import { descendingPriceAt } from "./descending";
import type { BiddingMethod } from "./methods";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";

/** Ngưỡng tô màu đồng hồ của design: ≤ 5 phút vàng, ≤ 60 giây đỏ. */
export type RoomUrgency = "normal" | "soon" | "urgent";

export function roomUrgency(ms: number | null): RoomUrgency {
  if (ms == null) return "normal";
  if (ms <= 60_000) return "urgent";
  if (ms <= 5 * 60_000) return "soon";
  return "normal";
}

/**
 * Thời gian còn lại lúc bị tạm dừng. org_resume_lot cộng bù khoảng dừng vào
 * ends_at, nên ends_at − paused_at chính là số giây sẽ còn khi mở lại.
 */
export function pausedRemainingMs(state: LotState | null): number | null {
  if (!state?.ends_at || !state.paused_at) return null;
  const ms = Date.parse(state.ends_at) - Date.parse(state.paused_at);
  return Number.isNaN(ms) ? null : Math.max(0, ms);
}

/** Phần trăm thời gian còn lại so với tổng thời lượng lô (tính cả gia hạn). */
export function remainingPercent(state: LotState | null, remaining: number | null): number {
  if (!state?.ends_at || !state.opened_at || remaining == null) return 0;
  const total = Date.parse(state.ends_at) - Date.parse(state.opened_at);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, (remaining / total) * 100);
}

/** Giá đang hiện của lô: giá trúng nếu đã chốt, không thì giá cao nhất, không thì giá khởi điểm. */
export function displayPrice(lot: AuctionSessionItem, state: LotState | null): number | null {
  return state?.winning_amount ?? state?.current_price ?? lot.starting_price;
}

/**
 * Giá hiện theo phương thức. Đặt giá xuống đang mở/tạm dừng: giá đồng hồ.
 * Bỏ phiếu kín chưa đóng: giá kín ⇒ hiện giá khởi điểm (giá sàn của vòng 1).
 */
export function roomDisplayPrice(
  lot: AuctionSessionItem,
  state: LotState | null,
  method: BiddingMethod,
  dropSeconds: number,
  now: Date,
): number | null {
  if (state?.winning_amount != null) return state.winning_amount;
  if (method === "descending" && (state?.status === "open" || state?.status === "paused")) {
    return descendingPriceAt(state, lot, dropSeconds, now) ?? lot.starting_price;
  }
  if (method === "sealed") return state?.tie_amount ?? lot.starting_price;
  return displayPrice(lot, state);
}

/** Lô có ít nhất một lượt hợp lệ còn hiệu lực. */
export const hasLeader = (state: LotState | null) => state?.current_bid_id != null && state.leading_bidder_no != null;

/** Lô đang trả giá, tạm dừng hoặc chờ vòng phụ — mỗi phiên tối đa MỘT lô như vậy (org_open_lot chặn `another_lot_live`). */
export function activeLotOf(lots: AuctionSessionItem[], stateByLot: Map<string, LotState>, now: Date) {
  return (
    lots.find((l) => {
      const p = lotPhaseOf(stateByLot.get(l.id) ?? null, now);
      return p === "open" || p === "extended" || p === "paused" || p === "tied";
    }) ?? null
  );
}

/** Lô "Tiếp theo": lô chưa mở có số thứ tự nhỏ nhất. */
export function nextPendingLotOf(lots: AuctionSessionItem[], stateByLot: Map<string, LotState>, now: Date) {
  return (
    [...lots]
      .sort((a, b) => a.lot_no - b.lot_no)
      .find((l) => lotPhaseOf(stateByLot.get(l.id) ?? null, now) === "pending") ?? null
  );
}

export const isLivePhase = (p: LotPhase) => p === "open" || p === "extended";

/** 2,550,000,000 → "2,550 tr" (chip trả nhanh). */
export const millions = (amount: number) => `${groupNumber(amount / 1_000_000)} tr`;

/** Giờ:phút:giây theo giờ Việt Nam. */
export const clockText = (d: Date | string) =>
  new Date(d).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  });
