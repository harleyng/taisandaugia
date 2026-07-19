// Nhãn + màu cho 3 nguồn doanh thu. Tách file dùng chung vì trước đây các map
// này nằm private trong RevenueByServiceTable.tsx — thêm nguồn thứ ba ở đó sẽ
// render pill không style và ô "Nguồn" rỗng ở các bảng khác.

export type RevenueSource = "credit" | "direct" | "commission";

export const SOURCE_LABELS: Record<RevenueSource, string> = {
  credit: "Nạp credit",
  direct: "Dịch vụ trực tiếp",
  commission: "Hoa hồng môi giới",
};

export const SOURCE_BADGE_CLASS: Record<RevenueSource, string> = {
  credit: "bg-amber-100 text-amber-700",
  direct: "bg-blue-100 text-blue-700",
  commission: "bg-emerald-100 text-emerald-700",
};

/** Màu biểu đồ — phải có đủ 3 khoá, các chart không có `??` fallback. */
export const SOURCE_COLORS: Record<RevenueSource, string> = {
  credit: "hsl(43 96% 56%)",
  direct: "hsl(210 90% 45%)",
  commission: "hsl(160 84% 39%)",
};

export const sourceLabel = (s: string): string =>
  SOURCE_LABELS[s as RevenueSource] ?? s;
