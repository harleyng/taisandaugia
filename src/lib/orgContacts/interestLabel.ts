// Nhãn đọc được cho một dòng nhu cầu của khách (org_contact_interests).
// Chỉ HIỂN THỊ — luật so khớp nằm duy nhất ở SQL (org_session_audience).

import { CHILD_NAME, PARENT_NAME } from "@/constants/category.constants";
import { formatVnd } from "@/lib/advertising/slug";

export interface InterestLike {
  categories: string[];
  provinces: string[];
  price_min: number | null;
  price_max: number | null;
}

export const categoryLabel = (slug: string): string => PARENT_NAME[slug] ?? CHILD_NAME[slug] ?? slug;

export function priceBandLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${formatVnd(min)} – ${formatVnd(max)}`;
  if (min != null) return `Từ ${formatVnd(min)}`;
  return `Đến ${formatVnd(max)}`;
}

/** Ba vế: loại tài sản · khu vực · khoảng giá. Chiều bỏ trống = không giới hạn. */
export function interestParts(i: InterestLike): string[] {
  const parts = [
    i.categories.length > 0 ? i.categories.map(categoryLabel).join(", ") : "Mọi loại tài sản",
    i.provinces.length > 0 ? i.provinces.join(", ") : "Toàn quốc",
  ];
  const price = priceBandLabel(i.price_min, i.price_max);
  if (price) parts.push(price);
  return parts;
}

export const interestSummary = (i: InterestLike): string => interestParts(i).join(" · ");
