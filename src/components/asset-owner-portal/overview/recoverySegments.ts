import type { CSSProperties } from "react";

// Theo bản thiết kế: xanh đậm → xanh nhạt → sọc vàng (tiền chưa về). Chỉ dùng token có sẵn.
const AWAITING_STRIPES: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(135deg, hsl(var(--accent) / 0.75) 0 5px, hsl(var(--accent)) 5px 10px)",
};

/** Màu 3 phần tiền — dùng chung với thanh "Số liệu cấu thành" của trang chi tiết chỉ tiêu. */
export const RECOVERY_SEGMENTS: {
  key: "recorded" | "estimated" | "awaiting";
  label: string;
  className: string;
  style?: CSSProperties;
}[] = [
  { key: "recorded", label: "Đã ghi thu", className: "bg-primary" },
  { key: "estimated", label: "Theo giá trúng", className: "bg-success/60" },
  { key: "awaiting", label: "Chờ thu", className: "bg-card", style: AWAITING_STRIPES },
];
