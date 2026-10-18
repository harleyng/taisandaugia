// Khung trả giá của phòng đấu giá có hiện không, và câu chặn theo trạng thái —
// theo phương thức. Tách khỏi JSX để LotActionArea chỉ còn component.

import { biddingReasonMessage } from "./errors";
import type { LotPhase } from "./lotPhase";
import type { BiddingMethod } from "./methods";
import { isLivePhase } from "./roomView";
import { lotGateOf, validateBid, type BidRejectReason, type BidSession } from "./rules";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";

/** Mã từ chối nói về trạng thái lô/phiên — thay khung trả giá bằng một câu thông báo. */
const STATE_REASONS = new Set<BidRejectReason>([
  "lot_not_found",
  "lot_not_configured",
  "method_mismatch",
  "session_not_live",
  "lot_not_open",
  "lot_paused",
  "lot_closed",
]);

interface Input {
  method: BiddingMethod;
  lot: AuctionSessionItem;
  state: LotState | null;
  phase: LotPhase;
  bidSession: BidSession;
  bidderNo: number;
  canBid: boolean;
  userId: string;
  now: Date;
}

/**
 * Khung trả giá có hiện không + câu chặn theo trạng thái. Trả giá lên: `bid_too_low`
 * khi CHƯA nhập số nghĩa là mọi điều kiện khác đã đạt; hai phương thức kia dùng
 * cổng chung (lotGateOf) — điều kiện riêng (đã nộp phiếu, ngoài vòng phụ) do panel tự nói.
 */
export function lotActionGate({ method, lot, state, phase, bidSession, bidderNo, canBid, userId, now }: Input) {
  const input = { lot, state, session: bidSession, bidderNo, eligible: canBid, userId, now };
  const gate = method === "ascending" ? validateBid({ ...input, amount: null }) : lotGateOf(input, method);
  const passed = method === "ascending" ? gate === "bid_too_low" : gate === null;
  return {
    show: canBid && isLivePhase(phase) && passed,
    stateMessage: isLivePhase(phase) && gate && STATE_REASONS.has(gate) ? biddingReasonMessage(gate) : null,
  };
}
