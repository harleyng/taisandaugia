import { describe, expect, it } from "vitest";
import {
  PLAN_ITEM_TEMPLATE_HEADERS,
  classifyPlanItemRows,
  detectPlanItemColumns,
  missingPlanItemColumns,
  parseDecimalCell,
  parsePlannedMonth,
  planItemRowsFromSheet,
  type ParsedPlanItemRow,
} from "./itemsImport";

const CTX = { planYear: 2027, assetType: "land_use_right" } as const;

describe("detectPlanItemColumns", () => {
  it("recognises the official form's seven columns", () => {
    expect(detectPlanItemColumns([...PLAN_ITEM_TEMPLATE_HEADERS])).toEqual({
      title: 1,
      lotLabels: 2,
      area: 3,
      location: 4,
      unitPrice: 5,
      month: 6,
    });
  });

  it("matches without diacritics, casing or the star", () => {
    expect(
      detectPlanItemColumns(["stt", "TEN LO DAT", "so lo", "Dien tich (m2)", "Vi tri", "Don gia", "Thang du kien"]),
    ).toMatchObject({ title: 1, area: 3, unitPrice: 5, month: 6 });
  });

  it("reports a missing title column", () => {
    expect(missingPlanItemColumns(["STT", "Diện tích"])).toEqual(["Tên lô đất"]);
    expect(missingPlanItemColumns([...PLAN_ITEM_TEMPLATE_HEADERS])).toEqual([]);
  });
});

describe("planItemRowsFromSheet", () => {
  it("skips fully empty rows and keeps the file's row numbers", () => {
    const rows = planItemRowsFromSheet([
      [...PLAN_ITEM_TEMPLATE_HEADERS],
      [1, "Lô A", "LK1-01", 100, "Giáp đường", 12000000, "6/2027"],
      ["", "", "", "", "", "", ""],
      [2, "Lô B", "", "", "", "", ""],
    ]);
    expect(rows.map((r) => [r.row, r.title])).toEqual([
      [2, "Lô A"],
      [4, "Lô B"],
    ]);
  });
});

describe("parsePlannedMonth", () => {
  it("reads the shapes officers actually type", () => {
    expect(parsePlannedMonth("6/2027", 2027)).toBe("2027-06-01");
    expect(parsePlannedMonth("06/2027", 2027)).toBe("2027-06-01");
    expect(parsePlannedMonth("2027-06", 2027)).toBe("2027-06-01");
    expect(parsePlannedMonth("Tháng 6/2027", 2027)).toBe("2027-06-01");
    expect(parsePlannedMonth("T6", 2027)).toBe("2027-06-01");
    expect(parsePlannedMonth("15/6/2027", 2027)).toBe("2027-06-01");
  });

  it("turns a quarter into the quarter's first month", () => {
    expect(parsePlannedMonth("Quý II", 2027)).toBe("2027-04-01");
    expect(parsePlannedMonth("Quý IV/2027", 2027)).toBe("2027-10-01");
    expect(parsePlannedMonth("Q3", 2027)).toBe("2027-07-01");
  });

  it("empty is undefined (allowed), nonsense is null (an error)", () => {
    expect(parsePlannedMonth("", 2027)).toBeUndefined();
    expect(parsePlannedMonth("   ", 2027)).toBeUndefined();
    expect(parsePlannedMonth("sau khi duyệt giá", 2027)).toBeNull();
    expect(parsePlannedMonth("13/2027", 2027)).toBeNull();
  });
});

describe("parseDecimalCell", () => {
  it("accepts both separator habits", () => {
    expect(parseDecimalCell("120.5")).toBeCloseTo(120.5);
    expect(parseDecimalCell("120,5")).toBeCloseTo(120.5);
    expect(parseDecimalCell("1.234")).toBe(1234);
    expect(parseDecimalCell("1,234")).toBe(1234);
    expect(parseDecimalCell("1.234,56")).toBeCloseTo(1234.56);
    expect(parseDecimalCell("1,234.56")).toBeCloseTo(1234.56);
    expect(parseDecimalCell("120 m²")).toBe(120);
  });

  it("empty is undefined, text is null", () => {
    expect(parseDecimalCell("")).toBeUndefined();
    expect(parseDecimalCell("khoảng 120")).toBeNull();
  });
});

describe("classifyPlanItemRows", () => {
  const row = (over: Partial<ParsedPlanItemRow> & { row: number }): ParsedPlanItemRow => ({
    title: `Lô LK1-${String(over.row).padStart(2, "0")}`,
    lotLabels: "",
    area: 100,
    location: "",
    unitPrice: 12_000_000,
    month: "6/2027",
    ...over,
  });

  it("fills payload with only the granted insert columns", () => {
    const { valid, invalid } = classifyPlanItemRows(
      [row({ row: 2, lotLabels: "LK1-10", location: "Giáp đường 5 m", area: "120,5", unitPrice: "12 triệu" })],
      CTX,
    );
    expect(invalid).toEqual([]);
    expect(valid[0].payload).toEqual({
      asset_type: "land_use_right",
      title: "Lô LK1-02",
      lot_labels: "LK1-10",
      location: "Giáp đường 5 m",
      area_m2: 120.5,
      unit_start_price: 12_000_000,
      expected_start_value: 1_446_000_000,
      planned_month: "2027-06-01",
    });
  });

  it("writes a row with no month but warns about it", () => {
    const { valid, invalid } = classifyPlanItemRows([row({ row: 2, month: "" })], CTX);
    expect(invalid).toEqual([]);
    expect(valid[0].payload.planned_month).toBeNull();
    expect(valid[0].warnings[0]).toContain("chưa có thời gian dự kiến");
  });

  it("rejects a month outside the plan year", () => {
    const { valid, invalid } = classifyPlanItemRows([row({ row: 2, month: "6/2026" })], CTX);
    expect(valid).toEqual([]);
    expect(invalid[0].reason).toContain("trong năm 2027");
  });

  // Tiêu chí nghiệm thu của Phase 3: 20 dòng, 2 dòng lỗi ⇒ ghi 18.
  it("keeps 18 of 20 rows when 2 are invalid", () => {
    const rows: ParsedPlanItemRow[] = Array.from({ length: 20 }, (_, i) => row({ row: i + 2 }));
    rows[4] = { ...rows[4], title: "" };
    rows[11] = { ...rows[11], area: "khoảng 120" };

    const { valid, invalid } = classifyPlanItemRows(rows, CTX);
    expect(valid).toHaveLength(18);
    expect(invalid).toHaveLength(2);
    expect(invalid.map((i) => i.row)).toEqual([6, 13]);
    expect(invalid[0].reason).toBe("Thiếu tên lô đất");
    expect(invalid[1].reason).toContain("Diện tích không đọc được");
    expect(valid.every((v) => v.payload.title.length >= 3)).toBe(true);
  });

  it("rejects an unreadable price and an over-long title", () => {
    const { invalid } = classifyPlanItemRows(
      [row({ row: 2, unitPrice: "thoả thuận" }), row({ row: 3, title: "x".repeat(301) })],
      CTX,
    );
    expect(invalid.map((i) => i.row)).toEqual([2, 3]);
    expect(invalid[0].reason).toContain("Giá khởi điểm");
    expect(invalid[1].reason).toContain("3 đến 300 ký tự");
  });
});
