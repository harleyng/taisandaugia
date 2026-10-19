// Giá khởi điểm quy về tổng giá trị (kernel dùng chung với sàn đấu giá trực tuyến —
// docs/platform-ownership.md §7). Tách khỏi lib/reports/listingsReport để
// lib/auctionSessions/snapshot chép sang repo kia mà không kéo theo báo cáo admin.

/**
 * Giá trị khởi điểm quy đổi ra VND.
 * BẢN SAO của public.listing_start_value() — PER_MONTH trả null vì giá
 * thuê/tháng không phải giá khởi điểm đấu giá, cộng vào tổng sẽ sai.
 */
export function startValueOf(
  price: number | string | null | undefined,
  unit: string | null | undefined,
  area: number | string | null | undefined,
): number | null {
  const p = Number(price ?? 0);
  if (!Number.isFinite(p) || p <= 0) return null;
  if (unit === "PER_MONTH") return null;
  if (unit === "PER_SQM") {
    const a = Number(area ?? 0);
    return p * (Number.isFinite(a) && a !== 0 ? a : 1);
  }
  return p;
}
