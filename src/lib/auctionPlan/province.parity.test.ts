// Đối chiếu ROLL-UP TỈNH ↔ TỔNG CÁC SỐ "THEO KỲ" CỦA TỪNG XÃ.
//
// Đây là tiêu chí nghiệm thu của Phase 7: "tổng của bảng Toàn tỉnh bằng tổng các
// số 'Theo kỳ' của các xã trong cùng một kỳ". `auction_plan_rollup` cộng chính
// các dòng `auction_plan_period_metrics` của từng kế hoạch, nên đẳng thức đúng do
// CẤU TRÚC — bảng dưới đây là bản chụp THẬT chứng minh điều đó, và là cái chuông
// báo nếu một ngày roll-up tự tính lại thay vì gọi hàm kỳ.
//
// Chụp ngày 26/10/2026 từ Trạm demo `d10ba07b-13d3-43d9-98ad-682445df74ba`
// ("UBND tỉnh Bắc Ninh", 4 xã, 4 kế hoạch năm đã duyệt, 20 tài sản) bằng:
//
//   SELECT … FROM auction_plan_rollup(ws, 2026, t, s)              -- cột "rollup"
//   SELECT … FROM auction_plans pl                                  -- cột "perPlan"
//     CROSS JOIN LATERAL auction_plan_period_metrics(pl.id, t, s)
//
// 10 kỳ (năm + 4 quý + 5 tháng) × 8 chỉ số = 80 cặp.

import { describe, expect, it } from "vitest";
import { provinceSummary, type ProvinceRollupRow } from "./province";

interface MetricSet {
  plannedCount: number;
  plannedStartValue: number;
  offeredCount: number;
  soldCount: number;
  actualStartValue: number;
  winningTotal: number;
  collected: number;
  awaiting: number;
}

interface Snapshot {
  periodType: "month" | "quarter" | "year";
  periodStart: string;
  unitCount: number;
  /** Tổng của `auction_plan_rollup` trên 4 xã. */
  rollup: MetricSet;
  /** Tổng của `auction_plan_period_metrics` trên 4 kế hoạch. */
  perPlan: MetricSet;
}

const set = (v: [number, number, number, number, number, number, number, number]): MetricSet => ({
  plannedCount: v[0],
  plannedStartValue: v[1],
  offeredCount: v[2],
  soldCount: v[3],
  actualStartValue: v[4],
  winningTotal: v[5],
  collected: v[6],
  awaiting: v[7],
});

const SNAPSHOTS: Snapshot[] = [
  {
    periodType: "year",
    periodStart: "2026-01-01",
    unitCount: 4,
    rollup: set([19, 359_485_500_000, 6, 4, 130_555_500_000, 123_687_600_000, 123_687_600_000, 0]),
    perPlan: set([19, 359_485_500_000, 6, 4, 130_555_500_000, 123_687_600_000, 123_687_600_000, 0]),
  },
  {
    periodType: "quarter",
    periodStart: "2026-01-01",
    unitCount: 4,
    rollup: set([0, 0, 0, 0, 0, 0, 0, 0]),
    perPlan: set([0, 0, 0, 0, 0, 0, 0, 0]),
  },
  {
    periodType: "quarter",
    periodStart: "2026-04-01",
    unitCount: 4,
    rollup: set([6, 149_080_000_000, 3, 2, 91_440_000_000, 86_092_800_000, 86_092_800_000, 0]),
    perPlan: set([6, 149_080_000_000, 3, 2, 91_440_000_000, 86_092_800_000, 86_092_800_000, 0]),
  },
  {
    periodType: "quarter",
    periodStart: "2026-07-01",
    unitCount: 4,
    rollup: set([4, 54_715_500_000, 3, 2, 39_115_500_000, 37_594_800_000, 37_594_800_000, 0]),
    perPlan: set([4, 54_715_500_000, 3, 2, 39_115_500_000, 37_594_800_000, 37_594_800_000, 0]),
  },
  {
    periodType: "quarter",
    periodStart: "2026-10-01",
    unitCount: 4,
    rollup: set([9, 155_690_000_000, 0, 0, 0, 0, 0, 0]),
    perPlan: set([9, 155_690_000_000, 0, 0, 0, 0, 0, 0]),
  },
  {
    periodType: "month",
    periodStart: "2026-05-01",
    unitCount: 4,
    rollup: set([3, 57_640_000_000, 0, 0, 0, 0, 0, 0]),
    perPlan: set([3, 57_640_000_000, 0, 0, 0, 0, 0, 0]),
  },
  {
    periodType: "month",
    periodStart: "2026-06-01",
    unitCount: 4,
    rollup: set([3, 91_440_000_000, 3, 2, 91_440_000_000, 86_092_800_000, 86_092_800_000, 0]),
    perPlan: set([3, 91_440_000_000, 3, 2, 91_440_000_000, 86_092_800_000, 86_092_800_000, 0]),
  },
  {
    periodType: "month",
    periodStart: "2026-07-01",
    unitCount: 4,
    rollup: set([3, 39_115_500_000, 3, 2, 39_115_500_000, 37_594_800_000, 37_594_800_000, 0]),
    perPlan: set([3, 39_115_500_000, 3, 2, 39_115_500_000, 37_594_800_000, 37_594_800_000, 0]),
  },
  {
    periodType: "month",
    periodStart: "2026-11-01",
    unitCount: 4,
    rollup: set([4, 83_570_000_000, 0, 0, 0, 0, 0, 0]),
    perPlan: set([4, 83_570_000_000, 0, 0, 0, 0, 0, 0]),
  },
  {
    periodType: "month",
    periodStart: "2026-12-01",
    unitCount: 4,
    rollup: set([5, 72_120_000_000, 0, 0, 0, 0, 0, 0]),
    perPlan: set([5, 72_120_000_000, 0, 0, 0, 0, 0, 0]),
  },
];

