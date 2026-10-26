// Ghép một đơn vị lập kế hoạch với dòng của nó trong "Đợt lập kế hoạch" của tỉnh.
//
// Hai hình triển khai (A2) nên có HAI cách ghép, và chỉ một trong hai cột được
// điền trên mỗi dòng `auction_plan_cycle_units`:
//   * hình A — tỉnh sở hữu Trạm, xã là CHI NHÁNH  ⇒ ghép theo `branch_id`;
//   * hình B — xã có Trạm riêng đã liên kết       ⇒ ghép theo `child_workspace_id`.
//
// Đợt và đơn vị trong đợt là bảng CHỈ ĐỌC với client (không có policy ghi): bảng
// thông báo ở đầu trang danh sách đọc chúng, không bao giờ ghi.

import type { AuctionPlanCycle, AuctionPlanCycleUnit } from "./types";

export interface PlanningUnitRef {
  workspaceId: string;
  /** null = toàn đơn vị (chính Trạm đang chọn). */
  branchId: string | null;
}

export interface PlanCycleContext {
  cycle: AuctionPlanCycle;
  /** Dòng giao việc của chính đơn vị này — null khi đợt không gọi tên đơn vị. */
  unit: AuctionPlanCycleUnit | null;
}

const matches = (unit: AuctionPlanCycleUnit, ref: PlanningUnitRef): boolean =>
  ref.branchId ? unit.branch_id === ref.branchId : unit.child_workspace_id === ref.workspaceId;

/**
 * Đợt đang mở của năm kế hoạch mà đơn vị này phải trình. Ưu tiên đợt có GỌI TÊN
 * đơn vị (có dòng giao việc) — một tỉnh có thể mở cả đợt năm và đợt bổ sung.
 */
export function cycleForUnit(
  cycles: readonly AuctionPlanCycle[],
  units: readonly AuctionPlanCycleUnit[],
  ref: PlanningUnitRef,
  planYear: number,
): PlanCycleContext | null {
  const open = cycles.filter((c) => c.status === "open" && c.plan_year === planYear);
  if (open.length === 0) return null;
  const withUnit = open
    .map((cycle) => ({ cycle, unit: units.find((u) => u.cycle_id === cycle.id && matches(u, ref)) ?? null }))
    .sort((a, b) => Number(!!b.unit) - Number(!!a.unit));
  return withUnit[0] ?? null;
}

/** Còn bao nhiêu ngày tới hạn trình; quá hạn ⇒ số âm. null khi đợt không đặt hạn. */
export function daysToDeadline(deadline: string | null | undefined, todayIso: string): number | null {
  if (!deadline) return null;
  const a = Date.parse(`${deadline}T00:00:00Z`);
  const b = Date.parse(`${todayIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86_400_000);
}

/** "còn 12 ngày" · "hôm nay" · "quá hạn 3 ngày". */
export function deadlineText(days: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return "hạn trình là hôm nay";
  return days > 0 ? `còn ${days} ngày` : `quá hạn ${Math.abs(days)} ngày`;
}
