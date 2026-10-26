import { describe, expect, it } from "vitest";
import {
  findAnnualPlanConflict,
  monthLabel,
  planItemTotals,
  planNextAction,
  planYears,
  quarterOf,
  suggestExpectedValue,
} from "./totals";
import type { AuctionPlan, AuctionPlanItem } from "./types";

const item = (over: Partial<AuctionPlanItem>): AuctionPlanItem =>
  ({
    id: over.id ?? "i1",
    plan_id: "p1",
    workspace_id: "w1",
    branch_id: null,
    admin_unit_code: "24127",
    seq: 1,
    item_code: "KH27-001",
    asset_type: "land_use_right",
    title: "Lô LK1-01",
    lot_labels: null,
    lot_count: null,
    map_sheet: null,
    parcel_no: null,
    location: null,
    area_m2: null,
    land_use_code: null,
    allocation_form: null,
    unit_start_price: null,
    expected_start_value: null,
    planned_month: null,
    planned_method: "chua_xac_dinh",
    executing_unit: null,
    forecast_month: null,
    forecast_reason: null,
    responsible_user_id: null,
    asset_posting_id: null,
    listing_id: null,
    exec_status: "active",
    exec_note: null,
    created_by: null,
    created_at: "2026-10-26T00:00:00Z",
    updated_at: "2026-10-26T00:00:00Z",
    ...over,
  }) as AuctionPlanItem;

const plan = (over: Partial<AuctionPlan>): AuctionPlan =>
  ({
    id: over.id ?? "p1",
    workspace_id: "w1",
    branch_id: null,
    admin_unit_code: "24127",
    cycle_id: null,
    plan_year: 2027,
    kind: "annual",
    title: null,
    level: "commune",
    status: "draft",
    baseline_version: 0,
    approval_doc_no: null,
    approval_doc_date: null,
    approval_doc_urls: [],
    legal_basis: null,
    notes: null,
    submitted_at: null,
    submitted_by: null,
    reviewed_at: null,
    reviewed_by: null,
    review_comment: null,
    created_by: null,
    created_at: "2026-10-26T00:00:00Z",
    updated_at: "2026-10-26T00:00:00Z",
    ...over,
  }) as AuctionPlan;

describe("quarterOf / monthLabel", () => {
  it("maps months to quarters", () => {
    expect(quarterOf("2027-01-01")).toBe(1);
    expect(quarterOf("2027-03-01")).toBe(1);
    expect(quarterOf("2027-04-01")).toBe(2);
    expect(quarterOf("2027-09-01")).toBe(3);
    expect(quarterOf("2027-12-01")).toBe(4);
  });

  it("treats missing or broken values as no quarter", () => {
    expect(quarterOf(null)).toBeNull();
    expect(quarterOf("")).toBeNull();
    expect(quarterOf("2027-13-01")).toBeNull();
    expect(monthLabel(null)).toBe("—");
    expect(monthLabel("2027-06-01")).toBe("6/2027");
  });
});

describe("planItemTotals", () => {
  it("sums count, area and expected value per quarter", () => {
    const totals = planItemTotals([
      item({ id: "a", planned_month: "2027-02-01", area_m2: 100, expected_start_value: 1_000_000_000 }),
      item({ id: "b", planned_month: "2027-03-01", area_m2: 50.5, expected_start_value: 500_000_000 }),
      item({ id: "c", planned_month: "2027-07-01", area_m2: 200, expected_start_value: 2_000_000_000 }),
    ]);
    expect(totals.count).toBe(3);
    expect(totals.area).toBeCloseTo(350.5);
    expect(totals.expected).toBe(3_500_000_000);
    expect(totals.byQuarter[1]).toEqual({ count: 2, expected: 1_500_000_000 });
    expect(totals.byQuarter[3]).toEqual({ count: 1, expected: 2_000_000_000 });
    expect(totals.byQuarter[2]).toEqual({ count: 0, expected: 0 });
    expect(totals.withoutMonth).toBe(0);
  });

  it("counts items without a month and excludes dropped ones", () => {
    const totals = planItemTotals([
      item({ id: "a", planned_month: null, expected_start_value: 1_000 }),
      item({ id: "b", exec_status: "dropped", planned_month: "2027-02-01", expected_start_value: 9_999 }),
    ]);
    expect(totals.count).toBe(1);
    expect(totals.withoutMonth).toBe(1);
    expect(totals.dropped).toBe(1);
    expect(totals.expected).toBe(1_000);
  });

  it("copes with numeric columns arriving as strings", () => {
    const totals = planItemTotals([
      item({ area_m2: "120.5" as unknown as number, expected_start_value: "1500000000" as unknown as number }),
    ]);
    expect(totals.area).toBeCloseTo(120.5);
    expect(totals.expected).toBe(1_500_000_000);
  });
});

describe("suggestExpectedValue", () => {
  it("multiplies area by unit price and rounds", () => {
    expect(suggestExpectedValue(120.5, 12_000_000)).toBe(1_446_000_000);
  });

  it("returns null when either side is missing", () => {
    expect(suggestExpectedValue(null, 12_000_000)).toBeNull();
    expect(suggestExpectedValue(120, null)).toBeNull();
    expect(suggestExpectedValue(0, 12_000_000)).toBeNull();
  });
});

describe("findAnnualPlanConflict", () => {
  const plans = [
    plan({ id: "p-live", branch_id: "b1", plan_year: 2027, status: "approved" }),
    plan({ id: "p-closed", branch_id: "b2", plan_year: 2027, status: "closed" }),
    plan({ id: "p-supp", branch_id: "b3", plan_year: 2027, kind: "supplement" }),
    plan({ id: "p-unit", branch_id: null, plan_year: 2026, status: "draft" }),
  ];

  it("flags a non-closed annual plan of the same unit and year", () => {
    expect(findAnnualPlanConflict(plans, { branchId: "b1", planYear: 2027 })?.id).toBe("p-live");
  });

  it("treats the whole unit (branch_id NULL) as its own unit — NULLS NOT DISTINCT", () => {
    expect(findAnnualPlanConflict(plans, { branchId: null, planYear: 2026 })?.id).toBe("p-unit");
    expect(findAnnualPlanConflict(plans, { branchId: null, planYear: 2027 })).toBeNull();
  });

  it("ignores closed plans, supplements, other years and itself", () => {
    expect(findAnnualPlanConflict(plans, { branchId: "b2", planYear: 2027 })).toBeNull();
    expect(findAnnualPlanConflict(plans, { branchId: "b3", planYear: 2027 })).toBeNull();
    expect(findAnnualPlanConflict(plans, { branchId: "b1", planYear: 2028 })).toBeNull();
    expect(findAnnualPlanConflict(plans, { branchId: "b1", planYear: 2027, excludePlanId: "p-live" })).toBeNull();
  });
});

describe("planNextAction / planYears", () => {
  it("picks the primary action from the status", () => {
    expect(planNextAction("draft")).toBe("submit");
    expect(planNextAction("adjusting")).toBe("submit");
    expect(planNextAction("returned")).toBe("reopen");
    expect(planNextAction("submitted")).toBe("waiting");
    expect(planNextAction("approved")).toBe("approved");
    expect(planNextAction("closed")).toBe("closed");
  });

  it("always offers the current year, newest first", () => {
    expect(planYears([plan({ plan_year: 2025 }), plan({ plan_year: 2027 })], 2026)).toEqual([2027, 2026, 2025]);
  });
});
