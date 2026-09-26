// RPC VR tour trả `{ok:false, reason}` cho lỗi nghiệp vụ — phải kiểm `ok` trước khi báo thành công.

const REASON_MESSAGES: Record<string, string> = {
  not_authenticated: "Vui lòng đăng nhập để tiếp tục.",
  not_authorized: "Bạn không có quyền thực hiện thao tác này.",
  not_found: "Không tìm thấy hồ sơ hoặc đơn VR tour.",
  posting_closed: "Hồ sơ đã kết thúc — không đặt thêm VR tour được.",
  package_unavailable: "Gói VR tour này đang tạm ngưng.",
  partner_unavailable: "Đối tác chưa sẵn sàng nhận đơn (chưa có hợp đồng hiệu lực).",
  already_active: "Hồ sơ đang có một đơn VR tour chưa hoàn tất.",
  invalid_status: "Đơn đã chuyển sang trạng thái khác — tải lại để xem trạng thái mới nhất.",
  invalid_price: "Giá báo phải là số tiền nguyên lớn hơn 0.",
  invalid_validity: "Hiệu lực báo giá phải từ 1 đến 60 ngày.",
  no_contract_terms: "Đối tác không còn hợp đồng hiệu lực cho dịch vụ VR tour — gia hạn hợp đồng ở mục Đối tác trước.",
  price_below_commission: "Giá báo thấp hơn mức hoa hồng cố định trong hợp đồng.",
  reason_required: "Nhập lý do huỷ (ít nhất 5 ký tự).",
  missing_txn: "Thiếu mã giao dịch thanh toán.",
  quote_expired: "Báo giá đã hết hạn — liên hệ sàn để được báo giá lại.",
  quote_changed: "Báo giá vừa được cập nhật — vui lòng xem lại giá và thanh toán lại.",
  txn_used: "Mã giao dịch đã được sử dụng.",
  invalid_appointment: "Chọn thời điểm hẹn.",
  note_required: "Nhập địa điểm / người liên hệ (ít nhất 5 ký tự).",
  invalid_url: "Link VR tour phải bắt đầu bằng https:// và không chứa khoảng trắng.",
  posting_not_approved: "Hồ sơ chưa được duyệt — duyệt hồ sơ trước khi gắn VR tour vào lô.",
};

export class VrTourRpcError extends Error {
  readonly reason: string;
  readonly payload: Record<string, unknown>;
  constructor(reason: string, payload: Record<string, unknown>) {
    super(REASON_MESSAGES[reason] ?? "Thao tác không thành công. Vui lòng thử lại.");
    this.reason = reason;
    this.payload = payload;
  }
}

export function unwrapVrRpc(data: unknown): Record<string, unknown> {
  const payload = (data ?? {}) as Record<string, unknown>;
  if (payload.ok !== true) throw new VrTourRpcError(String(payload.reason ?? ""), payload);
  return payload;
}

export const vrErrorMessage = (err: unknown) =>
  err instanceof Error && err.message ? err.message : "Thao tác không thành công. Vui lòng thử lại.";
