// Lỗi Postgres / PostgREST của luồng hồ sơ tham gia → câu tiếng Việt cho toast.
//
// Các RPC ở 20260911000005 đã RAISE sẵn tiếng Việt — giữ nguyên. Chỉ dịch lỗi hệ
// thống tiếng Anh. KHÔNG dùng lại sessionErrorMessage: hàm đó dịch mọi 23505
// thành "Tài sản này đã có trong phiên", sai với luồng này.

export function contractErrorMessage(err: unknown): string {
  const e = (err ?? {}) as { code?: string; message?: string };
  const msg = e.message ?? "";

  if (e.code === "23505") {
    if (/bidder_no/.test(msg)) return "Số báo danh đã được cấp cho hồ sơ khác trong phiên.";
    if (/uq_abc_session_user/.test(msg)) return "Bạn đã có hồ sơ cho phiên này.";
    if (/duplicate key/i.test(msg)) return "Dữ liệu bị trùng — vui lòng tải lại trang.";
    return msg;
  }
  if (/row-level security|permission denied/i.test(msg)) return "Bạn không có quyền thực hiện thao tác này.";
  if (/violates check constraint/i.test(msg)) return "Thông tin chưa hợp lệ — kiểm tra lại các trường đã nhập.";
  if (/failed to fetch|networkerror/i.test(msg)) return "Mất kết nối. Vui lòng thử lại.";
  return msg || "Có lỗi xảy ra. Vui lòng thử lại.";
}
