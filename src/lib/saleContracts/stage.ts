// Giai đoạn & quyền thao tác của hợp đồng mua bán — THUẦN.
//
// `saleStageOf` soi gương SQL `sale_contract_stage`; các hàm `canX` soi gương
// thứ tự kiểm trong từng RPC. Server vẫn là bên quyết định — hàm ở đây chỉ để
// KHÔNG hiện những nút chắc chắn sẽ bị từ chối. Sửa luật thì sửa CẢ HAI bên.

import type {
  SaleContract,
  SaleInstallment,
  SaleSide,
  SaleStage,
} from "@/types/auction-sale-contract";

type ContractLike = Pick<
  SaleContract,
  | "status"
  | "paid_at"
  | "handed_over_at"
  | "signed_doc_path"
  | "draft_doc_path"
  | "org_signs"
  | "buyer_confirmed_at"
  | "seller_confirmed_at"
  | "org_confirmed_at"
  | "handover_buyer_confirmed_at"
  | "handover_seller_confirmed_at"
  | "sign_due_at"
  | "handover_due_at"
  | "handover_scheduled_at"
>;

/** Các bước trên thanh tiến trình. `cancelled` không nằm trên thanh — nó cắt ngang. */
export const SALE_STEPS: { key: Exclude<SaleStage, "cancelled">; label: string }[] = [
  { key: "signing", label: "Ký hợp đồng" },
  { key: "paying", label: "Thanh toán" },
  { key: "handover", label: "Bàn giao" },
  { key: "completed", label: "Hoàn tất" },
];

const OPEN_SIGNING_STATUSES: SaleContract["status"][] = [
  "drafting",
  "awaiting_signatures",
  "awaiting_confirmation",
];

export function saleStageOf(c: ContractLike): SaleStage {
  if (c.status === "cancelled") return "cancelled";
  if (c.status === "completed") return "completed";
  if (c.status !== "signed") return "signing";
  if (!c.paid_at) return "paying";
  if (!c.handed_over_at) return "handover";
  return "completed";
}

export function saleStepIndex(stage: SaleStage): number {
  return SALE_STEPS.findIndex((s) => s.key === stage);
}

export interface SaleOverdue {
  sign: boolean;
  payment: boolean;
  handover: boolean;
  any: boolean;
}

/**
 * Quá hạn chỉ là CỜ CẢNH BÁO, không tự huỷ gì cả — huỷ hợp đồng luôn là quyết
 * định của con người.
 */
export function saleOverdueOf(
  c: ContractLike,
  installments: readonly Pick<SaleInstallment, "due_at" | "amount" | "paid_amount">[],
  now: Date = new Date(),
): SaleOverdue {
  const stage = saleStageOf(c);
  const t = now.getTime();
  const past = (iso: string | null | undefined) => !!iso && new Date(iso).getTime() < t;

  const sign = stage === "signing" && past(c.sign_due_at);
  const payment =
    stage === "paying" &&
    installments.some((i) => past(i.due_at) && Number(i.paid_amount) < Number(i.amount));
  const handover = stage === "handover" && past(c.handover_due_at);
  return { sign, payment, handover, any: sign || payment || handover };
}

export const isSaleOpen = (c: Pick<SaleContract, "status">): boolean =>
  c.status !== "cancelled" && c.status !== "completed";

export function hasConfirmedSigning(c: ContractLike, side: SaleSide): boolean {
  if (side === "buyer") return !!c.buyer_confirmed_at;
  if (side === "seller") return !!c.seller_confirmed_at;
  return !!c.org_confirmed_at;
}

/** Bên nào còn phải xác nhận bản đã ký. Tổ chức chỉ tính khi hợp đồng có 3 chữ ký. */
export function awaitingSigningSides(c: ContractLike): SaleSide[] {
  if (c.status !== "awaiting_confirmation") return [];
  const sides: SaleSide[] = ["buyer", "seller"];
  if (c.org_signs) sides.push("org");
  return sides.filter((s) => !hasConfirmedSigning(c, s));
}

/** Chỉ tổ chức soạn và chia sẻ dự thảo. Chia sẻ lại sẽ xoá bản ký đang có. */
export const canShareDraft = (c: ContractLike, side: SaleSide): boolean =>
  side === "org" && OPEN_SIGNING_STATUSES.includes(c.status);

/** Bên nào giữ bản giấy cũng tải lên được — bản ký có thể nằm ở tay bất kỳ bên nào. */
export const canAttachSigned = (c: ContractLike, side: SaleSide): boolean =>
  OPEN_SIGNING_STATUSES.includes(c.status) && (side !== "org" || c.org_signs);

export const canConfirmSigned = (c: ContractLike, side: SaleSide): boolean =>
  c.status === "awaiting_confirmation" &&
  !!c.signed_doc_path &&
  !hasConfirmedSigning(c, side) &&
  (side !== "org" || c.org_signs);

/** Huỷ được ở mọi trạng thái trừ đã huỷ / đã hoàn tất — kể cả khi ĐÃ KÝ (hai bên thoả thuận). */
export const canCancel = (c: ContractLike): boolean =>
  c.status !== "cancelled" && c.status !== "completed";

/** Sửa điều khoản: chỉ khi CHƯA ký, và chỉ khi sổ tiền còn trống. */
export const canEditTerms = (c: ContractLike, side: SaleSide, hasPayments: boolean): boolean =>
  side === "org" && OPEN_SIGNING_STATUSES.includes(c.status) && !hasPayments;

/** Ghi nhận tiền: chỉ tổ chức. Cho phép TRƯỚC khi ký (đặt cọc thường chuyển sớm). */
export const canRecordPayment = (c: ContractLike, side: SaleSide): boolean =>
  side === "org" && isSaleOpen(c);

export const canScheduleHandover = (c: ContractLike, side: SaleSide): boolean =>
  side === "org" && c.status === "signed" && !c.handed_over_at;

export function hasConfirmedHandover(c: ContractLike, side: SaleSide): boolean {
  if (side === "buyer") return !!c.handover_buyer_confirmed_at;
  if (side === "seller") return !!c.handover_seller_confirmed_at;
  return false;
}

/** Bàn giao do HAI bên xác nhận; tổ chức chỉ hẹn lịch, không xác nhận thay. */
export const canConfirmHandover = (c: ContractLike, side: SaleSide): boolean =>
  c.status === "signed" && side !== "org" && !hasConfirmedHandover(c, side);

export const canSetTitleTransfer = (c: ContractLike, side: SaleSide): boolean =>
  side === "org" && c.status !== "cancelled";

/** Câu nhắc "việc tiếp theo là gì" hiện trên thẻ hợp đồng. */
export function nextStepText(c: ContractLike): string {
  switch (saleStageOf(c)) {
    case "cancelled":
      return "Hợp đồng đã huỷ.";
    case "completed":
      return "Hợp đồng đã hoàn tất.";
    case "paying":
      return "Chờ bên mua thanh toán phần còn lại.";
    case "handover":
      return c.handover_scheduled_at
        ? "Hai bên xác nhận đã bàn giao tài sản."
        : "Tổ chức hẹn lịch bàn giao tài sản.";
    default:
      break;
  }
  if (c.status === "drafting") return "Tổ chức soạn và chia sẻ dự thảo hợp đồng.";
  if (c.status === "awaiting_signatures") return "Các bên ký và tải lên bản hợp đồng đã ký.";
  return "Các bên xác nhận bản hợp đồng đã ký.";
}
