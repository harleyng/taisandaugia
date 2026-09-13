// Lỗi của luồng đấu giá trực tuyến → câu tiếng Việt cho toast.
//
// KHÔNG dùng lại assertRpcOk / consignmentReasonMessage của ký gửi: hàm đó tra
// CONSIGNMENT_REASON_MESSAGES, nên mọi mã của đấu giá (bid_too_low, lot_paused…)
// sẽ rơi hết vào câu fallback chung chung. Cùng lý do mà
// biddingContracts/errors.ts từ chối dùng lại sessionErrorMessage: mỗi luồng
// một từ điển riêng.
//
// Các RPC ở 20260913000001 trả `{ ok:false, reason }` cho thất bại DỰ KIẾN thay
// vì RAISE. Supabase coi đó là thành công (error = null) — nên mọi mutation
// PHẢI gọi assertBiddingRpcOk, nếu không một lượt trả giá hỏng vẫn toast xanh.

import { formatVnd } from "@/lib/advertising/slug";

export const BIDDING_REASON_MESSAGES: Record<string, string> = {
  // Chung
  not_authenticated: "Vui lòng đăng nhập để tiếp tục.",
  not_authorized: "Bạn không có quyền điều hành phiên đấu giá này.",
  not_found: "Không tìm thấy dữ liệu, hoặc bạn không có quyền thao tác.",

  // place_bid
  lot_not_found: "Không tìm thấy lô tài sản này.",
  lot_not_configured: "Lô chưa có giá khởi điểm hoặc bước giá — chưa trả giá được.",
  session_not_live: "Phiên chưa bắt đầu hoặc không nhận trả giá trực tuyến.",
  lot_not_open: "Lô chưa được mở để trả giá.",
  lot_paused: "Lô đang tạm dừng. Vui lòng chờ đấu giá viên tiếp tục.",
  lot_closed: "Lô đã đóng, không nhận thêm lượt trả giá.",
  not_eligible:
    "Bạn chưa đủ điều kiện trả giá: cần hồ sơ đã thanh toán, đã nộp tiền đặt trước và có số báo danh.",
  already_leading: "Bạn đang là người trả giá cao nhất — không cần trả thêm.",
  invalid_nonce: "Phiên gửi không hợp lệ. Vui lòng tải lại trang rồi thử lại.",
  bid_too_low: "Giá trả phải cao hơn giá hiện tại ít nhất một bước giá.",
  bid_step_mismatch: "Giá trả phải đúng bội số của bước giá tính từ giá khởi điểm.",
  bid_too_many_steps: "Giá trả vượt quá số bước giá tối đa cho một lượt.",

  // withdraw_bid
  not_leading: "Chỉ rút được lượt trả giá đang cao nhất của chính bạn.",

  // org_*
  reason_required: "Vui lòng nhập lý do (ít nhất 3 ký tự).",
  invalid_duration: "Thời lượng mở lô phải từ 1 phút đến 24 giờ.",
  invalid_status: "Trạng thái vừa thay đổi. Tải lại trang để xem tình trạng mới nhất.",
  already_finalized: "Phiên đã được chốt kết quả trước đó.",
  lots_not_closed: "Còn lô chưa đóng — đóng hết các lô trước khi chốt kết quả phiên.",
  not_finalized: "Phiên chưa chốt kết quả.",
  invalid_path: "Đường dẫn tệp biên bản không hợp lệ, hoặc biên bản đã tồn tại.",
  invalid_hash: "Mã kiểm tra nội dung biên bản không hợp lệ.",
  file_missing: "Chưa tải được tệp biên bản lên. Vui lòng thử lại.",
};

const FALLBACK_MESSAGE = "Thao tác không thành công. Vui lòng thử lại.";

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Ghép số tiền cụ thể vào câu khi server có trả `min_amount` / `max_amount` —
 * "phải từ 6,450,000,000₫" hữu ích hơn hẳn "phải cao hơn một bước giá".
 */
export function biddingReasonMessage(
  reason: string | null | undefined,
  details?: Record<string, unknown>,
): string {
  const min = num(details?.min_amount);
  const max = num(details?.max_amount);

  if (reason === "bid_too_low" && min != null) {
    return `Giá trả tối thiểu cho lượt này là ${formatVnd(min)}.`;
  }
  if (reason === "bid_too_many_steps" && max != null) {
    return `Giá trả tối đa cho một lượt là ${formatVnd(max)}.`;
  }
  return (reason && BIDDING_REASON_MESSAGES[reason]) || FALLBACK_MESSAGE;
}

export class BiddingRpcError extends Error {
  readonly reason: string;
  /** Toàn bộ payload RPC — vd. min_amount / max_amount / current_price. */
  readonly details: Record<string, unknown>;

  constructor(reason: string, details: Record<string, unknown> = {}) {
    super(biddingReasonMessage(reason, details));
    this.name = "BiddingRpcError";
    this.reason = reason;
    this.details = details;
  }
}

/** Ném BiddingRpcError khi RPC trả `{ ok:false }`; im lặng với mọi dữ liệu khác. */
export function assertBiddingRpcOk(data: unknown): void {
  if (data && typeof data === "object" && !Array.isArray(data) && (data as { ok?: unknown }).ok === false) {
    const payload = data as Record<string, unknown>;
    const reason = payload.reason;
    throw new BiddingRpcError(typeof reason === "string" ? reason : "", payload);
  }
}

/**
 * Lỗi tầng Postgres / PostgREST (RLS, CHECK, mất mạng) — KHÁC với `{ok:false}`
 * ở trên. Các bảng đấu giá không có policy ghi nên mọi ghi thẳng sẽ về 42501.
 */
export function biddingErrorMessage(err: unknown): string {
  if (err instanceof BiddingRpcError) return err.message;

  const e = (err ?? {}) as { code?: string; message?: string };
  const msg = e.message ?? "";

  if (/row-level security|permission denied|insufficient_privilege/i.test(msg) || e.code === "42501") {
    return "Bạn không có quyền thực hiện thao tác này.";
  }
  if (e.code === "23505") return "Dữ liệu bị trùng — vui lòng tải lại trang.";
  if (/violates check constraint/i.test(msg)) {
    return "Thông tin chưa hợp lệ — kiểm tra lại số tiền và trạng thái lô.";
  }
  if (/failed to fetch|networkerror/i.test(msg)) return "Mất kết nối. Vui lòng thử lại.";
  return msg || FALLBACK_MESSAGE;
}
