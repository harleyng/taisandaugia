// Luật "kế hoạch so thực tế" theo kỳ (A5) — tháng / quý / năm, bỏ cọc, thu một
// phần, tài sản chưa liên kết, dời dự kiến sang quý sau.
//
// Bản đối chiếu với SQL (`auction_plan_period_metrics`) nằm ở
// `period.parity.test.ts`.

import { describe, expect, it } from "vitest";
import {
  baselineItemMap,
  defaultPlanPeriod,
  parsePlanPeriodKey,
  planPeriodItems,
  planPeriodKey,
  planPeriodLabel,
  planPeriodOptions,
  planPeriodRows,
  planQuarterGoals,
  planVsActual,
  planVsActualByMonth,
  type PlanPeriod,
  type PlanPeriodOutcome,
  type PlanPeriodRow,
} from "./period";
import type { AuctionPlanBaseline, AuctionPlanItem } from "./types";

const MONTH = (start: string): PlanPeriod => ({ type: "month", start });
const QUARTER = (start: string): PlanPeriod => ({ type: "quarter", start });
const YEAR = (y: number): PlanPeriod => ({ type: "year", start: `${y}-01-01` });

const row = (over: Partial<PlanPeriodRow> & Pick<PlanPeriodRow, "itemId">): PlanPeriodRow => ({
  itemCode: over.itemId,
  title: over.itemId,
  planned: true,
  baselineMonth: null,
  baselineExpected: 0,
  outcome: null,
  ...over,
});

const outcome = (over: Partial<PlanPeriodOutcome>): PlanPeriodOutcome => ({
  outcome: "sold",
  payment_status: "paid",
  auction_date: "2026-06-15",
  starting_price: 0,
  winning_price: 0,
  paid_amount: null,
  ...over,
});

/* ─── Mã kỳ trên URL ──────────────────────────────────────────────────────── */

describe("mã kỳ (?ky=)", () => {
  it("viết và đọc lại ba loại kỳ", () => {
    for (const p of [MONTH("2026-11-01"), QUARTER("2026-10-01"), YEAR(2026)]) {
      expect(parsePlanPeriodKey(planPeriodKey(p))).toEqual(p);
    }
  });

  it("dùng đúng bộ chữ 2026-11 / 2026-Q4 / 2026", () => {
    expect(planPeriodKey(MONTH("2026-11-01"))).toBe("2026-11");
    expect(planPeriodKey(QUARTER("2026-10-01"))).toBe("2026-Q4");
    expect(planPeriodKey(YEAR(2026))).toBe("2026");
  });

  it("mã sai trả null thay vì đoán", () => {
    for (const bad of ["", "2026-13", "2026-Q5", "26-01", "2026-1", "tháng 11", null, undefined]) {
      expect(parsePlanPeriodKey(bad)).toBeNull();
    }
  });

  it("nhãn tiếng Việt giống Chỉ tiêu", () => {
    expect(planPeriodLabel(MONTH("2026-11-01"))).toBe("tháng 11/2026");
    expect(planPeriodLabel(QUARTER("2026-10-01"))).toBe("quý IV/2026");
    expect(planPeriodLabel(YEAR(2026))).toBe("năm 2026");
  });

  it("danh sách kỳ của một năm = 1 năm + 4 quý + 12 tháng", () => {
    const opts = planPeriodOptions(2026);
    expect(opts).toHaveLength(17);
    expect(opts[0].key).toBe("2026");
    expect(opts.map((o) => o.key)).toContain("2026-Q3");
    expect(opts.map((o) => o.key)).toContain("2026-12");
  });

  it("kỳ mặc định: tháng này trong năm kế hoạch, cả năm nếu khác năm", () => {
    expect(defaultPlanPeriod(2026, "2026-10-26")).toEqual(MONTH("2026-10-01"));
    expect(defaultPlanPeriod(2027, "2026-10-26")).toEqual(YEAR(2027));
  });
});

/* ─── Cột KẾ HOẠCH lấy từ BẢN MỐC ─────────────────────────────────────────── */

