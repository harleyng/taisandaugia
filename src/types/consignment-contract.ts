// Hợp đồng dịch vụ đấu giá tài sản giữa CHỦ TÀI SẢN và TỔ CHỨC ĐẤU GIÁ — bước
// sau khi chủ tài sản chốt một báo giá (bảng consignment_contracts).
//
// Hai bên ký NGOÀI nền tảng (bản giấy), sàn chỉ giữ dự thảo, bản scan đã ký và
// hai lần xác nhận. Không phải `supplier_contracts` (hợp đồng hoa hồng giữa
// SÀN và tổ chức) — đừng lẫn.

import type { QuoteFeeItem, QuotePlan } from "./asset-posting";

export type ConsignmentContractStatus =
  | "drafting"
  | "awaiting_signatures"
  | "awaiting_confirmation"
  | "signed"
  | "cancelled";

export type ContractSide = "owner" | "org";

/** Báo giá được ĐÓNG BĂNG lúc chủ tài sản chốt — tổ chức không sửa được nữa. */
export interface ContractTerms {
  commission_pct: number | null;
  service_fee: number | null;
  starting_price: number | null;
  lead_time_days: number | null;
  plan: QuotePlan | null;
  fee_items: QuoteFeeItem[] | null;
  note: string | null;
  quote_doc_path: string | null;
  quoted_at: string | null;
}

/** Bên A — chủ tài sản. Chụp từ KYC (tổ chức ưu tiên, rồi cá nhân). */
export interface OwnerParty {
  kind: "individual" | "organization" | "unknown";
  full_name?: string | null;
  id_type?: "cccd" | "passport" | null;
  id_number?: string | null;
  phone?: string | null;
  email?: string | null;
  org_name?: string | null;
  tax_code?: string | null;
  rep_full_name?: string | null;
  rep_title?: string | null;
  rep_id_type?: "cccd" | "passport" | null;
  rep_id_number?: string | null;
  address?: string | null;
  ward?: string | null;
  province?: string | null;
}

/** Bên B — tổ chức đấu giá. Chụp từ org_general_info, thiếu thì từ danh bạ. */
export interface OrgParty {
  name: string | null;
  tax_code: string | null;
  address: string | null;
  ward: string | null;
  district: string | null;
  province: string | null;
  phone: string | null;
  email: string | null;
  legal_rep_name: string | null;
  legal_rep_position: string | null;
}

export interface AssetSnapshot {
  title: string;
  parent_slug: string;
  child_slug: string;
  address: string | null;
  ward: string | null;
  district: string | null;
  province: string | null;
  starting_price: number | null;
  pricing_mode: string | null;
  auction_format: string | null;
  has_dispute: boolean | null;
  has_mortgage: boolean | null;
  is_seized: boolean | null;
  right_to_sell: boolean | null;
  legal_notes: string | null;
}

export interface ConsignmentContract {
  id: string;
  code: string | null;
  contract_no: string | null;
  service_request_id: string;
  asset_posting_id: string;
  auction_org_id: string;
  organization_id: string;
  owner_user_id: string;
  opportunity_id: string | null;
  status: ConsignmentContractStatus;
  source: "platform" | "backfill";
  terms: ContractTerms;
  /** null trong bản chiếu của tổ chức — dùng OrgContractDetail.owner_party. */
  owner_party: OwnerParty | null;
  org_party: OrgParty | null;
  asset_snapshot: AssetSnapshot | null;
  draft_doc_path: string | null;
  draft_source: "generated" | "uploaded" | null;
  draft_uploaded_at: string | null;
  signed_doc_path: string | null;
  signed_uploaded_side: ContractSide | null;
  signed_uploaded_at: string | null;
  signed_date: string | null;
  owner_confirmed_at: string | null;
  org_confirmed_at: string | null;
  signed_at: string | null;
  cancelled_at: string | null;
  cancelled_side: ContractSide | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type ContractEventAction =
  | "created"
  | "draft_shared"
  | "signed_uploaded"
  | "confirmed"
  | "signed"
  | "cancelled";

export interface ContractEvent {
  action: ContractEventAction;
  side: ContractSide | null;
  created_at: string;
  data: Record<string, unknown> | null;
}

/** Thông tin pháp lý còn thiếu — chặn chia sẻ dự thảo / tải bản ký. */
export type MissingParty = "owner_address" | "org_legal_rep";

/** Bản chiếu RPC `org_consignment_contract` — thứ tổ chức được thấy. */
export interface OrgContractDetail {
  contract: ConsignmentContract;
  owner_party: OwnerParty | null;
  asset: AssetSnapshot | null;
  ownership_doc_paths: string[];
  events: ContractEvent[];
  can_act: boolean;
  missing: MissingParty[];
}

// ─── Nhãn ────────────────────────────────────────────────────────────────────

export const CONTRACT_STATUS_LABELS_OWNER: Record<ConsignmentContractStatus, string> = {
  drafting: "Tổ chức đang soạn hợp đồng",
  awaiting_signatures: "Chờ hai bên ký",
  awaiting_confirmation: "Chờ xác nhận bản đã ký",
  signed: "Đã ký hợp đồng",
  cancelled: "Đã huỷ hợp đồng",
};

export const CONTRACT_STATUS_LABELS_ORG: Record<ConsignmentContractStatus, string> = {
  drafting: "Cần soạn hợp đồng",
  awaiting_signatures: "Chờ ký & tải bản scan",
  awaiting_confirmation: "Chờ xác nhận bản đã ký",
  signed: "Đã ký hợp đồng",
  cancelled: "Đã huỷ hợp đồng",
};

export const CONTRACT_STATUS_BADGE_CLASS: Record<ConsignmentContractStatus, string> = {
  drafting: "bg-warning/10 text-warning",
  awaiting_signatures: "bg-primary/10 text-primary",
  awaiting_confirmation: "bg-accent/20 text-foreground",
  signed: "bg-success/10 text-success",
  cancelled: "bg-muted text-muted-foreground",
};

export const CONTRACT_SIDE_LABELS: Record<ContractSide, string> = {
  owner: "Chủ tài sản",
  org: "Tổ chức đấu giá",
};
