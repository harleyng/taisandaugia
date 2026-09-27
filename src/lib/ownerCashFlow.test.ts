import { describe, expect, it } from "vitest";
import {
  SCOPE_ALL,
  addDays,
  buildCashReportView,
  buildCollectionsView,
  cashForecast,
  cohortAssets,
  cohortWaterfall,
  collectionBucketOf,
  collectionBuckets,
  estimateLayer,
  mapCashFlowPayload,
  matchesAssetQuery,
  outcomeCashContext,
  receivables,
  recordableRows,
  recoveryRate,
  resolveScope,
  scopeData,
  unitRecovery,
  unitSuccessRates,
  untrackedSoldOf,
  waterfallSteps,
  writableOverdueCount,
  type CashEvent,
  type CashFlowData,
  type CashRow,
  type CashUnit,
  type CashUpcoming,
} from "./ownerCashFlow";
import { recoveryOf } from "./ownerTargets";

const AS_OF = "2026-09-26";
const SEPT = { from: "2026-09-01", to: "2026-09-30" };

const unit = (id: string, over: Partial<CashUnit> = {}): CashUnit => ({
  id,
  name: id.toUpperCase(),
  isSelf: id === "u1",
  canSeePeople: id === "u1",
  ...over,
});

let seq = 0;
const row = (over: Partial<CashRow> = {}): CashRow => {
  seq += 1;
  return {
    unitId: "u1",
    rowKey: `l:${seq}`,
    listingId: `${seq}`,
    ownOutcomeId: `o${seq}`,
    bestKind: "owner_report",
    title: `Tài sản ${seq}`,
    assetCode: null,
    branchId: null,
    branchName: null,
    outcome: "sold",
    date: "2026-09-10",
    startingPrice: 800,
    price: 1000,
    paymentStatus: "pending",
    paidAmount: null,
    paymentDueOn: null,
    confidence: "self_reported",
    ...over,
  };
};

const event = (over: Partial<CashEvent> = {}): CashEvent => ({
  id: `e${(seq += 1)}`,
  unitId: "u1",
  outcomeId: "o1",
  rowKey: "l:1",
  title: "x",
  assetCode: null,
  branchId: null,
  branchName: null,
  roundNo: 1,
  outcome: "sold",
  kind: "payment",
  amount: 100,
  occurredOn: "2026-09-15",
  note: null,
  updatedAt: null,
  createdByName: null,
  updatedByName: null,
  ...over,
});

