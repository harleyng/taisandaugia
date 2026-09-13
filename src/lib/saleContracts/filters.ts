// Lọc danh sách hợp đồng mua bán — THUẦN, dùng chung cho cổng tổ chức và cổng
// chủ tài sản. Lọc phía client vì một tổ chức hiếm khi có quá vài trăm hợp
// đồng, và cả hai màn dùng chung một cache theo `byOrg`.

import { saleOverdueOf, saleStageOf } from "./stage";
import type { SaleContract, SaleInstallment, SaleStage } from "@/types/auction-sale-contract";

export const ALL_SESSIONS = "all";
export const ALL_STAGES = "all";

export interface SaleFilters {
  sessionId: string;
  stage: SaleStage | typeof ALL_STAGES;
  overdueOnly: boolean;
  q: string;
}

export const EMPTY_SALE_FILTERS: SaleFilters = {
  sessionId: ALL_SESSIONS,
  stage: ALL_STAGES,
  overdueOnly: false,
  q: "",
};

/** Bỏ dấu để gõ "bao tin" cũng ra "Bảo Tín". */
export function foldText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

/** Chuỗi tìm kiếm của một hợp đồng: mã, số hợp đồng, tên tài sản, tên bên mua. */
export function saleSearchText(c: SaleContract): string {
  const asset = (c.asset_snapshot ?? {}) as { title?: string | null; session_code?: string | null };
  const buyer = (c.buyer_party ?? {}) as { full_name?: string | null };
  return foldText(
    [c.code, c.contract_no, asset.title, asset.session_code, buyer.full_name]
      .filter(Boolean)
      .join(" "),
  );
}

export function filterSaleContracts(
  rows: readonly SaleContract[],
  filters: SaleFilters,
  installmentsByContract: Readonly<Record<string, SaleInstallment[]>> = {},
  now: Date = new Date(),
): SaleContract[] {
  const q = foldText(filters.q);
  return rows.filter((c) => {
    if (filters.sessionId !== ALL_SESSIONS && c.session_id !== filters.sessionId) return false;
    if (filters.stage !== ALL_STAGES && saleStageOf(c) !== filters.stage) return false;
    if (filters.overdueOnly && !saleOverdueOf(c, installmentsByContract[c.id] ?? [], now).any) return false;
    if (q && !saleSearchText(c).includes(q)) return false;
    return true;
  });
}

/** Đếm cho các thẻ thống kê ở đầu trang. */
export function saleStageCounts(rows: readonly SaleContract[]): Record<SaleStage, number> {
  const counts: Record<SaleStage, number> = {
    signing: 0, paying: 0, handover: 0, completed: 0, cancelled: 0,
  };
  for (const c of rows) counts[saleStageOf(c)] += 1;
  return counts;
}
