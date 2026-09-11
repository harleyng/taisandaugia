// Máy trạng thái hợp đồng ký gửi — bản TS để UI biết nút nào hiện.
//
// Server là bên quyết định (RPC consignment_contract_* trong migration
// 20260912000004). Hàm ở đây chỉ để ẩn/hiện; sửa luật thì sửa CẢ HAI bên.

import type {
  ConsignmentContract,
  ConsignmentContractStatus,
  ContractSide,
  MissingParty,
} from "@/types/consignment-contract";

type ContractLike = Pick<
  ConsignmentContract,
  "status" | "signed_doc_path" | "owner_confirmed_at" | "org_confirmed_at"
>;

export const CONTRACT_STEPS: { key: Exclude<ConsignmentContractStatus, "cancelled">; label: string }[] = [
  { key: "drafting", label: "Soạn hợp đồng" },
  { key: "awaiting_signatures", label: "Ký hợp đồng" },
  { key: "awaiting_confirmation", label: "Xác nhận bản ký" },
  { key: "signed", label: "Đã ký" },
];

export const OPEN_CONTRACT_STATUSES: ConsignmentContractStatus[] = [
  "drafting",
  "awaiting_signatures",
  "awaiting_confirmation",
];

/** Vị trí trên thanh tiến trình; -1 khi đã huỷ. */
export function contractStepIndex(status: ConsignmentContractStatus): number {
  return CONTRACT_STEPS.findIndex((s) => s.key === status);
}

export function isContractOpen(c: Pick<ConsignmentContract, "status">): boolean {
  return OPEN_CONTRACT_STATUSES.includes(c.status);
}

export function hasConfirmed(c: ContractLike, side: ContractSide): boolean {
  return side === "owner" ? !!c.owner_confirmed_at : !!c.org_confirmed_at;
}

/** Chỉ tổ chức soạn / chia sẻ dự thảo. Chia sẻ lại khi đã có bản ký sẽ xoá bản ký. */
export function canShareDraft(c: ContractLike, side: ContractSide): boolean {
  return side === "org" && isContractOpen(c);
}

/** Bên nào cũng tải được bản scan đã ký — bản giấy có thể nằm ở tay bên nào. */
export function canAttachSigned(c: ContractLike): boolean {
  return isContractOpen(c);
}

export function canConfirm(c: ContractLike, side: ContractSide): boolean {
  return c.status === "awaiting_confirmation" && !!c.signed_doc_path && !hasConfirmed(c, side);
}

export function canCancel(c: ContractLike): boolean {
  return isContractOpen(c);
}

/**
 * Bên đang phải làm bước kế tiếp.
 *
 * Soạn và ký thì trách nhiệm chính thuộc tổ chức (họ giữ mẫu hợp đồng và làm
 * thủ tục) — không đếm chủ tài sản để khỏi nhắc cả hai. Xác nhận thì là bên
 * nào chưa xác nhận.
 */
export function awaitingSides(c: ContractLike): ContractSide[] {
  switch (c.status) {
    case "drafting":
    case "awaiting_signatures":
      return ["org"];
    case "awaiting_confirmation":
      return (["owner", "org"] as ContractSide[]).filter((s) => !hasConfirmed(c, s));
    default:
      return [];
  }
}

export const MISSING_PARTY_LABELS: Record<MissingParty, string> = {
  owner_address: "địa chỉ của chủ tài sản",
  org_legal_rep: "người đại diện theo pháp luật của tổ chức",
};

export function missingPartiesText(missing: MissingParty[]): string {
  return missing.map((m) => MISSING_PARTY_LABELS[m]).join(" và ");
}
