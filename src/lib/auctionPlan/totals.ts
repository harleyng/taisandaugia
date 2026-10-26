// Tổng hợp thuần của một kế hoạch đấu giá: số tài sản, diện tích, giá trị khởi
// điểm dự kiến, và chia theo quý / tháng.
//
// Đây là con số hiện ở đầu trang (tầng L1) và trong hộp thoại "Trình kế hoạch",
// nên nó phải tính từ ĐÚNG một chỗ. "Kế hoạch so thực tế" theo kỳ (A5) là việc
// của Phase 6 và đọc baseline + kết quả phiên — không trộn vào đây.
//
// Tài sản đã bỏ khỏi kế hoạch (`exec_status = 'dropped'`) KHÔNG được tính: nó
// vẫn nằm trong bảng để giữ lịch sử, nhưng không còn là cam kết của đơn vị.

import type { AuctionPlan, AuctionPlanItem, AuctionPlanStatus } from "./types";

export type Quarter = 1 | 2 | 3 | 4;

export const QUARTERS: Quarter[] = [1, 2, 3, 4];

export const QUARTER_LABELS: Record<Quarter, string> = {
  1: "Quý I",
  2: "Quý II",
  3: "Quý III",
  4: "Quý IV",
};

/** "2027-06-01" → 6. Chuỗi rỗng / sai định dạng ⇒ null. */
export function monthNumberOf(planned: string | null | undefined): number | null {
  if (!planned) return null;
  const m = /^(\d{4})-(\d{2})/.exec(planned);
  if (!m) return null;
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? month : null;
}

export function quarterOf(planned: string | null | undefined): Quarter | null {
  const month = monthNumberOf(planned);
  return month === null ? null : ((Math.floor((month - 1) / 3) + 1) as Quarter);
}

/** Nhãn tháng gọn cho bảng: "6/2027"; chưa chọn ⇒ "—". */
export function monthLabel(planned: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(planned ?? "");
  return m ? `${Number(m[2])}/${m[1]}` : "—";
}

export interface PlanSlice {
  count: number;
  /** Tổng giá trị khởi điểm dự kiến (đồng). */
  expected: number;
}

export interface PlanTotals extends PlanSlice {
  /** Tổng diện tích (m²) — chỉ cộng những dòng có diện tích. */
  area: number;
  byQuarter: Record<Quarter, PlanSlice>;
  /** Số tài sản chưa chọn tháng dự kiến — `auction_plan_submit` chặn vì việc này. */
  withoutMonth: number;
  /** Số tài sản đã bỏ khỏi kế hoạch (không nằm trong các con số trên). */
  dropped: number;
}

const num = (v: number | string | null | undefined): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Chỉ cần 4 cột — trang danh sách tải đúng 4 cột đó cho mọi kế hoạch của năm. */
export type PlanTotalsInput = Pick<AuctionPlanItem, "planned_month" | "area_m2" | "expected_start_value" | "exec_status">;

export function planItemTotals(items: readonly PlanTotalsInput[]): PlanTotals {
  const byQuarter = { 1: { count: 0, expected: 0 }, 2: { count: 0, expected: 0 }, 3: { count: 0, expected: 0 }, 4: { count: 0, expected: 0 } } as Record<Quarter, PlanSlice>;
  const totals: PlanTotals = { count: 0, expected: 0, area: 0, byQuarter, withoutMonth: 0, dropped: 0 };

  for (const item of items) {
    if (item.exec_status === "dropped") {
      totals.dropped += 1;
      continue;
    }
    const expected = num(item.expected_start_value);
    totals.count += 1;
    totals.expected += expected;
    totals.area += num(item.area_m2);
    const q = quarterOf(item.planned_month);
    if (q === null) totals.withoutMonth += 1;
    else {
      byQuarter[q].count += 1;
      byQuarter[q].expected += expected;
    }
  }
  return totals;
}

/** Giá trị khởi điểm gợi ý = diện tích × đơn giá (A4.3); thiếu một vế ⇒ null. */
export function suggestExpectedValue(
  areaM2: number | null | undefined,
  unitPrice: number | null | undefined,
): number | null {
  if (!areaM2 || !unitPrice) return null;
  return Math.round(areaM2 * unitPrice);
}

/* ─── Trùng kế hoạch năm ──────────────────────────────────────────────────── */

/**
 * Bản sao Ở CLIENT của partial unique index
 * `(workspace_id, branch_id, plan_year) NULLS NOT DISTINCT WHERE kind='annual' AND status <> 'closed'`.
 *
 * Dùng để cảnh báo + khoá nút Lưu TRƯỚC khi gửi (cùng UX với trang Chỉ tiêu),
 * chứ không để thay cho index: index mới là cổng thật khi hai người bấm Lưu
 * cùng lúc.
 */
export function findAnnualPlanConflict(
  plans: readonly AuctionPlan[],
  candidate: { branchId: string | null; planYear: number; excludePlanId?: string },
): AuctionPlan | null {
  return (
    plans.find(
      (p) =>
        p.id !== candidate.excludePlanId &&
        p.kind === "annual" &&
        p.status !== "closed" &&
        p.plan_year === candidate.planYear &&
        (p.branch_id ?? null) === candidate.branchId,
    ) ?? null
  );
}

/* ─── Trạng thái → hành động chính của trang chi tiết ─────────────────────── */

/** Việc tiếp theo của kế hoạch — quyết định nút chính ở đầu trang chi tiết. */
export type PlanNextAction = "submit" | "reopen" | "waiting" | "approved" | "closed";

export function planNextAction(status: AuctionPlanStatus): PlanNextAction {
  if (status === "draft" || status === "adjusting") return "submit";
  if (status === "returned") return "reopen";
  if (status === "submitted") return "waiting";
  if (status === "approved") return "approved";
  return "closed";
}

/** Danh sách năm có kế hoạch, mới nhất trước; luôn có năm hiện tại để tạo mới. */
export function planYears(plans: readonly AuctionPlan[], currentYear: number): number[] {
  const years = new Set<number>(plans.map((p) => p.plan_year));
  years.add(currentYear);
  return [...years].sort((a, b) => b - a);
}
