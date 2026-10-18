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
  lot_not_found: "Không tìm thấy tài sản này.",
  lot_not_configured: "Tài sản chưa có giá khởi điểm hoặc bước giá — chưa trả giá được.",
  session_not_live: "Phiên chưa bắt đầu hoặc không nhận trả giá trực tuyến.",
  lot_not_open: "Tài sản chưa được mở để trả giá.",
  lot_paused: "Tài sản đang tạm dừng. Vui lòng chờ đấu giá viên tiếp tục.",
  lot_closed: "Tài sản đã đóng, không nhận thêm lượt trả giá.",
  not_eligible:
    "Bạn chưa đủ điều kiện trả giá: cần hồ sơ đã được duyệt, đã nộp tiền đặt trước và đã điểm danh.",
  lot_not_registered: "Bạn không đăng ký tài sản này khi mua hồ sơ — chỉ trả giá được các tài sản đã đăng ký.",
  already_leading: "Bạn đang là người trả giá cao nhất — không cần trả thêm.",
  invalid_nonce: "Phiên gửi không hợp lệ. Vui lòng tải lại trang rồi thử lại.",
  bid_too_low: "Giá trả phải cao hơn giá hiện tại ít nhất một bước giá.",
  bid_step_mismatch: "Giá trả phải đúng bội số của bước giá tính từ giá khởi điểm.",
  bid_too_many_steps: "Giá trả vượt quá số bước giá tối đa cho một lượt.",

  // Phương thức (20261018190000)
  method_mismatch: "Phiên dùng phương thức trả giá khác — tải lại trang để vào đúng màn hình.",
  price_changed: "Giá vừa giảm — xác nhận lại ở mức giá mới.",
  round_closed: "Vòng bỏ phiếu đã kết thúc — chờ đấu giá viên công bố kết quả.",
  not_in_tie_round: "Vòng phụ chỉ dành cho những người cùng trả giá cao nhất ở vòng trước.",
  already_submitted: "Bạn đã nộp phiếu ở vòng này — phiếu kín không sửa được.",
  floor_missing: "Tài sản chưa có giá sàn — đặt giá sàn trước khi mở theo phương thức đặt giá xuống.",
  floor_invalid: "Giá sàn phải không cao hơn giá khởi điểm và nằm trên lưới bước giá.",
  duration_required: "Bỏ phiếu kín cần đặt thời gian nhận phiếu khi mở tài sản.",

  // withdraw_bid
  not_leading: "Chỉ rút được lượt trả giá đang cao nhất của chính bạn.",

  // org_*
  reason_required: "Vui lòng nhập lý do (ít nhất 3 ký tự).",
  invalid_duration: "Thời lượng mở tài sản phải từ 1 phút đến 24 giờ.",
  another_lot_live: "Đang có tài sản khác mở hoặc tạm dừng — mỗi phiên chỉ mở một tài sản tại một thời điểm.",
  invalid_status: "Trạng thái vừa thay đổi. Tải lại trang để xem tình trạng mới nhất.",
  already_finalized: "Phiên đã được chốt kết quả trước đó.",
  lots_not_closed: "Còn tài sản chưa đóng — đóng hết các tài sản trước khi chốt kết quả phiên.",
  not_finalized: "Phiên chưa chốt kết quả.",
  invalid_path: "Đường dẫn tệp biên bản không hợp lệ, hoặc biên bản đã tồn tại.",
  invalid_hash: "Mã kiểm tra nội dung biên bản không hợp lệ.",
  file_missing: "Chưa tải được tệp biên bản lên. Vui lòng thử lại.",

  // Điểm danh (20261008100300) — _checkin_block_reason + RPC điểm danh / OTP
  not_paid: "Hồ sơ tham gia chưa được thanh toán.",
  review_pending: "Hồ sơ tham gia đang chờ tổ chức đấu giá duyệt.",
  review_needs_info: "Tổ chức đấu giá yêu cầu bổ sung hồ sơ — nộp lại trước khi điểm danh.",
  review_rejected: "Hồ sơ tham gia đã bị tổ chức đấu giá từ chối.",
  deposit_not_received: "Tổ chức đấu giá chưa ghi nhận tiền đặt trước.",
  session_not_published: "Phiên không còn công bố.",
  format_unsupported: "Phiên theo hình thức này chưa hỗ trợ điểm danh trên hệ thống.",
  wrong_channel: "Phiên trực tiếp điểm danh tại địa điểm tổ chức; phiên trực tuyến người tham gia tự điểm danh.",
  already_checked_in: "Người tham gia đã điểm danh.",
  absent: "Người tham gia đã bị ghi vắng mặt.",
  roster_closed: "Phiên đã chốt danh sách điểm danh.",
  window_not_open: "Chưa đến giờ mở điểm danh.",
  window_closed: "Đã hết thời gian điểm danh.",
  wrong_session: "Phiếu dự phiên này thuộc phiên đấu giá khác.",
  query_too_short: "Nhập ít nhất 2 ký tự để tìm.",
  invalid_attendee: "Chọn người có mặt: người đăng ký hoặc người được uỷ quyền.",
  no_proxy: "Hồ sơ này không đăng ký người được uỷ quyền.",
  too_early: "Chỉ chốt danh sách sau giờ bắt đầu phiên.",
  otp_too_soon: "Vừa gửi mã — vui lòng chờ 30 giây rồi gửi lại.",
  otp_missing: "Chưa có mã xác nhận — bấm “Gửi mã” trước.",
  otp_expired: "Mã xác nhận đã hết hạn — gửi mã mới.",
  otp_invalid: "Mã xác nhận không đúng.",
  otp_locked: "Nhập sai quá 5 lần — gửi mã mới để thử lại.",
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
  const current = num(details?.current_price);
  if (reason === "price_changed" && current != null) {
    return `Giá vừa giảm còn ${formatVnd(current)} — xác nhận lại để chấp nhận mức giá này.`;
  }
  if (reason === "bid_too_many_steps" && max != null) {
    return `Giá trả tối đa cho một lượt là ${formatVnd(max)}.`;
  }
  const opensAt = typeof details?.opens_at === "string" ? new Date(details.opens_at) : null;
  if (reason === "window_not_open" && opensAt && !Number.isNaN(opensAt.getTime())) {
    return `Chưa đến giờ điểm danh — mở lúc ${opensAt.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}.`;
  }
  // 20261018140000: mỗi phiên chỉ một lô mở/tạm dừng — nêu đích danh lô đang chiếm.
  const liveLotNo = num(details?.lot_no);
  if (reason === "another_lot_live" && liveLotNo != null) {
    // Không có thao tác "đóng lô" tay — lô đóng theo giờ, nên chỉ gợi ý chờ hoặc rút.
    return details?.status === "paused"
      ? `Tài sản ${liveLotNo} đang tạm dừng — tiếp tục cho tài sản chạy hết giờ hoặc rút tài sản đó trước khi mở tài sản khác.`
      : `Tài sản ${liveLotNo} đang mở — chờ tài sản đóng hoặc rút tài sản đó trước khi mở tài sản khác.`;
  }
  const left = num(details?.attempts_left);
  if (reason === "otp_invalid" && left != null) {
    return `Mã xác nhận không đúng — còn ${left} lần thử.`;
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
    return "Thông tin chưa hợp lệ — kiểm tra lại số tiền và trạng thái tài sản.";
  }
  if (/failed to fetch|networkerror/i.test(msg)) return "Mất kết nối. Vui lòng thử lại.";
  return msg || FALLBACK_MESSAGE;
}
