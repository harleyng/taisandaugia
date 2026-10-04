import { describe, expect, it } from "vitest";
import {
  OwnerReportRpcError,
  assertOwnerReportRpcOk,
  createReportSchema,
  mapReportListRow,
  mapReportPayload,
  mapReportRow,
  previousPeriodStart,
  reportErrorMessage,
  reportFileName,
  reportNotesSchema,
  reportPeriodOptions,
  reportScopeLabel,
  reportTitle,
  toReportInsert,
  withDraftNotes,
  type OwnerReportRow,
} from "./ownerPeriodicReport";
import { RAW_REPORT_PAYLOAD } from "./ownerPeriodicReport.fixture";

const ROW: OwnerReportRow = {
  id: "r1",
  workspace_id: "ws1",
  branch_id: null,
  period_type: "month",
  period_start: "2026-09-01",
  status: "final",
  notes: null,
  plan_note: null,
  finalized_at: "2026-10-01T02:00:00+00:00",
  finalized_by: "u2",
  created_by: "u1",
  created_at: "2026-09-30T02:00:00+00:00",
  updated_at: "2026-10-01T02:00:00+00:00",
  payload: null,
  share_token: null,
  token_expires_at: "2026-10-31T02:00:00+00:00",
  view_count: 4,
  last_viewed_at: "2026-10-02T03:00:00+00:00",
  shared_at: "2026-10-01T03:00:00+00:00",
  shared_by: "u2",
};

describe("mapReportPayload", () => {
  it("returns null for anything without a readable period", () => {
    expect(mapReportPayload(null)).toBeNull();
    expect(mapReportPayload("x")).toBeNull();
    expect(mapReportPayload([])).toBeNull();
    expect(mapReportPayload({ meta: { period: { type: "week", start: "2026-09-01", end: "2026-09-07" } } })).toBeNull();
  });

  it("maps a full payload", () => {
    const p = mapReportPayload(RAW_REPORT_PAYLOAD)!;
    expect(p.meta.period).toEqual({ type: "month", start: "2026-09-01", end: "2026-09-30" });
    expect(p.meta.scope).toEqual({ kind: "branch", branchName: "Chi nhánh Hà Nội" });
    expect(p.targets[0]).toMatchObject({ collected: 12400000000, amountPct: 62, countRemaining: 1 });
    expect(p.results.totals.successRate).toBe(60);
    expect(p.money.carryOver).toEqual({ count: 2, awaiting: 5000000000 });
    expect(p.stuck.rule).toEqual({ minRounds: 3, maxDays: 90 });
    expect(p.plan.nextPeriod?.start).toBe("2026-10-01");
    expect(p.plan.scheduled[0].source).toBe("platform");
    expect(p.people).toEqual({ preparedBy: "Nguyễn Văn A", finalizedBy: "Trần Thị B" });
    expect(p.marketing?.totals.registrations).toBe(2);
    expect(p.marketing?.byAsset[0]).toMatchObject({ assetCode: "3F9A12BC", assetId: null, registrationsUnattributed: 3 });
  });

  it("drops unknown source labels and narrows unknown values instead of trusting them", () => {
    const p = mapReportPayload(RAW_REPORT_PAYLOAD)!;
    expect(p.results.byLabel.map((g) => g.label)).toEqual(["platform", "self_reported"]);
    const odd = p.results.items[1];
    expect(odd.outcome).toBeNull();
    expect(odd.title).toBe("Tài sản chưa đặt tên");
    expect(odd.assetCode).toBeNull();
    expect(odd.hasConflict).toBe(true);
  });

  it("tolerates missing sections", () => {
    const p = mapReportPayload({ meta: RAW_REPORT_PAYLOAD.meta })!;
    expect(p.targets).toEqual([]);
    expect(p.results.totals.total).toBe(0);
    expect(p.results.totals.successRate).toBeNull();
    expect(p.money.items).toEqual([]);
    expect(p.stuck.rule).toEqual({ minRounds: 3, maxDays: 90 });
    expect(p.plan.nextPeriod).toBeNull();
    expect(p.notes).toEqual({ officer: null, plan: null });
    // Báo cáo chốt trước Phase M5 không có phần truyền thông.
    expect(p.marketing).toBeNull();
  });

  it("uses the draft's own notes on top of live numbers", () => {
    const p = mapReportPayload(RAW_REPORT_PAYLOAD)!;
    const draft = withDraftNotes(p, { notes: "  ", planNote: "Đấu lại 3 tài sản" });
    expect(draft.notes).toEqual({ officer: null, plan: "Đấu lại 3 tài sản" });
    expect(draft.money).toBe(p.money);
  });
});

