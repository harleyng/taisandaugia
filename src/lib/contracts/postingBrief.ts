// Tóm tắt hồ sơ số hoá của tài sản trong hợp đồng — mã HS, loại, nơi, ảnh — cho bảng
// và trang chi tiết menu "Hợp đồng". THUẦN.

import { CHILD_NAME } from "@/constants/category.constants";

export interface PostingBrief {
  id: string;
  /** "HS-0142". */
  code: string | null;
  title: string | null;
  category: string | null;
  /** "Bình Thạnh, TP.HCM". */
  location: string | null;
  imageUrl: string | null;
}

export interface PostingBriefRow {
  id: string;
  code: string | null;
  title: string | null;
  child_slug: string | null;
  district: string | null;
  province: string | null;
  image_urls: string[] | null;
}

export const POSTING_BRIEF_SELECT = "id, code, title, child_slug, district, province, image_urls";

export function toPostingBrief(r: PostingBriefRow): PostingBrief {
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    category: r.child_slug ? (CHILD_NAME[r.child_slug] ?? null) : null,
    location: [r.district, r.province].filter(Boolean).join(", ") || null,
    imageUrl: r.image_urls?.find(Boolean) ?? null,
  };
}

/**
 * Hồ sơ của một dòng hợp đồng. Mua bán không trỏ thẳng tới hồ sơ — đi qua hợp đồng
 * ký gửi gốc (`consignmentPostings`: id hợp đồng ký gửi → id hồ sơ).
 */
export function postingIdOfRow(
  row: { postingId: string | null; consignmentContractId: string | null },
  consignmentPostings: ReadonlyMap<string, string>,
): string | null {
  return row.postingId ?? (row.consignmentContractId ? consignmentPostings.get(row.consignmentContractId) ?? null : null);
}
