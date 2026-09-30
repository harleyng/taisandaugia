export type AssetOwnerKYCStatus = "draft" | "pending_review" | "approved" | "rejected";
export type AssetOwnerOrgKYCStatus = "draft" | "pending_review" | "under_review" | "approved" | "rejected";
export type AssetOwnerBranch = "individual" | "organization";
export type OrgType =
  | "bank_credit" | "amc" | "enforcement" | "state_agency" | "administrator"
  /** Làng nghề / HTX làng nghề — số hoá & công khai hồ sơ lên bản đồ /lang-nghe. */
  | "craft_village";
export type IdType = "cccd" | "passport";
/** Phân loại pháp nhân trong danh bạ public.asset_owners (rộng hơn OrgType). */
export type OwnerKind =
  | "individual" | "bank_credit" | "amc" | "enforcement"
  | "state_agency" | "company" | "other";
export type ClaimStatus = "auto_claimed" | "pending_confirmation" | "confirmed" | "rejected";
/** linked_entity = không gian chi nhánh, claim từ đúng thực thể asset_owner_id (không khớp tên). */
export type MatchBasis = "auto_name" | "manual_search" | "admin_assigned" | "linked_entity";
/** organization = KYC tổ chức đầy đủ; branch = chi nhánh, KYC rút gọn (Phase 13, D3). */
export type OrgKycScope = "organization" | "branch";
/** names = khớp mờ theo tên/alias; entity = chỉ tài sản đứng tên asset_owner_id (Trạm của chi nhánh). */
export type WorkspaceMatchScope = "names" | "entity";

export interface AssetOwnerKYC {
  id: string;
  user_id: string;
  status: AssetOwnerKYCStatus;
  full_name: string | null;
  phone: string | null;
  phone_verified: boolean;
  contact_email: string | null;
  id_type: IdType | null;
  id_number: string | null;
  /** Địa chỉ — Bên A trong hợp đồng dịch vụ đấu giá. Sửa được sau duyệt (owner_update_kyc_address). */
  address: string | null;
  ward: string | null;
  province: string | null;
  id_front_url: string | null;
  id_back_url: string | null;
  selfie_url: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetOwnerOrgKYC {
  id: string;
  created_by: string;
  status: AssetOwnerOrgKYCStatus;
  org_type: OrgType | null;
  org_name: string | null;
  /** Tên viết tắt / thường gọi. Hệ thống gợi ý sẵn, user sửa được; khi hồ sơ
   *  được duyệt sẽ chảy thẳng vào asset_owner_workspaces.abbreviations để khớp tài sản. */
  aliases: string[];
  tax_code: string | null;
  official_email: string | null;
  email_domain: string | null;
  linked_auction_org_id: string | null;
  /** Chủ tài sản trong danh bạ đã chọn ở ô "Tên theo Giấy phép / Quyết định
   *  thành lập". NULL = người khai tự nhập tay vì chưa có trong danh bạ. */
  linked_asset_owner_id: string | null;
  /** 'branch' ⇒ Trạm chỉ chứa tài sản của đúng thực thể chi nhánh; giấy tờ rút gọn. */
  kyc_scope: OrgKycScope;
  /** Công ty mẹ người khai chọn (chỉ với kyc_scope = 'branch'). */
  parent_asset_owner_id: string | null;
  registry_match_score: number | null;
  registry_match_data: Record<string, unknown> | null;
  rep_full_name: string | null;
  rep_title: string | null;
  rep_id_type: IdType | null;
  rep_id_number: string | null;
  rep_id_front_url: string | null;
  rep_id_back_url: string | null;
  rep_selfie_url: string | null;
  establishment_doc_url: string | null;
  authorization_doc_url: string | null;
  /** Địa chỉ trụ sở — Bên A trong hợp đồng dịch vụ đấu giá. Sửa được sau duyệt. */
  head_office_address: string | null;
  head_office_province: string | null;
  rejection_reason: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetOwnerWorkspace {
  id: string;
  org_kyc_id: string;
  owner_user_id: string;
  primary_name: string;
  abbreviations: string[];
  branch_names: string[];
  last_matched_at: string | null;
  total_claimed: number;
  /** Thực thể asset_owners mà không gian đại diện; NULL = tên tự nhập. */
  asset_owner_id: string | null;
  match_scope: WorkspaceMatchScope;
  /** Trạm trụ sở đã được chấp nhận liên kết (Phase 14); cây đúng một cấp. */
  parent_workspace_id: string | null;
  parent_linked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetOwnerClaim {
  id: string;
  workspace_id: string;
  listing_id: string | null;
  asset_owner_id: string | null;
  confidence_score: number | null;
  match_basis: MatchBasis | null;
  matched_name: string | null;
  status: ClaimStatus;
  confirmed_by: string | null;
  confirmed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  listing?: {
    title: string;
    price: number | null;
    property_type_slug: string | null;
    image_url: string | null;
    status: string | null;
    address: Record<string, unknown> | null;
    custom_attributes?: Record<string, unknown> | null;
    /** Mốc "Niêm yết" của Đường ống (Phase 12) — tuỳ chọn cho các nơi dựng claim bằng tay. */
    created_at?: string | null;
  };
  asset_owner?: { name: string; address: string | null };
}

/** Một dòng danh bạ chủ tài sản dùng cho typeahead ở KYC tổ chức. */
export interface RegistryAssetOwner {
  id: string;
  name: string;
  address: string | null;
  owner_kind: OwnerKind | null;
  aliases: string[];
  /** Có giá trị ⇒ đây là chi nhánh / đơn vị thành viên của công ty mẹ này. */
  parent_owner_id?: string | null;
  parent?: { id: string; name: string } | null;
}

/** Cột + embed công ty mẹ dùng chung cho mọi truy vấn danh bạ ở KYC tổ chức. */
export const REGISTRY_OWNER_SELECT =
  "id, name, address, owner_kind, aliases, parent_owner_id, parent:parent_owner_id(id, name)";

export const OWNER_KIND_LABELS: Record<OwnerKind, string> = {
  individual: "Cá nhân",
  bank_credit: "Ngân hàng / TCTD",
  amc: "AMC",
  enforcement: "Thi hành án",
  state_agency: "Cơ quan Nhà nước",
  company: "Doanh nghiệp",
  other: "Khác",
};

/**
 * owner_kind (danh bạ) → org_type (hồ sơ KYC). Chỉ 4 giá trị trùng nhau; các
 * loại còn lại (company/other/individual) không có ô tương ứng nên để người
 * khai tự chọn.
 */
export const OWNER_KIND_TO_ORG_TYPE: Partial<Record<OwnerKind, OrgType>> = {
  bank_credit: "bank_credit",
  amc: "amc",
  enforcement: "enforcement",
  state_agency: "state_agency",
};

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  bank_credit: "Ngân hàng / TCTD",
  amc: "AMC (Công ty quản lý tài sản)",
  enforcement: "Cơ quan Thi hành án",
  state_agency: "Cơ quan Nhà nước",
  administrator: "Quản tài viên",
  craft_village: "Làng nghề / HTX làng nghề",
};
