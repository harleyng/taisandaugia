import { describe, it, expect } from "vitest";
import {
  overviewRowToTarget,
  recordToFormDefaults,
  recordToTarget,
  toOutcomeUpdate,
  type OwnerOutcomeRecord,
} from "./ownerOutcomeEdit";
import {
  buildOutcomeDefaults,
  isOffPlatformTarget,
  makeReportOutcomeSchema,
  outcomeTargetKey,
  toOutcomeInsert,
  type OffPlatformOutcomeTarget,
} from "./ownerOutcomeReport";
import type { OutcomeOverviewRow } from "./ownerOutcomesOverview";

const TODAY = "2026-09-26";

const rec = (over: Partial<OwnerOutcomeRecord> = {}): OwnerOutcomeRecord =>
  ({
    id: "o1",
    workspace_id: "w1",
    branch_id: "b1",
    listing_id: null,
    asset_posting_id: null,
    asset_title: "Xe tải Hino 2019",
    title_key: "xe tải hino 2019",
    asset_category: "xe-tai",
    round_no: 2,
    auction_date: "2026-09-01",
    auction_org_id: "org1",
    outcome: "unsold",
    failure_reason: "single_bidder",
    starting_price: 800_000_000,
    winning_price: null,
    participants: 1,
    payment_status: "pending",
    paid_amount: null,
    paid_at: null,
    auction_fee: null,
    evidence_urls: [],
    source: "owner_manual",
    share_to_market: false,
    reported_by: "u1",
    conflict_resolution: null,
    created_at: "",
    updated_at: "",
    ...over,
  }) as OwnerOutcomeRecord;

describe("off-platform target", () => {
  const off: OffPlatformOutcomeTarget = { kind: "offplatform" };

  it("is told apart from a listing target and keyed stably", () => {
    expect(isOffPlatformTarget(off)).toBe(true);
    expect(isOffPlatformTarget({ listingId: "l1", title: "x", startingPrice: null, auctionTime: null })).toBe(false);
    expect(outcomeTargetKey(off)).toBe("t:new");
    expect(outcomeTargetKey({ ...off, titleKey: "xe tải" })).toBe("t:xe tải");
    expect(outcomeTargetKey({ listingId: "l1", title: "x", startingPrice: null, auctionTime: null })).toBe("l:l1");
  });

  it("requires a name, and a branch for branch-scoped staff", () => {
    const d = buildOutcomeDefaults(off, [], "unsold", TODAY);
    const issues = (opts: Parameters<typeof makeReportOutcomeSchema>[1], v = d) => {
      const r = makeReportOutcomeSchema(TODAY, opts).safeParse({ ...v, unsoldReason: "other" });
      return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
    };
    expect(issues({ offPlatform: true })).toEqual(["assetTitle"]);
    expect(issues({ offPlatform: true, branchRequired: true }, { ...d, assetTitle: "Xe tải" })).toEqual(["branchId"]);
    expect(issues({ offPlatform: true, branchRequired: true }, { ...d, assetTitle: "Xe tải", branchId: "b1" })).toEqual([]);
    // Tài sản trên sàn không bị ràng buộc tên.
    expect(issues({})).toEqual([]);
  });

  it("builds an off-platform insert from the form fields", () => {
    const d = buildOutcomeDefaults({ ...off, title: "Xe tải", startingPrice: 900_000_000 }, [1], "sold", TODAY);
    expect(d).toMatchObject({ roundNo: "2", auctionDate: TODAY, winningPrice: "900000000", assetTitle: "Xe tải", startingPrice: "900000000" });
    const row = toOutcomeInsert(
      { ...d, assetTitle: "  Xe tải Hino  ", assetCategory: "xe-tai", auctionOrgId: "org1", branchId: "b1", winningPrice: "950000000" },
      { id: "o9", workspaceId: "w1", target: off, reportedBy: "u1" },
    );
    expect(row).toMatchObject({
      listing_id: null,
      asset_title: "Xe tải Hino",
      asset_category: "xe-tai",
      auction_org_id: "org1",
      branch_id: "b1",
      starting_price: 900_000_000,
      winning_price: 950_000_000,
      round_no: 2,
      outcome: "sold",
    });
  });
});

describe("edit mode", () => {
  it("maps an unsold record with a coded reason back to the form", () => {
    expect(recordToFormDefaults(rec())).toMatchObject({
      kind: "unsold",
      roundNo: "2",
      unsoldReason: "single_bidder",
      note: "",
      assetTitle: "Xe tải Hino 2019",
      branchId: "b1",
      startingPrice: "800000000",
    });
  });

  it("maps free-text reasons to 'other' and void outcomes to their kind", () => {
    expect(recordToFormDefaults(rec({ failure_reason: "Tranh chấp" }))).toMatchObject({ unsoldReason: "other", note: "Tranh chấp" });
    expect(recordToFormDefaults(rec({ outcome: "cancelled", failure_reason: "Có quyết định dừng" }))).toMatchObject({
      kind: "void",
      voidOutcome: "cancelled",
      note: "Có quyết định dừng",
    });
  });

  it("round-trips a sold listing record without touching listing-only columns", () => {
    const r = rec({ listing_id: "l1", asset_title: null, title_key: null, outcome: "sold", winning_price: 6_000_000_000, participants: 3, failure_reason: null });
    const form = recordToFormDefaults(r);
    expect(form.assetTitle).toBeUndefined();
    const patch = toOutcomeUpdate({ ...form, winningPrice: "6100000000" }, r);
    expect(patch).toEqual({
      round_no: 2,
      auction_date: "2026-09-01",
      outcome: "sold",
      failure_reason: null,
      winning_price: 6_100_000_000,
      participants: 3,
    });
  });

  it("updates the asset fields of an off-platform record", () => {
    const patch = toOutcomeUpdate({ ...recordToFormDefaults(rec()), assetTitle: "Xe tải Hino 2020" }, rec());
    expect(patch).toMatchObject({ asset_title: "Xe tải Hino 2020", branch_id: "b1", starting_price: 800_000_000, participants: 1 });
  });

  it("builds next-round targets from a record or an overview row", () => {
    expect(recordToTarget(rec({ listing_id: "l1" }), "Nhà Q7")).toMatchObject({ listingId: "l1", title: "Nhà Q7" });
    const row = { listingId: null, title: "Xe tải", titleKey: "xe tải", category: null, branchId: "b2", startingPrice: null } as OutcomeOverviewRow;
    expect(overviewRowToTarget(row, rec())).toMatchObject({ kind: "offplatform", titleKey: "xe tải", branchId: "b1", auctionOrgId: "org1" });
    expect(overviewRowToTarget(row)).toMatchObject({ kind: "offplatform", branchId: "b2", auctionOrgId: null });
  });
});
