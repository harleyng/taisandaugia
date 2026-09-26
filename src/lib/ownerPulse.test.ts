import { describe, it, expect } from "vitest";
import type { ResolvedAssetOutcome } from "./ownerOutcomes";
import {
  applyPulseAccess,
  auctionHasPassed,
  dayDiff,
  formatDayFull,
  formatDayMonth,
  selectAwaitingPayment,
  selectOutcomeDue,
  type PulseAsset,
} from "./ownerPulse";

// 26/09/2026 15:00 giờ máy — mọi phép so "hôm nay" dựa trên mốc này.
const NOW = new Date(2026, 8, 26, 15, 0, 0);

const asset = (over: Partial<PulseAsset> = {}): PulseAsset => ({
  id: "l1",
  title: "Nhà đất Q.7",
  price: 5_000_000_000,
  auctionTime: "2026-09-20",
  claimStatus: "confirmed",
  assetOwnerId: "ao1",
  ...over,
});

const outcome = (over: Partial<ResolvedAssetOutcome> = {}): ResolvedAssetOutcome => ({
  listingId: "l1",
  outcome: "sold",
  price: 6_000_000_000,
  date: "2026-09-20",
  paymentStatus: "pending",
  confidence: "self_reported",
  hasConflict: false,
  sources: [
    {
      kind: "owner_report",
      label: "self_reported",
      outcome: "sold",
      price: 6_000_000_000,
      date: "2026-09-20",
      orgName: null,
      sessionCode: null,
      roundNo: 1,
      refId: "o1",
      paymentStatus: "pending",
    },
  ],
  ...over,
});

describe("auctionHasPassed", () => {
  it("treats a date-only auction as passed only from the next day", () => {
    expect(auctionHasPassed("2026-09-25", NOW)).toBe(true);
    expect(auctionHasPassed("2026-09-26", NOW)).toBe(false);
    expect(auctionHasPassed("2026-09-27", NOW)).toBe(false);
  });

  it("compares a timestamp with the current moment", () => {
    expect(auctionHasPassed(new Date(2026, 8, 26, 9, 0).toISOString(), NOW)).toBe(true);
    expect(auctionHasPassed(new Date(2026, 8, 26, 17, 0).toISOString(), NOW)).toBe(false);
  });

  it("is false for missing or garbage values", () => {
    expect(auctionHasPassed(null, NOW)).toBe(false);
    expect(auctionHasPassed("sắp tới", NOW)).toBe(false);
  });
});

describe("selectOutcomeDue", () => {
  it("asks for a passed auction with no outcome", () => {
    const [item, ...rest] = selectOutcomeDue([asset()], {}, NOW);
    expect(rest).toHaveLength(0);
    expect(item).toMatchObject({
      listingId: "l1",
      auctionDay: "2026-09-20",
      daysOverdue: 6,
      startingPrice: 5_000_000_000,
      previous: null,
      assetOwnerId: "ao1",
    });
  });

  it("skips upcoming auctions, auctions today and assets without a date", () => {
    const assets = [
      asset({ id: "a", auctionTime: "2026-10-01" }),
      asset({ id: "b", auctionTime: "2026-09-26" }),
      asset({ id: "c", auctionTime: null }),
    ];
    expect(selectOutcomeDue(assets, {}, NOW)).toEqual([]);
  });

  it("leaves claims awaiting confirmation (and rejected ones) to their own block", () => {
    const assets = [
      asset({ id: "a", claimStatus: "pending_confirmation" }),
      asset({ id: "b", claimStatus: "rejected" }),
      asset({ id: "c", claimStatus: "auto_claimed" }),
    ];
    expect(selectOutcomeDue(assets, {}, NOW).map((i) => i.listingId)).toEqual(["c"]);
  });

  it("drops an asset once any source reports the same round", () => {
    expect(selectOutcomeDue([asset()], { l1: outcome() }, NOW)).toEqual([]);
    // cách 7 ngày vẫn là cùng lượt (luật của RPC)
    expect(selectOutcomeDue([asset()], { l1: outcome({ date: "2026-09-13" }) }, NOW)).toEqual([]);
    // kết quả không ngày (tin cào) phủ lượt này
    expect(selectOutcomeDue([asset()], { l1: outcome({ date: null }) }, NOW)).toEqual([]);
  });

  it("asks again when the only outcome belongs to an earlier round", () => {
    const earlier = outcome({ outcome: "unsold", price: null, date: "2026-02-02" });
    const [item] = selectOutcomeDue([asset({ auctionTime: "2026-07-12" })], { l1: earlier }, NOW);
    expect(item.previous).toBe(earlier);
    expect(item.daysOverdue).toBe(dayDiff("2026-07-12", "2026-09-26"));
  });

  it("still asks when the listing has an outcome row with nothing resolved", () => {
    const empty = outcome({ outcome: null, price: null, date: null, sources: [] });
    expect(selectOutcomeDue([asset()], { l1: empty }, NOW)).toHaveLength(1);
  });

  it("puts the most recent auction first", () => {
    const assets = [
      asset({ id: "old", auctionTime: "2026-05-18T09:00:00+07:00" }),
      asset({ id: "new", auctionTime: "2026-09-20" }),
      asset({ id: "mid", auctionTime: "2026-07-27T09:00:00+07:00" }),
    ];
    expect(selectOutcomeDue(assets, {}, NOW).map((i) => i.listingId)).toEqual(["new", "mid", "old"]);
  });

  it("has no starting price for a zero-priced listing", () => {
    expect(selectOutcomeDue([asset({ price: 0 })], {}, NOW)[0].startingPrice).toBeNull();
  });
});

