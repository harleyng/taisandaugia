import { describe, it, expect } from "vitest";
import {
  assetScopeFilter,
  calendarDayLabel,
  cumulativeWinByWeek,
  daysSince,
  overviewKpis,
  overviewWindow,
  relativeChange,
  rowInScope,
  sameDayLastYear,
  sessionTimeOf,
  stuckAsOf,
  summarizeTodo,
  upcomingCalendar,
  weekLabel,
} from "./ownerOverview";
import { SCOPE_ALL } from "./ownerTargets";

const TODAY = "2026-09-27";

type Row = Parameters<typeof overviewKpis>[0][number];
const row = (over: Partial<Row> = {}): Row => ({
  outcome: "sold",
  price: 1_000,
  date: "2026-09-10",
  paymentStatus: null,
  hasConflict: false,
  ...over,
});

describe("sameDayLastYear", () => {
  it("lùi đúng một năm", () => {
    expect(sameDayLastYear("2026-09-27")).toBe("2025-09-27");
  });
  it("29/02 ⇒ 28/02 năm trước", () => {
    expect(sameDayLastYear("2028-02-29")).toBe("2027-02-28");
  });
});

describe("overviewWindow", () => {
  it("tháng: kỳ này + cùng kỳ năm trước tới cùng ngày", () => {
    const w = overviewWindow("month", TODAY);
    expect(w).toMatchObject({
      start: "2026-09-01",
      end: "2026-09-30",
      label: "tháng 9/2026",
      prevStart: "2025-09-01",
      prevEnd: "2025-09-30",
      prevToday: "2025-09-27",
    });
  });
  it("quý và năm", () => {
    expect(overviewWindow("quarter", TODAY)).toMatchObject({ start: "2026-07-01", end: "2026-09-30", label: "quý III/2026" });
    expect(overviewWindow("year", TODAY)).toMatchObject({ start: "2026-01-01", end: "2026-12-31", prevEnd: "2025-12-31" });
  });
});

describe("phạm vi đơn vị", () => {
  it("rowInScope: 'all' gồm cả dòng chưa gắn chi nhánh", () => {
    expect(rowInScope(null, SCOPE_ALL)).toBe(true);
    expect(rowInScope(null, "b1")).toBe(false);
    expect(rowInScope("b1", "b1")).toBe(true);
  });
  it("assetScopeFilter suy chi nhánh qua asset_owner_id", () => {
    const branches = [
      { id: "b1", assetOwnerId: "ao1" },
      { id: "b2", assetOwnerId: null },
    ];
    expect(assetScopeFilter(SCOPE_ALL, branches)(null)).toBe(true);
    expect(assetScopeFilter("b1", branches)("ao1")).toBe(true);
    expect(assetScopeFilter("b1", branches)("ao2")).toBe(false);
    // Chi nhánh chưa gắn chủ tài sản không nhận tin nào (kể cả tin không có chủ).
    expect(assetScopeFilter("b2", branches)(null)).toBe(false);
  });
});

describe("cumulativeWinByWeek", () => {
  const w = overviewWindow("month", TODAY);

  it("tháng 30 ngày có 5 tuần, ngày lẻ cuối kỳ dồn vào tuần cuối", () => {
    const points = cumulativeWinByWeek([], w);
    expect(points).toHaveLength(5);
    expect(points[4]).toMatchObject({ from: "2026-09-29", to: "2026-09-30" });
    expect(weekLabel(points[0])).toBe("Tuần 1 · 01/09 – 07/09");
  });

  it("lũy kế kỳ này dừng ở tuần hiện tại, năm trước chạy hết kỳ", () => {
    const points = cumulativeWinByWeek(
      [
        row({ date: "2026-09-02", price: 100 }),
        row({ date: "2026-09-16", price: 50 }),
        row({ date: "2025-09-05", price: 30 }),
        row({ date: "2025-09-30", price: 20 }),
        row({ outcome: "unsold", date: "2026-09-03", price: 999 }),
        row({ date: "2026-08-31", price: 999 }),
        row({ date: null, price: 999 }),
      ],
      w,
    );
    expect(points.map((p) => p.current)).toEqual([100, 100, 150, 150, null]);
    expect(points.map((p) => p.previous)).toEqual([30, 30, 30, 30, 50]);
  });
});

