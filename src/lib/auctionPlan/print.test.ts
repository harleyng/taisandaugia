import { describe, expect, it } from "vitest";
import {
  formalDateLine,
  formatPlanDate,
  planPrintSource,
  printPeriodLabel,
} from "./print";
import type {
  AuctionPlan,
  AuctionPlanBaseline,
  AuctionPlanBaselinePayload,
  AuctionPlanItem,
} from "./types";

const plan = (over: Partial<AuctionPlan> = {}): AuctionPlan =>
  ({
    id: "p1",
    workspace_id: "ws",
    branch_id: null,
    admin_unit_code: "09169",
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
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...over,
  }) as AuctionPlan;

const item = (
  over: Partial<AuctionPlanItem> & { item_code: string },
): AuctionPlanItem =>
  ({
    id: `i-${over.item_code}`,
    plan_id: "p1",
    workspace_id: "ws",
    branch_id: null,
    admin_unit_code: "09169",
    seq: 1,
    asset_type: "land_use_right",
    title: "Lô LK1",
    lot_labels: "LK1-01",
    lot_count: 1,
    map_sheet: null,
    parcel_no: null,
    location: "Thôn Đoài",
    area_m2: 100,
    land_use_code: "ONT",
    allocation_form: "giao_co_thu_tien",
    unit_start_price: 10_000_000,
    expected_start_value: 1_000_000_000,
    planned_month: "2027-03-01",
    planned_method: "truc_tiep_loi_noi",
    executing_unit: "Phòng Kinh tế",
    forecast_month: null,
    forecast_reason: null,
    responsible_user_id: null,
    asset_posting_id: null,
    listing_id: null,
    exec_status: "active",
    exec_note: null,
    created_by: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...over,
  }) as AuctionPlanItem;

const payloadOf = (codes: string[]): AuctionPlanBaselinePayload => ({
  plan: {
    id: "p1",
    plan_year: 2027,
    kind: "annual",
    level: "commune",
    title: null,
    admin_unit_code: "09169",
    branch_id: null,
    cycle_id: null,
    legal_basis: null,
  },
  items: codes.map((code, i): AuctionPlanBaselinePayload["items"][number] => ({
    id: `i-${code}`,
    seq: i + 1,
    item_code: code,
    asset_type: "land_use_right",
    title: `Lô ${code}`,
    lot_labels: null,
    lot_count: null,
    map_sheet: null,
    parcel_no: null,
    location: null,
    area_m2: 200,
    land_use_code: null,
    allocation_form: null,
    unit_start_price: 5_000_000,
    expected_start_value: 1_000_000_000,
    planned_month: "2027-06-01",
    planned_method: "truc_tuyen",
    executing_unit: null,
  })),
  totals: {
    item_count: codes.length,
    area_total: 0,
    expected_total: 0,
    by_month: {},
    by_quarter: {},
  },
  frozen_at: "2026-11-01T00:00:00Z",
});

const baseline = (version: number, codes: string[]): AuctionPlanBaseline => ({
  id: `b${version}`,
  plan_id: "p1",
  workspace_id: "ws",
  branch_id: null,
  version,
  approved_at: "2026-11-01T00:00:00Z",
  approved_by: null,
  approval_doc_no: `${version}00/QĐ-UBND`,
  approval_doc_date: "2026-11-01",
  approval_doc_urls: [],
  payload: payloadOf(codes),
  created_at: "2026-11-01T00:00:00Z",
});

describe("printPeriodLabel / formatPlanDate / formalDateLine", () => {
  it("ghi theo tháng của biểu mẫu giấy", () => {
    expect(printPeriodLabel("2027-06-01")).toBe("Tháng 6/2027");
    expect(printPeriodLabel(null)).toBe("—");
  });

  it("ngày dạng dd/mm/yyyy và dòng ngày tháng của văn bản", () => {
    expect(formatPlanDate("2026-11-05T10:00:00Z")).toBe("05/11/2026");
    expect(formatPlanDate(null)).toBe("—");
    expect(formalDateLine("2026-11-05")).toBe("ngày 5 tháng 11 năm 2026");
    expect(formalDateLine(null)).toBe("");
  });
});

describe("planPrintSource", () => {
  const items = [
    item({ item_code: "KH27-001" }),
    item({ item_code: "KH27-002", exec_status: "dropped" }),
  ];

  it("kế hoạch chưa duyệt in danh mục hiện tại và đánh dấu bản dự thảo", () => {
    const src = planPrintSource(plan(), items, []);
    expect(src.isDraft).toBe(true);
    expect(src.baseline).toBeNull();
    expect(src.rows.map((r) => r.itemCode)).toEqual(["KH27-001"]);
    expect(src.totals.dropped).toBe(1);
  });

  it("kế hoạch đã duyệt in BẢN MỐC mới nhất, không in danh mục hiện tại", () => {
    const src = planPrintSource(
      plan({ status: "approved", baseline_version: 2 }),
      items,
      [baseline(1, ["KH27-001"]), baseline(2, ["KH27-001", "KH27-005"])],
    );
    expect(src.isDraft).toBe(false);
    expect(src.baseline?.version).toBe(2);
    expect(src.rows.map((r) => r.itemCode)).toEqual(["KH27-001", "KH27-005"]);
    expect(src.totals.count).toBe(2);
  });

  it("đang điều chỉnh thì in danh mục hiện tại dù đã có bản mốc", () => {
    const src = planPrintSource(
      plan({ status: "adjusting", baseline_version: 1 }),
      items,
      [baseline(1, ["KH27-001"])],
    );
    expect(src.isDraft).toBe(true);
    expect(src.rows).toHaveLength(1);
  });

  it("đã đóng vẫn in bản mốc", () => {
    const src = planPrintSource(
      plan({ status: "closed", baseline_version: 1 }),
      items,
      [baseline(1, ["KH27-009"])],
    );
    expect(src.baseline?.version).toBe(1);
    expect(src.rows[0].itemCode).toBe("KH27-009");
  });

  it("đã duyệt nhưng chưa tải được bản mốc ⇒ in danh mục hiện tại, đánh dấu dự thảo", () => {
    const src = planPrintSource(
      plan({ status: "approved", baseline_version: 1 }),
      items,
      [],
    );
    expect(src.isDraft).toBe(true);
  });
});
