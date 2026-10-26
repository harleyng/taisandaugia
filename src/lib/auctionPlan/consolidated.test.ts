// Danh mục hợp nhất toàn tỉnh (Phase 7): phép gom theo đơn vị + workbook Excel.
//
// Mẫu là bản chụp thật của `auction_plan_consolidated('d10ba07b…', 2026)` trên
// Trạm demo "UBND tỉnh Bắc Ninh" (26/10/2026): Phường Bắc Giang 4 tài sản
// (46.080.000.000 + 15.600.000.000 + 11.180.000.000 + 13.800.000.000 =
// 86.660.000.000 ₫ — đúng bằng `planned_start_value` của roll-up cho xã đó) và
// hai dòng đầu của Phường Việt Yên.

import { describe, expect, it } from "vitest";
import { consolidatedByUnit, consolidatedTotals, type ConsolidatedItemRow } from "./consolidated";
import { buildProvincePlanWorkbook, PROVINCE_SUMMARY_SHEET, sheetNameOf } from "./provinceExcel";

const row = (over: Partial<ConsolidatedItemRow>): ConsolidatedItemRow => ({
  admin_unit_code: "07210",
  unit_name: "Phường Bắc Giang",
  unit_level: "commune",
  plan_id: "plan-bg",
  plan_title: "Kế hoạch đấu giá QSDĐ năm 2026 · Phường Bắc Giang",
  plan_kind: "annual",
  plan_level: "commune",
  plan_status: "approved",
  baseline_version: 1,
  approval_doc_no: "QĐ-1202/QĐ-UBND",
  approval_doc_date: "2026-01-20",
  seq: 1,
  item_code: "KH26-001",
  asset_type: "land_use_right",
  title: "Khu dân cư Bắc Giang — lô A",
  lot_labels: "A-01→12",
  lot_count: 12,
  map_sheet: null,
  parcel_no: null,
  location: "Phường Bắc Giang",
  area_m2: 1440,
  land_use_code: "ODT",
  allocation_form: "giao_co_thu_tien",
  unit_start_price: 32_000_000,
  expected_start_value: 46_080_000_000,
  planned_month: "2026-06-01",
  planned_method: "truc_tiep_loi_noi",
  executing_unit: "Phòng Kinh tế",
  ...over,
});

const ROWS: ConsolidatedItemRow[] = [
  row({}),
  row({ seq: 2, item_code: "KH26-002", title: "Khu dân cư Bắc Giang — lô B", lot_labels: "B-01→05", area_m2: 520, unit_start_price: 30_000_000, expected_start_value: 15_600_000_000, planned_month: "2026-08-01" }),
  row({ seq: 3, item_code: "KH26-003", title: "Đất ở Thọ Xương", lot_labels: "TX-01→04", area_m2: 430, unit_start_price: 26_000_000, expected_start_value: 11_180_000_000, planned_month: "2026-11-01" }),
  row({ seq: 4, item_code: "KH26-004", title: "Khu tái định cư Dĩnh Kế — phần còn lại", lot_labels: "DK-05→09", area_m2: 600, unit_start_price: 23_000_000, expected_start_value: 13_800_000_000, planned_month: "2026-12-01" }),
  row({
    admin_unit_code: "07777",
    unit_name: "Phường Việt Yên",
    plan_id: "plan-vy",
    approval_doc_no: "QĐ-1203/QĐ-UBND",
    seq: 1,
    item_code: "KH26-001",
    title: "Khu dân cư Việt Yên — lô C",
    lot_labels: "C-01→09",
    area_m2: 1080,
    unit_start_price: 27_000_000,
    expected_start_value: 29_160_000_000,
    planned_month: "2026-05-01",
  }),
  row({
    admin_unit_code: "07777",
    unit_name: "Phường Việt Yên",
    plan_id: "plan-vy",
    approval_doc_no: "QĐ-1203/QĐ-UBND",
    seq: 2,
    item_code: "KH26-002",
    title: "Khu dân cư Việt Yên — lô D",
    lot_labels: "D-01→07",
    area_m2: 840,
    unit_start_price: 22_000_000,
    expected_start_value: 18_480_000_000,
    planned_month: "2026-06-01",
  }),
];