describe("overviewKpis", () => {
  const w = overviewWindow("month", TODAY);

  it("so kỳ này với cùng khoảng ngày năm trước", () => {
    const k = overviewKpis(
      [
        row({ date: "2026-09-05", price: 300 }),
        row({ date: "2026-09-06", outcome: "unsold", price: null }),
        row({ date: "2025-09-05", price: 200 }),
        // Sau mốc cùng ngày năm trước ⇒ không tính.
        row({ date: "2025-09-29", price: 999 }),
      ],
      w,
      { now: 3, lastYear: 4 },
    );
    expect(k.auctioned).toMatchObject({ current: 2, previous: 1, change: 100 });
    expect(k.successRate).toMatchObject({ current: 50, previous: 100, change: -50, kind: "points" });
    expect(k.winValue).toMatchObject({ current: 300, previous: 200, change: 50 });
    expect(k.stuck).toMatchObject({ current: 3, previous: 4, change: -25, higherIsBetter: false });
  });

  it("năm trước không có số ⇒ không so", () => {
    const k = overviewKpis([row({ date: "2026-09-05" })], w, { now: 0, lastYear: 0 });
    expect(k.auctioned.change).toBeNull();
    expect(k.successRate.change).toBeNull();
    expect(k.stuck.change).toBeNull();
  });

  it("relativeChange làm tròn", () => {
    expect(relativeChange(2, 3)).toBe(-33);
    expect(relativeChange(5, 0)).toBeNull();
  });
});

describe("stuckAsOf", () => {
  it("≥ 2 phiên tới ngày đó và chưa bán", () => {
    const assets = [
      { sessionDays: ["2025-05-01", "2025-06-01"], soldOn: null },
      { sessionDays: ["2025-05-01", "2025-06-01"], soldOn: "2025-07-01" },
      { sessionDays: ["2025-05-01", "2025-06-01"], soldOn: "2025-10-01" },
      { sessionDays: ["2025-05-01", "2025-12-01"], soldOn: null },
    ];
    expect(stuckAsOf(assets, "2025-09-27")).toBe(2);
  });
});

describe("summarizeTodo", () => {
  it("cộng tiền, lấy tên việc chờ lâu nhất", () => {
    const s = summarizeTodo("outcome_due", [
      { title: "A", days: 3, amount: 100 },
      { title: "B", days: 12, amount: null },
      { title: "C", days: null, amount: 50 },
    ]);
    expect(s).toMatchObject({ count: 3, amount: 150, oldestTitle: "B" });
  });
  it("không việc nào có mốc ⇒ lấy tên việc đầu", () => {
    const s = summarizeTodo("stuck", [{ title: "X", days: null, amount: 10 }]);
    expect(s).toMatchObject({ oldestTitle: "X" });
  });
  it("daysSince", () => {
    expect(daysSince("2026-09-20", TODAY)).toBe(7);
    expect(daysSince("2026-10-01", TODAY)).toBe(0);
    expect(daysSince(null, TODAY)).toBeNull();
  });
});

describe("upcomingCalendar", () => {
  it("gom theo ngày trong 7 ngày, hôm nay luôn có mặt", () => {
    const days = upcomingCalendar(
      [
        { id: "a", auctionTime: "2026-09-29T09:00:00" },
        { id: "b", auctionTime: "2026-09-29T08:00:00" },
        { id: "c", auctionTime: "2026-10-03" },
        { id: "d", auctionTime: "2026-10-04" },
        { id: "e", auctionTime: "2026-09-26" },
        { id: "f", auctionTime: null },
      ],
      TODAY,
    );
    expect(days.map((d) => [d.day, d.isToday, d.items.map((i) => i.id)])).toEqual([
      ["2026-09-27", true, []],
      ["2026-09-29", false, ["b", "a"]],
      ["2026-10-03", false, ["c"]],
    ]);
  });
  it("không phiên nào ⇒ rỗng", () => {
    expect(upcomingCalendar([{ id: "x", auctionTime: "2026-12-01" }], TODAY)).toEqual([]);
  });
  it("giờ phiên và nhãn ngày", () => {
    expect(sessionTimeOf("2026-09-29T09:05:00")).toBe("09:05");
    expect(sessionTimeOf("2026-09-29")).toBeNull();
    expect(calendarDayLabel(TODAY, TODAY)).toEqual({ title: "Hôm nay", date: "27/09" });
    expect(calendarDayLabel("2026-09-28", TODAY).title).toBe("Ngày mai");
    expect(calendarDayLabel("2026-10-01", TODAY).title).toBe("Thứ Năm");
  });
});