describe("cột kế hoạch = bản mốc, không phải danh mục hiện tại", () => {
  const baseline = {
    payload: {
      items: [
        { id: "a", planned_month: "2026-06-01", expected_start_value: 1_000 },
        { id: "b", planned_month: "2026-09-01", expected_start_value: 2_000 },
      ],
    },
  } as unknown as AuctionPlanBaseline;

  const items = [
    // Đã dời sang tháng 12 trong bản điều chỉnh CHƯA được duyệt.
    { id: "a", item_code: "KH26-001", title: "A", planned_month: "2026-12-01", expected_start_value: 9_999, exec_status: "active" },
    // Bị bỏ khỏi kế hoạch SAU khi duyệt ⇒ vẫn là cam kết của bản mốc.
    { id: "b", item_code: "KH26-002", title: "B", planned_month: "2026-09-01", expected_start_value: 2_000, exec_status: "dropped" },
    // Thêm SAU bản mốc ⇒ dùng giá trị hiện tại.
    { id: "c", item_code: "KH26-003", title: "C", planned_month: "2026-06-01", expected_start_value: 500, exec_status: "active" },
    // Bỏ khỏi kế hoạch và KHÔNG có trong bản mốc ⇒ không là cam kết của kỳ nào.
    { id: "d", item_code: "KH26-004", title: "D", planned_month: "2026-06-01", expected_start_value: 700, exec_status: "dropped" },
  ] as unknown as AuctionPlanItem[];

  it("bản mốc thắng tháng và giá trị hiện tại", () => {
    const rows = planPeriodRows(items, new Map(), baseline);
    const a = rows.find((r) => r.itemId === "a")!;
    expect(a.baselineMonth).toBe("2026-06-01");
    expect(a.baselineExpected).toBe(1_000);
  });

  it("tài sản bỏ khỏi kế hoạch: còn trong bản mốc ⇒ vẫn đếm; không có ⇒ không đếm", () => {
    const rows = planPeriodRows(items, new Map(), baseline);
    expect(rows.find((r) => r.itemId === "b")!.planned).toBe(true);
    expect(rows.find((r) => r.itemId === "d")!.planned).toBe(false);
  });

  it("tháng 6 đếm a + c (1.000 + 500), không đếm d", () => {
    const m = planVsActual(planPeriodRows(items, new Map(), baseline), MONTH("2026-06-01"));
    expect(m.plannedCount).toBe(2);
    expect(m.plannedStartValue).toBe(1_500);
  });

  it("không có bản mốc (kế hoạch chưa từng duyệt) ⇒ dùng tháng hiện tại", () => {
    const rows = planPeriodRows(items, new Map(), null);
    expect(rows.find((r) => r.itemId === "a")!.baselineMonth).toBe("2026-12-01");
    expect(baselineItemMap(null).size).toBe(0);
  });
});

/* ─── Bảng chỉ số A5 ──────────────────────────────────────────────────────── */

