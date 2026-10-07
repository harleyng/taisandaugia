import { useAuth } from "@/contexts/AuthContext";
import { useMySessionContract } from "@/hooks/useBiddingContracts";
import { bidderBlockReasonOf, type BidderBlockReason } from "@/lib/bidding/bidderReason";
import type { BiddingContract } from "@/types/bidding-contract";

/**
 * Người đang xem có được trả giá trong phiên này không, và nếu không thì vướng ở đâu.
 * Thứ tự nhánh nằm ở bidderBlockReasonOf (thuần, có test).
 *
 * Dùng lại useMySessionContract nên KHÔNG thêm query key mới.
 */

export { BIDDER_BLOCK_MESSAGES, type BidderBlockReason } from "@/lib/bidding/bidderReason";

export interface MyBidderStatus {
  loading: boolean;
  eligible: boolean;
  /** `null` khi đủ điều kiện. */
  reason: BidderBlockReason | null;
  bidderNo: number | null;
  contract: BiddingContract | null;
}

export function useMyBidderStatus(sessionId?: string | null): MyBidderStatus {
  const { userId, loading: authLoading } = useAuth();
  const { data: contract, isLoading } = useMySessionContract(sessionId ?? undefined);

  if (!userId) {
    return {
      loading: authLoading,
      eligible: false,
      reason: "login_required",
      bidderNo: null,
      contract: null,
    };
  }

  const loading = authLoading || isLoading;
  const base = { loading, eligible: false, bidderNo: contract?.bidder_no ?? null, contract: contract ?? null };

  if (loading) return { ...base, reason: null };
  const reason = bidderBlockReasonOf(contract ?? null);
  return { ...base, eligible: reason === null, reason };
}
