// Ai được vào phòng đấu giá, và nếu không thì vì sao.
//
// Tách khỏi JSX để unit test được: chuỗi này có 9 nhánh xếp theo thứ tự, mà một
// nhánh xếp sai chỗ là hiện sai câu (ví dụ phiên đã HUỶ mà báo "không đấu giá
// trực tuyến"). Trang chỉ còn việc switch trên kết quả.
//
// QUYẾT ĐỊNH (người dùng chọn 2026-09-12): người chưa đủ điều kiện bị chặn CẢ
// TRANG, không được xem giá/lịch sử — dù RLS vốn cho phép đọc.
//
// "VÀO ĐƯỢC" KHÁC "TRẢ GIÁ ĐƯỢC" (Bước 6). org_finalize_session đổi tiền đặt
// trước của MỌI người đã nộp sang applied / pending_refund, nên nếu cứ đòi
// deposit_status='received' thì chốt phiên xong là cả phòng bị đuổi ra bằng câu
// "tổ chức chưa ghi nhận tiền đặt trước của bạn" — sai sự thật, và đuổi đúng lúc
// họ cần đọc kết quả. Nhánh `view_only` giữ họ ở lại, chỉ khoá ô trả giá.

import type { BidderBlockReason } from "@/hooks/useMyBidderStatus";
import type { SessionPublishStatus } from "@/lib/auctionSessions/phase";

export type RoomGate =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "cancelled" }
  /** Phiên đấu giá trực tiếp tại hội trường — không có phòng trực tuyến. */
  | { kind: "not_online" }
  /** bidding_method ngoài 'ascending' (hiện CHECK ở DB chưa cho, để sẵn cho sau). */
  | { kind: "method_unsupported" }
  | { kind: "not_started"; startsAt: string }
  | { kind: "blocked"; reason: BidderBlockReason }
  /** Vào xem được nhưng không trả giá được nữa — lý do quyết định câu giải thích. */
  | { kind: "view_only"; reason: NoBidReason }
  | { kind: "open" };

/**
 * Vì sao một người ĐÃ tham gia không trả giá được nữa. Khác BidderBlockReason:
 * bộ kia là "không vào được phòng", bộ này là "vào xem được, không trả giá".
 * Cố ý không dùng chung câu chữ — cùng một trạng thái nhưng hai hoàn cảnh đọc.
 */
export type NoBidReason = "forfeited" | "settled" | "refunded";

export const NO_BID_MESSAGES: Record<NoBidReason, string> = {
  forfeited:
    "Bạn đã rút lại giá đã trả nên tiền đặt trước bị tịch thu — không thể trả giá tiếp ở phiên này. Bạn vẫn theo dõi được diễn biến các lô.",
  settled:
    "Phiên đã chốt kết quả nên không còn nhận trả giá. Bạn vẫn xem được diễn biến và kết quả các lô.",
  refunded:
    "Tổ chức đấu giá đã hoàn trả tiền đặt trước của bạn nên bạn không còn trả giá ở phiên này.",
};

export interface RoomGateSession {
  status: SessionPublishStatus;
  auction_format: string;
  bidding_method: string;
  starts_at: string;
}

export interface RoomGateInput {
  sessionLoading: boolean;
  session: RoomGateSession | null;
  bidderLoading: boolean;
  eligible: boolean;
  reason: BidderBlockReason | null;
  /** contract?.deposit_status === 'forfeited' */
  forfeited: boolean;
  /** Số báo danh đã cấp — `null` thì phòng không dựng được, xem chú thích dưới. */
  bidderNo: number | null;
  now: Date;
}

const ONLINE_FORMATS = new Set(["truc_tuyen", "ca_hai"]);

/**
 * KHÔNG có nhánh nào theo `ends_at`: phiên kết thúc rồi thì phòng vẫn mở để
 * người trả giá đọc kết quả (Bước 6 công khai kết quả ở đây).
 */
export function roomGateOf(input: RoomGateInput): RoomGate {
  const { sessionLoading, session, bidderLoading, eligible, reason, forfeited, bidderNo, now } = input;

  if (sessionLoading) return { kind: "loading" };
  if (!session || session.status === "draft") return { kind: "not_found" };
  if (session.status === "cancelled") return { kind: "cancelled" };
  if (!ONLINE_FORMATS.has(session.auction_format)) return { kind: "not_online" };
  if (session.bidding_method !== "ascending") return { kind: "method_unsupported" };

  // place_bid trả session_not_live trước starts_at, nên vào phòng lúc này chỉ
  // thấy một màn hình chết. Báo giờ mở thay vì bày phòng rỗng.
  const starts = Date.parse(session.starts_at);
  if (!Number.isNaN(starts) && now.getTime() < starts) {
    return { kind: "not_started", startsAt: session.starts_at };
  }

  if (bidderLoading) return { kind: "loading" };

  // Xét TRƯỚC `eligible`: người đã rút giá có deposit_status='forfeited' nên
  // useMyBidderStatus trả 'no_deposit' — câu đó SAI sự thật với họ (tổ chức đã
  // ghi nhận tiền, chỉ là đã bị tịch thu).
  const noBid: NoBidReason | null = forfeited
    ? "forfeited"
    : reason === "settled" || reason === "refunded"
      ? reason
      : null;

  // Chỉ-xem vẫn phải DỰNG ĐƯỢC phòng, mà phòng cần số báo danh: trang render
  // null khi thiếu nó (AuctionBiddingRoomPage), tức màn trắng không lời giải
  // thích. Không có số thì nói thẳng là chưa được cấp.
  if (noBid) {
    return bidderNo != null ? { kind: "view_only", reason: noBid } : { kind: "blocked", reason: "no_bidder_no" };
  }

  if (!eligible) return { kind: "blocked", reason: reason ?? "no_contract" };
  return { kind: "open" };
}
