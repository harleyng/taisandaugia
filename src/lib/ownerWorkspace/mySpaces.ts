// Màn "Tài sản của tôi" ở hồ sơ người dùng (design 979d4c55 "Tai San Cua Toi - Cong
// Nguoi Dung"): lưới thẻ không gian Chủ tài sản + thẻ trạng thái hồ sơ xác thực.
// Hàm thuần — hook useMyOwnerSpaces chỉ nạp dữ liệu rồi gọi vào đây.

import type { AssetOwnerKYCStatus, AssetOwnerOrgKYCStatus } from "@/types/asset-owner";

export type KycTileStatus = "draft" | "pending" | "rejected";

/** Thẻ hồ sơ xác thực CHƯA được duyệt (đã duyệt thì thành thẻ không gian). */
export interface KycTile {
  key: string;
  kind: "individual" | "organization";
  name: string;
  status: KycTileStatus;
  rejectionReason: string | null;
}

/** Trạng thái của cả màn — quyết định dòng mô tả dưới tiêu đề. */
export type MySpacesState = "ok" | "rejected" | "pending" | "draft" | "none";

export function kycTileStatus(status: AssetOwnerKYCStatus | AssetOwnerOrgKYCStatus): KycTileStatus | null {
  if (status === "approved") return null;
  if (status === "rejected") return "rejected";
  if (status === "draft") return "draft";
  return "pending";
}

export function mySpacesState(spaceCount: number, kycTiles: KycTile[]): MySpacesState {
  if (spaceCount > 0) return "ok";
  if (kycTiles.some((t) => t.status === "rejected")) return "rejected";
  if (kycTiles.some((t) => t.status === "pending")) return "pending";
  if (kycTiles.length > 0) return "draft";
  return "none";
}

export const MY_SPACES_SUBTITLE: Record<MySpacesState, string> = {
  ok: "Chọn không gian Chủ tài sản để vào Trạm điều hành.",
  rejected: "Hồ sơ cần chỉnh sửa trước khi được duyệt.",
  pending: "Hồ sơ đang được xét duyệt, kết quả gửi qua email.",
  draft: "Hoàn tất hồ sơ xác thực để mở Trạm điều hành.",
  none: "Bán tài sản nhanh hơn và không lỡ bước nào, từ lúc đăng tin đến khi thu đủ tiền.",
};

// Tiền tố pháp lý không nói lên đơn vị là ai — bỏ khi lấy chữ viết tắt.
const GENERIC_WORDS = new Set([
  "ngân", "hàng", "tmcp", "công", "ty", "cổ", "phần", "tnhh", "mtv", "chi", "nhánh", "cn",
  "trung", "tâm", "cục", "sở", "phòng", "và", "của",
]);

/** Chữ viết tắt 2–4 ký tự cho ô biểu tượng ("Ngân hàng TMCP An Phát" → "AP"). */
export function spaceInitials(name: string, abbreviations: readonly string[] = []): string {
  const abbr = abbreviations.find((a) => /^[\p{L}\d]{2,4}$/u.test(a.trim()));
  if (abbr) return abbr.trim().toUpperCase();
  const words = name.split(/[\s–\-,.()]+/).filter(Boolean);
  const significant = words.filter((w) => !GENERIC_WORDS.has(w.toLocaleLowerCase("vi")));
  const pool = significant.length > 0 ? significant : words;
  const initials = pool.slice(0, 2).map((w) => w[0]).join("");
  return (initials || name.slice(0, 2) || "?").toLocaleUpperCase("vi");
}