/** Dựng lại 4 dòng roll-up "giả" mang đúng tổng đã chụp, để chạy qua provinceSummary. */
function rowsFrom(snapshot: Snapshot): ProvinceRollupRow[] {
  const m = snapshot.rollup;
  const blank: ProvinceRollupRow = {
    admin_unit_code: "x",
    unit_name: "Xã",
    unit_level: "commune",
    shape: "branch",
    branch_id: "b",
    child_workspace_id: null,
    in_cycle: true,
    cycle_id: "c",
    cycle_kind: "annual",
    cycle_status: "closed",
    submit_deadline: null,
    cycle_plan_id: "p",
    cycle_plan_status: "approved",
    assigned_revenue: 0,
    assigned_count: 0,
    plan_count: 1,
    plan_id: "p",
    plan_status: "approved",
    plan_statuses: ["approved"],
    has_submitted: true,
    is_returned: false,
    period_type: snapshot.periodType,
    period_start: snapshot.periodStart,
    period_end: snapshot.periodStart,
    planned_count: 0,
    planned_start_value: 0,
    offered_count: 0,
    sold_count: 0,
    actual_start_value: 0,
    winning_total: 0,
    collected: 0,
    recorded: 0,
    estimated: 0,
    awaiting: 0,
    done_pct: null,
    late_count: 0,
    at_risk_count: 0,
    last_update: null,
  };
  // Dồn toàn bộ tổng vào dòng đầu, ba dòng còn lại bằng 0: provinceSummary chỉ
  // CỘNG, nên tổng không phụ thuộc cách chia — điều cần kiểm là phép cộng.
  return [
    {
      ...blank,
      admin_unit_code: "u1",
      planned_count: m.plannedCount,
      planned_start_value: m.plannedStartValue,
      offered_count: m.offeredCount,
      sold_count: m.soldCount,
      actual_start_value: m.actualStartValue,
      winning_total: m.winningTotal,
      collected: m.collected,
      awaiting: m.awaiting,
    },
    { ...blank, admin_unit_code: "u2" },
    { ...blank, admin_unit_code: "u3" },
    { ...blank, admin_unit_code: "u4" },
  ];
}

describe("auction_plan_rollup ↔ Σ auction_plan_period_metrics (Trạm demo Bắc Ninh, 2026)", () => {
  it.each(SNAPSHOTS)("kỳ $periodType $periodStart khớp từng chỉ số", (snapshot) => {
    expect(snapshot.rollup).toEqual(snapshot.perPlan);
  });

  it.each(SNAPSHOTS)("provinceSummary cộng đúng tổng đã chụp ($periodType $periodStart)", (snapshot) => {
    const s = provinceSummary(rowsFrom(snapshot));
    expect(s.unitCount).toBe(snapshot.unitCount);
    expect(s.plannedCount).toBe(snapshot.perPlan.plannedCount);
    expect(s.plannedStartValue).toBe(snapshot.perPlan.plannedStartValue);
    expect(s.offeredCount).toBe(snapshot.perPlan.offeredCount);
    expect(s.soldCount).toBe(snapshot.perPlan.soldCount);
    expect(s.winningTotal).toBe(snapshot.perPlan.winningTotal);
    expect(s.collected).toBe(snapshot.perPlan.collected);
    expect(s.awaiting).toBe(snapshot.perPlan.awaiting);
  });

  it("tổng của cả năm bằng tổng 4 quý cho những chỉ số cộng được", () => {
    const quarters = SNAPSHOTS.filter((s) => s.periodType === "quarter");
    const year = SNAPSHOTS.find((s) => s.periodType === "year")!;
    expect(quarters).toHaveLength(4);
    const sum = (pick: (m: MetricSet) => number) => quarters.reduce((t, q) => t + pick(q.rollup), 0);
    expect(sum((m) => m.plannedCount)).toBe(year.rollup.plannedCount);
    expect(sum((m) => m.plannedStartValue)).toBe(year.rollup.plannedStartValue);
    expect(sum((m) => m.soldCount)).toBe(year.rollup.soldCount);
    expect(sum((m) => m.winningTotal)).toBe(year.rollup.winningTotal);
    expect(sum((m) => m.collected)).toBe(year.rollup.collected);
  });
});
