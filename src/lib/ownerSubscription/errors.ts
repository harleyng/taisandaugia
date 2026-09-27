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
  invalid_name: "Tên gói phải từ 2 đến 120 ký tự.",
  invalid_entitlements: "Danh sách tính năng không hợp lệ.",
  unsupported_variant: "Tính năng này chưa hỗ trợ tính theo gói.",
  invalid_quota: "Hạn mức mỗi tháng phải lớn hơn 0 (hoặc chọn Không giới hạn).",
  no_entitlements: "Gói chưa có tính năng nào — thêm ít nhất một tính năng trước.",
  invalid_transition: "Không chuyển được sang trạng thái này.",
  reason_required: "Nhập lý do huỷ (ít nhất 3 ký tự).",
  invalid_amount: "Số tiền phải ≥ 0.",
  invalid_method: "Chọn hình thức thanh toán.",
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
