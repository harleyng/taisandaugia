// Hợp đồng mua bán tài sản đấu giá — kiểu dữ liệu dùng chung.
//
// Bảng do migration 20260914000001_auction_sale_contracts.sql sở hữu. Sinh mã
// Supabase gõ mọi cột CHECK là `string`, nên ở đây ta Omit rồi giao lại bằng
// union: thêm một giá trị vào union mà quên nhãn sẽ là lỗi biên dịch.

import type { Tables } from "@/integrations/supabase/types";

type ContractRow = Tables<"auction_sale_contracts">;
type InstallmentRow = Tables<"auction_sale_installments">;
type PaymentRow = Tables<"auction_sale_payments">;
type EventRow = Tables<"auction_sale_contract_events">;

export type SaleContractStatus =
  | "drafting"
  | "awaiting_signatures"
  | "awaiting_confirmation"
  | "signed"
  | "completed"
  | "cancelled";

/** Ba vai trên một hợp đồng. `seller` có thể do tổ chức đóng thay (org_on_behalf). */
export type SaleSide = "buyer" | "seller" | "org";

export type SaleSellerKind = "owner_user" | "org_on_behalf";
export type SalePayeeSide = "seller" | "org";
export type SaleCancelKind = "buyer_refused" | "seller_refused" | "mutual";
export type SalePaymentMethod = "bank_transfer" | "cash" | "vnpay_mock" | "other";
export type SaleTitleTransferStatus = "not_required" | "pending" | "submitted" | "completed";
export type SaleDraftSource = "generated" | "uploaded";

/** Giai đoạn SUY RA (không phải cột) — soi gương SQL `sale_contract_stage`. */
export type SaleStage = "signing" | "paying" | "handover" | "completed" | "cancelled";

export type SaleContract = Omit<
  ContractRow,
  | "status"
  | "seller_kind"
  | "payee_side"
  | "cancel_kind"
  | "cancelled_side"
  | "signed_uploaded_side"
  | "title_transfer_status"
  | "draft_source"
> & {
  status: SaleContractStatus;
  seller_kind: SaleSellerKind;
  payee_side: SalePayeeSide;
  cancel_kind: SaleCancelKind | null;
  cancelled_side: SaleSide | null;
  signed_uploaded_side: SaleSide | null;
  title_transfer_status: SaleTitleTransferStatus;
  draft_source: SaleDraftSource | null;
};

export type SaleInstallment = InstallmentRow;

export type SalePayment = Omit<PaymentRow, "method"> & { method: SalePaymentMethod };

export type SaleContractEventAction =
  | "created"
  | "terms_updated"
  | "draft_shared"
  | "signed_uploaded"
  | "confirmed"
  | "signed"
  | "payment"
  | "payment_reversed"
  | "handover_scheduled"
  | "handover_confirmed"
  | "handed_over"
  | "title_transfer"
  | "completed"
  | "cancelled";

export type SaleContractEvent = Omit<EventRow, "action" | "side"> & {
  action: SaleContractEventAction;
  side: SaleSide | null;
};

// ─── Bản chiếu các bên (JSONB, server dựng lúc tạo / chia sẻ dự thảo) ───────

