// Menu "Hợp đồng" của CỔNG TỔ CHỨC: chuẩn hoá hợp đồng ký gửi (với chủ tài sản)
// và hợp đồng mua bán (với người trúng) về MỘT dạng dòng — cùng dạng với menu
// "Hợp đồng" của chủ tài sản để dùng chung bảng ContractsTable. Thuần.
//
// "Cần xử lý" phải khớp số trên menu:
// - Ký gửi: `org_action` do RPC org_consignment_contract_list tính, cùng luật
//   với `contracts_action` của org_service_request_counts. Dòng mở trang hợp đồng
//   /portal/hop-dong/ky-gui/:id (không phải trang yêu cầu).
// - Mua bán: orgSaleActionOf nhân bản `action_needed` của org_sale_contract_counts
//   (20260914000001). Quá hạn trả tiền theo kỳ cần sổ kỳ hạn — danh sách không
//   tải ⇒ chỉ bắt quá hạn ký / bàn giao (bảng cũ cũng vậy).

import { CHILD_NAME } from "@/constants/category.constants";
import { saleOverdueOf, saleStageOf } from "@/lib/saleContracts/stage";
import { portalSaleContractPath } from "@/lib/saleContracts/files";
import { stripViDiacritics } from "@/lib/normalizeVi";
import {
  CONTRACT_STATUS_LABELS_ORG,
  type ConsignmentContractStatus,
  type OrgConsignmentAction,
  type OrgConsignmentContractListRow,
} from "@/types/consignment-contract";
import {
  SALE_STAGE_LABELS,
  type SaleAssetSnapshot,
  type SaleBuyerParty,
  type SaleContract,
  type SaleStage,
} from "@/types/auction-sale-contract";
import type { PostingBrief } from "./postingBrief";
import type { ContractListRow, ContractTone } from "./rows";

export type PortalContractType = "ky-gui" | "mua-ban";
export type PortalContractTab = "tat-ca" | "can-xu-ly" | PortalContractType;

export const PORTAL_CONTRACT_TABS: readonly { key: PortalContractTab; label: string }[] = [
  { key: "tat-ca", label: "Tất cả" },
  { key: "can-xu-ly", label: "Cần xử lý" },
  { key: "ky-gui", label: "Ký gửi đấu giá" },
  { key: "mua-ban", label: "Mua bán tài sản" },
];

export interface PortalContractRow extends ContractListRow {
  type: PortalContractType;
  /** Dòng phụ cột Tài sản: mã HS (ký gửi) hoặc mã phiên + lô (mua bán). */
  brief: PostingBrief | null;
  /** Chỉ mua bán — bộ lọc Phiên / Giai đoạn / Quá hạn. */
  sessionId: string | null;
  saleStage: SaleStage | null;
  overdue: boolean;
}

// ─── Ký gửi ──────────────────────────────────────────────────────────────────

export const CONSIGNMENT_ACTION_LABELS: Record<OrgConsignmentAction, string> = {
  share_draft: "Soạn & chia sẻ dự thảo",
  attach_signed: "Tải bản đã ký",
  confirm: "Xác nhận bản đã ký",
};

const CONSIGNMENT_TONE: Record<ConsignmentContractStatus, ContractTone> = {
  drafting: "info",
  awaiting_signatures: "info",
  awaiting_confirmation: "warning",
  signed: "success",
  cancelled: "muted",
};

/** Trang hợp đồng ký gửi — nơi DUY NHẤT có thao tác hợp đồng (trang yêu cầu chỉ còn lối vào). */
export const portalConsignmentContractPath = (contractId: string) => `/portal/hop-dong/ky-gui/${contractId}`;
/** Trang yêu cầu ký gửi (hồ sơ tài sản + báo giá) của một hợp đồng. */
export const portalConsignmentRequestPath = (requestId: string) => `/portal/yeu-cau-ky-gui/${requestId}`;

export function fromOrgConsignment(c: OrgConsignmentContractListRow): PortalContractRow {
  const act = c.org_action;
  return {
    key: `ky-gui:${c.id}`,
    type: "ky-gui",
    code: c.code,
    kindLabel: "Ký gửi đấu giá",
    title: c.title ?? "—",
    counterparty: c.owner_name,
    counterpartyRole: c.owner_name ? "Chủ tài sản" : null,
    postingId: null,
    consignmentContractId: c.id,
    value: c.service_fee,
    valueLabel: "Chi phí dịch vụ",
    statusLabel: CONTRACT_STATUS_LABELS_ORG[c.status],
    tone: CONSIGNMENT_TONE[c.status],
    needsAction: !!act,
    actionLabel: act ? CONSIGNMENT_ACTION_LABELS[act] : null,
    note: c.contract_no,
    date: c.signed_at ?? c.created_at,
    updatedAt: c.updated_at,
    href: portalConsignmentContractPath(c.id),
    service: null,
    brief: {
      id: c.id,
      code: c.posting_code,
      title: c.title,
      category: c.child_slug ? (CHILD_NAME[c.child_slug] ?? null) : null,
      location: null,
      imageUrl: null,
    },
    sessionId: null,
    saleStage: null,
    overdue: false,
  };
}

// ─── Mua bán ─────────────────────────────────────────────────────────────────

