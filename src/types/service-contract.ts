// Hợp đồng cung ứng dịch vụ (HDCU) giữa CHỦ TÀI SẢN và SÀN — giao kết điện tử khi
// chủ tài sản bấm đồng ý, TRƯỚC khi trả tiền một trong 4 dịch vụ (VR tour, giám
// định, tư vấn pháp lý, tư vấn đấu giá). Bảng service_contracts chỉ ghi thêm.
//
// Khác consignment_contracts (chủ tài sản ↔ tổ chức đấu giá, ký ngoài sàn) và
// supplier_contracts (sàn ↔ đối tác, hoa hồng) — đừng lẫn.

import type { ServiceKindKey } from "@/lib/serviceRequests/kinds";
import type { OwnerParty } from "@/types/consignment-contract";

/** Bên A: KYC suy từ hồ sơ + người đã bấm đồng ý. */
export interface ServiceOwnerParty extends OwnerParty {
  signatory?: { user_id: string; name: string | null; email: string | null } | null;
}

/** Bên B: sàn (từ mẫu đang áp dụng lúc đồng ý) + đơn vị thực hiện. */
export interface ServiceProviderParty {
  name: string | null;
  tax_code: string | null;
  address: string | null;
  representative: string | null;
  rep_title: string | null;
  email: string | null;
  partner_name: string | null;
  expert_name: string | null;
}

/** Dữ kiện đơn đóng băng lúc đồng ý. */
export interface ServiceContractTerms {
  service_label: string;
  order_code: string;
  package_name: string | null;
  posting_title: string | null;
  price: number;
  quote_note: string | null;
  quoted_at: string;
  quote_expires_at: string | null;
  extra: Record<string, unknown> | null;
}

export interface ServiceContract {
  id: string;
  code: string;
  service_kind: ServiceKindKey;
  order_id: string;
  order_code: string;
  asset_posting_id: string;
  quoted_at: string;
  price: number;
  template_id: string;
  template_version: string;
  owner_party: ServiceOwnerParty;
  provider_party: ServiceProviderParty;
  terms: ServiceContractTerms;
  content_hash: string;
  accepted_by: string;
  accepted_at: string;
}

export interface ServiceContractOrderState {
  status: string;
  quoted_at: string | null;
  quoted_price: number | null;
  paid_at: string | null;
  done_at: string | null;
  cancelled_at: string | null;
}

/** RPC service_contract_detail. */
export interface ServiceContractDetail {
  contract: ServiceContract;
  template: { id: string; version: string; effective_date: string; clauses: Record<string, unknown> };
  order: ServiceContractOrderState | null;
  /** false khi admin đã báo giá lại sau lần đồng ý này. */
  is_current: boolean;
  accepted_by_name: string | null;
}

/** Dòng RPC owner_service_contracts. */
export interface OwnerServiceContractRow {
  service_kind: ServiceKindKey;
  order_id: string;
  order_code: string;
  asset_posting_id: string;
  posting_title: string | null;
  package_name: string | null;
  partner_name: string | null;
  order_status: string;
  quoted_price: number | null;
  quoted_at: string | null;
  quote_expires_at: string | null;
  paid_at: string | null;
  done_at: string | null;
  cancelled_at: string | null;
  contract_id: string | null;
  contract_code: string | null;
  accepted_at: string | null;
  /** Báo giá hiện hành chưa ai đồng ý (và chưa hết hạn). */
  needs_acceptance: boolean;
  /** Người đang xem là người gửi yêu cầu và còn quyền ghi — mới được đồng ý/trả. */
  can_accept: boolean;
  /** Đã trả trước khi có hợp đồng điện tử. */
  legacy: boolean;
  created_at: string;
}

/** Đơn đang chờ đồng ý — đủ để mở hộp thoại đồng ý từ thẻ đơn. */
export interface ServiceOrderForContract {
  kind: ServiceKindKey;
  id: string;
  code: string;
  asset_posting_id: string;
  status: string;
  quoted_price: number | null;
  quoted_at: string | null;
  quote_expires_at: string | null;
  quote_note: string | null;
  package_name: string | null;
  partner_name: string | null;
  expert_name?: string | null;
  posting_title: string | null;
}
