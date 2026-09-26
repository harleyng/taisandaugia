import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx-js-style";
import { REPORT_SHEETS, buildReportWorkbook } from "./ownerPeriodicReportExcel";
import { mapReportPayload } from "./ownerPeriodicReport";
import { RAW_REPORT_PAYLOAD } from "./ownerPeriodicReport.fixture";

const payload = mapReportPayload(RAW_REPORT_PAYLOAD)!;

function rowsOf(ws: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, blankrows: false });
}

describe("buildReportWorkbook", () => {
  const wb = buildReportWorkbook(payload, "final");

  it("has the summary sheet and one sheet per detail table", () => {
    expect(wb.SheetNames).toEqual([...REPORT_SHEETS]);
  });

  it("writes one row per item under a header row", () => {
    expect(rowsOf(wb.Sheets["Kết quả phiên"])).toHaveLength(1 + payload.results.items.length);
    expect(rowsOf(wb.Sheets["Tiền thu"])).toHaveLength(1 + payload.money.items.length);
    expect(rowsOf(wb.Sheets["Tồn đọng"])).toHaveLength(1 + payload.stuck.items.length);
    expect(rowsOf(wb.Sheets["Kế hoạch kỳ tới"])).toHaveLength(1 + payload.plan.scheduled.length);
  });

  it("keeps money as numbers with thousands grouping and labels every row's source", () => {
    const ws = wb.Sheets["Kết quả phiên"];
    const price = ws["H2"] as XLSX.CellObject;
    expect(price.t).toBe("n");
    expect(price.v).toBe(3000000000);
    expect(price.z).toBe("#,##0");
    expect((ws["J2"] as XLSX.CellObject).v).toBe("Sàn xác nhận");
    expect((ws["A3"] as XLSX.CellObject).v).toBe("Ngoài sàn");
  });

  it("never exports internal identifiers", () => {
    for (const name of wb.SheetNames) {
      const header = rowsOf(wb.Sheets[name])[0].map(String).join(" | ").toLowerCase();
      expect(header).not.toMatch(/\bid\b|workspace|uuid/);
    }
  });

  it("marks drafts in the summary", () => {
    const draft = buildReportWorkbook(payload, "draft");
    const summary = rowsOf(draft.Sheets["Tổng quan"]).map((r) => r.join(" "));
    expect(summary.some((line) => line.includes("Bản nháp"))).toBe(true);
    const final = rowsOf(wb.Sheets["Tổng quan"]).map((r) => r.join(" "));
    expect(final.some((line) => line.includes("Đã chốt 01/10/2026"))).toBe(true);
  });
});
