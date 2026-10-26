import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  baselineMonthMap,
  baselineMonthOf,
  firstStep,
  monthEndIso,
  monthStartIso,
  planHealthCounts,
  planItemHealth,
  withBaselineMonth,
  type PlanItemHealthInput,
  type PlanStepHealthInput,
} from "./health";
import type { AuctionPlanBaseline, AuctionPlanItem } from "./types";

const AS_OF = "2026-10-26";

const item = (patch: Partial<PlanItemHealthInput> = {}): PlanItemHealthInput => ({
  planned_month: "2026-12-01",
  forecast_month: null,
  exec_status: "active",
  ...patch,
});

/** Bản mẫu QSDĐ 10 mốc, chưa làm gì, không có ngày dự kiến. */
const steps = (patch: Partial<PlanStepHealthInput>[] = []): PlanStepHealthInput[] =>
  Array.from({ length: 10 }, (_, i): PlanStepHealthInput => ({
    sort_order: i + 1,
    planned_date: null,
    done_on: null,
    ...(patch[i] ?? {}),
  }));

describe("monthEndIso / monthStartIso / addDaysIso", () => {
  it("gives the last day of the month", () => {
    expect(monthEndIso("2026-02-01")).toBe("2026-02-28");
    expect(monthEndIso("2028-02-01")).toBe("2028-02-29");
    expect(monthEndIso("2026-12-01")).toBe("2026-12-31");
  });

  it("returns null for a missing or malformed month", () => {
    expect(monthEndIso(null)).toBeNull();
    expect(monthEndIso("2026-13-01")).toBeNull();
    expect(monthEndIso("2026-06")).toBeNull();
  });

  it("normalises any day to the 1st and adds days without timezone drift", () => {
    expect(monthStartIso("2026-05-18")).toBe("2026-05-01");
    expect(addDaysIso("2026-12-25", 30)).toBe("2027-01-24");
    expect(addDaysIso("2026-02-27", 2)).toBe("2026-03-01");
  });
});

