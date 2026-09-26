import { describe, it, expect } from "vitest";
import {
  BRANCH_ALL,
  BRANCH_NONE,
  filterOverview,
  mapOverviewRow,
  sortOverview,
  summarizeOutcomes,
  type OutcomeOverviewRow,
  type OverviewFilters,
  type OverviewRowRaw,
} from "./ownerOutcomesOverview";
import { PERIOD_ALL } from "./ownerPeriods";

const raw = (over: Partial<OverviewRowRaw> = {}): OverviewRowRaw =>
  ({
    row_key: "l:3f9a12bc-0000-4000-8000-000000000001",
    listing_id: "3f9a12bc-0000-4000-8000-000000000001",
    title_key: null,
    own_outcome_id: null,
    own_round_no: null,
    rounds_reported: 0,
    asset_title: "Nhà phố Quận 7",
    asset_category: "nha-pho",
    branch_id: "b1",
    auction_org_name: "Công ty X",
    starting_price: 5_000_000_000,
    resolved_outcome: "sold",
    resolved_price: 5_500_000_000,
    resolved_date: "2026-09-10",
    payment_status: "pending",
    paid_amount: null,
    best_kind: "org_report",
    confidence_label: "self_reported",
    has_conflict: false,
    sources: [],
    ...over,
  }) as OverviewRowRaw;

const ALL: OverviewFilters = {
  period: PERIOD_ALL,
  branch: BRANCH_ALL,
  outcome: "all",
  source: "all",
  conflictOnly: false,
  q: "",
};

describe("mapOverviewRow", () => {
  it("narrows types and keeps the server's conflict flags on each source", () => {
    const row = mapOverviewRow(
      raw({
        has_conflict: true,
        own_round_no: 2,
        sources: [
          { kind: "owner_report", label: "self_reported", outcome: "sold", price: 5_500_000_000, ref_id: "o1", fp: "owner_report|o1|sold|5500000000", in_round: true, disagrees: false, dismissed: false },
          { kind: "org_report", label: "self_reported", outcome: "sold", price: 5_000_000_000, ref_id: "r1", fp: "org_report|r1|sold|5000000000", in_round: true, disagrees: true, dismissed: false },
        ],
      }),
    );
    expect(row.hasConflict).toBe(true);
    expect(row.ownRoundNo).toBe(2);
    expect(row.sources[1]).toMatchObject({ kind: "org_report", fp: "org_report|r1|sold|5000000000", disagrees: true, inRound: true, dismissed: false });
  });

  it("falls back to a placeholder title and tolerates junk", () => {
    const row = mapOverviewRow(raw({ asset_title: null as unknown as string, resolved_outcome: "weird", sources: {} as never }));
    expect(row.title).toBe("Tài sản chưa đặt tên");
    expect(row.outcome).toBeNull();
    expect(row.sources).toEqual([]);
  });
});

const rows: OutcomeOverviewRow[] = [
  mapOverviewRow(raw()),
  mapOverviewRow(raw({ row_key: "t:xe tải", listing_id: null, title_key: "xe tải", asset_title: "Xe tải Hino", branch_id: null, resolved_outcome: "unsold", resolved_price: null, resolved_date: "2026-08-02", confidence_label: "owner_evidence" })),
  mapOverviewRow(raw({ row_key: "l:2", listing_id: "7e00aa01-0000-4000-8000-000000000002", asset_title: "Đất nền Bình Dương", resolved_outcome: "postponed", resolved_price: null, resolved_date: "2025-01-05", has_conflict: true })),
  mapOverviewRow(raw({ row_key: "l:3", listing_id: "9b000000-0000-4000-8000-000000000003", asset_title: "Căn hộ cũ", resolved_price: null, resolved_date: null, confidence_label: "estimated", payment_status: "defaulted" })),
];

describe("filterOverview", () => {
  it("filters by period on the result date; undated rows only under all time", () => {
    expect(filterOverview(rows, { ...ALL, period: "m-2026-09" }, "2026-09-26").map((r) => r.title)).toEqual(["Nhà phố Quận 7"]);
    expect(filterOverview(rows, { ...ALL, period: "last-12m" }, "2026-09-26")).toHaveLength(2);
    expect(filterOverview(rows, ALL, "2026-09-26")).toHaveLength(4);
  });

  it("filters by branch, including rows without a branch", () => {
    expect(filterOverview(rows, { ...ALL, branch: "b1" }, "2026-09-26")).toHaveLength(3);
    expect(filterOverview(rows, { ...ALL, branch: BRANCH_NONE }, "2026-09-26").map((r) => r.title)).toEqual(["Xe tải Hino"]);
  });

  it("filters by result group, source label and conflicts", () => {
    expect(filterOverview(rows, { ...ALL, outcome: "void" }, "2026-09-26").map((r) => r.title)).toEqual(["Đất nền Bình Dương"]);
    expect(filterOverview(rows, { ...ALL, source: "owner_evidence" }, "2026-09-26")).toHaveLength(1);
    expect(filterOverview(rows, { ...ALL, conflictOnly: true }, "2026-09-26")).toHaveLength(1);
  });

  it("searches by name without accents or by asset code", () => {
    expect(filterOverview(rows, { ...ALL, q: "dat nen" }, "2026-09-26")).toHaveLength(1);
    expect(filterOverview(rows, { ...ALL, q: "Mã 7E00AA01" }, "2026-09-26").map((r) => r.title)).toEqual(["Đất nền Bình Dương"]);
    expect(filterOverview(rows, { ...ALL, q: "7e0" }, "2026-09-26")).toHaveLength(0);
  });
});

describe("sortOverview", () => {
  it("puts the newest result first and undated rows last", () => {
    expect(sortOverview(rows).map((r) => r.date)).toEqual(["2026-09-10", "2026-08-02", "2025-01-05", null]);
  });
});

describe("summarizeOutcomes", () => {
  it("counts by result group and sums known winning prices", () => {
    expect(summarizeOutcomes(rows)).toEqual({
      total: 4,
      sold: 2,
      unsold: 1,
      voided: 1,
      conflicts: 1,
      soldValue: 5_500_000_000,
      soldWithoutPrice: 1,
      defaulted: 1,
      successRate: 50,
    });
  });
  it("has no success rate without rows", () => {
    expect(summarizeOutcomes([]).successRate).toBeNull();
  });
});
