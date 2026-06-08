export type AssetOwnerKYCStatus = "draft" | "pending_review" | "approved" | "rejected";
export type AssetOwnerOrgKYCStatus = "draft" | "pending_review" | "under_review" | "approved" | "rejected";
export type AssetOwnerBranch = "individual" | "organization";
export type OrgType = "bank_credit" | "amc" | "enforcement" | "state_agency" | "administrator";
export type IdType = "cccd" | "passport";
export type ClaimStatus = "auto_claimed" | "pending_confirmation" | "confirmed" | "rejected";
export type MatchBasis = "auto_name" | "manual_search" | "admin_assigned";

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
  tax_code: string | null;
  official_email: string | null;
  email_domain: string | null;
  linked_auction_org_id: string | null;
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
  };
  asset_owner?: { name: string; address: string | null };
}

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  bank_credit: "Ngân hàng / TCTD",
  amc: "AMC (Công ty quản lý tài sản)",
  enforcement: "Cơ quan Thi hành án",
  state_agency: "Cơ quan Nhà nước",
  administrator: "Quản tài viên",
};
