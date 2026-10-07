import { describe, expect, it } from "vitest";
import { decisionNeedsNote, reviewActionsFor, type ReviewableContract } from "./review";

const base: ReviewableContract = {
  status: "paid",
  review_status: "pending",
  checked_in_at: null,
  absent_at: null,
  auction_sessions: { status: "published", roster_closed_at: null },
};

describe("reviewActionsFor", () => {
  it("chuyển trạng thái đúng như v_ok của RPC", () => {
    expect(reviewActionsFor(base).decisions).toEqual(["approved", "needs_info", "rejected"]);
    expect(reviewActionsFor({ ...base, review_status: "needs_info" }).decisions).toEqual(["approved", "rejected"]);
    expect(reviewActionsFor({ ...base, review_status: "approved" }).decisions).toEqual(["needs_info", "rejected"]);
  });

  it("đã từ chối / hoàn tiền thì khoá", () => {
    const r = reviewActionsFor({ ...base, status: "refunded", review_status: "rejected" });
    expect(r.decisions).toEqual([]);
    expect(r.blockedNote).toMatch(/từ chối/);
  });

  it("chưa thanh toán hoặc phiên không còn công bố thì khoá", () => {
    expect(reviewActionsFor({ ...base, status: "pending_payment" }).decisions).toEqual([]);
    expect(reviewActionsFor({ ...base, auction_sessions: { status: "cancelled", roster_closed_at: null } }).blockedNote)
      .toMatch(/công bố/);
    expect(reviewActionsFor({ ...base, auction_sessions: null }).decisions).toEqual([]);
  });

  it("đã điểm danh hoặc đã chốt danh sách thì khoá (trigger review_lock)", () => {
    const approved = { ...base, review_status: "approved" as const };
    expect(reviewActionsFor({ ...approved, checked_in_at: "2026-10-08T01:00:00Z" }).blockedNote).toMatch(/điểm danh/);
    expect(reviewActionsFor({ ...approved, absent_at: "2026-10-08T01:00:00Z" }).blockedNote).toMatch(/chốt/);
    expect(
      reviewActionsFor({ ...approved, auction_sessions: { status: "published", roster_closed_at: "2026-10-08T01:00:00Z" } })
        .decisions,
    ).toEqual([]);
  });
});

describe("decisionNeedsNote", () => {
  it("chỉ duyệt mới không cần lý do", () => {
    expect(decisionNeedsNote("approved")).toBe(false);
    expect(decisionNeedsNote("needs_info")).toBe(true);
    expect(decisionNeedsNote("rejected")).toBe(true);
  });
});
