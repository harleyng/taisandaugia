// Cấu hình thương hiệu MỘT chỗ (docs/owner-marketing-plan.md §B6 — white label).
//
// Module Truyền thông đọc tên sàn, tên người gửi và gốc link ngắn TỪ ĐÂY, không viết
// cứng trong component: bản white label (chạy trong hạ tầng ngân hàng) chỉ cần đổi
// file này / biến môi trường. Các chuỗi thương hiệu cũ ở module khác chưa chuyển về
// đây — việc đó thuộc Phase M7.

// Dùng chung với Hồ sơ online (Phase M0 — src/lib/postingShare/*).
export const BRAND = {
  /** Tên sàn hiển thị (chân trang Hồ sơ online, nội dung truyền thông). */
  name: "Tài Sản Đấu Giá",
  /** Bí danh của `name` cho module Truyền thông. */
  platformName: "Tài Sản Đấu Giá",
  /** Tên miền hiển thị (chữ, không dùng để dựng URL). */
  domain: "taisandaugia.vn",
  /** Tên người gửi email truyền thông. */
  senderName: "Tài Sản Đấu Giá",
} as const;

/**
 * Gốc của link ngắn /l/:code. `VITE_SHORT_LINK_BASE_URL` (vd. https://tsdg.vn) cho
 * tên miền link riêng; không có thì dùng chính origin đang chạy. Không có dấu / cuối.
 */
export function shortLinkBase(): string {
  const env = (import.meta.env.VITE_SHORT_LINK_BASE_URL as string | undefined)?.trim();
  const base = env || (typeof window === "undefined" ? "" : window.location.origin);
  return base.replace(/\/+$/, "");
}
