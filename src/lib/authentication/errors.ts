// RPC giám định trả `{ok:false, reason}` cho lỗi nghiệp vụ — phải kiểm `ok` trước khi báo thành công.

const REASON_MESSAGES: Record<string, string> = {
  not_authenticated: "Vui lòng đăng nhập để tiếp tục.",
  not_authorized: "Bạn không có quyền thực hiện thao tác này.",
  not_found: "Không tìm thấy hồ sơ hoặc đơn giám định.",
  posting_closed: "Hồ sơ đã kết thúc — không đặt thêm giám định được.",
  package_unavailable: "Phương thức giám định này đang tạm ngưng.",
  partner_unavailable: "Đối tác chưa sẵn sàng nhận đơn (chưa có hợp đồng hiệu lực).",
  address_required: "Nhập địa chỉ nơi đặt hiện vật để giám định tại chỗ.",
  already_active: "Hồ sơ đang có một đơn giám định chưa hoàn tất.",
  invalid_status: "Đơn đã chuyển sang trạng thái khác — tải lại để xem trạng thái mới nhất.",
  invalid_price: "Số tiền phải là số nguyên không âm.",
  invalid_validity: "Hiệu lực báo giá phải từ 1 đến 60 ngày.",
  no_contract_terms: "Đối tác không còn hợp đồng hiệu lực cho dịch vụ giám định — gia hạn hợp đồng ở mục Đối tác trước.",
  price_below_commission: "Giá báo thấp hơn mức hoa hồng cố định trong hợp đồng.",
  reason_required: "Nhập lý do (ít nhất 5 ký tự).",
  missing_txn: "Thiếu mã giao dịch thanh toán.",
  quote_expired: "Báo giá đã hết hạn — liên hệ sàn để được báo giá lại.",
  quote_changed: "Báo giá vừa được cập nhật — vui lòng xem lại giá và thanh toán lại.",
  txn_used: "Mã giao dịch đã được sử dụng.",
  tracking_required: "Nhập mã vận đơn (4–200 ký tự).",
  invalid_appointment: "Chọn thời điểm hẹn.",
  invalid_verdict: "Chọn kết luận giám định.",
  certificate_missing: "Chưa tải chứng thư PDF lên — tải file trước khi lưu kết luận.",
  slugs_required: "Chọn ít nhất một nhóm tài sản áp dụng.",
  user_not_found: "Không tìm thấy tài khoản với email này.",
};

export class AuthenticationRpcError extends Error {
  readonly reason: string;
  readonly payload: Record<string, unknown>;
  constructor(reason: string, payload: Record<string, unknown>) {
    super(REASON_MESSAGES[reason] ?? "Thao tác không thành công. Vui lòng thử lại.");
    this.reason = reason;
    this.payload = payload;
  }
}

export function unwrapGdRpc(data: unknown): Record<string, unknown> {
  const payload = (data ?? {}) as Record<string, unknown>;
  if (payload.ok !== true) throw new AuthenticationRpcError(String(payload.reason ?? ""), payload);
  return payload;
}

export const gdErrorMessage = (err: unknown) =>
  err instanceof Error && err.message ? err.message : "Thao tác không thành công. Vui lòng thử lại.";

/**
 * Lỗi từ trigger cổng giám định trên asset_postings / auction_session_items. Message
 * bắt đầu bằng mã (GD_REQUIRED / GD_FAILED_CATEGORY) — trả câu tiếng Việt, hoặc null
 * nếu không phải lỗi cổng giám định.
 */
export function authenticationGateMessage(err: unknown): string | null {
  const msg = (err as { message?: string } | null)?.message ?? "";
  if (msg.includes("GD_REQUIRED")) {
    return "Tài sản này bắt buộc có chứng thư giám định trước khi nộp. Đặt giám định ở bước “Đấu giá”, lưu nháp và nộp lại khi có chứng thư.";
  }
  if (msg.includes("GD_FAILED_CATEGORY")) {
    return "Kết quả giám định không cho phép đăng tài sản này ở nhóm Cổ vật. Xem lý do trong hồ sơ.";
  }
  return null;
}
