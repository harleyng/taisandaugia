// Lớp dùng chung của bản thiết kế Chỉ tiêu. Viết NGUYÊN chuỗi (không ghép bằng template
// literal) để Tailwind quét ra được.

/** Bóng "nổi" khi rê chuột (dòng danh sách, thẻ tiêu chí); chế độ tối quay về shadow-card. */
export const HOVER_RAISE =
  "hover:shadow-[0_2px_4px_hsl(var(--foreground)/0.06),0_8px_24px_hsl(var(--foreground)/0.08)] dark:hover:shadow-card";

/** Thẻ tiêu chí đang chọn: viền xanh 2px + bóng nổi. */
export const SELECTED_RING =
  "shadow-[0_0_0_2px_hsl(var(--primary)),0_2px_4px_hsl(var(--foreground)/0.06),0_8px_24px_hsl(var(--foreground)/0.08)] hover:shadow-[0_0_0_2px_hsl(var(--primary)),0_2px_4px_hsl(var(--foreground)/0.06),0_8px_24px_hsl(var(--foreground)/0.08)]";

/** Viền mảnh vẽ bằng bóng inset (dòng kỳ sắp tới, khối tiêu chí trong form, nút trang). */
export const HAIRLINE = "shadow-[inset_0_0_0_1px_hsl(var(--border))]";
