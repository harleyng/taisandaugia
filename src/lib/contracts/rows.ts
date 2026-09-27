// Chuẩn hoá 3 loại hợp đồng của chủ tài sản về MỘT dạng dòng cho menu "Hợp đồng".
// Thuần — không Supabase, không React — để kiểm thử được.
//
// Việc cần làm lấy từ RPC tóm tắt của từng loại (cùng nguồn với số trên menu),
// không tự suy từ trạng thái: owner_consignment_summary.owner_action,
// owner_sale_contract_summary.owner_action, owner_service_contracts.can_accept.

import { CONTRACT_STATUS_LABELS_OWNER, type ConsignmentContract } from "@/types/consignment-contract";
import { SALE_STAGE_LABELS, type OwnerSaleAction, type SaleContract } from "@/types/auction-sale-contract";
import type { OwnerServiceContractRow } from "@/types/service-contract";
import type { ServiceKindKey } from "@/lib/serviceRequests/kinds";
import { saleStageOf } from "@/lib/saleContracts/stage";
import { stripViDiacritics } from "@/lib/normalizeVi";
import {
  SERVICE_CONTRACT_LABELS,
  SERVICE_CONTRACT_STAGE_LABELS,
  serviceContractStageOf,
  serviceOrderOwnerPath,
  type ServiceContractStage,
} from "@/lib/serviceContracts";
import {
  ownerConsignmentContractPath,
  ownerSaleContractPath,
  ownerServiceContractPath,
  type ContractTab,
  type ContractTypeKey,
} from "./paths";

export const CONTRACT_TYPE_LABELS: Record<ContractTypeKey, string> = {
  "ky-gui": "Ký gửi",
  "mua-ban": "Mua bán",
  "dich-vu": "Dịch vụ",
};

/** Tab theo loại (admin). */
export const CONTRACT_TYPE_TABS: readonly { key: "tat-ca" | ContractTypeKey; label: string }[] = [
  { key: "tat-ca", label: "Tất cả" },
  { key: "ky-gui", label: "Ký gửi đấu giá" },
  { key: "mua-ban", label: "Mua bán tài sản" },
  { key: "dich-vu", label: "Dịch vụ" },
];

/** Tab của menu "Hợp đồng" (chủ tài sản): thêm "Cần bạn xử lý". */
export const CONTRACT_TABS: readonly { key: ContractTab; label: string }[] = [
  CONTRACT_TYPE_TABS[0],
  { key: "can-xu-ly", label: "Cần bạn xử lý" },
  ...CONTRACT_TYPE_TABS.slice(1),
];

export type ContractTone = "info" | "warning" | "success" | "muted";

/** Màu badge trạng thái hợp đồng — chỉ token có sẵn. */
export const CONTRACT_TONE_CLASS: Record<ContractTone, string> = {
  info: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  muted: "bg-muted text-muted-foreground",
};

export interface ContractListRow {
  /** Duy nhất trong danh sách (báo giá chờ đồng ý chưa có id hợp đồng). */
  key: string;
  type: ContractTypeKey;
  code: string | null;
  kindLabel: string;
  title: string;
  counterparty: string | null;
  value: number | null;
  valueLabel: string;
  statusLabel: string;
  tone: ContractTone;
  needsAction: boolean;
  actionLabel: string | null;
  note: string | null;
  /** Mốc để sắp xếp (ký / đồng ý, không thì tạo). */
  date: string;
  href: string;
  /** Chỉ dòng dịch vụ: để mở hộp thoại đồng ý ngay tại danh sách. */
  service: { kind: ServiceKindKey; orderId: string; postingId: string } | null;
}

// ─── Ký gửi ──────────────────────────────────────────────────────────────────

export type OwnerConsignmentContractItem = Pick<
  ConsignmentContract,
  "id" | "code" | "status" | "asset_posting_id" | "terms" | "org_party" | "asset_snapshot" | "created_at" | "signed_at"
> & { posting: { title: string | null } | null };

/** Chỉ hai việc thuộc về hợp đồng; "chọn báo giá" là việc của menu Ký gửi. */
export type ConsignmentContractAction = "confirm_contract" | "add_address";

export const isConsignmentContractAction = (a: string | null | undefined): a is ConsignmentContractAction =>
  a === "confirm_contract" || a === "add_address";

const CONSIGNMENT_ACTION_LABELS: Record<ConsignmentContractAction, string> = {
  confirm_contract: "Xác nhận bản đã ký",
  add_address: "Bổ sung địa chỉ Bên A",
};

const CONSIGNMENT_TONE: Record<ConsignmentContract["status"], ContractTone> = {
  drafting: "info",
  awaiting_signatures: "info",
  awaiting_confirmation: "warning",
  signed: "success",
  cancelled: "muted",
};

