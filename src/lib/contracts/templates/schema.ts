// Schema "ô điều khoản" (slot) của từng loại mẫu hợp đồng.
//
// Mẫu trong DB (bảng contract_templates) chỉ giữ CÂU CHỮ của từng slot; cấu trúc
// điều khoản và các điều sinh từ dữ liệu (các bên, tài sản, giá) nằm ở builder
// PDF. Key slot ghi thẳng vào JSONB nên BẤT BIẾN — đổi key là mất câu chữ của mọi
// phiên bản đã tạo. Thêm slot mới thì builder phải có mặc định cho nó.
//
// Mặc định của ký gửi / mua bán = hằng số TS cũ (clauses.ts), dùng làm fallback
// từng slot khi DB chưa có. Mẫu dịch vụ luôn có trong DB (đồng ý hợp đồng đòi mẫu
// đang áp dụng) nên không có mặc định TS.

import * as consignment from "@/lib/consignment/contract-pdf/clauses";
import * as sale from "@/lib/saleContracts/contract-pdf/clauses";
import type { ServiceKindKey } from "@/lib/serviceRequests/kinds";

export type ContractTemplateType =
  | "consignment"
  | "sale"
  | "service:vr-tour"
  | "service:giam-dinh"
  | "service:tu-van-phap-ly"
  | "service:tu-van-dau-gia"
  | "service:tham-dinh";

export type SlotValue = string | string[];
export type ClauseMap = Record<string, SlotValue>;

export interface TemplateSlot {
  key: string;
  label: string;
  /** text = một đoạn; list = mỗi dòng một mục (in thành gạch đầu dòng). */
  kind: "text" | "list";
  /** party = thông tin Bên B (sàn) của mẫu dịch vụ. */
  group: "party" | "clause";
  hint?: string;
}

export interface TemplateTypeDef {
  type: ContractTemplateType;
  label: string;
  /** Nhãn ngắn cho tab. */
  shortLabel: string;
  group: "dau-gia" | "dich-vu";
  /** Gợi ý tiền tố mã phiên bản khi tạo bản mới. */
  versionPrefix: string;
  slots: readonly TemplateSlot[];
  defaults: ClauseMap;
}

/** Chuỗi đánh dấu thông tin còn thiếu trong mẫu seed — admin phải thay trước khi dùng thật. */
export const PLACEHOLDER_MARK = "[CẦN NHẬP]";

const CONSIGNMENT_SLOTS: readonly TemplateSlot[] = [
  { key: "legal_bases", label: "Căn cứ pháp lý", kind: "list", group: "clause" },
  { key: "owner_duties", label: "Quyền và nghĩa vụ của Bên A (chủ tài sản)", kind: "list", group: "clause" },
  { key: "org_duties", label: "Quyền và nghĩa vụ của Bên B (tổ chức đấu giá)", kind: "list", group: "clause" },
  { key: "payment_terms", label: "Điều khoản thanh toán thù lao", kind: "text", group: "clause" },
  { key: "termination", label: "Chấm dứt hợp đồng và giải quyết tranh chấp", kind: "list", group: "clause" },
  { key: "effect", label: "Hiệu lực hợp đồng", kind: "list", group: "clause" },
  { key: "draft_notice", label: "Ghi chú chân trang dự thảo", kind: "text", group: "clause" },
];

const SALE_SLOTS: readonly TemplateSlot[] = [
  { key: "legal_bases", label: "Căn cứ pháp lý", kind: "list", group: "clause" },
  { key: "deposit_clause", label: "Tiền đặt trước chuyển thành tiền đặt cọc", kind: "text", group: "clause" },
  { key: "seller_duties", label: "Quyền và nghĩa vụ của Bên bán", kind: "list", group: "clause" },
  { key: "buyer_duties", label: "Quyền và nghĩa vụ của Bên mua", kind: "list", group: "clause" },
  { key: "handover_terms", label: "Bàn giao tài sản", kind: "text", group: "clause" },
  { key: "title_transfer_terms", label: "Đăng ký sang tên", kind: "text", group: "clause" },
  { key: "breach_terms", label: "Vi phạm, chấm dứt và giải quyết tranh chấp", kind: "list", group: "clause" },
  { key: "effect", label: "Hiệu lực hợp đồng", kind: "list", group: "clause" },
  { key: "notarization_note", label: "Ghi chú công chứng", kind: "text", group: "clause" },
  { key: "draft_notice", label: "Ghi chú chân trang dự thảo", kind: "text", group: "clause" },
];

