import { describe, expect, it } from "vitest";
import { filterOwnerReports, ownerReportTabCounts } from "./ownerReportTabs";

const rows = [
  { id: "a", status: "draft" as const, periodType: "month" as const, periodStart: "2026-08-01" },
  { id: "b", status: "final" as const, periodType: "quarter" as const, periodStart: "2026-04-01" },
  { id: "c", status: "final" as const, periodType: "month" as const, periodStart: "2026-07-01" },
];

describe("ownerReportTabs", () => {
  it("đếm theo tab — 'Tất cả' gồm mọi báo cáo", () => {
    expect(ownerReportTabCounts(rows)).toEqual({ draft: 1, final: 2, all: 3 });
  });

  it("lọc theo tab và từ khoá không dấu", () => {
    expect(filterOwnerReports(rows, "final", "").map((r) => r.id)).toEqual(["b", "c"]);
    expect(filterOwnerReports(rows, "all", "quy II").map((r) => r.id)).toEqual(["b"]);
    expect(filterOwnerReports(rows, "all", "thang 7").map((r) => r.id)).toEqual(["c"]);
  });

  it("tìm cả trong phạm vi / người lập do trang truyền vào", () => {
    const extra = (r: (typeof rows)[number]) => (r.id === "a" ? "Chi nhánh Hà Nội" : "Toàn đơn vị");
    expect(filterOwnerReports(rows, "all", "ha noi", extra).map((r) => r.id)).toEqual(["a"]);
  });
});
