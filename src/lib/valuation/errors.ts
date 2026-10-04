// RPC thẩm định giá trả `{ok:false, reason}` cho lỗi nghiệp vụ — phải kiểm `ok` trước khi báo thành công.

const REASON_MESSAGES: Record<string, string> = {
  not_authenticated: "Vui lòng đăng nhập để tiếp tục.",
  not_authorized: "Bạn không có quyền thực hiện thao tác này.",
  not_found: "Không tìm thấy hồ sơ hoặc đơn thẩm định giá.",
  posting_closed: "Hồ sơ đã kết thúc — không gửi thêm yêu cầu thẩm định giá được.",
  package_unavailable: "Dịch vụ thẩm định giá đang tạm ngưng.",
  invalid_purpose: "Chọn mục đích thẩm định giá.",
  address_too_long: "Địa chỉ khảo sát tối đa 500 ký tự.",
  already_active: "Hồ sơ đang có một đơn thẩm định giá chưa hoàn tất.",
  invalid_status: "Đơn đã chuyển sang trạng thái khác — tải lại để xem trạng thái mới nhất.",
  expert_required: "Nhập tên thẩm định viên được phân công.",
  partner_unavailable: "Đơn vị thẩm định không còn hoạt động.",
  invalid_price: "Số tiền phải là số nguyên dương.",
  invalid_validity: "Hiệu lực báo giá phải từ 1 đến 60 ngày.",
  no_contract_terms: "Đơn vị chưa có hợp đồng hiệu lực cho dịch vụ thẩm định giá — kiểm tra mục Đối tác trước.",
  price_below_commission: "Giá báo thấp hơn mức hoa hồng cố định trong hợp đồng.",
  reason_required: "Nhập lý do (ít nhất 5 ký tự).",
  missing_txn: "Thiếu mã giao dịch thanh toán.",
  quote_expired: "Báo giá đã hết hạn — liên hệ sàn để được báo giá lại.",
  quote_changed: "Báo giá vừa được cập nhật — vui lòng xem lại giá và thanh toán lại.",
  txn_used: "Mã giao dịch đã được sử dụng.",
  invalid_value: "Giá trị thẩm định phải là số nguyên dương.",
  invalid_valuation_date: "Ngày thẩm định không được sau hôm nay.",
  invalid_valid_until: "Ngày hết hiệu lực phải sau ngày thẩm định.",
  invalid_method: "Phương pháp thẩm định không hợp lệ.",
  certificate_missing: "Chưa tải lên chứng thư (PDF) — tải lại tệp rồi thử lại.",
};

export class ValuationRpcError extends Error {
  readonly reason: string;
  readonly payload: Record<string, unknown>;
  constructor(reason: string, payload: Record<string, unknown>) {
    super(REASON_MESSAGES[reason] ?? "Thao tác không thành công. Vui lòng thử lại.");
    this.reason = reason;
    this.payload = payload;
  }
}

export function unwrapTdgRpc(data: unknown): Record<string, unknown> {
  const payload = (data ?? {}) as Record<string, unknown>;
  if (payload.ok !== true) throw new ValuationRpcError(String(payload.reason ?? ""), payload);
  return payload;
}

export const tdgErrorMessage = (err: unknown) =>
  err instanceof Error && err.message ? err.message : "Thao tác không thành công. Vui lòng thử lại.";