const SERVICE_SLOTS: readonly TemplateSlot[] = [
  { key: "provider_name", label: "Tên pháp nhân (Bên B)", kind: "text", group: "party" },
  { key: "provider_tax_code", label: "Mã số thuế", kind: "text", group: "party" },
  { key: "provider_address", label: "Địa chỉ trụ sở", kind: "text", group: "party" },
  { key: "provider_representative", label: "Người đại diện", kind: "text", group: "party" },
  { key: "provider_rep_title", label: "Chức vụ người đại diện", kind: "text", group: "party" },
  { key: "provider_email", label: "Email liên hệ", kind: "text", group: "party" },
  { key: "legal_bases", label: "Căn cứ pháp lý", kind: "list", group: "clause" },
  { key: "scope", label: "Phạm vi dịch vụ", kind: "list", group: "clause" },
  { key: "deliverables", label: "Kết quả bàn giao", kind: "text", group: "clause" },
  { key: "payment_terms", label: "Thanh toán", kind: "text", group: "clause" },
  { key: "owner_duties", label: "Quyền và nghĩa vụ của Bên A (chủ tài sản)", kind: "list", group: "clause" },
  { key: "provider_duties", label: "Quyền và nghĩa vụ của Bên B (sàn)", kind: "list", group: "clause" },
  { key: "disclaimer", label: "Giới hạn trách nhiệm", kind: "list", group: "clause" },
  { key: "termination", label: "Chấm dứt hợp đồng và giải quyết tranh chấp", kind: "list", group: "clause" },
  {
    key: "electronic_acceptance",
    label: "Giao kết điện tử",
    kind: "text",
    group: "clause",
    hint: "Hiện cho chủ tài sản ngay trên ô đồng ý.",
  },
  { key: "effect", label: "Hiệu lực hợp đồng", kind: "list", group: "clause" },
];

const serviceDef = (
  kind: ServiceKindKey,
  label: string,
  shortLabel: string,
  versionPrefix: string,
): TemplateTypeDef => ({
  type: `service:${kind}` as ContractTemplateType,
  label,
  shortLabel,
  group: "dich-vu",
  versionPrefix,
  slots: SERVICE_SLOTS,
  defaults: {},
});

export const TEMPLATE_TYPES: readonly TemplateTypeDef[] = [
  {
    type: "consignment",
    label: "Hợp đồng dịch vụ đấu giá (ký gửi)",
    shortLabel: "Ký gửi",
    group: "dau-gia",
    versionPrefix: "HDDV-MAU",
    slots: CONSIGNMENT_SLOTS,
    defaults: {
      legal_bases: consignment.LEGAL_BASES,
      owner_duties: consignment.OWNER_DUTIES,
      org_duties: consignment.ORG_DUTIES,
      payment_terms: consignment.PAYMENT_TERMS,
      termination: consignment.TERMINATION,
      effect: consignment.EFFECT,
      draft_notice: consignment.DRAFT_NOTICE,
    },
  },
  {
    type: "sale",
    label: "Hợp đồng mua bán tài sản đấu giá",
    shortLabel: "Mua bán",
    group: "dau-gia",
    versionPrefix: "HDMB-MAU",
    slots: SALE_SLOTS,
    defaults: {
      legal_bases: sale.LEGAL_BASES,
      deposit_clause: sale.DEPOSIT_CLAUSE,
      seller_duties: sale.SELLER_DUTIES,
      buyer_duties: sale.BUYER_DUTIES,
      handover_terms: sale.HANDOVER_TERMS,
      title_transfer_terms: sale.TITLE_TRANSFER_TERMS,
      breach_terms: sale.BREACH_TERMS,
      effect: sale.EFFECT,
      notarization_note: sale.NOTARIZATION_NOTE,
      draft_notice: sale.DRAFT_NOTICE,
    },
  },
  serviceDef("vr-tour", "Hợp đồng dịch vụ VR tour", "VR tour", "HDCU-VR-MAU"),
  serviceDef("giam-dinh", "Hợp đồng dịch vụ giám định", "Giám định", "HDCU-GD-MAU"),
  serviceDef("tu-van-phap-ly", "Hợp đồng dịch vụ tư vấn pháp lý", "Tư vấn pháp lý", "HDCU-TVPL-MAU"),
  serviceDef("tu-van-dau-gia", "Hợp đồng dịch vụ tư vấn đấu giá", "Tư vấn đấu giá", "HDCU-TVDG-MAU"),
  serviceDef("tham-dinh", "Hợp đồng dịch vụ thẩm định giá", "Thẩm định giá", "HDCU-TDG-MAU"),
];

export const TEMPLATE_GROUP_LABELS: Record<TemplateTypeDef["group"], string> = {
  "dau-gia": "Đấu giá",
  "dich-vu": "Dịch vụ",
};

export function templateTypeDef(type: string): TemplateTypeDef | null {
  return TEMPLATE_TYPES.find((d) => d.type === type) ?? null;
}

export const serviceTemplateType = (kind: ServiceKindKey): ContractTemplateType =>
  `service:${kind}` as ContractTemplateType;

export const isTemplateType = (v: string | null | undefined): v is ContractTemplateType =>
  !!v && TEMPLATE_TYPES.some((d) => d.type === v);
