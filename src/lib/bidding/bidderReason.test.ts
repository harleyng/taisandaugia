import { describe, expect, it } from "vitest";
import { bidderBlockReasonOf, type BidderReasonContract } from "./bidderReason";

const ready = (patch: Partial<BidderReasonContract> = {}): BidderReasonContract => ({
  status: "paid",
  review_status: "approved",
  deposit_status: "received",
  checked_in_at: "2026-10-10T01:30:00Z",
  absent_at: null,
  bidder_no: 17,
  ...patch,
});

describe("bidderBlockReasonOf", () => {
  it("đã duyệt + đã nhận tiền + đã điểm danh + có số ⇒ đủ điều kiện", () => {
    expect(bidderBlockReasonOf(ready())).toBeNull();
  });

  it("không có hồ sơ / chưa thanh toán", () => {
    expect(bidderBlockReasonOf(null)).toBe("no_contract");
    expect(bidderBlockReasonOf(ready({ status: "pending_payment" }))).toBe("unpaid");
  });

  it("chưa điểm danh ⇒ not_checked_in (không phải no_bidder_no)", () => {
    expect(bidderBlockReasonOf(ready({ checked_in_at: null, bidder_no: null }))).toBe("not_checked_in");
  });

  it("hồ sơ chưa duyệt xét TRƯỚC tiền đặt trước, như _checkin_block_reason", () => {
    const c: Partial<BidderReasonContract> = { checked_in_at: null, bidder_no: null };
    expect(bidderBlockReasonOf(ready({ ...c, review_status: "pending", deposit_status: "pending" }))).toBe(
      "review_pending",
    );
    expect(bidderBlockReasonOf(ready({ ...c, review_status: "needs_info" }))).toBe("review_needs_info");
    expect(bidderBlockReasonOf(ready({ ...c, deposit_status: "pending" }))).toBe("no_deposit");
  });

  it("vắng mặt thắng mọi nhánh tiền đặt trước", () => {
    const absent: Partial<BidderReasonContract> = { absent_at: "2026-10-10T02:00:00Z", checked_in_at: null, bidder_no: null };
    expect(bidderBlockReasonOf(ready({ ...absent, deposit_status: "forfeited" }))).toBe("absent");
    expect(bidderBlockReasonOf(ready({ ...absent, deposit_status: "pending_refund" }))).toBe("absent");
  });

  it("đã chốt phiên ⇒ settled / refunded, kể cả người đã điểm danh", () => {
    expect(bidderBlockReasonOf(ready({ deposit_status: "applied" }))).toBe("settled");
    expect(bidderBlockReasonOf(ready({ deposit_status: "pending_refund" }))).toBe("settled");
    expect(bidderBlockReasonOf(ready({ deposit_status: "refunded" }))).toBe("refunded");
  });

  it("đã điểm danh thì không hỏi lại duyệt (dữ liệu cũ backfill)", () => {
    expect(bidderBlockReasonOf(ready({ review_status: "pending" }))).toBeNull();
  });

  it("đã điểm danh mà thiếu số báo danh ⇒ no_bidder_no", () => {
    expect(bidderBlockReasonOf(ready({ bidder_no: null }))).toBe("no_bidder_no");
  });
});
