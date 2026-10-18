import type { Database, Json } from "@/integrations/supabase/types";
import { slugify } from "@/lib/advertising/slug";

type PublicVillageRow = Database["public"]["Functions"]["public_craft_villages"]["Returns"][number];

/** Một hồ sơ số hoá đang hiện trong trang làng (chỉ cột an toàn). */
export interface PublicCraftAsset {
  posting_id: string;
  title: string | null;
  description: string | null;
  image_urls: string[];
  vr_url: string | null;
}

/** Một làng nghề trên bản đồ — RPC public_craft_villages (mỗi dòng một Trạm). Hồ sơ bìa đứng đầu `assets`. */
export type PublicCraftVillage = Omit<PublicVillageRow, "assets"> & { assets: PublicCraftAsset[] };

const isObj = (v: unknown): v is Record<string, Json> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : null);
const num = (v: unknown) => (typeof v === "number" ? v : Number(v));

export function parseCraftAssets(value: Json | null | undefined): PublicCraftAsset[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isObj).flatMap((a) => {
    const id = str(a.posting_id);
    if (!id) return [];
    const images = Array.isArray(a.image_urls) ? a.image_urls.filter((u): u is string => typeof u === "string") : [];
    return [{ posting_id: id, title: str(a.title), description: str(a.description), image_urls: images, vr_url: str(a.vr_url) }];
  });
}

export function parsePublicVillage(row: PublicVillageRow): PublicCraftVillage {
  return { ...row, assets: parseCraftAssets(row.assets) };
}

/** Thẻ "Hiện trong trang làng nghề" ở chi tiết hồ sơ — RPC owner_craft_map_state. */
export type CraftMapState =
  | { eligible: false }
  | {
      eligible: true;
      canEdit: boolean;
      reviewStatus: string | null;
      hasVr: boolean;
      hasImage: boolean;
      isPublished: boolean;
      /** null = Trạm chưa thiết lập Hồ sơ làng nghề. */
      village: { isPublished: boolean; isCover: boolean } | null;
    };

export function parseCraftMapState(value: Json | null | undefined): CraftMapState {
  if (!isObj(value) || value.eligible !== true) return { eligible: false };
  const v = value.village;
  return {
    eligible: true,
    canEdit: value.can_edit === true,
    reviewStatus: str(value.review_status),
    hasVr: value.has_vr === true,
    hasImage: value.has_image === true,
    isPublished: value.is_published === true,
    village: isObj(v) ? { isPublished: v.is_published === true, isCover: v.is_cover === true } : null,
  };
}

export interface CraftVillageProfile {
  latitude: number;
  longitude: number;
  province: string | null;
  product: string;
  intro: string | null;
  coverPostingId: string | null;
  isPublished: boolean;
  publishedAt: string | null;
}

/** Một hồ sơ của Trạm ở trang Hồ sơ làng nghề. */
export interface CraftVillageAsset {
  postingId: string;
  code: string | null;
  title: string | null;
  image: string | null;
  status: string | null;
  reviewStatus: string | null;
  /** Chủ đã bật "Hiện trong trang làng". */
  isPublished: boolean;
  /** Đang hiện thật (bật + đã duyệt + chưa huỷ). */
  visible: boolean;
  hasVr: boolean;
}

/** Trang "Hồ sơ làng nghề" — RPC owner_craft_village_profile. */
export type CraftVillageState =
  | { eligible: false }
  | {
      eligible: true;
      canEdit: boolean;
      canEditAssets: boolean;
      villageName: string;
      profile: CraftVillageProfile | null;
      assets: CraftVillageAsset[];
    };

export function parseCraftVillageState(value: Json | null | undefined): CraftVillageState {
  if (!isObj(value) || value.eligible !== true) return { eligible: false };
  const p = value.profile;
  const profile: CraftVillageProfile | null = isObj(p)
    ? {
        latitude: num(p.latitude),
        longitude: num(p.longitude),
        province: str(p.province),
        product: str(p.product) ?? "",
        intro: str(p.intro),
        coverPostingId: str(p.cover_posting_id),
        isPublished: p.is_published === true,
        publishedAt: str(p.published_at),
      }
    : null;
  const assets = (Array.isArray(value.assets) ? value.assets : []).filter(isObj).flatMap((a) => {
    const id = str(a.posting_id);
    if (!id) return [];
    return [{
      postingId: id,
      code: str(a.code),
      title: str(a.title),
      image: str(a.image),
      status: str(a.status),
      reviewStatus: str(a.review_status),
      isPublished: a.is_published === true,
      visible: a.visible === true,
      hasVr: a.has_vr === true,
    }];
  });
  return {
    eligible: true,
    canEdit: value.can_edit === true,
    canEditAssets: value.can_edit_assets === true,
    villageName: str(value.village_name) ?? "",
    profile,
    assets,
  };
}

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

const REASON_MESSAGES: Record<string, string> = {
  not_authenticated: "Vui lòng đăng nhập lại",
  not_found: "Không tìm thấy hoặc bạn không có quyền sửa",
  not_craft_village: "Chỉ tổ chức loại Làng nghề mới công khai được lên bản đồ",
  invalid_location: "Vị trí phải nằm trong lãnh thổ Việt Nam",
  invalid_product: "Sản phẩm chính cần từ 1 đến 80 ký tự",
  invalid_province: "Tỉnh / thành phố không hợp lệ",
  invalid_intro: "Giới thiệu tối đa 2.000 ký tự",
  invalid_cover: "Hồ sơ ảnh bìa không thuộc làng này",
  not_approved: "Hồ sơ cần được duyệt trước khi hiện trong trang làng",
  posting_closed: "Hồ sơ đã huỷ, không hiện được",
};

export function craftMapErrorMessage(reason: unknown): string {
  return (typeof reason === "string" && REASON_MESSAGES[reason]) || "Không lưu được, vui lòng thử lại";
}

const searchKey = (query: string) => slugify(query).replace(/-+/g, "-").replace(/^-|-$/g, "");

/** Lọc theo tên làng / tỉnh / sản phẩm chính / tên các hồ sơ, không phân biệt dấu. */
export function matchesVillage(
  v: Pick<PublicCraftVillage, "village_name" | "province" | "product"> & { assets: Pick<PublicCraftAsset, "title">[] },
  query: string,
): boolean {
  const q = searchKey(query);
  if (!q) return true;
  return [v.village_name, v.province, v.product, ...v.assets.map((a) => a.title)].some((field) =>
    slugify(field ?? "").includes(q),
  );
}

/** Tên hiển thị trên ghim: tên làng (Trạm); thiếu thì lấy tên hồ sơ bìa. */
export function villageLabel(v: Pick<PublicCraftVillage, "village_name"> & { assets: Pick<PublicCraftAsset, "title">[] }): string {
  return v.village_name?.trim() || v.assets[0]?.title?.trim() || "Làng nghề";
}

/** Dòng phụ trên ghim / danh sách: "Sản phẩm · Tỉnh · N sản phẩm" (chỉ ghi số khi > 1). */
export function villageSubtitle(v: Pick<PublicCraftVillage, "product" | "province"> & { assets: unknown[] }): string {
  const count = v.assets.length > 1 ? `${v.assets.length} sản phẩm` : null;
  return [v.product, v.province, count].filter(Boolean).join(" · ");
}

/** Làng chứa hồ sơ — giữ link cũ /lang-nghe?ho-so=<id>. */
export function villageOfAsset(villages: PublicCraftVillage[], postingId: string | null): PublicCraftVillage | null {
  if (!postingId) return null;
  return villages.find((v) => v.assets.some((a) => a.posting_id === postingId)) ?? null;
}
