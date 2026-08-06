// Khách hàng tiềm năng của sàn — suy ra từ dữ liệu tài sản đã có (listings +
// asset_postings), KHÔNG phải bảng CRM. Nguồn: RPC admin_prospects /
// admin_prospect_detail (SECURITY DEFINER, chặn theo has_role ADMIN).

export type ProspectKind = "asset_owner" | "auction_org";

/** Trạng thái quan hệ giữa prospect và sàn. */
export type OnboardStatus = "none" | "kyc_pending" | "onboarded";

export const ONBOARD_STATUS_LABELS: Record<OnboardStatus, string> = {
  none: "Chưa liên hệ",
  kyc_pending: "Đang KYC",
  onboarded: "Đã là khách hàng",
};

/** Cá nhân hay pháp nhân. Chỉ chủ tài sản mới có thể là cá nhân — tổ chức đấu
 *  giá theo luật luôn là pháp nhân (Trung tâm DVĐG hoặc doanh nghiệp ĐGTS). */
export type EntityType = "individual" | "organization";

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  individual: "Cá nhân",
  organization: "Tổ chức",
};

/** Loại hình hiển thị. Chi nhánh cũng là một khách hàng tiềm năng độc lập trong
 *  danh sách, nên phải nhìn ra ngay nó là trụ sở chính hay đơn vị trực thuộc —
 *  suy từ việc có công ty mẹ hay không, không phải cột riêng trong DB. */
export type EntityRole = "individual" | "main" | "branch";

export const ENTITY_ROLE_LABELS: Record<EntityRole, string> = {
  individual: "Cá nhân",
  main: "Tổ chức - Chính",
  branch: "Tổ chức - Chi nhánh",
};

export const entityRole = (
  entityType: EntityType | null | undefined,
  parentId: string | null | undefined,
): EntityRole =>
  entityType === "individual" ? "individual" : parentId ? "branch" : "main";

/** Hình thức chi tiết. Chủ tài sản lấy từ asset_owners.owner_kind, tổ chức đấu
 *  giá quy đổi từ auction_organizations.org_type (0/1/2/11) trong RPC. */
export type ProspectSubtype =
  | "individual" | "bank_credit" | "amc" | "enforcement" | "state_agency" | "company"
  | "center" | "enterprise" | "branch"
  | "other";

/** Nhãn CỐ Ý ngắn: mọi chỗ dùng đều là cột bảng hoặc dòng phụ, nhãn dài vỡ
 *  thành ba dòng và bóp méo cả cột. Tên pháp lý đầy đủ nằm ở trang chi tiết. */
export const PROSPECT_SUBTYPE_LABELS: Record<ProspectSubtype, string> = {
  individual: "Cá nhân",
  bank_credit: "Ngân hàng",
  amc: "Công ty AMC",
  enforcement: "Thi hành án",
  state_agency: "Cơ quan nhà nước",
  company: "Doanh nghiệp",
  center: "Trung tâm ĐGTS",
  enterprise: "DN đấu giá",
  branch: "Chi nhánh",
  other: "Khác",
};

export const prospectSubtypeLabel = (s: string | null | undefined) =>
  (s && PROSPECT_SUBTYPE_LABELS[s as ProspectSubtype]) || "Chưa phân loại";

/**
 * Hình thức chi tiết có đáng hiện thành dòng phụ dưới vai trò không.
 *
 * Chi nhánh gần như luôn mang lĩnh vực của công ty mẹ — "Chi nhánh Vietcombank"
 * kèm "Ngân hàng" chỉ lặp lại thứ đã đọc được ở tên, lại còn trông như hai cách
 * phân loại đang chọi nhau. Ngoại lệ duy nhất là AMC: công ty quản lý nợ &
 * khai thác tài sản là một dạng đơn vị trực thuộc KHÁC hẳn chi nhánh thường,
 * giấu đi thì mất thông tin thật.
 *
 * Chỉ áp cho dòng phụ. Cột "Hình thức" đứng riêng (BranchTable) vẫn hiện đủ —
 * ở đó nó là nội dung chính của cột, để trống sẽ thành bảng thủng.
 */
export const showSubtypeUnderRole = (
  role: EntityRole,
  subtype: ProspectSubtype | null | undefined,
): boolean => {
  if (!subtype) return false;
  if (role === "individual") return false;       // trùng y hệt nhãn vai trò
  if (role === "branch") return subtype === "amc";
  return subtype !== "other";                     // "Khác" không nói lên điều gì
};

/** Quan hệ chi nhánh do máy suy ra từ tên, hay do admin xác nhận. */
export type ParentRelation = "inferred" | "confirmed";

export const PARENT_RELATION_LABELS: Record<ParentRelation, string> = {
  inferred: "Hệ thống suy ra",
  confirmed: "Đã xác nhận",
};

