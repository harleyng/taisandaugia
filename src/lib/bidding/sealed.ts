// Bỏ phiếu kín phía client — BẢN SAO các chốt của submit_sealed_bid
// (20261018190000_descending_sealed_methods.sql). Sửa một bên phải sửa cả bên kia.
//
// Mỗi người MỘT phiếu mỗi vòng, không sửa. Vòng 1: giá ≥ giá khởi điểm. Vòng phụ
// (round_no ≥ 2): chỉ số báo danh trong tied_bidder_nos, giá ≥ tie_amount. Mọi
// giá nằm trên lưới giá khởi điểm + k × bước giá.
//
// THỨ TỰ KIỂM TRA:
//   not_authenticated → lot_not_found → method_mismatch → session_not_live → lot_not_open
//   → round_closed → lot_paused → lot_closed → not_eligible → lot_not_registered
//   → not_in_tie_round → already_submitted → invalid_nonce → bid_too_low → bid_step_mismatch

import { lotGateOf, nonceInvalid, type BidLot, type BidRejectReason, type ValidateBidInput } from "./rules";
import type { LotState, SealedBid } from "@/types/auction-bidding";

type RoundState = Pick<LotState, "round_no" | "tie_amount" | "tied_bidder_nos">;

export const isTieRound = (state: RoundState | null) => (state?.round_no ?? 1) > 1;

/** Giá phiếu nhỏ nhất của vòng hiện tại. */
export function sealedMinBid(state: RoundState | null, lot: BidLot | null): number | null {
  if (!lot || lot.starting_price == null) return null;
  return isTieRound(state) && state?.tie_amount != null ? state.tie_amount : lot.starting_price;
}

/** Người này được nộp ở vòng hiện tại không (vòng 1: mọi người đủ điều kiện). */
export function inCurrentRound(state: RoundState | null, bidderNo: number | null): boolean {
  if (!isTieRound(state)) return true;
  return bidderNo != null && (state?.tied_bidder_nos ?? []).includes(bidderNo);
}

/** Phiếu của chính mình ở một vòng (RLS trả phiếu mình + các vòng đã công bố). */
export function myRoundBid(bids: SealedBid[], contractId: string | null, roundNo: number): SealedBid | null {
  if (!contractId) return null;
  return bids.find((b) => b.contract_id === contractId && b.round_no === roundNo) ?? null;
}

/** Phiếu theo vòng, vòng mới trước; trong vòng giá cao trước. */
export function groupByRound(bids: SealedBid[]): { roundNo: number; bids: SealedBid[] }[] {
  const map = new Map<number, SealedBid[]>();
  for (const b of bids) map.set(b.round_no, [...(map.get(b.round_no) ?? []), b]);
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([roundNo, list]) => ({
      roundNo,
      bids: [...list].sort((x, y) => y.amount - x.amount || Date.parse(x.placed_at) - Date.parse(y.placed_at)),
    }));
}

export const roundLabel = (roundNo: number) => (roundNo > 1 ? `Vòng phụ ${roundNo - 1}` : "Vòng 1");

export interface ValidateSealedInput extends ValidateBidInput {
  /** Đã có phiếu của mình ở vòng hiện tại. */
  alreadySubmitted: boolean;
}

export function validateSealedBid(input: ValidateSealedInput): BidRejectReason | null {
  const gate = lotGateOf(input, "sealed");
  if (gate) return gate;
  const { lot, state, bidderNo, amount, nonce, alreadySubmitted } = input;
  if (!lot || lot.starting_price == null || !lot.bid_step || !state) return "lot_not_found";

  if (!inCurrentRound(state, bidderNo)) return "not_in_tie_round";
  if (alreadySubmitted) return "already_submitted";
  if (nonceInvalid(nonce)) return "invalid_nonce";

  const min = sealedMinBid(state, lot)!;
  if (amount == null || !Number.isFinite(amount) || amount < min) return "bid_too_low";
  if (!Number.isInteger(amount) || (amount - lot.starting_price) % lot.bid_step !== 0) return "bid_step_mismatch";
  return null;
}
