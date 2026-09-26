// RPC tư vấn pháp lý trả `{ok:false, reason}` cho lỗi nghiệp vụ — phải kiểm `ok` trước khi báo thành công.

const REASON_MESSAGES: Record<string, string> = {
  not_authenticated: "Vui lòng đăng nhập để tiếp tục.",
  not_authorized: "Bạn không có quyền thực hiện thao tác này.",
  not_found: "Không tìm thấy hồ sơ hoặc yêu cầu tư vấn.",
  posting_closed: "Hồ sơ đã kết thúc — không gửi thêm yêu cầu tư vấn được.",
  package_unavailable: "Dịch vụ tư vấn pháp lý đang tạm ngưng.",
  docs_required: "Chọn hoặc tải lên ít nhất một tệp hồ sơ.",
  too_many_docs: "Tối đa 50 tệp cho một lần tư vấn.",
  doc_invalid: "Có tệp không hợp lệ hoặc chưa tải lên xong — tải lại tệp rồi thử lại.",
  already_active: "Hồ sơ đang có một yêu cầu tư vấn chưa hoàn tất.",
  invalid_status: "Yêu cầu đã chuyển sang trạng thái khác — tải lại để xem trạng thái mới nhất.",
  expert_required: "Nhập tên chuyên gia được phân công.",
  partner_unavailable: "Đối tác không còn hoạt động.",
  invalid_price: "Số tiền phải là số nguyên dương.",
  invalid_validity: "Hiệu lực báo giá phải từ 1 đến 60 ngày.",
  no_contract_terms: "Đối tác chưa có hợp đồng hiệu lực cho dịch vụ tư vấn pháp lý — kiểm tra mục Đối tác trước.",
  price_below_commission: "Giá báo thấp hơn mức hoa hồng cố định trong hợp đồng.",
  reason_required: "Nhập lý do (ít nhất 5 ký tự).",
  missing_txn: "Thiếu mã giao dịch thanh toán.",
  quote_expired: "Báo giá đã hết hạn — liên hệ sàn để được báo giá lại.",
  quote_changed: "Báo giá vừa được cập nhật — vui lòng xem lại giá và thanh toán lại.",
  txn_used: "Mã giao dịch đã được sử dụng.",
  summary_required: "Nhập nhận định chung (ít nhất 5 ký tự).",
  invalid_items: "Checklist không hợp lệ.",
  too_many_items: "Checklist tối đa 80 mục.",
  checklist_empty: "Checklist cần ít nhất một mục.",
  item_label_invalid: "Tên mục checklist phải từ 2–300 ký tự.",
  item_status_invalid: "Kết luận mục không hợp lệ.",
  item_unmarked: "Còn mục chưa chấm Đủ / Thiếu / Cần làm rõ.",
  item_action_required: "Mục Thiếu / Cần làm rõ phải ghi rõ việc người bán cần làm.",
  item_doc_invalid: "Tệp gắn vào mục phải thuộc bộ hồ sơ đã nộp.",
};

export class LegalConsultRpcError extends Error {
  readonly reason: string;
  readonly payload: Record<string, unknown>;
  constructor(reason: string, payload: Record<string, unknown>) {
    super(REASON_MESSAGES[reason] ?? "Thao tác không thành công. Vui lòng thử lại.");
    this.reason = reason;
    this.payload = payload;
  }
}

export function unwrapTvplRpc(data: unknown): Record<string, unknown> {
  const payload = (data ?? {}) as Record<string, unknown>;
  if (payload.ok !== true) throw new LegalConsultRpcError(String(payload.reason ?? ""), payload);
  return payload;
}

export const tvplErrorMessage = (err: unknown) =>
  err instanceof Error && err.message ? err.message : "Thao tác không thành công. Vui lòng thử lại.";
