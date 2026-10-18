// Cách phòng điều hành (design pdg-ops `controlTab`) gọi tên & tô màu từng lô.
//
// Tách khỏi JSX vì cả thanh tiến độ, sân khấu, hàng đợi lô và danh sách kết quả
// đều phải đọc CÙNG một khoá — lệch một chỗ là thanh màu nói "đã trúng" còn hàng
// đợi nói "đang trả giá".

import { lotPhaseOf } from "./lotPhase";
import type { LotState } from "@/types/auction-bidding";

export type LotViewKey = "wait" | "live" | "paused" | "tied" | "won" | "unsold" | "pulled" | "closed";

export const LOT_VIEW_LABELS: Record<LotViewKey, string> = {
  wait: "Chờ đấu",
  live: "Đang trả giá",
  paused: "Tạm dừng",
  tied: "Bằng giá",
  won: "Đã trúng",
  unsold: "Không thành",
  pulled: "Đã rút",
  closed: "Đã đóng",
};

export function lotViewKeyOf(state: LotState | null, now: Date): LotViewKey {
  switch (lotPhaseOf(state, now)) {
    case "pending":
      return "wait";
    case "open":
    case "extended":
      return "live";
    case "paused":
      return "paused";
    case "tied":
      return "tied";
    case "withdrawn":
      return "pulled";
    case "closed":
      return state?.result === "sold" ? "won" : state?.result === "unsold" ? "unsold" : "closed";
  }
}

/** Lô "xong" theo design: đã trúng / không thành / đã rút (cả lô đóng chưa có kết quả). */
export const isLotDone = (k: LotViewKey) => k === "won" || k === "unsold" || k === "pulled" || k === "closed";

/** "1 giờ 30 phút" / "12 phút" — thời gian còn lại của PHIÊN ở thanh trạng thái. */
export function formatSessionRemaining(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(m / 60);
  return `${h ? `${h} giờ ` : ""}${m % 60} phút`;
}

/**
 * Số mili-giây còn lại của lô ĐANG TẠM DỪNG: ends_at chưa được cộng bù nên
 * phải đo tới lúc dừng, không tới bây giờ — "Đồng hồ dừng ở".
 */
export function pausedRemainingMs(state: LotState | null): number | null {
  if (!state?.ends_at || !state.paused_at) return null;
  const ms = Date.parse(state.ends_at) - Date.parse(state.paused_at);
  return Number.isNaN(ms) ? null : Math.max(0, ms);
}