describe("planVsActual — bảng chỉ số A5", () => {
  const rows: PlanPeriodRow[] = [
    // Đấu thành, thu đủ, trong tháng 6.
    row({
      itemId: "sold-paid",
      baselineMonth: "2026-06-01",
      baselineExpected: 10_000,
      outcome: outcome({ starting_price: 10_000, winning_price: 12_000, payment_status: "paid", paid_amount: 12_000 }),
    }),
    // Đấu thành, thu một phần.
    row({
      itemId: "sold-partial",
      baselineMonth: "2026-06-01",
      baselineExpected: 20_000,
      outcome: outcome({
        auction_date: "2026-06-20",
        starting_price: 20_000,
        winning_price: 25_000,
        payment_status: "partial",
        paid_amount: 10_000,
      }),
    }),
    // Đấu thành nhưng người trúng BỎ CỌC ⇒ ra khỏi sold / winning / collected,
    // vẫn là "đưa ra đấu giá".
    row({
      itemId: "sold-defaulted",
      baselineMonth: "2026-06-01",
      baselineExpected: 30_000,
      outcome: outcome({
        auction_date: "2026-06-25",
        starting_price: 30_000,
        winning_price: 33_000,
        payment_status: "defaulted",
        paid_amount: null,
      }),
    }),
    // Không thành.
    row({
      itemId: "unsold",
      baselineMonth: "2026-06-01",
      baselineExpected: 5_000,
      outcome: outcome({ auction_date: "2026-06-28", outcome: "unsold", payment_status: null, starting_price: 5_000, winning_price: null }),
    }),
    // Theo kế hoạch tháng 6 nhưng CHƯA liên kết hồ sơ ⇒ không có thực tế.
    row({ itemId: "no-link", baselineMonth: "2026-06-01", baselineExpected: 7_000 }),
    // Kết quả ở tháng 7 (ngoài kỳ tháng 6, trong kỳ quý II và năm).
    row({
      itemId: "july",
      baselineMonth: "2026-07-01",
      baselineExpected: 40_000,
      outcome: outcome({ auction_date: "2026-07-02", starting_price: 40_000, winning_price: 41_000, paid_amount: 41_000 }),
    }),
  ];

  const june = planVsActual(rows, MONTH("2026-06-01"));

  it("số tài sản theo kế hoạch của tháng 6", () => {
    expect(june.plannedCount).toBe(5);
    expect(june.plannedStartValue).toBe(72_000);
  });

  it('"đưa ra đấu giá" đếm mọi kết quả, kể cả bỏ cọc', () => {
    expect(june.offeredCount).toBe(4);
  });

  it('"đấu thành" loại bỏ cọc', () => {
    expect(june.soldCount).toBe(2);
  });

  it("giá trị khởi điểm: kế hoạch theo bản mốc, thực tế theo phiên", () => {
    expect(june.plannedStartValue).toBe(72_000);
    expect(june.actualStartValue).toBe(65_000);
  });

  it("tổng giá trúng loại bỏ cọc", () => {
    expect(june.winningTotal).toBe(37_000);
  });

  it("đã thu theo luật cash-strict (thu đủ + thu một phần, phần còn lại là chờ thu)", () => {
    expect(june.collected).toBe(22_000);
    expect(june.recorded).toBe(22_000);
    expect(june.estimated).toBe(0);
    expect(june.awaiting).toBe(15_000);
  });

  it("tỷ lệ hoàn thành làm tròn XUỐNG", () => {
    // 2 / 5 = 40%
    expect(june.donePct).toBe(40);
    // 1 / 3 = 33,3% → 33
    const third = planVsActual(
      [
        row({ itemId: "p1", baselineMonth: "2026-08-01", baselineExpected: 1 }),
        row({ itemId: "p2", baselineMonth: "2026-08-01", baselineExpected: 1 }),
        row({
          itemId: "p3",
          baselineMonth: "2026-08-01",
          baselineExpected: 1,
          outcome: outcome({ auction_date: "2026-08-10", winning_price: 1, paid_amount: 1 }),
        }),
      ],
      MONTH("2026-08-01"),
    );
    expect(third.donePct).toBe(33);
  });

  it("kỳ không có tài sản theo kế hoạch ⇒ tỷ lệ null, không phải 0", () => {
    expect(planVsActual(rows, MONTH("2026-02-01")).donePct).toBeNull();
  });

  it("quý II gộp tháng 4–6, năm gộp cả tháng 7", () => {
    const q2 = planVsActual(rows, QUARTER("2026-04-01"));
    expect(q2.plannedCount).toBe(5);
    expect(q2.offeredCount).toBe(4);
    const year = planVsActual(rows, YEAR(2026));
    expect(year.plannedCount).toBe(6);
    expect(year.offeredCount).toBe(5);
    expect(year.soldCount).toBe(3);
    expect(year.winningTotal).toBe(78_000);
    expect(year.collected).toBe(63_000);
  });

  it("biên kỳ BAO GỒM hai đầu", () => {
    const edge: PlanPeriodRow[] = [
      row({ itemId: "first", baselineMonth: "2026-06-01", baselineExpected: 1, outcome: outcome({ auction_date: "2026-06-01", winning_price: 1, paid_amount: 1 }) }),
      row({ itemId: "last", baselineMonth: "2026-06-01", baselineExpected: 1, outcome: outcome({ auction_date: "2026-06-30", winning_price: 1, paid_amount: 1 }) }),
    ];
    expect(planVsActual(edge, MONTH("2026-06-01")).offeredCount).toBe(2);
    expect(planVsActual(edge, MONTH("2026-07-01")).offeredCount).toBe(0);
  });

  it("kết quả KHÔNG CÓ NGÀY không thuộc kỳ nào (luật Chỉ tiêu)", () => {
    const undated = [
      row({ itemId: "x", baselineMonth: "2026-06-01", baselineExpected: 1, outcome: outcome({ auction_date: null, winning_price: 9 }) }),
    ];
    expect(planVsActual(undated, MONTH("2026-06-01")).offeredCount).toBe(0);
    expect(planVsActual(undated, YEAR(2026)).offeredCount).toBe(0);
  });

  it("tài sản dời dự kiến sang quý sau: cột kế hoạch vẫn ở quý của BẢN MỐC", () => {
    // Bản mốc quý II, dự kiến mới quý III, phiên thật diễn ra quý III.
    const moved = [
      row({
        itemId: "moved",
        baselineMonth: "2026-06-01",
        baselineExpected: 50_000,
        outcome: outcome({ auction_date: "2026-08-10", starting_price: 50_000, winning_price: 55_000, paid_amount: 55_000 }),
      }),
    ];
    const q2 = planVsActual(moved, QUARTER("2026-04-01"));
    expect(q2.plannedCount).toBe(1);
    expect(q2.soldCount).toBe(0);
    expect(q2.donePct).toBe(0);
    const q3 = planVsActual(moved, QUARTER("2026-07-01"));
    expect(q3.plannedCount).toBe(0);
    expect(q3.soldCount).toBe(1);
    expect(q3.donePct).toBeNull();
  });

  it("nguồn org/crawled (payment_status null) tính theo giá trúng — nhánh estimated", () => {
    const est = [
      row({
        itemId: "est",
        baselineMonth: "2026-06-01",
        baselineExpected: 1_000,
        outcome: outcome({ payment_status: null, winning_price: 3_000, paid_amount: null, starting_price: 1_000 }),
      }),
    ];
    const m = planVsActual(est, MONTH("2026-06-01"));
    expect(m.estimated).toBe(3_000);
    expect(m.recorded).toBe(0);
    expect(m.collected).toBe(3_000);
  });
});

