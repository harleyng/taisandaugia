// Bản soạn "đơn vị trong đợt" — tách khỏi component để file component chỉ export
// component (luật react-refresh/only-export-components của ESLint repo này).

import type { PlanCycleCandidate } from "@/hooks/useAuctionPlanProvince";

/** Một dòng đang soạn: chọn / không, và chỉ tiêu giao. */
export interface CycleUnitDraft {
  selected: boolean;
  revenue: number | null;
  count: number | null;
}

export type CycleUnitDraftMap = Record<string, CycleUnitDraft>;

export const emptyDraft: CycleUnitDraft = { selected: false, revenue: null, count: null };

/** Dựng bản soạn từ danh sách xã + chỉ tiêu đã giao trước đó (nếu có). */
export function buildCycleDraft(
  candidates: readonly PlanCycleCandidate[],
  existing?: ReadonlyMap<string, { revenue: number | null; count: number | null }>,
): CycleUnitDraftMap {
  const out: CycleUnitDraftMap = {};
  for (const c of candidates) {
    const prev = existing?.get(c.admin_unit_code);
    out[c.admin_unit_code] = prev
      ? { selected: true, revenue: prev.revenue, count: prev.count }
      : { ...emptyDraft };
  }
  return out;
}
