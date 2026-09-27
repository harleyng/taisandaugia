// Dòng RPC admin_contract_list → nhãn / màu / đường dẫn cho bảng "Hợp đồng" của admin.
// Thuần để kiểm thử được.

import { CONTRACT_STATUS_LABELS_OWNER, type ConsignmentContractStatus } from "@/types/consignment-contract";
import { SALE_STAGE_LABELS, type SaleStage } from "@/types/auction-sale-contract";
import {
  SERVICE_CONTRACT_LABELS,
  SERVICE_CONTRACT_STAGE_LABELS,
  serviceContractStageOf,
  type ServiceContractStage,
} from "@/lib/serviceContracts";
import type { ServiceKindKey } from "@/lib/serviceRequests/kinds";
import { stripViDiacritics } from "@/lib/normalizeVi";
import { adminContractPath, type ContractTypeKey } from "./paths";
import type { ContractTone } from "./rows";

export interface AdminContractRpcRow {
  contract_type: "consignment" | "sale" | "service";
  service_kind: ServiceKindKey | null;
  id: string;
  code: string | null;
  status: string;
  stage: string;
  title: string | null;
  party_a: string | null;
  party_b: string | null;
  value: number | null;
  created_at: string;
  signed_at: string | null;
  cancelled_at: string | null;
  asset_posting_id: string | null;
  order_id: string | null;
}

export interface AdminContractRow {
  key: string;
  type: ContractTypeKey;
  id: string;
  code: string | null;
  kindLabel: string;
  title: string;
  partyA: string;
  partyB: string;
  partyALabel: string;
  partyBLabel: string;
  value: number | null;
  statusLabel: string;
  tone: ContractTone;
  createdAt: string;
  signedAt: string | null;
  href: string;
}

const TYPE_OF: Record<AdminContractRpcRow["contract_type"], ContractTypeKey> = {
  consignment: "ky-gui",
  sale: "mua-ban",
  service: "dich-vu",
};

const SALE_TONE: Record<SaleStage, ContractTone> = {
  signing: "info",
  paying: "warning",
  handover: "warning",
  completed: "success",
  cancelled: "muted",
};

const SERVICE_TONE: Record<ServiceContractStage, ContractTone> = {
  awaiting_acceptance: "warning",
  awaiting_payment: "info",
  in_progress: "info",
  completed: "success",
  cancelled: "muted",
  requoted: "muted",
};

function statusOf(r: AdminContractRpcRow): { label: string; tone: ContractTone } {
  if (r.contract_type === "consignment") {
    const s = r.status as ConsignmentContractStatus;
    const tone: ContractTone =
      s === "signed" ? "success" : s === "cancelled" ? "muted" : s === "awaiting_confirmation" ? "warning" : "info";
    return { label: CONTRACT_STATUS_LABELS_OWNER[s] ?? r.status, tone };
  }
  if (r.contract_type === "sale") {
    const st = r.stage as SaleStage;
    return { label: SALE_STAGE_LABELS[st] ?? r.stage, tone: SALE_TONE[st] ?? "info" };
  }
  const stage: ServiceContractStage =
    r.stage === "requoted" ? "requoted" : serviceContractStageOf(r.status, true);
  return { label: SERVICE_CONTRACT_STAGE_LABELS[stage], tone: SERVICE_TONE[stage] };
}

export function toAdminContractRow(r: AdminContractRpcRow): AdminContractRow {
  const type = TYPE_OF[r.contract_type];
  const { label, tone } = statusOf(r);
  return {
    key: `${type}:${r.id}`,
    type,
    id: r.id,
    code: r.code,
    kindLabel:
      type === "ky-gui"
        ? "Ký gửi"
        : type === "mua-ban"
          ? "Mua bán"
          : r.service_kind
            ? SERVICE_CONTRACT_LABELS[r.service_kind]
            : "Dịch vụ",
    title: r.title ?? "—",
    partyA: r.party_a ?? "—",
    partyB: r.party_b ?? "—",
    partyALabel: type === "mua-ban" ? "Bên bán" : "Chủ tài sản",
    partyBLabel: type === "ky-gui" ? "Tổ chức đấu giá" : type === "mua-ban" ? "Bên mua" : "Đơn vị thực hiện",
    value: r.value == null ? null : Number(r.value),
    statusLabel: label,
    tone,
    createdAt: r.created_at,
    signedAt: r.signed_at,
    href: adminContractPath(type, r.id),
  };
}

/** Tìm theo mã / tài sản / hai bên, không phân biệt dấu. */
export function matchesAdminContractSearch(row: AdminContractRow, q: string): boolean {
  const needle = stripViDiacritics(q);
  if (!needle) return true;
  return stripViDiacritics([row.code, row.title, row.partyA, row.partyB, row.kindLabel].filter(Boolean).join(" ")).includes(
    needle,
  );
}
