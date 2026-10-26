// Luật thu hẹp kiểu + nhãn của phần "Thực hiện kế hoạch đấu giá" (payload v2, Phase 8).
// Không có phép tính chỉ số nào ở đây — chỉ số do owner_report_plan_execution tính ở server.

import { describe, expect, it } from "vitest";
import {
  mapReportPlanExecution,
  planAttentionReason,
  planDayLabel,
  planExecutionHeadline,
  planExecutionUnitLabel,
  planMonthLabel,
  type PlanExecutionAttentionItem,
} from "./ownerReportPlanExecution";

const attention = (patch: Partial<PlanExecutionAttentionItem> = {}): PlanExecutionAttentionItem => ({
  itemCode: "KH26-002",
  title: "Khu dân cư — lô B",
  health: "late",
  baselineMonth: "2026-08-01",
  forecastMonth: null,
  stepsDone: 2,
  stepsTotal: 10,
  forecastReason: null,
  execNote: null,
  overdueStep: null,
  overdueStepDate: null,
  overdueStepNote: null,
  ...patch,
});

describe("mapReportPlanExecution", () => {
  it("trả null cho payload v1 và cho mọi giá trị không phải object", () => {
    expect(mapReportPlanExecution(undefined)).toBeNull();
    expect(mapReportPlanExecution(null)).toBeNull();
    expect(mapReportPlanExecution("x")).toBeNull();
    expect(mapReportPlanExecution(42)).toBeNull();
    expect(mapReportPlanExecution([])).toBeNull();
  });

  it("object rỗng ⇒ phần có thật nhưng không có kế hoạch nào, số về 0", () => {
    const pe = mapReportPlanExecution({})!;
    expect(pe).not.toBeNull();
    expect(pe.plans).toEqual([]);
    expect(pe.period).toBeNull();
    expect(pe.totals.plans).toBe(0);
    expect(pe.totals.plannedCount).toBe(0);
    // donePct null ⇒ UI hiện "—", KHÔNG hiện 0%.
    expect(pe.totals.donePct).toBeNull();
  });

  it("đọc đúng chỉ số, số đếm và các dòng chi tiết", () => {
    const pe = mapReportPlanExecution({
      as_of: "2026-10-26",
      period: { type: "quarter", start: "2026-10-01", end: "2026-12-31" },
      totals: { plans: 2, planned_count: 9, sold_count: 3, done_pct: 33, late_count: 1, at_risk_count: 2, moved_count: 4 },
      plans: [
        {
          title: "KH 2026 · Xã A",
          unit_name: "Xã A",
          kind: "annual",
          status: "approved",
          plan_year: 2026,
          metrics: { planned_count: 5, sold_count: 2, winning_total: "1500", collected: 1500, done_pct: 40 },
          attention: [{ item_code: "KH26-001", title: "Lô A", health: "late", steps_done: 1, steps_total: 10 }],
          forecast_moves: [{ item_code: "KH26-002", title: "Lô B", baseline_month: "2026-10-01", forecast_month: "2026-11-01" }],
        },
      ],
    })!;
    expect(pe.asOf).toBe("2026-10-26");
    expect(pe.period).toEqual({ type: "quarter", start: "2026-10-01", end: "2026-12-31" });
    expect(pe.totals.plannedCount).toBe(9);
    expect(pe.totals.movedCount).toBe(4);
    const plan = pe.plans[0];
    expect(plan.kind).toBe("annual");
    expect(plan.status).toBe("approved");
    expect(plan.metrics.winningTotal).toBe(1500);
    expect(plan.metrics.donePct).toBe(40);
    expect(plan.attention[0].health).toBe("late");
    expect(plan.forecastMoves[0].forecastMonth).toBe("2026-11-01");
  });

  it("bỏ qua mã trạng thái / sức khoẻ / mốc không có trong danh mục", () => {
    const pe = mapReportPlanExecution({
      plans: [
        {
          kind: "khong_co",
          status: "khong_co",
          attention: [{ health: "khong_co", overdue_step: "khong_co" }],
        },
      ],
    })!;
    expect(pe.plans[0].kind).toBeNull();
    expect(pe.plans[0].status).toBeNull();
    expect(pe.plans[0].attention[0].health).toBeNull();
    expect(pe.plans[0].attention[0].overdueStep).toBeNull();
  });
});

describe("nhãn", () => {
  it("tháng và ngày", () => {
    expect(planMonthLabel("2026-08-01")).toBe("8/2026");
    expect(planMonthLabel(null)).toBe("—");
    expect(planDayLabel("2026-05-09")).toBe("09/05/2026");
    expect(planDayLabel(null)).toBe("—");
  });

  it("tên đơn vị lùi dần: đơn vị hành chính → chi nhánh → tiêu đề", () => {
    const base = mapReportPlanExecution({ plans: [{ title: "KH 2026" }] })!.plans[0];
    expect(planExecutionUnitLabel(base)).toBe("KH 2026");
    expect(planExecutionUnitLabel({ ...base, branchName: "CN 1" })).toBe("CN 1");
    expect(planExecutionUnitLabel({ ...base, branchName: "CN 1", unitName: "Xã A" })).toBe("Xã A");
    expect(planExecutionUnitLabel({ ...base, title: null })).toBe("Kế hoạch chưa đặt tên");
  });

  it("lý do xếp theo thứ tự: dời tháng → mốc quá hạn → ghi chú; không có gì thì nói rõ", () => {
    expect(planAttentionReason(attention())).toBe("Chưa khai lý do");
    expect(planAttentionReason(attention({ overdueStep: "start_price", overdueStepDate: "2026-05-09" }))).toBe(
      'Quá hạn mốc "Phê duyệt giá khởi điểm" (hạn 09/05/2026)',
    );
    expect(planAttentionReason(attention({ overdueStep: "start_price" }))).toBe('Quá hạn mốc "Phê duyệt giá khởi điểm"');
    expect(
      planAttentionReason(attention({ forecastReason: "Chờ mặt bằng", overdueStep: "announced", execNote: "Đã nhắc xã" })),
    ).toBe('Chờ mặt bằng · Quá hạn mốc "Thông báo công khai" · Đã nhắc xã');
  });

  it("câu L1 nêu đấu thành trên kế hoạch rồi mới tới việc cần chú ý", () => {
    const pe = mapReportPlanExecution({
      totals: { planned_count: 19, sold_count: 4, late_count: 4, at_risk_count: 4, moved_count: 4 },
    })!;
    expect(planExecutionHeadline(pe)).toBe(
      "Đã đấu thành 4/19 tài sản theo kế hoạch · 4 tài sản trễ · 4 nguy cơ trễ · 4 đã dời tháng dự kiến",
    );
    const clean = mapReportPlanExecution({ totals: { planned_count: 5, sold_count: 5 } })!;
    expect(planExecutionHeadline(clean)).toBe("Đã đấu thành 5/5 tài sản theo kế hoạch");
  });
});
