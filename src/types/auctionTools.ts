// Công cụ đấu giá — 4 công cụ hỗ trợ đấu giá (Số hoá / Định giá / Vay vốn / Pháp lý),
// mỗi công cụ có nhiều PROVIDER (đối tác ngoài hoặc SSCorp) kèm SHOWCASE trình bày.
//
// Truy cập DB qua untyped cast như các module back-office khác.

export type AuctionToolKey = "so-hoa" | "dinh-gia" | "vay-von" | "phap-ly";
export type ProviderStatus = "active" | "inactive";
export type ShowcaseKind = "tour_3d" | "image" | "video" | "link";
export type ShowcaseVisibility = "public" | "password";

export interface AuctionTool {
  id: string;
  key: AuctionToolKey;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuctionToolUpsert {
  id?: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  icon?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface AuctionToolProvider {
  id: string;
  tool_id: string;
  name: string;
  slug: string;
  is_own: boolean;
  supplier_id: string | null;
  service_id: string | null;
  service_variant_id: string | null;
  logo_url: string | null;
  tagline: string | null;
  description: string | null;
  website: string | null;
  price_label: string | null;
  sort_order: number;
  status: ProviderStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  tool?: { id: string; key: AuctionToolKey; name: string; slug: string } | null;
  supplier?: { id: string; name: string; code: string | null } | null;
  service?: { id: string; name: string; kind: string } | null;
  showcase_count?: number;
}

export interface AuctionToolProviderUpsert {
  id?: string;
  tool_id: string;
  name: string;
  slug: string;
  is_own?: boolean;
  supplier_id?: string | null;
  service_id?: string | null;
  service_variant_id?: string | null;
  logo_url?: string | null;
  tagline?: string | null;
  description?: string | null;
  website?: string | null;
  price_label?: string | null;
  sort_order?: number;
  status?: ProviderStatus;
}

export interface AuctionToolShowcase {
  id: string;
  provider_id: string;
  title: string;
  kind: ShowcaseKind;
  url: string;
  thumbnail_url: string | null;
  description: string | null;
  visibility: ShowcaseVisibility;
  access_password: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuctionToolShowcaseUpsert {
  id?: string;
  provider_id: string;
  title: string;
  kind: ShowcaseKind;
  url: string;
  thumbnail_url?: string | null;
  description?: string | null;
  visibility: ShowcaseVisibility;
  access_password?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

/** Hình dạng an toàn trả về từ RPC list_tool_showcases — không bao giờ có access_password;
 *  `url` chỉ có giá trị khi showcase public (is_locked=false). */
export interface PublicShowcase {
  id: string;
  title: string;
  kind: ShowcaseKind;
  thumbnail_url: string | null;
  description: string | null;
  visibility: ShowcaseVisibility;
  sort_order: number;
  url: string | null;
  is_locked: boolean;
}

/** Kết quả JSONB của request_tool_service. */
export interface RequestToolServiceResult {
  opportunity_id: string;
  lead_id: string | null;
  deduped: boolean;
}
