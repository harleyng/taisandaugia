import { useAuth } from "@/contexts/AuthContext";
import { useMySessionContract } from "@/hooks/useBiddingContracts";
import type { BiddingContract } from "@/types/bidding-contract";

/**
 * Người đang xem có được trả giá trong phiên này không, và nếu không thì vướng ở đâu.
 *
 * BẢN SAO PHÍA CLIENT của chốt `not_eligible` trong place_bid
 * (20260913000001:776-778): hồ sơ status='paid' + có bidder_no +
 * deposit_status='received'. Server chỉ trả một mã `not_eligible` duy nhất cho
 * cả ba trường hợp; tách ra ở đây để EligibilityGate nói đúng việc cần làm tiếp.
 *
 * Dùng lại useMySessionContract nên KHÔNG thêm query key mới.
 *
 * `settled` / `refunded` KHÔNG phải mã của server: server chỉ biết not_eligible.
 * Chúng tách ra khỏi `no_deposit` vì sau org_finalize_session mọi người đã nộp
 * tiền đều rời khỏi 'received' (sang applied / pending_refund), mà câu "chưa ghi
 * nhận tiền đặt trước" thì sai sự thật với họ. roomGateOf đọc hai mã này để giữ
 * họ trong phòng ở chế độ chỉ xem.
 */

export type BidderBlockReason =
  | "login_required"
  | "no_contract"
  | "unpaid"
  | "no_deposit"
  | "settled"
  | "refunded"
  | "no_bidder_no";

export const BIDDER_BLOCK_MESSAGES: Record<BidderBlockReason, string> = {
  login_required: "Vui lòng đăng nhập để vào phòng đấu giá.",
  no_contract: "Bạn chưa mua hồ sơ tham gia phiên đấu giá này.",
  unpaid: "Hồ sơ tham gia của bạn chưa được thanh toán.",
  no_deposit: "Tổ chức đấu giá chưa ghi nhận tiền đặt trước của bạn.",
  settled: "Phiên đã chốt kết quả — không còn nhận trả giá.",
  refunded: "Tổ chức đấu giá đã hoàn trả tiền đặt trước của bạn.",
  no_bidder_no: "Bạn chưa được cấp số báo danh. Vui lòng liên hệ tổ chức đấu giá.",
};

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
  if (!contract) return { ...base, reason: "no_contract" };
  if (contract.status !== "paid") return { ...base, reason: "unpaid" };
  switch (contract.deposit_status) {
    case "received":
      break;
    // Phiên đã chốt: tiền đặt trước thành tiền mua tài sản hoặc chờ hoàn trả.
    case "applied":
    case "pending_refund":
      return { ...base, reason: "settled" };
    case "refunded":
      return { ...base, reason: "refunded" };
    // 'forfeited' tới đây được về lý thuyết, nhưng roomGateOf bắt nó trước.
    default:
      return { ...base, reason: "no_deposit" };
  }
  if (contract.bidder_no == null) return { ...base, reason: "no_bidder_no" };

  return { ...base, eligible: true, reason: null };
}