describe("planItemHealth — mỗi nhánh của bảng A5", () => {
  it("done: kết quả bán được và không bỏ cọc", () => {
    expect(planItemHealth(item({ planned_month: "2026-01-01" }), steps(), { outcome: "sold", payment_status: "paid" }, AS_OF)).toBe("done");
    expect(planItemHealth(item(), steps(), { outcome: "sold", payment_status: "pending" }, AS_OF)).toBe("done");
    expect(planItemHealth(item(), steps(), { outcome: "sold", payment_status: "partial" }, AS_OF)).toBe("done");
  });

  it("done thắng dropped: tài sản đã đấu thành rồi mới bị bỏ khỏi kế hoạch vẫn đọc là done", () => {
    expect(
      planItemHealth(item({ exec_status: "dropped" }), steps(), { outcome: "sold", payment_status: "paid" }, AS_OF),
    ).toBe("done");
  });

  it("dropped: đã bỏ khỏi kế hoạch, kể cả khi cũng đã trễ", () => {
    expect(planItemHealth(item({ exec_status: "dropped", planned_month: "2026-03-01" }), steps(), null, AS_OF)).toBe("dropped");
  });

  it("dropped thắng failed_retry", () => {
    expect(
      planItemHealth(item({ exec_status: "dropped" }), steps(), { outcome: "unsold", payment_status: null }, AS_OF),
    ).toBe("dropped");
  });

  it("failed_retry: không bán được / hoãn / huỷ / rút, và cả bán được nhưng BỎ CỌC", () => {
    for (const outcome of ["unsold", "postponed", "cancelled", "withdrawn"]) {
      expect(planItemHealth(item(), steps(), { outcome, payment_status: null }, AS_OF)).toBe("failed_retry");
    }
    expect(planItemHealth(item(), steps(), { outcome: "sold", payment_status: "defaulted" }, AS_OF)).toBe("failed_retry");
  });

  it("failed_retry thắng late: tháng kế hoạch đã qua nhưng đã có kết quả không thành", () => {
    expect(
      planItemHealth(item({ planned_month: "2026-05-01" }), steps(), { outcome: "unsold", payment_status: null }, AS_OF),
    ).toBe("failed_retry");
  });

  it("late: quá ngày cuối tháng kế hoạch mà chưa có kết quả bán được", () => {
    expect(planItemHealth(item({ planned_month: "2026-05-01" }), steps(), null, AS_OF)).toBe("late");
  });

  it("late có BIÊN BAO GỒM: đúng ngày cuối tháng chưa trễ, hôm sau mới trễ", () => {
    const may = item({ planned_month: "2026-05-01" });
    expect(planItemHealth(may, steps(), null, "2026-05-31")).not.toBe("late");
    expect(planItemHealth(may, steps(), null, "2026-06-01")).toBe("late");
  });

  it("late thắng at_risk: tháng đã qua VÀ có mốc quá hạn", () => {
    const overdue = steps([{ planned_date: "2026-04-01" }]);
    expect(planItemHealth(item({ planned_month: "2026-05-01" }), overdue, null, AS_OF)).toBe("late");
  });

  it("at_risk ①: một mốc có ngày dự kiến đã qua mà chưa xong", () => {
    const overdue = steps([{ planned_date: "2026-09-10" }]);
    expect(planItemHealth(item(), overdue, null, AS_OF)).toBe("at_risk");
  });

  it("at_risk ① biên bao gồm: mốc đến hạn ĐÚNG hôm nay là chưa quá hạn", () => {
    const dueToday = steps([{ planned_date: AS_OF }]);
    expect(planItemHealth(item({ planned_month: "2027-06-01" }), dueToday, null, AS_OF)).toBe("on_track");
  });

  it("at_risk ①: mốc quá hạn nhưng ĐÃ xong thì không tính", () => {
    const doneLate = steps([{ planned_date: "2026-09-10", done_on: "2026-09-20" }]);
    expect(planItemHealth(item({ planned_month: "2027-06-01" }), doneLate, null, AS_OF)).toBe("on_track");
  });

  it("at_risk ②: đã dời dự kiến sang tháng muộn hơn tháng kế hoạch", () => {
    expect(planItemHealth(item({ forecast_month: "2027-03-01" }), steps(), null, AS_OF)).toBe("at_risk");
  });

  it("at_risk ② không tính khi dời dự kiến SỚM hơn hoặc đúng tháng kế hoạch", () => {
    expect(planItemHealth(item({ forecast_month: "2026-11-01" }), steps([{ done_on: "2026-10-01" }]), null, AS_OF)).toBe("on_track");
    expect(planItemHealth(item({ forecast_month: "2026-12-01" }), steps([{ done_on: "2026-10-01" }]), null, AS_OF)).toBe("on_track");
  });

  it("at_risk ③: còn ≤ 30 ngày tới tháng kế hoạch mà mốc đầu tiên chưa xong", () => {
    expect(planItemHealth(item({ planned_month: "2026-11-01" }), steps(), null, AS_OF)).toBe("at_risk");
  });

  it("at_risk ③ không tính khi mốc đầu tiên đã xong", () => {
    expect(planItemHealth(item({ planned_month: "2026-11-01" }), steps([{ done_on: "2026-10-11" }]), null, AS_OF)).toBe("on_track");
  });

  it("at_risk ③ dùng mốc có sort_order NHỎ NHẤT (tài sản công không có legal_ready)", () => {
    const publicAsset: PlanStepHealthInput[] = Array.from({ length: 8 }, (_, i): PlanStepHealthInput => ({
      sort_order: i + 2,
      planned_date: null,
      done_on: null,
    }));
    expect(planItemHealth(item({ planned_month: "2026-11-01" }), publicAsset, null, AS_OF)).toBe("at_risk");
    publicAsset[0].done_on = "2026-10-11";
    expect(planItemHealth(item({ planned_month: "2026-11-01" }), publicAsset, null, AS_OF)).toBe("on_track");
  });

  it("at_risk ③ còn tính khi đã VÀO tháng kế hoạch (chưa quá ngày cuối tháng)", () => {
    expect(planItemHealth(item({ planned_month: "2026-10-01" }), steps(), null, AS_OF)).toBe("at_risk");
  });

  it("at_risk ③ không tính khi tháng kế hoạch còn xa hơn 30 ngày", () => {
    expect(planItemHealth(item({ planned_month: "2026-12-01" }), steps(), null, AS_OF)).toBe("on_track");
  });

  it("on_track: chưa có kết quả, chưa trễ, không mốc quá hạn", () => {
    expect(planItemHealth(item({ planned_month: "2027-06-01" }), steps(), null, AS_OF)).toBe("on_track");
  });

  it("chưa chọn tháng kế hoạch ⇒ không bao giờ late, cũng không dính luật 30 ngày", () => {
    expect(planItemHealth(item({ planned_month: null }), steps(), null, AS_OF)).toBe("on_track");
    expect(planItemHealth(item({ planned_month: null, forecast_month: "2027-01-01" }), steps(), null, AS_OF)).toBe("on_track");
  });

  it("so với THÁNG CỦA BẢN MỐC, không phải tháng đang sửa trong bản điều chỉnh", () => {
    const moved = item({ planned_month: "2027-06-01", baseline_month: "2026-05-01" });
    expect(planItemHealth(moved, steps(), null, AS_OF)).toBe("late");
  });

  it("không có bản mốc ⇒ dùng tháng hiện tại", () => {
    expect(baselineMonthOf(item({ planned_month: "2026-05-01" }))).toBe("2026-05-01");
    expect(baselineMonthOf(item({ planned_month: "2026-05-01", baseline_month: null }))).toBe("2026-05-01");
    expect(baselineMonthOf(item({ planned_month: "2026-05-01", baseline_month: "2026-09-01" }))).toBe("2026-09-01");
  });
});

describe("baselineMonthMap / withBaselineMonth", () => {
  const baseline = {
    payload: {
      items: [
        { id: "a", planned_month: "2026-05-01" },
        { id: "b", planned_month: null },
      ],
    },
  } as unknown as AuctionPlanBaseline;

  it("maps item id → baseline month", () => {
    const map = baselineMonthMap(baseline);
    expect(map.get("a")).toBe("2026-05-01");
    expect(map.get("b")).toBeNull();
    expect(map.has("c")).toBe(false);
    expect(baselineMonthMap(null).size).toBe(0);
  });

  it("falls back to the current month for an item added after the baseline", () => {
    const map = baselineMonthMap(baseline);
    const fresh = { id: "c", planned_month: "2026-12-01" } as unknown as AuctionPlanItem;
    expect(withBaselineMonth(fresh, map).baseline_month).toBe("2026-12-01");
    const old = { id: "a", planned_month: "2027-06-01" } as unknown as AuctionPlanItem;
    expect(withBaselineMonth(old, map).baseline_month).toBe("2026-05-01");
  });
});

describe("firstStep / planHealthCounts", () => {
  it("picks the lowest sort_order", () => {
    expect(firstStep([{ sort_order: 5 }, { sort_order: 2 }, { sort_order: 9 }])?.sort_order).toBe(2);
    expect(firstStep([])).toBeNull();
  });

  it("counts every bucket, zeros included", () => {
    expect(planHealthCounts(["late", "late", "done"])).toEqual({
      done: 1,
      dropped: 0,
      failed_retry: 0,
      late: 2,
      at_risk: 0,
      on_track: 0,
    });
  });
});
