// Điểm nối DUY NHẤT với đối tác quét 3D phía client.
//
// Hiện là đối tác GIẢ LẬP: deeplink mở trang /doi-tac-3d/quet trong chính ứng dụng.
// Khi ký đối tác thật, chỉ đổi buildScanDeeplink sang deeplink / universal link của
// app đối tác (vẫn mang scan_ref + lot_id + token để webhook trả về đúng hồ sơ) —
// phần còn lại của luồng (webhook scan3d-webhook, hàm SQL attach/fail) giữ nguyên.

export const SCAN_PARTNER_NAME = "Đối tác quét 3D (mô phỏng)";

/** Quá thời hạn này mà chưa có kết quả thì phiên quét hết hạn và credit được hoàn. */
export const SCAN_EXPIRY_HOURS = 24;

export function buildScanDeeplink(args: { scanId: string; lotId: string; token: string }): string {
  const params = new URLSearchParams({ scan_ref: args.scanId, lot_id: args.lotId, token: args.token });
  return `${window.location.origin}/doi-tac-3d/quet?${params.toString()}`;
}

export const SCAN_STEPS = [
  "Đặt tài sản ở nơi đủ sáng, nền gọn — tránh nắng gắt và bề mặt phản chiếu.",
  "Đi một vòng quanh tài sản, giữ điện thoại cách 0,5–1,5 m, quay chậm.",
  "Quét thêm một vòng từ trên cao và cận các vết nứt, trầy xước cần thể hiện.",
  "Gửi kết quả trong app — model 3D tự gắn vào hồ sơ, thường trong vòng 10 phút.",
];
