import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx-js-style";
import { buildCashReportView, type CashFlowData, type CashRow } from "./ownerCashFlow";
import { CASH_FLOW_SHEETS, buildCashFlowWorkbook } from "./ownerCashFlowExcel";

const row = (over: Partial<CashRow>): CashRow => ({
  unitId: "u1",
  rowKey: "l:1",
  listingId: "1",
  ownOutcomeId: "o1",
  bestKind: "owner_report",
  title: "Nhà đất 45 Lê Văn Lương",
  assetCode: "3F9A12BC",
  branchId: null,
  branchName: null,
  outcome: "sold",
  date: "2026-09-10",
  startingPrice: 800,
  price: 1_000_000_000,
  paymentStatus: "partial",
  paidAmount: 400_000_000,
  paymentDueOn: null,
  confidence: "self_reported",
  ...over,
});

const data = (units: CashFlowData["units"]): CashFlowData => ({
  asOf: "2026-09-26",
  units,
  rows: [row({}), row({ rowKey: "l:2", date: "2026-08-01", title: "Ngoài kỳ" })],
  events: [
    {
      id: "e1",
      unitId: "u1",
      outcomeId: "o1",
      rowKey: "l:1",
      title: "Nhà đất 45 Lê Văn Lương",
      assetCode: "3F9A12BC",
      branchId: null,
      branchName: null,
      roundNo: 1,
      outcome: "sold",
      kind: "fee",
      amount: 20_000_000,
      occurredOn: "2026-09-15",
      note: null,
      updatedAt: null,
      createdByName: "Cán bộ A",
      updatedByName: null,
    },
  ],
  upcoming: [],
});

const self = { id: "u1", name: "Trụ sở", isSelf: true, canSeePeople: true };

describe("buildCashFlowWorkbook", () => {
  it("writes the period's cohort as numbers and skips the unit sheet for a single unit", () => {
    const d = data([self]);
    const wb = buildCashFlowWorkbook(d, buildCashReportView(d, "m-2026-09"), { periodId: "m-2026-09", scopeName: "Trụ sở" });
    expect(wb.SheetNames).toEqual([CASH_FLOW_SHEETS[0], CASH_FLOW_SHEETS[2], CASH_FLOW_SHEETS[3]]);

    const summary = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[CASH_FLOW_SHEETS[0]], { header: 1 });
    const value = (label: string) => summary.find((r) => r[0] === label)?.[1];
    expect(value("Giá trúng (₫)")).toBe(1_000_000_000);
    expect(value("Đã thu (₫)")).toBe(400_000_000);
    expect(value("Còn phải thu (₫)")).toBe(600_000_000);
    expect(value("Thực nhận (₫)")).toBe(380_000_000);

    const assets = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[CASH_FLOW_SHEETS[2]]);
    expect(assets.map((a) => a["Tài sản"])).toEqual(["Nhà đất 45 Lê Văn Lương"]);
    const ledger = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[CASH_FLOW_SHEETS[3]]);
    expect(ledger[0]).toMatchObject({ Loại: "Phí & chi phí", "Số tiền (₫)": -20_000_000, "Người ghi": "Cán bộ A" });
  });

  it("adds the unit sheet and a unit column when the head office sees several units", () => {
    const d = data([self, { id: "u2", name: "Chi nhánh B", isSelf: false, canSeePeople: false }]);
    const wb = buildCashFlowWorkbook(d, buildCashReportView(d, "m-2026-09"), { periodId: "m-2026-09", scopeName: "Toàn hệ thống" });
    expect(wb.SheetNames).toEqual([...CASH_FLOW_SHEETS]);
    const units = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[CASH_FLOW_SHEETS[1]]);
    expect(units.map((u) => u["Đơn vị"])).toEqual(["Trụ sở (trụ sở)", "Chi nhánh B"]);
    const assets = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[CASH_FLOW_SHEETS[2]]);
    expect(assets[0]["Đơn vị"]).toBe("Trụ sở");
  });
});