describe("consolidatedByUnit", () => {
  it("gom theo đơn vị, giữ thứ tự RPC trả về", () => {
    const units = consolidatedByUnit(ROWS);
    expect(units.map((u) => u.unitName)).toEqual(["Phường Bắc Giang", "Phường Việt Yên"]);
    expect(units[0].rows).toHaveLength(4);
    expect(units[1].rows).toHaveLength(2);
  });

  it("tổng mỗi đơn vị khớp bản mốc của xã đó", () => {
    const [bacGiang, vietYen] = consolidatedByUnit(ROWS);
    expect(bacGiang.totals.count).toBe(4);
    expect(bacGiang.totals.expected).toBe(86_660_000_000);
    expect(bacGiang.totals.area).toBe(2990);
    expect(vietYen.totals.expected).toBe(47_640_000_000);
  });

  it("đánh LẠI STT từ 1 trong mỗi bảng, và liệt kê căn cứ phê duyệt một lần", () => {
    const units = consolidatedByUnit(ROWS);
    expect(units[1].rows.map((r) => r.seq)).toEqual([1, 2]);
    expect(units[1].plans).toEqual([
      {
        planId: "plan-vy",
        planKind: "annual",
        baselineVersion: 1,
        approvalDocNo: "QĐ-1203/QĐ-UBND",
        approvalDocDate: "2026-01-20",
      },
    ]);
  });

  it("một đơn vị có cả kế hoạch năm và bổ sung ⇒ hai căn cứ, một bảng", () => {
    const units = consolidatedByUnit([
      ...ROWS.slice(0, 1),
      row({ plan_id: "plan-bg-sup", plan_kind: "supplement", approval_doc_no: "QĐ-1444", seq: 1, item_code: "KH26-005" }),
    ]);
    expect(units).toHaveLength(1);
    expect(units[0].plans.map((p) => p.planKind)).toEqual(["annual", "supplement"]);
    expect(units[0].rows.map((r) => r.seq)).toEqual([1, 2]);
  });

  it("tổng cả tỉnh = tổng các đơn vị", () => {
    const units = consolidatedByUnit(ROWS);
    const totals = consolidatedTotals(ROWS);
    expect(totals.count).toBe(6);
    expect(totals.expected).toBe(units.reduce((t, u) => t + u.totals.expected, 0));
    expect(totals.expected).toBe(134_300_000_000);
  });

  it("danh sách rỗng ⇒ không có đơn vị nào, tổng bằng 0", () => {
    expect(consolidatedByUnit([])).toEqual([]);
    expect(consolidatedTotals([]).count).toBe(0);
  });
});

describe("buildProvincePlanWorkbook", () => {
  it("một sheet Tổng hợp + một sheet cho mỗi đơn vị", () => {
    const units = consolidatedByUnit(ROWS);
    const wb = buildProvincePlanWorkbook(units, ROWS, 2026);
    expect(wb.SheetNames).toEqual([PROVINCE_SUMMARY_SHEET, "Phường Bắc Giang", "Phường Việt Yên"]);
  });

  it("sheet đơn vị dùng BẢY cột biểu mẫu chính thức", () => {
    const units = consolidatedByUnit(ROWS);
    const wb = buildProvincePlanWorkbook(units, ROWS, 2026);
    const ws = wb.Sheets["Phường Bắc Giang"];
    // Hàng 4 (index 3) là hàng tiêu đề: 3 dòng đầu là tiêu đề + căn cứ + dòng trống.
    expect(ws.A4?.v).toBe("STT");
    expect(ws.G4?.v).toBe("Thời gian dự kiến");
    expect(ws.B5?.v).toBe("Khu dân cư Bắc Giang — lô A");
    expect(ws.F5?.v).toBe(32_000_000);
    expect(ws.F5?.z).toBe("#,##0");
  });

  it("tên sheet cắt 28 ký tự và không trùng nhau", () => {
    const used = new Set<string>([PROVINCE_SUMMARY_SHEET]);
    expect(sheetNameOf("Phường Vũ Ninh", used)).toBe("Phường Vũ Ninh");
    expect(sheetNameOf("Phường Vũ Ninh", used)).toBe("Phường Vũ Ninh 2");
    expect(sheetNameOf("Xã/Phường [thử] *lạ*", used)).toBe("Xã Phường  thử   lạ");
    expect(sheetNameOf("A".repeat(40), used)).toHaveLength(28);
  });
});