export type OrgSaleAction = "share_draft" | "confirm_signed" | "schedule_handover";

const SALE_ACTION_LABELS: Record<OrgSaleAction, string> = {
  share_draft: "Soạn & chia sẻ dự thảo",
  confirm_signed: "Xác nhận bản đã ký",
  schedule_handover: "Hẹn lịch bàn giao",
};

type SaleActionInput = Pick<
  SaleContract,
  | "status"
  | "org_signs"
  | "org_confirmed_at"
  | "seller_kind"
  | "seller_confirmed_at"
  | "paid_at"
  | "handed_over_at"
  | "handover_scheduled_at"
>;

/** Việc của tổ chức — nhân bản `action_needed` trong org_sale_contract_counts. */
export function orgSaleActionOf(c: SaleActionInput): OrgSaleAction | null {
  if (c.status === "drafting") return "share_draft";
  if (
    c.status === "awaiting_confirmation" &&
    ((c.org_signs && !c.org_confirmed_at) || (c.seller_kind === "org_on_behalf" && !c.seller_confirmed_at))
  )
    return "confirm_signed";
  if (c.status === "signed" && c.paid_at && !c.handed_over_at && !c.handover_scheduled_at) return "schedule_handover";
  return null;
}

const OVERDUE_LABEL: Record<"sign" | "handover", string> = {
  sign: "Quá hạn ký",
  handover: "Quá hạn bàn giao",
};

export function fromOrgSale(c: SaleContract, now: Date = new Date()): PortalContractRow {
  const stage = saleStageOf(c);
  const act = orgSaleActionOf(c);
  const overdue = saleOverdueOf(c, [], now);
  const overdueLabel = overdue.sign ? OVERDUE_LABEL.sign : overdue.handover ? OVERDUE_LABEL.handover : null;
  const asset = (c.asset_snapshot ?? {}) as SaleAssetSnapshot;
  const buyer = (c.buyer_party ?? {}) as SaleBuyerParty;
  const category = asset.category_slug ? (CHILD_NAME[asset.category_slug] ?? null) : null;
  return {
    key: `mua-ban:${c.id}`,
    type: "mua-ban",
    code: c.code,
    kindLabel: "Mua bán tài sản",
    title: asset.title ?? "—",
    counterparty: buyer.full_name ?? null,
    counterpartyRole: buyer.full_name ? (buyer.bidder_no ? `Bên mua · SBD ${buyer.bidder_no}` : "Bên mua") : null,
    postingId: null,
    consignmentContractId: c.consignment_contract_id ?? null,
    value: c.price,
    valueLabel: "Giá bán",
    statusLabel: SALE_STAGE_LABELS[stage],
    tone: overdue.any ? "warning" : stage === "completed" ? "success" : stage === "cancelled" ? "muted" : "info",
    needsAction: !!act || overdue.any,
    actionLabel: act ? SALE_ACTION_LABELS[act] : overdueLabel,
    note: c.contract_no,
    date: c.signed_at ?? c.created_at,
    updatedAt: c.updated_at ?? c.signed_at ?? c.created_at,
    href: portalSaleContractPath(c.id),
    service: null,
    brief: {
      id: c.id,
      code: asset.session_code ?? null,
      title: asset.title ?? null,
      category: [asset.lot_no ? `Lô ${asset.lot_no}` : null, category].filter(Boolean).join(" · ") || null,
      location: null,
      imageUrl: null,
    },
    sessionId: c.session_id,
    saleStage: stage,
    overdue: overdue.any,
  };
}

// ─── Lọc ─────────────────────────────────────────────────────────────────────

export function matchesPortalContractTab(tab: PortalContractTab, row: PortalContractRow): boolean {
  if (tab === "tat-ca") return true;
  if (tab === "can-xu-ly") return row.needsAction;
  return row.type === tab;
}

/** Tìm theo mã / số hợp đồng / tài sản / mã HS-phiên / bên kia, không phân biệt dấu. */
export function matchesPortalContractSearch(row: PortalContractRow, q: string): boolean {
  const needle = stripViDiacritics(q);
  if (!needle) return true;
  return stripViDiacritics(
    [row.code, row.note, row.title, row.brief?.code, row.counterparty, row.kindLabel].filter(Boolean).join(" "),
  ).includes(needle);
}

export const ALL = "all";

export interface PortalSaleFilters {
  session: string;
  stage: string;
  overdue: string;
}

/** Bộ lọc riêng của tab Mua bán — dòng ký gửi không bị ảnh hưởng. */
export function matchesPortalSaleFilters(row: PortalContractRow, f: PortalSaleFilters): boolean {
  if (row.type !== "mua-ban") return true;
  if (f.session !== ALL && row.sessionId !== f.session) return false;
  if (f.stage !== ALL && row.saleStage !== f.stage) return false;
  if (f.overdue === "1" && !row.overdue) return false;
  return true;
}

/** Việc cần làm lên đầu, còn lại mới cập nhật trước. */
export function sortPortalContractRows(rows: PortalContractRow[]): PortalContractRow[] {
  return [...rows].sort(
    (a, b) => Number(b.needsAction) - Number(a.needsAction) || b.updatedAt.localeCompare(a.updatedAt),
  );
}
