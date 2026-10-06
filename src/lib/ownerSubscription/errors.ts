// RPC gói thuê bao trả `{ok:false, reason}` cho lỗi nghiệp vụ — phải kiểm `ok` trước khi báo thành công.

const REASON_MESSAGES: Record<string, string> = {
  not_found: "Không tìm thấy gói thuê bao hoặc Trạm.",
  forbidden: "Bạn không có quyền thực hiện thao tác này.",
  quota_exhausted: "Đã dùng hết hạn mức của gói — liên hệ quản trị / gia hạn.",
  insufficient: "Số dư credit không đủ.",
  not_owner: "Chỉ Trưởng đơn vị mới thanh toán được gói thuê bao.",
  invalid_status: "Gói đã chuyển sang trạng thái khác — tải lại để xem trạng thái mới nhất.",
  not_payable: "Gói này không thanh toán online (giá 0 ₫) — liên hệ quản trị để kích hoạt.",
  quote_changed: "Giá gói vừa được cập nhật — vui lòng xem lại giá và thanh toán lại.",
  txn_used: "Mã giao dịch đã được sử dụng.",
  missing_txn: "Thiếu mã giao dịch thanh toán.",
  invalid_overage: "Chọn cách xử lý khi hết hạn mức.",
  invalid_terms: "Giá phải ≥ 0 và thời hạn từ 1 đến 36 tháng.",
  invalid_name: "Tên gói phải từ 2 đến 60 ký tự.",
  no_benefits: "Gói chưa có quyền lợi nào — thêm ít nhất một quyền lợi.",
  unknown_benefit: "Quyền lợi không có trong danh mục — tải lại trang rồi chọn lại.",
  duplicate_benefit: "Mỗi quyền lợi chỉ thêm một lần vào gói.",
  invalid_benefit: "Hạn mức phải là số nguyên lớn hơn 0 (hoặc Không giới hạn) và chọn chu kỳ làm mới.",
  invalid_transition: "Không chuyển được sang trạng thái này.",
  reason_required: "Nhập lý do huỷ (ít nhất 3 ký tự).",
  invalid_amount: "Số tiền phải ≥ 0.",
  invalid_method: "Chọn hình thức thanh toán.",
  pending_exists: "Trạm đã có một lần đổi gói chờ áp dụng từ kỳ sau — chờ tới khi gói mới có hiệu lực.",
  plan_inactive: "Gói này đã ngừng cung cấp — chọn gói khác.",
  plan_not_available: "Gói này hiện không mở cho tổ chức của bạn — vui lòng liên hệ sàn.",
  workspace_not_found: "Có tổ chức không còn tồn tại — tải lại danh sách rồi chọn lại.",
  invalid_term: "Thời hạn không hợp lệ — chọn một kỳ trong danh sách.",
  invalid_tier: "Chọn kiểu hiển thị của gói.",
  invalid_text: "Mô tả ngắn tối đa 120 ký tự.",
  invalid_package_name: "Tên bộ gói phải từ 2 đến 60 ký tự.",
  no_plans: "Bộ gói cần ít nhất một gói.",
  no_terms: "Chọn ít nhất một kỳ mua cho bộ gói.",
  duplicate_term_months: "Một bộ gói không có hai kỳ cùng số tháng — bỏ bớt một kỳ.",
  plans_changed: "Danh sách gói của bộ vừa thay đổi — tải lại trang rồi lưu lại.",
  invalid_featured: "Gói “Phổ biến” phải là một gói đang bán.",
  default_package_active: "Bộ mặc định không ngừng bán được.",
  default_package_workspaces: "Bộ mặc định không gán tổ chức — tổ chức chưa gán bộ nào tự thấy bộ này.",
  duplicate_term: "Kỳ này (số tháng + chiết khấu) đã có trong thư viện.",
  term_months_conflict: "Có bộ gói đang dùng cả kỳ này lẫn một kỳ khác cùng số tháng mới — bỏ bớt khỏi bộ trước.",
  term_in_use: "Kỳ đang dùng trong bộ gói — bỏ khỏi bộ trước khi xoá.",
};

export class OwnerSubRpcError extends Error {
  readonly reason: string;
  readonly payload: Record<string, unknown>;
  constructor(reason: string, payload: Record<string, unknown>) {
    super(REASON_MESSAGES[reason] ?? "Thao tác không thành công. Vui lòng thử lại.");
    this.reason = reason;
    this.payload = payload;
  }
}

export function unwrapSubRpc(data: unknown): Record<string, unknown> {
  const payload = (data ?? {}) as Record<string, unknown>;
  if (payload.ok !== true) throw new OwnerSubRpcError(String(payload.reason ?? ""), payload);
  return payload;
}

export const subReasonMessage = (reason: string | null | undefined) =>
  (reason && REASON_MESSAGES[reason]) || "Thao tác không thành công. Vui lòng thử lại.";

export const subErrorMessage = (err: unknown) =>
  err instanceof Error && err.message ? err.message : "Thao tác không thành công. Vui lòng thử lại.";
