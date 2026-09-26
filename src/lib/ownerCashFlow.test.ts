import { describe, expect, it } from "vitest";
import {
  SCOPE_ALL,
  addDays,
  buildCashFlowView,
  cashForecast,
  cohortWaterfall,
  estimateLayer,
  mapCashFlowPayload,
  outcomeCashContext,
  periodCashTotals,
  receivables,
  recordableRows,
  resolveScope,
  scopeData,
  unitSuccessRates,
  untrackedSoldOf,
  waterfallSteps,
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

describe("periodCashTotals", () => {
  it("sums by cash date with inclusive bounds; fees and refunds are money out", () => {
    const t = periodCashTotals(
      [
        event({ kind: "deposit", amount: 100, occurredOn: "2026-09-01" }),
        event({ kind: "payment", amount: 900, occurredOn: "2026-09-30" }),
        event({ kind: "refund", amount: 50, occurredOn: "2026-09-15" }),
        event({ kind: "fee", amount: 30, occurredOn: "2026-09-15", outcome: "unsold" }),
        event({ kind: "payment", amount: 999, occurredOn: "2026-10-01" }),
      ],
      SEPT,
    );
    expect(t).toEqual({ inflow: 1000, refunds: 50, fees: 30, net: 920, count: 4 });
  });

  it("counts everything for 'all time'", () => {
    expect(periodCashTotals([event({ occurredOn: "2020-01-01" })], null).count).toBe(1);
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
  it("chains totals and floating steps", () => {
    const steps = waterfallSteps({
      count: 1,
      starting: 800,
      premium: 200,
      winning: 1000,
      awaiting: 400,
      recorded: 600,
      fees: 50,
      net: 550,
      notes: { missingStart: 0, defaulted: 0, platform: { count: 0, value: 0 }, untracked: { count: 0, value: 0 }, overpaid: 0 },
    });
    expect(steps.map((s) => [s.key, s.range, s.kind])).toEqual([
      ["starting", [0, 800], "total"],
      ["premium", [800, 1000], "up"],
      ["winning", [0, 1000], "total"],
      ["awaiting", [600, 1000], "down"],
      ["recorded", [0, 600], "total"],
      ["fees", [550, 600], "down"],
      ["net", [0, 550], "total"],
    ]);
  });

  it("draws a bid below the starting price and a negative net as downward spans", () => {
    const steps = waterfallSteps({
      count: 1,
      starting: 1000,
      premium: -100,
      winning: 900,
      awaiting: 900,
      recorded: 0,
      fees: 30,
      net: -30,
      notes: { missingStart: 0, defaulted: 0, platform: { count: 0, value: 0 }, untracked: { count: 0, value: 0 }, overpaid: 0 },
    });
    expect(steps[1]).toMatchObject({ kind: "down", range: [900, 1000], value: -100 });
    expect(steps[6]).toMatchObject({ range: [-30, 0], value: -30 });
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

describe("buildCashFlowView", () => {
  it("assembles the page and splits the system table by unit", () => {
    const data: CashFlowData = {
      asOf: AS_OF,
      units: [unit("u1"), unit("u2", { isSelf: false })],
      rows: [row({ unitId: "u1", date: "2026-08-01" }), row({ unitId: "u2", date: "2026-09-20" })],
      events: [event({ unitId: "u1", kind: "payment", amount: 100 }), event({ unitId: "u2", kind: "fee", amount: 20 })],
      upcoming: [],
    };
    const v = buildCashFlowView(data, "m-2026-09");
    expect(v.period.net).toBe(80);
    expect(v.overdue).toHaveLength(1);
    expect(v.owedTotal).toBe(2000);
    expect(v.units.map((u) => [u.unit.id, u.period.net, u.owed, u.overdueCount])).toEqual([
      ["u1", 100, 1000, 1],
      ["u2", -20, 1000, 0],
    ]);
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
