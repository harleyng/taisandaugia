// Lỗi Postgres / PostgREST của luồng phiên đấu giá → câu tiếng Việt cho toast.
//
// Trigger ở 20260911000003 đã RAISE sẵn tiếng Việt (vd "Phiên cần ít nhất 1 tài
// sản trước khi công bố.") — giữ nguyên những câu đó. Chỉ dịch các lỗi hệ thống
// tiếng Anh: vi phạm RLS, trùng khoá, CHECK constraint.

export function sessionErrorMessage(err: unknown): string {
  const e = (err ?? {}) as { code?: string; message?: string };
  const msg = e.message ?? "";

  if (e.code === "23505") return "Tài sản này đã có trong phiên.";
  if (/row-level security/i.test(msg)) return "Bạn không có quyền thực hiện thao tác này.";
  if (e.code === "PGRST116") return "Không tìm thấy phiên, hoặc bạn không có quyền sửa phiên này.";
  if (/auction_sessions_cancel_reason/.test(msg)) return "Vui lòng nhập lý do huỷ phiên.";
  if (/violates check constraint/i.test(msg)) {
    return "Thông tin chưa hợp lệ — kiểm tra lại các mốc thời gian và số liệu.";
  }
  return msg || "Có lỗi xảy ra. Vui lòng thử lại.";
}
