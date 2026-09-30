import type { Database, Json } from "@/integrations/supabase/types";
import { slugify } from "@/lib/advertising/slug";

/** Một hồ sơ làng nghề đã công khai — RPC public_craft_villages (chỉ cột an toàn). */
export type PublicCraftVillage = Database["public"]["Functions"]["public_craft_villages"]["Returns"][number];

export interface CraftMapPublication {
  latitude: number;
  longitude: number;
  product: string;
  is_published: boolean;
  published_at: string | null;
}

/** Trạng thái thẻ "Công khai lên bản đồ làng nghề" — RPC owner_craft_map_state. */
export type CraftMapState =
  | { eligible: false }
  | {
      eligible: true;
      canEdit: boolean;
      reviewStatus: string | null;
      hasVr: boolean;
      hasImage: boolean;
      publication: CraftMapPublication | null;
    };

// Hộp bao khớp CHECK ở DB (gồm Hoàng Sa, Trường Sa).
export const VN_LAT_RANGE = [7, 24] as const;
export const VN_LNG_RANGE = [102, 118] as const;
/** Khung nhìn mặc định: đất liền + hai quần đảo. */
export const VN_BOUNDS: [[number, number], [number, number]] = [[8.2, 102.1], [23.4, 117.4]];

export function isVietnamCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= VN_LAT_RANGE[0] && lat <= VN_LAT_RANGE[1] &&
    lng >= VN_LNG_RANGE[0] && lng <= VN_LNG_RANGE[1]
  );
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v));

/** Đọc jsonb trả về từ owner_craft_map_state; dữ liệu lạ ⇒ coi như không áp dụng. */
export function parseCraftMapState(value: Json | null | undefined): CraftMapState {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.eligible !== true) {
    return { eligible: false };
  }
  const pub = value.publication;
  const publication: CraftMapPublication | null =
    pub && typeof pub === "object" && !Array.isArray(pub)
      ? {
          latitude: num(pub.latitude),
          longitude: num(pub.longitude),
          product: typeof pub.product === "string" ? pub.product : "",
          is_published: pub.is_published === true,
          published_at: typeof pub.published_at === "string" ? pub.published_at : null,
        }
      : null;
  return {
    eligible: true,
    canEdit: value.can_edit === true,
    reviewStatus: typeof value.review_status === "string" ? value.review_status : null,
    hasVr: value.has_vr === true,
    hasImage: value.has_image === true,
    publication,
  };
}

const REASON_MESSAGES: Record<string, string> = {
  not_authenticated: "Vui lòng đăng nhập lại",
  not_found: "Không tìm thấy hồ sơ hoặc bạn không có quyền sửa",
  not_craft_village: "Chỉ tổ chức loại Làng nghề mới công khai được lên bản đồ",
  invalid_location: "Vị trí phải nằm trong lãnh thổ Việt Nam",
  invalid_product: "Sản phẩm chính cần từ 1 đến 80 ký tự",
  not_approved: "Hồ sơ cần được duyệt trước khi công khai",
  posting_closed: "Hồ sơ đã huỷ, không công khai được",
};

export function craftMapErrorMessage(reason: unknown): string {
  return (typeof reason === "string" && REASON_MESSAGES[reason]) || "Không lưu được, vui lòng thử lại";
}

/** Lọc theo làng / hồ sơ / tỉnh / sản phẩm, không phân biệt dấu. */
export function matchesVillage(
  v: Pick<PublicCraftVillage, "village_name" | "title" | "province" | "product">,
  query: string,
): boolean {
  const q = slugify(query).replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!q) return true;
  return [v.village_name, v.title, v.province, v.product].some((field) => slugify(field ?? "").includes(q));
}

/** Tên hiển thị trên ghim: tên làng (không gian) — hồ sơ không tên thì lấy sản phẩm. */
export function villageLabel(v: Pick<PublicCraftVillage, "village_name" | "title">): string {
  return v.village_name?.trim() || v.title?.trim() || "Làng nghề";
}