export interface ProspectRow {
  id: string;
  kind: ProspectKind;
  name: string;
  address: string | null;
  aliases: string[];
  entity_type: EntityType;
  subtype: ProspectSubtype | null;
  /** Công ty mẹ — chỉ có khi bản ghi này là chi nhánh/đơn vị thành viên. */
  parent_id: string | null;
  parent_name: string | null;
  /** Số đơn vị thành viên trực thuộc. */
  branch_count: number;
  total_listings: number;
  total_starting_price: number;
  province_count: number;
  top_province: string | null;
  /** Tên hiển thị (đã resolve từ property_types trong RPC), không phải slug. */
  top_asset_type: string | null;
  posting_count: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
  onboard_status: OnboardStatus;
  workspace_id: string | null;
  lead_id: string | null;
}

/** Một lát cắt trong cơ cấu tài sản. */
export interface DistSlice {
  label: string;
  count: number;
  value: number;
  pct: number;
}

export interface CounterpartySlice extends DistSlice {
  id: string | null;
}

export interface MonthPoint {
  month: string;
  count: number;
  value: number;
}

/** 4 cờ pháp lý của tài sản user tự đăng (asset_postings) — thang đo KHÁC
 *  listings.legal_status nên cố ý để riêng, không gộp vào by_legal. */
export interface LegalFlags {
  total: number;
  has_dispute: number;
  has_mortgage: number;
  is_seized: number;
  clean: number;
}

/** Cụm do admin tự đặt tên (VD "Cụm miền Bắc"), nằm DƯỚI một công ty mẹ cụ thể
 *  chứ không phải nhãn tự do dùng chung toàn sàn. */
export interface ProspectGroup {
  id: string;
  name: string;
  sort_order: number;
  unit_count: number;
  listing_count: number;
  starting_price_sum: number;
}

/** Nhãn cho chi nhánh chưa được xếp vào cụm nào. */
export const UNGROUPED_LABEL = "Chưa xếp cụm";

/** Đơn vị thành viên / chi nhánh / AMC trực thuộc một prospect. */
export interface ProspectBranch {
  id: string;
  kind: ProspectKind;
  name: string;
  subtype: ProspectSubtype | null;
  province: string | null;
  listing_count: number;
  starting_price_sum: number;
  relation: ParentRelation;
  is_amc: boolean;
  group_id: string | null;
  group_name: string | null;
}

export interface ProspectDetail {
  profile: {
    id: string;
    kind: ProspectKind;
    name: string;
    address: string | null;
    aliases: string[];
    entity_type: EntityType;
    subtype: ProspectSubtype | null;
    /** Có giá trị khi chính prospect này là chi nhánh của đơn vị khác. */
    parent: { id: string; name: string } | null;
  };
  /** Số tài sản khách tự đăng (asset_postings) — chỉ có sau khi onboard. */
  postings_count: number;
  legal_flags: LegalFlags;
  groups: ProspectGroup[];
  branches: ProspectBranch[];
  /** Lịch sử đấu giá đầy đủ (RPC chặn trên 500 dòng), mới nhất trước.
   *  KPI và các biểu đồ theo tin đều gộp từ mảng này ở client — xem
   *  lib/prospects/auctionHistory.ts — để bộ lọc chi phối được toàn bộ tab. */
  history: AuctionHistoryRow[];
}

export interface AuctionHistoryRow {
  id: string;
  title: string;
  price: number;
  province: string | null;
  asset_type: string | null;
  legal_status: string | null;
  /** Chờ đấu / Đang đấu / Đã thành / Không thành / Tồn đọng */
  bucket: string;
  round_count: number;
  win_price: number | null;
  auction_at: string | null;
  created_at: string;
  /** Đối tác của giao dịch: chủ tài sản → tổ chức đấu giá, và ngược lại. */
  counterparty_id: string | null;
  counterparty: string | null;
  /** Đơn vị SỞ HỮU tin — trụ sở chính cũng là một đơn vị mang tên chính nó,
   *  không phải "phần còn lại". Nhờ vậy phân bổ theo chi nhánh đọc được ngay ai
   *  đóng góp bao nhiêu. */
  unit_id: string;
  unit_name: string;
  /** Cụm của đơn vị sở hữu. NULL với tin của chính trụ sở (trụ sở không thuộc
   *  cụm nào) và với chi nhánh chưa xếp cụm. */
  group_id: string | null;
  group_name: string | null;
}

/** Kết quả suggest_org_aliases — dùng chung onboarding (Tier-1) và portal. */
export interface AliasSuggestion {
  aliases: string[];
  candidates: { id: string; name: string; listing_count: number; is_amc: boolean; score: number }[];
  total_listings: number;
  total_starting_price: number;
}