export function fromConsignment(
  c: OwnerConsignmentContractItem,
  action: string | null | undefined,
): ContractListRow {
  const act = isConsignmentContractAction(action) ? action : null;
  return {
    key: `ky-gui:${c.id}`,
    type: "ky-gui",
    code: c.code,
    kindLabel: "Ký gửi đấu giá",
    title: c.asset_snapshot?.title ?? c.posting?.title ?? "—",
    counterparty: c.org_party?.name ?? null,
    value: c.terms?.service_fee ?? null,
    valueLabel: "Chi phí dịch vụ",
    statusLabel: CONTRACT_STATUS_LABELS_OWNER[c.status],
    tone: CONSIGNMENT_TONE[c.status],
    needsAction: !!act,
    actionLabel: act ? CONSIGNMENT_ACTION_LABELS[act] : null,
    note: null,
    date: c.signed_at ?? c.created_at,
    href: ownerConsignmentContractPath(c.id),
    service: null,
  };
}

// ─── Mua bán ─────────────────────────────────────────────────────────────────

const SALE_ACTION_LABELS: Record<Exclude<OwnerSaleAction, "none">, string> = {
  confirm_signed: "Xác nhận bản đã ký",
  confirm_handover: "Xác nhận bàn giao",
};

export function fromSale(c: SaleContract, action: OwnerSaleAction | null | undefined): ContractListRow {
  const stage = saleStageOf(c);
  const act = action && action !== "none" ? action : null;
  const asset = (c.asset_snapshot ?? {}) as { title?: string | null };
  const buyer = (c.buyer_party ?? {}) as { full_name?: string | null };
  return {
    key: `mua-ban:${c.id}`,
    type: "mua-ban",
    code: c.code,
    kindLabel: "Mua bán tài sản",
    title: asset.title ?? "—",
    counterparty: buyer.full_name ? `Bên mua: ${buyer.full_name}` : null,
    value: c.price,
    valueLabel: "Giá bán",
    statusLabel: SALE_STAGE_LABELS[stage],
    tone: stage === "completed" ? "success" : stage === "cancelled" ? "muted" : "info",
    needsAction: !!act,
    actionLabel: act ? SALE_ACTION_LABELS[act] : null,
    note: null,
    date: c.signed_at ?? c.created_at,
    href: ownerSaleContractPath(c.id),
    service: null,
  };
}

// ─── Dịch vụ ─────────────────────────────────────────────────────────────────

const SERVICE_TONE: Record<ServiceContractStage, ContractTone> = {
  awaiting_acceptance: "warning",
  awaiting_payment: "info",
  in_progress: "info",
  completed: "success",
  cancelled: "muted",
  requoted: "muted",
};

export function fromService(r: OwnerServiceContractRow): ContractListRow {
  const stage = serviceContractStageOf(r.order_status, !!r.contract_id);
  const act = r.needs_acceptance && r.can_accept;
  return {
    key: r.contract_id ? `dich-vu:${r.contract_id}` : `dich-vu:don:${r.service_kind}:${r.order_id}`,
    type: "dich-vu",
    code: r.contract_code,
    kindLabel: SERVICE_CONTRACT_LABELS[r.service_kind],
    title: r.posting_title ?? "—",
    counterparty: r.partner_name,
    value: r.quoted_price,
    valueLabel: "Phí dịch vụ",
    statusLabel: SERVICE_CONTRACT_STAGE_LABELS[stage],
    tone: SERVICE_TONE[stage],
    needsAction: act,
    actionLabel: act ? "Xem & đồng ý hợp đồng" : null,
    note: r.legacy
      ? `Đơn ${r.order_code} thanh toán trước khi có hợp đồng điện tử`
      : r.contract_id
        ? `Đơn ${r.order_code}`
        : r.needs_acceptance && !r.can_accept
          ? `Đơn ${r.order_code} · chờ người gửi yêu cầu đồng ý`
          : `Đơn ${r.order_code}`,
    date: r.accepted_at ?? r.quoted_at ?? r.created_at,
    // Chưa có hợp đồng ⇒ về thẻ đơn trong hồ sơ (nơi có nút đồng ý & thanh toán).
    href: r.contract_id ? ownerServiceContractPath(r.contract_id) : serviceOrderOwnerPath(r.service_kind, r.asset_posting_id),
    service: { kind: r.service_kind, orderId: r.order_id, postingId: r.asset_posting_id },
  };
}

// ─── Lọc & sắp xếp ───────────────────────────────────────────────────────────

export function matchesContractTab(tab: ContractTab, row: ContractListRow): boolean {
  if (tab === "tat-ca") return true;
  if (tab === "can-xu-ly") return row.needsAction;
  return row.type === tab;
}

/** Tìm theo mã / tài sản / bên kia / loại, không phân biệt dấu. */
export function matchesContractSearch(row: ContractListRow, q: string): boolean {
  const needle = stripViDiacritics(q);
  if (!needle) return true;
  return stripViDiacritics([row.code, row.title, row.counterparty, row.kindLabel, row.note].filter(Boolean).join(" ")).includes(
    needle,
  );
}

/** Việc cần làm lên đầu, còn lại mới nhất trước. */
export function sortContractRows(rows: ContractListRow[]): ContractListRow[] {
  return [...rows].sort((a, b) => Number(b.needsAction) - Number(a.needsAction) || b.date.localeCompare(a.date));
}

/** Số việc cần làm — nguồn của huy hiệu menu "Hợp đồng". */
export const contractActionCount = (rows: readonly ContractListRow[]) => rows.filter((r) => r.needsAction).length;