/* ─── Chuỗi 12 tháng + bảng tài sản của kỳ ────────────────────────────────── */

describe("chuỗi 12 tháng và bảng tài sản của kỳ", () => {
  const rows: PlanPeriodRow[] = [
    row({
      itemId: "a",
      baselineMonth: "2026-06-01",
      baselineExpected: 10,
      outcome: outcome({ auction_date: "2026-06-10", winning_price: 12, paid_amount: 12, starting_price: 10 }),
    }),
    row({ itemId: "b", baselineMonth: "2026-06-01", baselineExpected: 20 }),
    row({
      itemId: "c",
      baselineMonth: "2026-11-01",
      baselineExpected: 30,
      outcome: outcome({ auction_date: "2026-08-01", winning_price: 33, paid_amount: 33, starting_price: 30 }),
    }),
  ];

  it("12 điểm, cộng đúng theo tháng của bản mốc / của phiên", () => {
    const series = planVsActualByMonth(rows, 2026);
    expect(series).toHaveLength(12);
    expect(series[5]).toMatchObject({ key: "2026-06", label: "T6", plannedCount: 2, plannedStartValue: 30, soldCount: 1, winningTotal: 12 });
    expect(series[7]).toMatchObject({ key: "2026-08", plannedCount: 0, soldCount: 1, winningTotal: 33 });
    expect(series[10]).toMatchObject({ key: "2026-11", plannedCount: 1, plannedStartValue: 30, soldCount: 0 });
  });

  it("tổng 12 tháng = chỉ số của cả năm", () => {
    const series = planVsActualByMonth(rows, 2026);
    const year = planVsActual(rows, YEAR(2026));
    expect(series.reduce((s, p) => s + p.plannedCount, 0)).toBe(year.plannedCount);
    expect(series.reduce((s, p) => s + p.winningTotal, 0)).toBe(year.winningTotal);
  });

  it("bảng tài sản của kỳ phân biệt theo kế hoạch / có kết quả / cả hai", () => {
    const june = planPeriodItems(rows, MONTH("2026-06-01"));
    expect(june.map((i) => [i.row.itemId, i.membership])).toEqual([
      ["a", "both"],
      ["b", "planned"],
    ]);
    const aug = planPeriodItems(rows, MONTH("2026-08-01"));
    expect(aug.map((i) => [i.row.itemId, i.membership])).toEqual([["c", "actual"]]);
  });
});

/* ─── Chỉ tiêu sinh từ kế hoạch ───────────────────────────────────────────── */

describe("planQuarterGoals", () => {
  const rows: PlanPeriodRow[] = [
    row({ itemId: "a", baselineMonth: "2026-02-01", baselineExpected: 1_000 }),
    row({ itemId: "b", baselineMonth: "2026-03-01", baselineExpected: 2_000 }),
    row({ itemId: "c", baselineMonth: "2026-11-01", baselineExpected: 4_000 }),
    // Không có tháng ⇒ không thuộc quý nào.
    row({ itemId: "d", baselineMonth: null, baselineExpected: 9_000 }),
    // Đã bỏ khỏi kế hoạch và không trong bản mốc.
    row({ itemId: "e", baselineMonth: "2026-11-01", baselineExpected: 8_000, planned: false }),
  ];

  it("chỉ sinh cho quý CÓ tài sản", () => {
    const goals = planQuarterGoals(rows, 2026);
    expect(goals.map((g) => g.quarter)).toEqual([1, 4]);
    expect(goals[0]).toMatchObject({ periodStart: "2026-01-01", offeredCount: 2, winningTotal: 3_000 });
    expect(goals[1]).toMatchObject({ periodStart: "2026-10-01", offeredCount: 1, winningTotal: 4_000, label: "quý IV/2026" });
  });

  it("không sinh chỉ tiêu mục tiêu 0 (owner_save_target đòi goal > 0)", () => {
    expect(planQuarterGoals([row({ itemId: "z", baselineMonth: "2026-05-01", baselineExpected: 0 })], 2026)).toEqual([]);
    expect(planQuarterGoals([], 2026)).toEqual([]);
  });
});
