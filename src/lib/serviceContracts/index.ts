// Hợp đồng cung ứng dịch vụ (HDCU): nhãn, giai đoạn, lỗi RPC, đường dẫn.
// Thuần — không Supabase, không React — để kiểm thử được.

import { serviceGroupOf, type ServiceGroupKey } from "@/lib/serviceRequests/groups";
import type { ServiceKindKey } from "@/lib/serviceRequests/kinds";
import { ownerPostingPath, vrTourCheckoutPath } from "@/lib/vrTour/paths";
import { authenticationCheckoutPath, ownerAuthenticationPath } from "@/lib/authentication/paths";
import { ownerValuationPath, valuationCheckoutPath } from "@/lib/valuation/paths";
import { legalConsultCheckoutPath, ownerLegalConsultPath } from "@/lib/legalConsult/paths";
import { auctionConsultCheckoutPath, ownerAuctionConsultPath } from "@/lib/auctionConsult/paths";
import { serviceTemplateType, type ContractTemplateType } from "@/lib/contracts/templates/schema";
import type {
  ServiceContractTerms,
  ServiceOrderForContract,
  ServiceProviderParty,
} from "@/types/service-contract";

/** Nhãn dịch vụ dùng TRONG HỢP ĐỒNG (đầy đủ hơn nhãn tab admin). */
export const SERVICE_CONTRACT_LABELS: Record<ServiceKindKey, string> = {
  "vr-tour": "VR tour",
  "giam-dinh": "Giám định tài sản",
  "tu-van-phap-ly": "Tư vấn pháp lý",
  "tu-van-dau-gia": "Tư vấn đấu giá",
  "tham-dinh": "Thẩm định giá tài sản",
};

export const templateTypeOfService = (kind: ServiceKindKey): ContractTemplateType => serviceTemplateType(kind);

// ─── Giai đoạn hợp đồng (suy từ trạng thái đơn, không lưu) ──────────────────

export type ServiceContractStage =
  | "awaiting_acceptance"
  | "awaiting_payment"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "requoted";

export const SERVICE_CONTRACT_STAGE_LABELS: Record<ServiceContractStage, string> = {
  awaiting_acceptance: "Chờ đồng ý",
  awaiting_payment: "Chờ thanh toán",
  in_progress: "Đang thực hiện",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
  requoted: "Đã báo giá lại",
};

const GROUP_TO_STAGE: Record<ServiceGroupKey, ServiceContractStage> = {
  "cho-bao-gia": "awaiting_acceptance",
  "cho-thanh-toan": "awaiting_payment",
  "dang-thuc-hien": "in_progress",
  "hoan-tat": "completed",
  "da-huy": "cancelled",
};

/**
 * @param accepted  đã có hợp đồng cho BÁO GIÁ HIỆN HÀNH của đơn
 * @param isCurrent false khi admin báo giá lại sau lần đồng ý đang xem
 */
export function serviceContractStageOf(
  orderStatus: string | null | undefined,
  accepted: boolean,
  isCurrent = true,
): ServiceContractStage {
  if (accepted && !isCurrent) return "requoted";
  if (orderStatus === "quoted") return accepted ? "awaiting_payment" : "awaiting_acceptance";
  const group = orderStatus ? serviceGroupOf(orderStatus) : null;
  return group ? GROUP_TO_STAGE[group] : "in_progress";
}

// ─── Đường dẫn ───────────────────────────────────────────────────────────────

/** Nơi đặt thẻ đơn (nút Thanh toán) trong hồ sơ số hoá. */
export function serviceOrderOwnerPath(kind: ServiceKindKey, postingId: string): string {
  if (kind === "tu-van-phap-ly") return ownerLegalConsultPath(postingId);
  if (kind === "tu-van-dau-gia") return ownerAuctionConsultPath(postingId);
  if (kind === "tham-dinh") return ownerValuationPath(postingId);
  if (kind === "giam-dinh") return ownerAuthenticationPath(postingId);
  return ownerPostingPath(postingId);
}

