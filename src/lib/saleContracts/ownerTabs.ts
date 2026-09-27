// Tab + việc cần làm của hợp đồng mua bán trong cổng CHỦ TÀI SẢN — THUẦN.
//
// `ownerSaleActionOf` soi gương CASE `owner_action` của RPC
// `owner_sale_contract_summary` (nguồn huy hiệu sidebar) — sửa luật thì sửa CẢ
// HAI bên, không thì số trên huy hiệu lệch số trong tab "Cần bạn xử lý".

import { foldText, saleSearchText } from "./filters";
import { isSaleOpen } from "./stage";
import type { OwnerSaleAction, SaleContract } from "@/types/auction-sale-contract";

type ContractLike = Pick<
  SaleContract,
  "status" | "seller_confirmed_at" | "paid_at" | "handover_seller_confirmed_at"
>;

export type OwnerSaleTab = "action" | "active" | "completed" | "cancelled";

export const OWNER_SALE_TABS: { key: OwnerSaleTab; label: string }[] = [
  { key: "action", label: "Cần bạn xử lý" },
  { key: "active", label: "Đang thực hiện" },
  { key: "completed", label: "Hoàn tất" },
  { key: "cancelled", label: "Đã huỷ" },
];

export const OWNER_SALE_ACTION_LABELS: Record<Exclude<OwnerSaleAction, "none">, string> = {
  confirm_signed: "Xác nhận bản hợp đồng đã ký",
  confirm_handover: "Xác nhận đã bàn giao",
};

export function ownerSaleActionOf(c: ContractLike): OwnerSaleAction {
  if (c.status === "awaiting_confirmation" && !c.seller_confirmed_at) return "confirm_signed";
  if (c.status === "signed" && c.paid_at && !c.handover_seller_confirmed_at) return "confirm_handover";
  return "none";
}

/**
 * Một hợp đồng có thể thuộc NHIỀU tab: "Cần bạn xử lý" là tập con của "Đang
 * thực hiện" — tab sau là toàn bộ hợp đồng còn mở, kể cả việc đang chờ bên khác.
 */
export function inOwnerSaleTab(c: ContractLike, tab: OwnerSaleTab): boolean {
  switch (tab) {
    case "action":
      return ownerSaleActionOf(c) !== "none";
    case "active":
      return isSaleOpen(c);
    case "completed":
      return c.status === "completed";
    case "cancelled":
      return c.status === "cancelled";
  }
}

export function ownerSaleTabCounts(rows: readonly ContractLike[]): Record<OwnerSaleTab, number> {
  const counts: Record<OwnerSaleTab, number> = { action: 0, active: 0, completed: 0, cancelled: 0 };
  for (const c of rows) {
    for (const t of OWNER_SALE_TABS) if (inOwnerSaleTab(c, t.key)) counts[t.key] += 1;
  }
  return counts;
}

export function filterOwnerSaleContracts(
  rows: readonly SaleContract[],
  tab: OwnerSaleTab,
  q: string,
): SaleContract[] {
  const needle = foldText(q);
  return rows.filter((c) => inOwnerSaleTab(c, tab) && (!needle || saleSearchText(c).includes(needle)));
}