describe("report rows", () => {
  it("maps the share status without ever carrying the token", () => {
    const r = mapReportRow(ROW)!;
    expect(r.share).toEqual({
      expiresAt: "2026-10-31T02:00:00+00:00",
      viewCount: 4,
      lastViewedAt: "2026-10-02T03:00:00+00:00",
      sharedAt: "2026-10-01T03:00:00+00:00",
      sharedBy: "u2",
    });
    expect(JSON.stringify(r)).not.toContain("share_token");
  });

  it("rejects rows with unknown period type or status", () => {
    expect(mapReportRow({ ...ROW, period_type: "week" })).toBeNull();
    expect(mapReportRow({ ...ROW, status: "sent" })).toBeNull();
  });

  it("keeps frozen summary fields only for finalised reports", () => {
    const extra = {
      scope: { kind: "branch", branch_name: "CN Hà Nội" },
      people: { prepared_by: "Nguyễn Văn A" },
      collected: 12400000000,
      sold_count: 3,
      sold_value: 15400000000,
      targets: [
        { scope: "unit", target_amount: 90000000000, amount_pct: 20 },
        { scope: "branch", branch_name: "CN Hà Nội", target_amount: 20000000000, amount_pct: 62 },
      ],
    };
    const final = mapReportListRow({ ...ROW, ...extra })!;
    expect(final.frozenScope).toEqual({ kind: "branch", branchName: "CN Hà Nội" });
    expect(final.frozenPreparedBy).toBe("Nguyễn Văn A");
    expect(final.collected).toBe(12400000000);
    expect(final.soldValue).toBe(15400000000);
    // Báo cáo chi nhánh ⇒ % của dòng chỉ tiêu chi nhánh, không phải cả đơn vị.
    expect(final.targetPct).toBe(62);

    const draft = mapReportListRow({ ...ROW, ...extra, status: "draft" })!;
    expect(draft.frozenScope).toBeNull();
    expect(draft.collected).toBeNull();
    expect(draft.targetPct).toBeNull();
  });
});

describe("periods & labels", () => {
  it("offers the current period and earlier ones", () => {
    const months = reportPeriodOptions("month", "2026-09-26");
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ start: "2026-09-01", label: "Tháng 9/2026" });
    expect(months[11].start).toBe("2025-10-01");

    const quarters = reportPeriodOptions("quarter", "2026-09-26");
    expect(quarters.map((q) => q.start)).toEqual([
      "2026-07-01",
      "2026-04-01",
      "2026-01-01",
      "2025-10-01",
      "2025-07-01",
      "2025-04-01",
    ]);
    expect(reportPeriodOptions("year", "2026-09-26").map((y) => y.start)).toEqual([
      "2026-01-01",
      "2025-01-01",
      "2024-01-01",
    ]);
  });

  it("defaults to the period that just ended", () => {
    expect(previousPeriodStart("month", "2026-01-15")).toBe("2025-12-01");
    expect(previousPeriodStart("quarter", "2026-09-26")).toBe("2026-04-01");
    expect(previousPeriodStart("year", "2026-09-26")).toBe("2025-01-01");
  });

  it("builds titles, scope labels and file names", () => {
    expect(reportTitle("quarter", "2026-07-01")).toBe("Báo cáo quý III/2026");
    expect(reportScopeLabel({ kind: "unit", branchName: null })).toBe("Toàn đơn vị");
    const p = mapReportPayload(RAW_REPORT_PAYLOAD)!;
    expect(reportFileName(p, "xlsx")).toBe("bao-cao-thang-9-2026-chi-nhanh-ha-noi.xlsx");
  });
});

describe("forms", () => {
  it("maps the whole-unit scope to a NULL branch", () => {
    const form = createReportSchema.parse({ periodType: "month", periodStart: "2026-09-01", scope: "all" });
    expect(toReportInsert(form, "ws1")).toEqual({
      workspace_id: "ws1",
      branch_id: null,
      period_type: "month",
      period_start: "2026-09-01",
    });
    expect(toReportInsert({ ...form, scope: "b1" }, "ws1").branch_id).toBe("b1");
  });

  it("rejects periods that do not start on the 1st and overly long notes", () => {
    expect(createReportSchema.safeParse({ periodType: "month", periodStart: "2026-09-15", scope: "all" }).success).toBe(
      false,
    );
    expect(reportNotesSchema.safeParse({ planNote: "x".repeat(4001), notes: "" }).success).toBe(false);
    expect(reportNotesSchema.safeParse({ planNote: "x".repeat(4000), notes: "" }).success).toBe(true);
  });
});

describe("errors", () => {
  it("throws a Vietnamese error for {ok:false}", () => {
    expect(() => assertOwnerReportRpcOk({ ok: true })).not.toThrow();
    expect(() => assertOwnerReportRpcOk({ ok: false, reason: "forbidden" })).toThrow(OwnerReportRpcError);
    try {
      assertOwnerReportRpcOk({ ok: false, reason: "already_final" });
    } catch (e) {
      expect(reportErrorMessage(e)).toBe("Báo cáo này đã được chốt trước đó.");
    }
  });

  it("maps database error codes", () => {
    expect(reportErrorMessage({ code: "42501" })).toContain("không có quyền");
    expect(reportErrorMessage({ code: "P0001", message: "Báo cáo đã chốt không thể sửa" })).toBe(
      "Báo cáo đã chốt không thể sửa",
    );
    expect(reportErrorMessage(new Error("boom"), "fallback")).toBe("fallback");
  });
});
