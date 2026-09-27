import { describe, expect, it } from "vitest";
import { mapReportPayload, type ReportPayload } from "./ownerPeriodicReport";
import { RAW_REPORT_PAYLOAD } from "./ownerPeriodicReport.fixture";
import {
  NO_BRANCH_LABEL,
  deltaLabel,
  reportAttentionItems,
  reportBranchRows,
  reportConclusion,
  reportDelta,
  reportDueDate,
  reportFigures,
  reportRangeLabel,
  reportSummary,
} from "./ownerReportDigest";

const BRANCH = mapReportPayload(RAW_REPORT_PAYLOAD)!;

/** Cùng số liệu nhưng báo cáo cả đơn vị, 2 chi nhánh + 1 tài sản chưa gán chi nhánh. */
function unitPayload(): ReportPayload {
  const base = mapReportPayload(RAW_REPORT_PAYLOAD)!;
  const sold = base.results.items[0];
  return {
    ...base,
    meta: { ...base.meta, scope: { kind: "unit", branchName: null } },
    targets: base.targets.map((t) => ({ ...t, scope: "unit" as const, branchName: null as string | null })),
    results: {
      ...base.results,
      items: [
        sold, // HN, 3 tỷ, chờ thu cả 3 tỷ
        { ...sold, branchName: "Chi nhánh Đà Nẵng", price: 10_000_000_000, paymentStatus: "paid" },
        { ...sold, branchName: "Chi nhánh Đà Nẵng", price: 2_000_000_000, paymentStatus: "defaulted" },
        { ...sold, branchName: "Chi nhánh Đà Nẵng", outcome: "unsold", price: null },
        { ...sold, branchName: null, price: 1_000_000_000, paymentStatus: "paid" },
      ],
    },
  };
}

describe("due date & range", () => {
  it("is the 5th of the month after the period", () => {
    expect(reportDueDate("quarter", "2026-07-01")).toBe("2026-10-05");
    expect(reportDueDate("month", "2026-12-01")).toBe("2027-01-05");
    expect(reportDueDate("year", "2026-01-01")).toBe("2027-01-05");
  });

  it("drops the year of the first day when both ends share it", () => {
    expect(reportRangeLabel("quarter", "2026-07-01")).toBe("01/07 – 30/09/2026");
    expect(reportRangeLabel("month", "2026-02-01")).toBe("01/02 – 28/02/2026");
  });
});

describe("figures & deltas", () => {
  it("takes the target of the report's own scope", () => {
    expect(reportFigures(BRANCH)).toEqual({ soldValue: 15_400_000_000, collected: 12_400_000_000, targetPct: 62 });
  });

  it("compares with the previous period", () => {
    expect(reportDelta(118, 100)).toEqual({ pct: 18, dir: "up" });
    expect(reportDelta(90, 100)).toEqual({ pct: -10, dir: "down" });
    expect(reportDelta(5, 0)).toEqual({ pct: null, dir: "up" });
    expect(reportDelta(5, null)).toBeNull();
    expect(deltaLabel({ pct: 18, dir: "up" }, "quý II/2026")).toBe("+18% so quý II/2026");
    expect(deltaLabel({ pct: -10, dir: "down" }, "quý II/2026")).toBe("-10% so quý II/2026");
  });
});

describe("conclusion", () => {
  it("states progress against the period target, awaiting money not counted", () => {
    const { headline, bar } = reportConclusion(BRANCH);
    expect(headline).toBe("Đạt 62% chỉ tiêu tháng — còn thiếu 7.6 tỷ để đạt mục tiêu 20 tỷ");
    expect(bar).toMatchObject({ collected: 12_400_000_000, awaiting: 3_000_000_000, uncovered: 4_600_000_000 });
    expect(bar!.widths[0] + bar!.widths[1] + bar!.widths[2]).toBeCloseTo(100);
  });

  it("falls back to the amount collected when no target is set", () => {
    const { headline, bar } = reportConclusion({ ...BRANCH, targets: [] });
    expect(headline).toBe("Đã thu 12.4 tỷ trong tháng 9/2026 — kỳ này chưa đặt chỉ tiêu thu hồi");
    expect(bar).toBeNull();
  });

  it("summarises results, target gap and risks", () => {
    const text = reportSummary(BRANCH).map((p) => p.text).join("");
    expect(text).toBe(
      "Tháng 9/2026 ghi nhận 3 tài sản đấu thành / 5 tài sản, giá trúng bình quân vượt 7% giá khởi điểm." +
        " Tiến độ chỉ tiêu đạt 62%, cần thêm 7.6 tỷ trong tháng 10/2026." +
        " Cần theo dõi: 1 khoản chờ thu 3 tỷ, 1 tài sản tồn đọng.",
    );
  });
});

describe("attention items", () => {
  it("lists defaulted, awaiting, then stuck", () => {
    const p = { ...BRANCH, money: { ...BRANCH.money, items: [...BRANCH.money.items] } };
    p.money.items.push({ ...p.money.items[0], title: "Xe tải", paymentStatus: "defaulted", awaiting: 0 });
    const items = reportAttentionItems(p);
    expect(items.map((i) => [i.title, i.issue])).toEqual([
      ["Xe tải", "Người trúng bỏ cọc"],
      ["Nhà phố Đống Đa", "Chờ thu tiền"],
      ["Kho xưởng Cần Thơ", "Tồn đọng — 3 lượt · 261 ngày, chưa có lịch phiên"],
    ]);
    expect(items[1].amount).toBe(3_000_000_000);
  });
});

describe("branch rows", () => {
  it("is empty for a branch report", () => {
    expect(reportBranchRows(BRANCH)).toEqual([]);
  });

  it("sums per branch, collection rate excludes defaulted, unassigned last", () => {
    const rows = reportBranchRows(unitPayload());
    expect(rows).toEqual([
      { branchName: "Chi nhánh Đà Nẵng", soldValue: 12_000_000_000, sold: 2, total: 3, collectRate: 100 },
      { branchName: "Chi nhánh Hà Nội", soldValue: 3_000_000_000, sold: 1, total: 1, collectRate: 0 },
      { branchName: NO_BRANCH_LABEL, soldValue: 1_000_000_000, sold: 1, total: 1, collectRate: 100 },
    ]);
  });
});