export function serviceCheckoutPath(kind: ServiceKindKey, orderId: string, postingId: string): string {
  switch (kind) {
    case "vr-tour":
      return vrTourCheckoutPath(orderId, postingId);
    case "giam-dinh":
      return authenticationCheckoutPath(orderId, postingId);
    case "tu-van-phap-ly":
      return legalConsultCheckoutPath(orderId, postingId);
    case "tu-van-dau-gia":
      return auctionConsultCheckoutPath(orderId, postingId);
    case "tham-dinh":
      return valuationCheckoutPath(orderId, postingId);
  }
}

// ─── Lỗi RPC ─────────────────────────────────────────────────────────────────

const REASON_MESSAGES: Record<string, string> = {
  not_authenticated: "Vui lòng đăng nhập để tiếp tục.",
  invalid_kind: "Loại dịch vụ không hợp lệ.",
  not_found: "Không tìm thấy đơn dịch vụ hoặc hợp đồng.",
  not_requester: "Chỉ người đã gửi yêu cầu mới đồng ý hợp đồng và thanh toán được đơn này.",
  not_authorized: "Bạn không còn quyền thao tác trên hồ sơ này.",
  invalid_status: "Đơn đã chuyển sang trạng thái khác — tải lại để xem trạng thái mới nhất.",
  quote_expired: "Báo giá đã hết hạn — liên hệ sàn để được báo giá lại.",
  quote_changed: "Báo giá vừa được cập nhật — vui lòng xem lại giá rồi đồng ý lại.",
  no_template: "Sàn chưa có mẫu hợp đồng cho dịch vụ này. Vui lòng liên hệ sàn.",
  template_changed: "Mẫu hợp đồng vừa được cập nhật — vui lòng đọc lại bản mới rồi đồng ý.",
};

export class ServiceContractError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(REASON_MESSAGES[reason] ?? "Thao tác không thành công. Vui lòng thử lại.");
    this.reason = reason;
  }
}

export interface AcceptServiceContractResult {
  ok: true;
  status: "accepted" | "already_accepted";
  contract_id: string;
  code: string;
}

export function unwrapServiceContractRpc<T = Record<string, unknown>>(data: unknown): T {
  const payload = (data ?? {}) as Record<string, unknown>;
  if (payload.ok !== true) throw new ServiceContractError(String(payload.reason ?? ""));
  return payload as T;
}

/** Tên tệp PDF tải về. */
export const serviceContractFileName = (code: string) => `Hop-dong-dich-vu_${code}.pdf`;

// ─── Bên B & bản xem trước ───────────────────────────────────────────────────

/** Bên B từ khối provider_* của mẫu — NHÂN BẢN của v_provider trong owner_accept_service_contract. */
export function providerPartyFromClauses(
  clauses: Record<string, unknown> | null | undefined,
  partnerName: string | null,
  expertName: string | null,
): ServiceProviderParty {
  const s = (k: string) => {
    const v = clauses?.[k];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  return {
    name: s("provider_name"),
    tax_code: s("provider_tax_code"),
    address: s("provider_address"),
    representative: s("provider_representative"),
    rep_title: s("provider_rep_title"),
    email: s("provider_email"),
    partner_name: partnerName,
    expert_name: expertName,
  };
}

/** Điều khoản đơn như server sẽ chụp — để xem trước trước khi đồng ý. */
export function previewTermsOf(order: ServiceOrderForContract): ServiceContractTerms {
  return {
    service_label: SERVICE_CONTRACT_LABELS[order.kind],
    order_code: order.code,
    package_name: order.package_name,
    posting_title: order.posting_title,
    price: Number(order.quoted_price ?? 0),
    quote_note: order.quote_note,
    quoted_at: order.quoted_at ?? "",
    quote_expires_at: order.quote_expires_at,
    extra: null,
  };
}

export const serviceContractPreviewFileName = (orderCode: string) => `Xem-truoc-hop-dong-dich-vu_${orderCode}.pdf`;
