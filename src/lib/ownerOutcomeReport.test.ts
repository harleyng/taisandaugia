import { describe, it, expect } from "vitest";
import type { AssetOwnerClaim } from "@/types/asset-owner";
import {
  buildOutcomeDefaults,
  claimToReportTarget,
  evidenceObjectPath,
  isoDayOf,
  makeReportOutcomeSchema,
  outcomeErrorMessage,
  toOutcomeInsert,
  validateEvidenceFile,
  type ReportOutcomeForm,
  type ReportOutcomeTarget,
} from "./ownerOutcomeReport";

const TODAY = "2026-09-26";
const target: ReportOutcomeTarget = {
  listingId: "l1",
  title: "Nhà đất Q.7",
  startingPrice: 5_000_000_000,
  auctionTime: "2026-09-24T09:00:00+07:00",
};
const ctx = { id: "o1", workspaceId: "w1", target, reportedBy: "u1" };
const schema = makeReportOutcomeSchema(TODAY);
const defaults = buildOutcomeDefaults(target, [], "sold", TODAY);
const issuesOf = (v: ReportOutcomeForm) => {
  const r = schema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("buildOutcomeDefaults", () => {
  it("prefills the winning price with the starting price and uses the past auction date", () => {
    expect(defaults).toMatchObject({ kind: "sold", roundNo: "1", auctionDate: "2026-09-24", winningPrice: "5000000000" });
  });

  it("uses the highest reported round + 1, even with a gap", () => {
    expect(buildOutcomeDefaults(target, [1, 2], "sold", TODAY).roundNo).toBe("3");
    expect(buildOutcomeDefaults(target, [1, 3], "sold", TODAY).roundNo).toBe("4");
  });

  it("falls back to today when the auction is in the future or unknown", () => {
    expect(buildOutcomeDefaults({ ...target, auctionTime: "2026-10-05" }, [], "sold", TODAY).auctionDate).toBe(TODAY);
    expect(buildOutcomeDefaults({ ...target, auctionTime: null }, [], "sold", TODAY).auctionDate).toBe(TODAY);
    expect(buildOutcomeDefaults({ ...target, auctionTime: "rác" }, [], "sold", TODAY).auctionDate).toBe(TODAY);
  });

  it("leaves the price empty without a starting price and honours a preselected kind", () => {
    const d = buildOutcomeDefaults({ ...target, startingPrice: null }, [], "unsold", TODAY);
    expect(d.winningPrice).toBe("");
    expect(d.kind).toBe("unsold");
  });
});

describe("isoDayOf", () => {
  it("keeps plain dates and reads the day of a timestamp", () => {
    expect(isoDayOf("2026-09-24")).toBe("2026-09-24");
    expect(isoDayOf("2026-09-24T09:00:00+07:00")).toMatch(/^2026-09-2[34]$/);
    expect(isoDayOf("")).toBeNull();
    expect(isoDayOf("không rõ")).toBeNull();
  });
});

describe("makeReportOutcomeSchema", () => {
  it("accepts a complete sold report", () => {
    expect(issuesOf({ ...defaults, participants: "3" })).toEqual([]);
  });

  it("requires a positive winning price and at least one participant when sold", () => {
    expect(issuesOf({ ...defaults, winningPrice: "" })).toContain("winningPrice");
    expect(issuesOf({ ...defaults, winningPrice: "0" })).toContain("winningPrice");
    expect(issuesOf({ ...defaults, participants: "0" })).toContain("participants");
  });

  it("requires a reason when unsold, but not a price", () => {
    const unsold = { ...defaults, kind: "unsold" as const, winningPrice: "" };
    expect(issuesOf(unsold)).toEqual(["unsoldReason"]);
    expect(issuesOf({ ...unsold, unsoldReason: "single_bidder" })).toEqual([]);
  });

  it("accepts a postponed report with no other field", () => {
    expect(issuesOf({ ...defaults, kind: "void", winningPrice: "" })).toEqual([]);
  });

  it("rejects future dates, round 0 and non-digit money", () => {
    expect(issuesOf({ ...defaults, auctionDate: "2026-09-27" })).toContain("auctionDate");
    expect(issuesOf({ ...defaults, roundNo: "0" })).toContain("roundNo");
    expect(issuesOf({ ...defaults, winningPrice: "5,000" })).toContain("winningPrice");
  });
});

describe("toOutcomeInsert", () => {
  it("maps a sold report", () => {
    expect(toOutcomeInsert({ ...defaults, winningPrice: "6200000000", participants: "4" }, ctx)).toEqual({
      id: "o1",
      workspace_id: "w1",
      listing_id: "l1",
      round_no: 1,
      auction_date: "2026-09-24",
      outcome: "sold",
      failure_reason: null,
      starting_price: 5_000_000_000,
      winning_price: 6_200_000_000,
      participants: 4,
      source: "owner_manual",
      reported_by: "u1",
    });
  });

  it("derives participants from the quick unsold reasons and drops the price", () => {
    const unsold = { ...defaults, kind: "unsold" as const };
    expect(toOutcomeInsert({ ...unsold, unsoldReason: "no_registrants" }, ctx)).toMatchObject({
      outcome: "unsold", failure_reason: "no_registrants", participants: 0, winning_price: null,
    });
    expect(toOutcomeInsert({ ...unsold, unsoldReason: "single_bidder" }, ctx)).toMatchObject({ participants: 1 });
    expect(toOutcomeInsert({ ...unsold, unsoldReason: "deposit_forfeited" }, ctx)).toMatchObject({ participants: null });
  });

  it("stores the typed note for 'Khác', or 'other' when empty", () => {
    const other = { ...defaults, kind: "unsold" as const, unsoldReason: "other" as const };
    expect(toOutcomeInsert({ ...other, note: "  Tranh chấp pháp lý " }, ctx).failure_reason).toBe("Tranh chấp pháp lý");
    expect(toOutcomeInsert(other, ctx).failure_reason).toBe("other");
  });

  it("maps Hoãn-Huỷ to the chosen outcome with an optional reason", () => {
    const v = { ...defaults, kind: "void" as const, voidOutcome: "cancelled" as const };
    expect(toOutcomeInsert(v, ctx)).toMatchObject({ outcome: "cancelled", failure_reason: null, participants: null, winning_price: null });
    expect(toOutcomeInsert({ ...v, note: "Có quyết định tạm dừng" }, ctx).failure_reason).toBe("Có quyết định tạm dừng");
  });
});

describe("evidence", () => {
  it("builds a path under {workspace}/{outcome}/ with a safe file name", () => {
    expect(evidenceObjectPath("w1", "o1", "Biên bản phiên 1.pdf", 1)).toBe("w1/o1/bien-ban-1-Bien_ban_phien_1.pdf");
  });

  it("accepts PDF/JPG/PNG up to 10MB only", () => {
    expect(validateEvidenceFile({ type: "application/pdf", size: 1024 })).toBeNull();
    expect(validateEvidenceFile({ type: "image/webp", size: 1024 })).toMatch(/PDF, JPG hoặc PNG/);
    expect(validateEvidenceFile({ type: "image/png", size: 11 * 1024 * 1024 })).toMatch(/10MB/);
  });
});

describe("outcomeErrorMessage", () => {
  it("explains duplicate rounds, missing permission and guard errors in Vietnamese", () => {
    expect(outcomeErrorMessage({ code: "23505" }, 2)).toBe("Lượt 2 đã được khai cho tài sản này. Chọn lượt khác.");
    expect(outcomeErrorMessage({ code: "42501" })).toMatch(/không có quyền/);
    expect(outcomeErrorMessage({ code: "P0001", message: "Tài sản này không thuộc danh mục của đơn vị" }))
      .toBe("Tài sản này không thuộc danh mục của đơn vị");
    expect(outcomeErrorMessage(new Error("network"))).toMatch(/Không lưu được/);
  });
});

describe("claimToReportTarget", () => {
  const claim = {
    id: "c1",
    listing_id: "l1",
    listing: {
      title: "Nhà đất Q.7",
      price: 5_000_000_000,
      property_type_slug: null,
      image_url: null,
      status: "ACTIVE",
      address: null,
      custom_attributes: { auction_time: "2026-09-24T09:00:00+07:00" },
    },
  } as unknown as AssetOwnerClaim;

  it("reads title, starting price and auction time from the claimed listing", () => {
    expect(claimToReportTarget(claim)).toEqual({
      listingId: "l1",
      title: "Nhà đất Q.7",
      startingPrice: 5_000_000_000,
      auctionTime: "2026-09-24T09:00:00+07:00",
    });
  });

  it("returns null without a listing and tolerates a missing price or date", () => {
    expect(claimToReportTarget({ ...claim, listing_id: null })).toBeNull();
    const bare = { ...claim, listing: { ...claim.listing!, price: null as number | null, custom_attributes: null } } as AssetOwnerClaim;
    expect(claimToReportTarget(bare)).toMatchObject({ startingPrice: null, auctionTime: null });
  });
});
