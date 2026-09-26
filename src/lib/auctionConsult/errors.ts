// RPC tư vấn đấu giá trả `{ok:false, reason}` cho lỗi nghiệp vụ — phải kiểm `ok` trước khi báo thành công.

export const TVDG_REASON_MESSAGES: Record<string, string> = {
  not_authenticated: "Vui lòng đăng nhập để tiếp tục.",
  not_authorized: "Bạn không có quyền thực hiện thao tác này.",
  not_found: "Không tìm thấy hồ sơ hoặc yêu cầu tư vấn.",
  posting_closed: "Hồ sơ đã kết thúc — không gửi thêm yêu cầu tư vấn được.",
  package_unavailable: "Dịch vụ tư vấn đấu giá đang tạm ngưng.",
  invalid_goal: "Chọn mục tiêu bán.",
  invalid_price: "Số tiền phải là số nguyên dương.",
  min_above_expected: "Giá thấp nhất chấp nhận không được cao hơn giá mong muốn.",
  invalid_timeline: "Tiến độ mong muốn không hợp lệ.",
  invalid_deadline: "Hạn chót phải từ hôm nay đến tối đa 2 năm tới.",
  already_active: "Hồ sơ đang có một yêu cầu tư vấn đấu giá chưa hoàn tất.",
  invalid_status: "Yêu cầu đã chuyển sang trạng thái khác — tải lại để xem trạng thái mới nhất.",
  invalid_decision: "Quyết định không hợp lệ.",
  expert_required: "Nhập tên chuyên gia được phân công.",
  partner_unavailable: "Đối tác không còn hoạt động.",
  invalid_validity: "Hiệu lực báo giá phải từ 1 đến 60 ngày.",
  no_contract_terms: "Đối tác chưa có hợp đồng hiệu lực cho dịch vụ tư vấn đấu giá — kiểm tra mục Đối tác trước.",
  price_below_commission: "Giá báo thấp hơn mức hoa hồng cố định trong hợp đồng.",
  reason_required: "Nhập lý do (ít nhất 5 ký tự).",
  missing_txn: "Thiếu mã giao dịch thanh toán.",
  quote_expired: "Báo giá đã hết hạn — liên hệ sàn để được báo giá lại.",
  quote_changed: "Báo giá vừa được cập nhật — vui lòng xem lại giá và thanh toán lại.",
  txn_used: "Mã giao dịch đã được sử dụng.",
  invalid_proposal: "Phương án không hợp lệ.",
  format_invalid: "Hình thức đấu giá không hợp lệ.",
  method_invalid: "Phương thức trả giá không hợp lệ.",
  starting_price_invalid: "Giá khởi điểm phải là số nguyên dương.",
  reserve_invalid: "Giá bảo lưu không hợp lệ — trả giá lên thì phải ≥ giá khởi điểm, đặt giá xuống thì ≤ giá khởi điểm.",
  bid_step_invalid: "Bước giá phải là số nguyên dương và không lớn hơn giá khởi điểm.",
  duration_invalid: "Thời lượng lô phải từ 1 đến 1.440 phút (24 giờ).",
  deposit_mode_invalid: "Cách tính tiền đặt trước không hợp lệ.",
  deposit_value_invalid: "Tiền đặt trước không hợp lệ — % phải trong (0, 100], số tiền phải là số nguyên dương.",
  deposit_above_price: "Tiền đặt trước không được lớn hơn giá khởi điểm.",
  field_notes_invalid: "Ghi chú tham số không hợp lệ (tối đa 1.000 ký tự mỗi mục).",
  rationale_too_long: "Lý giải tối đa 4.000 ký tự.",
  format_required: "Chọn hình thức đấu giá.",
  method_required: "Chọn phương thức trả giá.",
  starting_price_required: "Nhập giá khởi điểm đề xuất.",
  bid_step_required: "Nhập bước giá đề xuất.",
  deposit_required: "Nhập tiền đặt trước đề xuất.",
  duration_required: "Hình thức có trực tuyến cần thời lượng lô.",
  rationale_required: "Nhập lý giải phương án (ít nhất 5 ký tự).",
};

export const tvdgReasonMessage = (reason: string) =>
  TVDG_REASON_MESSAGES[reason] ?? "Thao tác không thành công. Vui lòng thử lại.";

export class AuctionConsultRpcError extends Error {
  readonly reason: string;
  readonly payload: Record<string, unknown>;
  constructor(reason: string, payload: Record<string, unknown>) {
    super(tvdgReasonMessage(reason));
    this.reason = reason;
    this.payload = payload;
  }
}

export function unwrapTvdgRpc(data: unknown): Record<string, unknown> {
  const payload = (data ?? {}) as Record<string, unknown>;
  if (payload.ok !== true) throw new AuctionConsultRpcError(String(payload.reason ?? ""), payload);
  return payload;
}

export const tvdgErrorMessage = (err: unknown) =>
  err instanceof Error && err.message ? err.message : "Thao tác không thành công. Vui lòng thử lại.";
