/**
 * Thông báo lỗi cho tài liệu phiên + hộp thư. RPC / trigger đã RAISE bằng tiếng
 * Việt nên phần lớn chỉ việc hiện nguyên văn; chỉ dịch các mã lỗi hệ thống.
 */
export function caseQaErrorMessage(err: unknown): string {
  const e = (err ?? {}) as { message?: string; code?: string };
  const msg = e.message ?? "";
  if (e.code === "42501" || /row-level security/i.test(msg)) return "Bạn không có quyền thực hiện thao tác này.";
  if (e.code === "23505" && /session_type_key/.test(msg)) return "Phiên đã có tài liệu loại này.";
  if (/no_placeholder/.test(msg)) return "Điều khoản còn chỗ trống [[CẦN NHẬP]] — hãy điền trước khi xác nhận.";
  if (e.code === "23514") return "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại độ dài và định dạng.";
  return msg || "Có lỗi xảy ra, vui lòng thử lại.";
}