export interface SaleBuyerParty {
  dossier_code?: string | null;
  bidder_no?: number | null;
  full_name?: string | null;
  id_type?: string | null;
  id_number?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

/**
 * Bên bán có HAI hình dạng khác nhau, tuỳ nguồn của lô:
 *  - lô ký gửi  → bản chiếu KYC chủ tài sản (kind individual | organization)
 *  - lô tin đăng → thực thể danh bạ (kind 'registry'), KHÔNG có CCCD/điện thoại
 */
export interface SaleSellerParty {
  kind?: "individual" | "organization" | "registry" | "unknown" | string | null;
  name?: string | null;
  full_name?: string | null;
  org_name?: string | null;
  tax_code?: string | null;
  id_type?: string | null;
  id_number?: string | null;
  rep_full_name?: string | null;
  rep_title?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  ward?: string | null;
  province?: string | null;
  owner_kind?: string | null;
}

export interface SaleOrgParty {
  name?: string | null;
  tax_code?: string | null;
  address?: string | null;
  ward?: string | null;
  district?: string | null;
  province?: string | null;
  phone?: string | null;
  email?: string | null;
  legal_rep_name?: string | null;
  legal_rep_position?: string | null;
}

export interface SaleAssetSnapshot {
  lot_no?: number | null;
  title?: string | null;
  category_slug?: string | null;
  province?: string | null;
  district?: string | null;
  image_url?: string | null;
  starting_price?: number | null;
  source?: string | null;
  session_code?: string | null;
  session_title?: string | null;
  session_ends_at?: string | null;
}

// ─── Envelope của RPC ───────────────────────────────────────────────────────
// Sinh mã gõ mọi RPC là `Json`, nên union khai ở đây và ép kiểu tại biên hook.

export interface SaleRpcFail {
  ok: false;
  reason: string;
  [key: string]: unknown;
}

export interface CreateSaleContractOk {
  ok: true;
  id: string;
  code: string | null;
  deposit_credit: number;
  seller_kind: SaleSellerKind;
}

export interface RecordSalePaymentOk {
  ok: true;
  payment_id: string;
  balance: number;
  settled: boolean;
}

export interface ReverseSalePaymentOk {
  ok: true;
  reversal_id: string;
  balance: number;
}

export interface CancelSaleContractOk {
  ok: true;
  status: "cancelled";
  cancel_kind: SaleCancelKind;
  deposit_forfeited: boolean;
  deposit_pending_refund: boolean;
}

export interface ConfirmHandoverOk {
  ok: true;
  handed_over: boolean;
  completed: boolean;
}

export interface SaleCanAct {
  buyer: boolean;
  seller: boolean;
  org: boolean;
}

/** Một vòng gọi cho cả trang chi tiết — RPC `sale_contract_detail`. */
export interface SaleContractDetail {
  ok: true;
  contract: SaleContract;
  stage: SaleStage;
  balance: number;
  net_paid: number;
  installments: SaleInstallment[];
  payments: SalePayment[];
  events: SaleContractEvent[];
  can_act: SaleCanAct;
}

export interface OrgSaleContractCounts {
  open: number;
  action_needed: number;
  overdue: number;
}

export type OwnerSaleAction = "confirm_signed" | "confirm_handover" | "none";

export interface OwnerSaleContractRow {
  contract_id: string;
  code: string | null;
  status: SaleContractStatus;
  stage: SaleStage;
  owner_action: OwnerSaleAction;
}

// ─── Nhãn tiếng Việt ────────────────────────────────────────────────────────

export const SALE_STAGE_LABELS: Record<SaleStage, string> = {
  signing: "Chờ ký hợp đồng",
  paying: "Chờ thanh toán",
  handover: "Chờ bàn giao",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
};

export const SALE_STATUS_LABELS: Record<SaleContractStatus, string> = {
  drafting: "Đang soạn",
  awaiting_signatures: "Chờ ký",
  awaiting_confirmation: "Chờ xác nhận bản ký",
  signed: "Đã ký",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
};

export const SALE_SIDE_LABELS: Record<SaleSide, string> = {
  buyer: "Bên mua",
  seller: "Bên bán",
  org: "Tổ chức đấu giá",
};

export const SALE_SELLER_KIND_LABELS: Record<SaleSellerKind, string> = {
  owner_user: "Chủ tài sản tự ký",
  org_on_behalf: "Tổ chức đấu giá ký thay",
};

export const SALE_PAYEE_LABELS: Record<SalePayeeSide, string> = {
  org: "Tổ chức đấu giá thu hộ",
  seller: "Bên bán thu trực tiếp",
};

export const SALE_CANCEL_KIND_LABELS: Record<SaleCancelKind, string> = {
  buyer_refused: "Bên mua từ chối ký",
  seller_refused: "Bên bán từ chối ký",
  mutual: "Hai bên thoả thuận huỷ",
};

/** Hậu quả tiền đặt trước của từng loại huỷ — hiện ngay trong hộp thoại huỷ. */
export const SALE_CANCEL_CONSEQUENCES: Record<SaleCancelKind, string> = {
  buyer_refused:
    "Tiền đặt trước của người trúng đấu giá bị MẤT và lô được ghi nhận là không thanh toán.",
  seller_refused: "Tiền đặt trước của người trúng đấu giá chuyển sang chờ hoàn trả.",
  mutual: "Tiền đặt trước của người trúng đấu giá chuyển sang chờ hoàn trả.",
};

export const SALE_PAYMENT_METHOD_LABELS: Record<SalePaymentMethod, string> = {
  bank_transfer: "Chuyển khoản",
  cash: "Tiền mặt",
  vnpay_mock: "VNPay (mô phỏng)",
  other: "Khác",
};

export const SALE_TITLE_TRANSFER_LABELS: Record<SaleTitleTransferStatus, string> = {
  not_required: "Không phải sang tên",
  pending: "Chưa nộp hồ sơ",
  submitted: "Đã nộp hồ sơ",
  completed: "Đã sang tên xong",
};
