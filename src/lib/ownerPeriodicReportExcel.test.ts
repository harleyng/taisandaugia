import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx-js-style";
import { REPORT_PLAN_SHEET, REPORT_SHEETS, buildReportWorkbook } from "./ownerPeriodicReportExcel";
import { mapReportPayload } from "./ownerPeriodicReport";
import { mapReportPlanExecution } from "./ownerReportPlanExecution";
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

  // Phase 8: payload v1 xuất ra ĐÚNG 6 sheet như trước; sheet kế hoạch chỉ có ở v2.
  it("adds the plan sheet only for a v2 payload", () => {
    expect(payload.planExecution).toBeNull();
    expect(wb.SheetNames).not.toContain(REPORT_PLAN_SHEET);
    expect(rowsOf(wb.Sheets["Tổng quan"]).map((r) => r.join(" "))).not.toContain("Thực hiện kế hoạch đấu giá");

    const v2 = buildReportWorkbook({ ...payload, planExecution: PLAN_EXECUTION }, "final");
    expect(v2.SheetNames).toEqual([...REPORT_SHEETS, REPORT_PLAN_SHEET]);
    const summary = rowsOf(v2.Sheets["Tổng quan"]).map((r) => r.join(" "));
    expect(summary).toContain("Thực hiện kế hoạch đấu giá");
    expect(summary).toContain("Tài sản theo kế hoạch trong kỳ 4");
    expect(summary).toContain("Tài sản trễ kế hoạch 1");
    // Một dòng cho mỗi tài sản trễ / nguy cơ trễ + tài sản dời tháng chưa có ở trên.
    const rows = rowsOf(v2.Sheets[REPORT_PLAN_SHEET]);
    expect(rows).toHaveLength(1 + 3);
    expect(rows[1]).toContain('Quá hạn mốc "Phê duyệt phương án đấu giá" (hạn 09/05/2026)');
    expect(rows[3]).toContain("Chờ mặt bằng sạch");
  });

  it("the plan sheet is empty-but-present when the scope has no approved plan", () => {
    const none = buildReportWorkbook(
      { ...payload, planExecution: { ...PLAN_EXECUTION, plans: [] } },
      "final",
    );
    expect(rowsOf(none.Sheets[REPORT_PLAN_SHEET])).toHaveLength(1);
    expect(rowsOf(none.Sheets["Tổng quan"]).map((r) => r.join(" "))).toContain(
      "Ghi chú Phạm vi này chưa có kế hoạch đấu giá nào được duyệt cho năm của kỳ báo cáo",
    );
  });

  it("writes one row per item under a header row", () => {
    expect(rowsOf(wb.Sheets["Kết quả phiên"])).toHaveLength(1 + payload.results.items.length);
    expect(rowsOf(wb.Sheets["Tiền thu"])).toHaveLength(1 + payload.money.items.length);
    expect(rowsOf(wb.Sheets["Tồn đọng"])).toHaveLength(1 + payload.stuck.items.length);
    expect(rowsOf(wb.Sheets["Kế hoạch kỳ tới"])).toHaveLength(1 + payload.plan.scheduled.length);
    expect(rowsOf(wb.Sheets["Truyền thông"])).toHaveLength(1 + payload.marketing!.byAsset.length);
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

  it("summarises the marketing funnel, and says so when a report predates it", () => {
    const summary = rowsOf(wb.Sheets["Tổng quan"]).map((r) => r.join(" "));
    expect(summary).toContain("6. Hiệu quả truyền thông");
    expect(summary).toContain("Đăng ký tham gia 2");
    expect(summary).toContain("Giá trúng / giá khởi điểm (%) 120");
    const old = buildReportWorkbook({ ...payload, marketing: null }, "final");
    expect(rowsOf(old.Sheets["Tổng quan"]).map((r) => r.join(" "))).toContain("Ghi chú Báo cáo chốt trước khi có phần này");
    expect(rowsOf(old.Sheets["Truyền thông"])).toHaveLength(1);
  });

  it("marks drafts in the summary", () => {
    const draft = buildReportWorkbook(payload, "draft");
    const summary = rowsOf(draft.Sheets["Tổng quan"]).map((r) => r.join(" "));
    expect(summary.some((line) => line.includes("Bản nháp"))).toBe(true);
    const final = rowsOf(wb.Sheets["Tổng quan"]).map((r) => r.join(" "));
    expect(final.some((line) => line.includes("Đã chốt 01/10/2026"))).toBe(true);
  });
});

/** Rút gọn từ plan_execution THẬT của Trạm demo tỉnh Bắc Ninh (một kế hoạch, đủ 3 loại dòng). */
const PLAN_EXECUTION = mapReportPlanExecution({
  as_of: "2026-10-26",
  period: { type: "year", start: "2026-01-01", end: "2026-12-31" },
  totals: {
    plans: 1,
    planned_count: 4,
    planned_start_value: 86660000000,
    offered_count: 1,
    sold_count: 1,
    actual_start_value: 46080000000,
    winning_total: 54374400000,
    collected: 54374400000,
    recorded: 54374400000,
    estimated: 0,
    awaiting: 0,
    done_pct: 25,
    item_count: 5,
    late_count: 1,
    at_risk_count: 1,
    failed_retry_count: 0,
    moved_count: 2,
  },
  plans: [
    {
      title: "Kế hoạch đấu giá QSDĐ năm 2026 · Phường Bắc Giang",
      unit_name: "Phường Bắc Giang",
      branch_name: "Phường Bắc Giang",
      admin_unit_code: "07210",
      kind: "annual",
      status: "approved",
      plan_year: 2026,
      baseline_version: 1,
      approval_doc_no: "QĐ-1202/QĐ-UBND",
      approval_doc_date: "2025-12-28",
      item_count: 5,
      late_count: 1,
      at_risk_count: 1,
      failed_retry_count: 0,
      moved_count: 2,
      metrics: {
        planned_count: 4,
        planned_start_value: 86660000000,
        offered_count: 1,
        sold_count: 1,
        actual_start_value: 46080000000,
        winning_total: 54374400000,
        collected: 54374400000,
        recorded: 54374400000,
        estimated: 0,
        awaiting: 0,
        done_pct: 25,
      },
      attention: [
        {
          item_code: "KH26-002",
          title: "Khu dân cư Bắc Giang — lô B",
          health: "late",
          baseline_month: "2026-08-01",
          forecast_month: null,
          steps_done: 2,
          steps_total: 10,
          forecast_reason: null,
          exec_note: null,
          overdue_step: "plan_approved",
          overdue_step_date: "2026-05-09",
          overdue_step_note: null,
        },
        {
          item_code: "KH26-003",
          title: "Khu dân cư Bắc Giang — lô C",
          health: "at_risk",
          baseline_month: "2026-11-01",
          forecast_month: "2026-12-01",
          steps_done: 4,
          steps_total: 10,
          forecast_reason: "Chờ phê duyệt giá khởi điểm",
          exec_note: null,
          overdue_step: null,
          overdue_step_date: null,
          overdue_step_note: null,
        },
      ],
      forecast_moves: [
        {
          item_code: "KH26-003",
          title: "Khu dân cư Bắc Giang — lô C",
          health: "at_risk",
          baseline_month: "2026-11-01",
          forecast_month: "2026-12-01",
          reason: "Chờ phê duyệt giá khởi điểm",
        },
        {
          item_code: "KH26-005",
          title: "Khu dân cư Bắc Giang — lô E",
          health: "on_track",
          baseline_month: "2026-10-01",
          forecast_month: "2026-11-01",
          reason: "Chờ mặt bằng sạch",
        },
      ],
    },
  ],
})!;