describe("selectAwaitingPayment", () => {
  it("lists sold outcomes that are unpaid or partly paid", () => {
    const outcomes = {
      a: outcome({ listingId: "a" }),
      b: outcome({ listingId: "b", paymentStatus: "partial" }),
      c: outcome({ listingId: "c", paymentStatus: "paid" }),
      d: outcome({ listingId: "d", paymentStatus: "defaulted" }),
      e: outcome({ listingId: "e", outcome: "unsold", paymentStatus: null }),
      f: outcome({ listingId: "f", paymentStatus: null }),
    };
    const assets = ["a", "b", "c", "d", "e", "f"].map((id) => asset({ id }));
    expect(selectAwaitingPayment(assets, outcomes).map((i) => i.listingId)).toEqual(["a", "b"]);
  });

  it("can write only to the unit's own report", () => {
    const [item] = selectAwaitingPayment([asset()], { l1: outcome() });
    expect(item).toMatchObject({ source: "owner_report", outcomeId: "o1", winningPrice: 6_000_000_000 });
  });

  it("keeps on-platform sales read-only", () => {
    const platform = outcome({
      confidence: "platform",
      sources: [
        {
          kind: "platform",
          label: "platform",
          outcome: "sold",
          price: 28_450_000_000,
          date: "2026-09-13",
          orgName: "Bảo Tín",
          sessionCode: "PDG000013",
          roundNo: null,
          refId: "lot1",
          paymentStatus: "pending",
        },
      ],
    });
    const [item] = selectAwaitingPayment([asset()], { l1: platform });
    expect(item).toMatchObject({ source: "platform", outcomeId: null, sessionCode: "PDG000013" });
  });

  it("puts the longest-waiting sale first", () => {
    const outcomes = {
      a: outcome({ listingId: "a", date: "2026-09-20" }),
      b: outcome({ listingId: "b", date: "2026-06-01" }),
    };
    const assets = [asset({ id: "a" }), asset({ id: "b" })];
    expect(selectAwaitingPayment(assets, outcomes).map((i) => i.listingId)).toEqual(["b", "a"]);
  });
});

describe("applyPulseAccess", () => {
  const items = [{ assetOwnerId: "mine" }, { assetOwnerId: "other" }, { assetOwnerId: null }];
  const canWrite = (id: string | null) => id === "mine";

  it("shows everything, flagging what the user can act on", () => {
    expect(applyPulseAccess(items, canWrite, false).map((i) => i.canWrite)).toEqual([true, false, false]);
  });

  it("shows branch-scoped staff only their own branches", () => {
    expect(applyPulseAccess(items, canWrite, true)).toEqual([{ assetOwnerId: "mine", canWrite: true }]);
  });
});

describe("date labels", () => {
  it("formats days", () => {
    expect(formatDayMonth("2026-09-24")).toBe("24/09");
    expect(formatDayFull("2026-09-24")).toBe("24/09/2026");
  });
});