describe("mapCashFlowPayload", () => {
  it("drops malformed entries and keeps typed fields", () => {
    const d = mapCashFlowPayload({
      as_of: "2026-09-26",
      units: [{ id: "u1", name: "Trạm", is_self: true, can_see_people: true }, { name: "no id" }],
      rows: [
        { unit_id: "u1", row_key: "l:a", best_kind: "owner_report", resolved_outcome: "sold", resolved_price: "1000", payment_status: "partial", paid_amount: 300, resolved_date: "2026-09-01", payment_due_on: "2026-10-01" },
        { row_key: "missing unit" },
      ],
      events: [
        { id: "e1", unit_id: "u1", outcome_id: "o1", row_key: "l:a", kind: "deposit", amount: "50", occurred_on: "2026-09-02" },
        { id: "e2", unit_id: "u1", outcome_id: "o1", kind: "bogus", amount: 1, occurred_on: "2026-09-02" },
      ],
      upcoming: [{ unit_id: "u1", row_key: "l:b", auction_date: "2026-10-05", starting_price: 500 }],
    });
    expect(d.units).toHaveLength(1);
    expect(d.rows).toHaveLength(1);
    expect(d.rows[0]).toMatchObject({ price: 1000, paymentStatus: "partial", paidAmount: 300, paymentDueOn: "2026-10-01" });
    expect(d.events).toHaveLength(1);
    expect(d.events[0]).toMatchObject({ kind: "deposit", amount: 50 });
    expect(d.upcoming[0]).toMatchObject({ startingPrice: 500, auctionDate: "2026-10-05" });
  });

  it("survives an empty or broken payload", () => {
    const d = mapCashFlowPayload(null);
    expect(d.units).toEqual([]);
    expect(d.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("scope", () => {
  const units = [unit("u1"), unit("u2")];
  it("falls back to the whole system for unknown ids", () => {
    expect(resolveScope("u2", units)).toBe("u2");
    expect(resolveScope("zzz", units)).toBe(SCOPE_ALL);
    expect(resolveScope(null, units)).toBe(SCOPE_ALL);
  });

  it("keeps only the chosen unit's rows, entries and auctions", () => {
    const data: CashFlowData = {
      asOf: AS_OF,
      units,
      rows: [row({ unitId: "u1" }), row({ unitId: "u2" })],
      events: [event({ unitId: "u2" })],
      upcoming: [],
    };
    const s = scopeData(data, "u2");
    expect(s.units.map((u) => u.id)).toEqual(["u2"]);
    expect(s.rows).toHaveLength(1);
    expect(s.events).toHaveLength(1);
    expect(scopeData(data, SCOPE_ALL)).toBe(data);
  });
});

describe("cohortWaterfall", () => {
  it("adds up like Chỉ tiêu (recoveryOf) and subtracts the cohort's fees from every round", () => {
    const a = row({ price: 1000, startingPrice: 800, paymentStatus: "partial", paidAmount: 300 });
    const b = row({ price: 500, startingPrice: null, paymentStatus: "paid", paidAmount: 500 });
    const w = cohortWaterfall(
      [a, b],
      [
        event({ kind: "fee", amount: 40, rowKey: a.rowKey }),
        event({ kind: "fee", amount: 10, rowKey: a.rowKey, roundNo: 1, outcome: "unsold" }),
        event({ kind: "fee", amount: 99, rowKey: "l:elsewhere" }),
      ],
      SEPT,
    );
    expect(w.count).toBe(2);
    expect(w.starting).toBe(800 + 500);
    expect(w.winning).toBe(1500);
    expect(w.premium).toBe(200);
    const expected = recoveryOf({ day: null, branchId: null, price: 1000, paymentStatus: "partial", paidAmount: 300 });
    expect(w.recorded).toBe(expected.recorded + 500);
    expect(w.awaiting).toBe(700);
    expect(w.recorded + w.awaiting).toBe(w.winning);
    expect(w.fees).toBe(50);
    expect(w.net).toBe(800 - 50);
    expect(w.notes.missingStart).toBe(1);
  });

  it("keeps platform, untracked, defaulted and out-of-period rows out and counts them", () => {
    const w = cohortWaterfall(
      [
        row({ bestKind: "platform", ownOutcomeId: null, price: 7 }),
        row({ bestKind: "crawled", ownOutcomeId: null, price: 5 }),
        row({ paymentStatus: "defaulted" }),
        row({ date: "2026-08-31" }),
        row({ outcome: "unsold" }),
      ],
      [],
      SEPT,
    );
    expect(w.count).toBe(0);
    expect(w.notes.platform).toEqual({ count: 1, value: 7 });
    expect(w.notes.untracked).toEqual({ count: 1, value: 5 });
    expect(w.notes.defaulted).toBe(1);
  });

  it("clamps an overpayment for the chart and reports it", () => {
    const w = cohortWaterfall([row({ price: 100, paymentStatus: "paid", paidAmount: 120 })], [], SEPT);
    expect(w.recorded).toBe(100);
    expect(w.notes.overpaid).toBe(20);
  });
});

describe("waterfallSteps", () => {
  const notes = { missingStart: 0, defaulted: 0, platform: { count: 0, value: 0 }, untracked: { count: 0, value: 0 }, overpaid: 0 };

  it("goes from winning price to net in five steps (design 2026-09-27)", () => {
    const steps = waterfallSteps({
      count: 1,
      starting: 800,
      premium: 200,
      winning: 1000,
      awaiting: 400,
      recorded: 600,
      fees: 50,
      net: 550,
      notes,
    });
    expect(steps.map((s) => [s.key, s.range, s.kind, s.value])).toEqual([
      ["winning", [0, 1000], "total", 1000],
      ["awaiting", [600, 1000], "down", -400],
      ["recorded", [0, 600], "total", 600],
      ["fees", [550, 600], "down", -50],
      ["net", [0, 550], "total", 550],
    ]);
  });

  it("draws a negative net as a downward span below zero", () => {
    const steps = waterfallSteps({
      count: 1,
      starting: 1000,
      premium: -100,
      winning: 900,
      awaiting: 900,
      recorded: 0,
      fees: 30,
      net: -30,
      notes,
    });
    expect(steps[3]).toMatchObject({ key: "fees", range: [-30, 0], value: -30 });
    expect(steps[4]).toMatchObject({ key: "net", range: [-30, 0], value: -30 });
  });

  it("rates collection as recorded / winning, null without a winning price", () => {
    expect(recoveryRate({ recorded: 730, winning: 1000 })).toBeCloseTo(0.73);
    expect(recoveryRate({ recorded: 0, winning: 0 })).toBeNull();
  });
});

describe("receivables", () => {
  it("uses the officer's due date, else auction day + 30, and sorts overdue first", () => {
    const late = row({ date: "2026-08-01", paymentStatus: "pending" }); // due 08-31 ⇒ 26 days late
    const set = row({ date: "2026-09-20", paymentDueOn: "2026-10-10", paymentStatus: "partial", paidAmount: 400 });
    const paid = row({ paymentStatus: "paid", paidAmount: 1000 });
    const list = receivables([set, late, paid, row({ bestKind: "org_report", ownOutcomeId: null })], AS_OF);
    expect(list.map((r) => r.row.rowKey)).toEqual([late.rowKey, set.rowKey]);
    expect(list[0]).toMatchObject({ dueOn: "2026-08-31", dueIsDefault: true, daysOverdue: 26, remaining: 1000 });
    expect(list[1]).toMatchObject({ dueOn: "2026-10-10", dueIsDefault: false, daysOverdue: 0, remaining: 600 });
  });

  it("skips defaulted sales", () => {
    expect(receivables([row({ paymentStatus: "defaulted" })], AS_OF)).toEqual([]);
  });
});

describe("estimate", () => {
  const units = [unit("u1"), unit("u2")];
  const results = [
    row({ unitId: "u1", outcome: "sold", date: "2026-05-01" }),
    row({ unitId: "u1", outcome: "unsold", date: "2026-06-01" }),
    row({ unitId: "u1", outcome: "sold", date: "2026-07-01" }),
    row({ unitId: "u1", outcome: "postponed", date: "2026-08-01" }),
    row({ unitId: "u1", outcome: "sold", date: "2024-01-01" }), // ngoài 12 tháng
    row({ unitId: "u2", outcome: "sold", date: "2026-09-01" }),
  ];
  const up = (over: Partial<CashUpcoming>): CashUpcoming => ({
    unitId: "u1",
    rowKey: "l:up",
    title: "Sắp đấu",
    assetCode: null,
    branchId: null,
    branchName: null,
    auctionDate: "2026-10-05",
    orgName: null,
    startingPrice: 1000,
    ...over,
  });

  it("uses each unit's 12-month success rate (sold / results) and needs 3 results", () => {
    const rates = unitSuccessRates(results, units, AS_OF);
    expect(rates.get("u1")).toMatchObject({ results: 4, sold: 2, rate: 0.5 });
    expect(rates.get("u2")).toMatchObject({ results: 1, rate: null });
  });

  it("expects starting × rate, 30 days after the auction; skips units without data or price", () => {
    const layer = estimateLayer(
      [up({}), up({ unitId: "u2" }), up({ startingPrice: null })],
      unitSuccessRates(results, units, AS_OF),
    );
    expect(layer.items).toHaveLength(1);
    expect(layer.items[0]).toMatchObject({ expected: 500, cashOn: "2026-11-04" });
    expect(layer.total).toBe(500);
    expect(layer.skippedNoRate).toBe(1);
    expect(layer.skippedNoPrice).toBe(1);
  });
});

describe("cashForecast", () => {
  it("buckets by days from today at 0/30/31/60/61/90 edges; estimates are never overdue", () => {
    const r = (dueOn: string | null, remaining: number) => ({ row: row(), remaining, dueOn, dueIsDefault: false, daysOverdue: 0 });
    const f = cashForecast(
      [
        r("2026-09-25", 1),
        r(AS_OF, 10),
        r(addDays(AS_OF, 30), 100),
        r(addDays(AS_OF, 31), 1000),
        r(addDays(AS_OF, 60), 10000),
        r(addDays(AS_OF, 61), 100000),
        r(addDays(AS_OF, 90), 1000000),
        r(addDays(AS_OF, 91), 7),
        r(null, 3),
      ],
      { items: [{ upcoming: {} as CashUpcoming, expected: 5, cashOn: addDays(AS_OF, 45) }], total: 5, skippedNoRate: 0, skippedNoPrice: 0 },
      AS_OF,
    );
    expect(f.buckets.map((b) => [b.key, b.owed, b.estimate])).toEqual([
      ["overdue", 1, 0],
      ["d30", 110, 0],
      ["d60", 11000, 5],
      ["d90", 1100000, 0],
    ]);
    expect(f.laterOwed).toBe(7);
    expect(f.undatedOwed).toBe(3);
  });
});

describe("Thu tiền — nhóm theo hạn", () => {
  it("splits owed money into overdue / due within 7 days (today included) / later or undated", () => {
    const late = row({ date: "2026-08-01" }); // hạn mặc định 31/08 ⇒ trễ
    const latePartial = row({ date: "2026-08-01", paymentStatus: "partial", paidAmount: 400 });
    const today = row({ paymentDueOn: AS_OF });
    const day7 = row({ paymentDueOn: "2026-10-03" });
    const day8 = row({ paymentDueOn: "2026-10-04" });
    const undated = row({ date: null, paymentDueOn: null });
    const recv = receivables([late, latePartial, today, day7, day8, undated], AS_OF);
    const byKey = new Map(recv.map((r) => [r.row.rowKey, collectionBucketOf(r, AS_OF)]));
    expect([late, latePartial, today, day7, day8, undated].map((r) => byKey.get(r.rowKey))).toEqual([
      "overdue",
      "overdue",
      "soon",
      "soon",
      "later",
      "later",
    ]);
    expect(collectionBuckets(recv, AS_OF).map((b) => [b.key, b.count, b.amount])).toEqual([
      ["overdue", 2, 1600],
      ["soon", 2, 2000],
      ["later", 2, 2000],
    ]);
  });

  it("counts the sidebar badge only for overdue rows the viewer can record", () => {
    const data: CashFlowData = {
      asOf: AS_OF,
      units: [unit("u1"), unit("u2", { isSelf: false })],
      rows: [
        row({ unitId: "u1", date: "2026-08-01" }),
        row({ unitId: "u1", date: "2026-08-01", branchId: "b2" }),
        row({ unitId: "u2", date: "2026-08-01" }),
        row({ unitId: "u1" }), // chưa tới hạn
      ],
      events: [],
      upcoming: [],
    };
    expect(writableOverdueCount(data, (unitId, branchId) => unitId === "u1" && branchId !== "b2")).toBe(1);
  });

  it("lists every entry newest first and keeps owed money from every period", () => {
    const data: CashFlowData = {
      asOf: AS_OF,
      units: [unit("u1")],
      rows: [row({ date: "2025-01-10" }), row()],
      events: [
        event({ id: "old", occurredOn: "2026-09-01" }),
        event({ id: "new", occurredOn: "2026-09-20" }),
        event({ id: "edited", occurredOn: "2026-09-20", updatedAt: "2026-09-21T10:00:00Z" }),
      ],
      upcoming: [],
    };
    const v = buildCollectionsView(data);
    expect(v.ledger.map((e) => e.id)).toEqual(["edited", "new", "old"]);
    expect(v.receivables).toHaveLength(2);
  });

  it("matches the search box on accent-free title or asset code", () => {
    const item = { title: "Nhà đất 45 Lê Văn Lương", assetCode: "3F9A12BC" };
    expect(matchesAssetQuery(item, "nha dat")).toBe(true);
    expect(matchesAssetQuery(item, "LƯƠNG")).toBe(true);
    expect(matchesAssetQuery(item, "3f9a")).toBe(true);
    expect(matchesAssetQuery(item, "  ")).toBe(true);
    expect(matchesAssetQuery(item, "kho xưởng")).toBe(false);
  });
});

describe("Dòng tiền — tài sản bán trong kỳ", () => {
  it("lists the cohort with defaulted sales flagged and overdue days only while money is owed", () => {
    const partial = row({ date: "2026-09-12", paymentStatus: "partial", paidAmount: 300 });
    const defaulted = row({ date: "2026-09-11", paymentStatus: "defaulted" });
    const settledLate = row({ date: "2026-09-02", paymentDueOn: "2026-09-05", paymentStatus: "paid", paidAmount: 1000 });
    const owedLate = row({ date: "2026-09-01", paymentDueOn: "2026-09-20" });
    const assets = cohortAssets(
      [
        partial,
        defaulted,
        settledLate,
        owedLate,
        row({ date: "2026-08-01" }),
        row({ bestKind: "platform", ownOutcomeId: null }),
      ],
      SEPT,
      AS_OF,
    );
    expect(assets.map((a) => [a.row.rowKey, a.defaulted, a.recorded, a.awaiting, a.daysOverdue])).toEqual([
      [partial.rowKey, false, 300, 700, 0],
      [defaulted.rowKey, true, 0, 0, 0],
      [settledLate.rowKey, false, 1000, 0, 0],
      [owedLate.rowKey, false, 0, 1000, 6],
    ]);
  });

  it("builds the unit table from the same cohort as the hero, so owed + collected = winning", () => {
    const u1Late = row({ unitId: "u1", date: "2026-09-10", paymentDueOn: "2026-09-20", price: 1000 });
    const u1Paid = row({ unitId: "u1", date: "2026-09-12", paymentStatus: "paid", paidAmount: 500, price: 500 });
    const u2 = row({ unitId: "u2", date: "2026-09-15", paymentStatus: "partial", paidAmount: 200, price: 800 });
    const data: CashFlowData = {
      asOf: AS_OF,
      units: [unit("u1"), unit("u2", { isSelf: false })],
      rows: [u1Late, u1Paid, u2, row({ unitId: "u1", date: "2026-08-01" })],
      events: [event({ unitId: "u1", rowKey: u1Late.rowKey, kind: "fee", amount: 50 })],
      upcoming: [],
    };
    const units = unitRecovery(data, SEPT);
    expect(
      units.map((u) => [u.unit.id, u.totals.winning, u.totals.recorded, u.totals.awaiting, u.totals.net, u.overdue, u.overdueCount]),
    ).toEqual([
      ["u1", 1500, 500, 1000, 450, 1000, 1],
      ["u2", 800, 200, 600, 200, 0, 0],
    ]);
    expect(units[0].rate).toBeCloseTo(1 / 3);
    expect(units[1].rate).toBeCloseTo(0.25);

    const v = buildCashReportView(data, "m-2026-09");
    expect(v.waterfall.winning).toBe(2300);
    expect(v.waterfall.recorded + v.waterfall.awaiting).toBe(v.waterfall.winning);
    expect(v.rate).toBeCloseTo(700 / 2300);
    expect(v.steps.map((s) => s.key)).toEqual(["winning", "awaiting", "recorded", "fees", "net"]);
    // Dự báo vẫn tính từ hôm nay: gồm cả khoản của tháng 8.
    expect(v.forecast.buckets.find((b) => b.key === "overdue")?.owed).toBe(2000);
    expect(recordableRows(data).every((r) => r.unitId === "u1")).toBe(true);
  });
});

describe("outcomeCashContext", () => {
  it("rebuilds collected from the ledger and takes price / defaulted from the tracked row", () => {
    const r = row({ ownOutcomeId: "oX", price: 900, paymentStatus: "defaulted" });
    const data: CashFlowData = {
      asOf: AS_OF,
      units: [unit("u1")],
      rows: [r],
      events: [
        event({ outcomeId: "oX", kind: "deposit", amount: 100 }),
        event({ outcomeId: "oX", kind: "refund", amount: 30 }),
        event({ outcomeId: "oX", kind: "fee", amount: 999 }),
        event({ outcomeId: "old", kind: "deposit", amount: 50, outcome: "unsold" }),
      ],
      upcoming: [],
    };
    expect(outcomeCashContext(data, "oX")).toEqual({ sold: true, defaulted: true, winningPrice: 900, collected: 70 });
    expect(outcomeCashContext(data, "old")).toEqual({ sold: false, defaulted: false, winningPrice: null, collected: 50 });
  });
});

describe("untrackedSoldOf", () => {
  it("keeps only the unit's own sold rows won by org / crawled sources in the period", () => {
    const rows = [
      row({ unitId: "u1", bestKind: "org_report", ownOutcomeId: null }),
      row({ unitId: "u1", bestKind: "platform", ownOutcomeId: null }),
      row({ unitId: "u2", bestKind: "crawled", ownOutcomeId: null }),
      row({ unitId: "u1" }),
      row({ unitId: "u1", bestKind: "crawled", ownOutcomeId: null, date: "2026-01-01" }),
    ];
    expect(untrackedSoldOf(rows, "u1", SEPT)).toHaveLength(1);
  });
});
