// Vì sao người đang xem chưa vào được phòng đấu giá — phần THUẦN của
// useMyBidderStatus, tách ra để unit test được thứ tự nhánh.
//
// BẢN SAO PHÍA CLIENT của chốt `not_eligible` trong place_bid
// (20260913000001, vá ở 20261008100300): hồ sơ status='paid' + có bidder_no +
// deposit_status='received' + checked_in_at. Server chỉ trả một mã
// `not_eligible` duy nhất; tách ra ở đây để EligibilityGate nói đúng việc cần
// làm tiếp.
//
// `settled` / `refunded` KHÔNG phải mã của server: chúng tách khỏi `no_deposit`
// vì sau org_finalize_session mọi người đã nộp tiền đều rời khỏi 'received'
// (sang applied / pending_refund), mà câu "chưa ghi nhận tiền đặt trước" thì sai
// sự thật với họ. roomGateOf đọc hai mã này để giữ họ trong phòng ở chế độ chỉ xem.
//
// Thứ tự duyệt hồ sơ → tiền đặt trước → điểm danh theo _checkin_block_reason
// (20261008100300): hồ sơ chưa duyệt thì có nộp tiền rồi cũng chưa điểm danh được,
// nên câu "chưa điểm danh" lúc đó là sai việc cần làm.

import type { DepositStatus, ReviewStatus } from "@/types/bidding-contract";

export type BidderBlockReason =
  | "login_required"
  | "no_contract"
  | "unpaid"
  | "review_pending"
  | "review_needs_info"
  | "no_deposit"
  | "settled"
  | "refunded"
  | "absent"
  | "not_checked_in"
  | "no_bidder_no";

export const BIDDER_BLOCK_MESSAGES: Record<BidderBlockReason, string> = {
  login_required: "Vui lòng đăng nhập để vào phòng đấu giá.",
  no_contract: "Bạn chưa mua hồ sơ tham gia phiên đấu giá này.",
  unpaid: "Hồ sơ tham gia của bạn chưa được thanh toán.",
  review_pending: "Hồ sơ tham gia của bạn đang chờ tổ chức đấu giá duyệt.",
  review_needs_info: "Tổ chức đấu giá yêu cầu bạn bổ sung hồ sơ tham gia.",
  no_deposit: "Tổ chức đấu giá chưa ghi nhận tiền đặt trước của bạn.",
  settled: "Phiên đã chốt kết quả — không còn nhận trả giá.",
  refunded: "Tổ chức đấu giá đã hoàn trả tiền đặt trước của bạn.",
  absent: "Bạn không điểm danh trước giờ bắt đầu nên đã bị ghi vắng mặt ở phiên này.",
  not_checked_in: "Bạn chưa điểm danh. Điểm danh trong thời gian mở để nhận số báo danh và vào phòng.",
  no_bidder_no: "Bạn chưa được cấp số báo danh. Vui lòng liên hệ tổ chức đấu giá.",
};

export interface BidderReasonContract {
  status: string;
  review_status: ReviewStatus;
  deposit_status: DepositStatus;
  checked_in_at: string | null;
  absent_at: string | null;
  bidder_no: number | null;
}

/** null = đủ điều kiện trả giá. Chưa đăng nhập / đang tải do hook tự xử lý. */
export function bidderBlockReasonOf(contract: BidderReasonContract | null): BidderBlockReason | null {
  if (!contract) return "no_contract";
  if (contract.status !== "paid") return "unpaid";
  // Trước mọi nhánh tiền: vắng ⇒ deposit 'forfeited' / 'pending_refund' (miễn trừ),
  // câu của các nhánh dưới sẽ sai.
  if (contract.absent_at) return "absent";
  // Đã điểm danh = đã được duyệt lúc điểm danh (trigger khoá duyệt sau đó), nên
  // chỉ hỏi duyệt khi chưa điểm danh.
  if (!contract.checked_in_at) {
    if (contract.review_status === "pending") return "review_pending";
    if (contract.review_status === "needs_info") return "review_needs_info";
  }
  switch (contract.deposit_status) {
    case "received":
      break;
    // Phiên đã chốt: tiền đặt trước thành tiền mua tài sản hoặc chờ hoàn trả.
    case "applied":
    case "pending_refund":
      return "settled";
    case "refunded":
      return "refunded";
    // 'forfeited' tới đây được về lý thuyết, nhưng roomGateOf bắt nó trước.
    default:
      return "no_deposit";
  }
  if (!contract.checked_in_at) return "not_checked_in";
  if (contract.bidder_no == null) return "no_bidder_no";
  return null;
}
