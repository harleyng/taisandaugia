import { describe, expect, it } from "vitest";
import { pushCandidateNote, pushMarketingCandidates, type PushInput } from "./pushCandidates";

const TODAY = "2026-10-01";

const row = (over: Partial<PushInput> & Pick<PushInput, "id">): PushInput => ({
  title: `Tài sản ${over.id}`,
  price: 1_000_000_000,
  claimStatus: "confirmed",
  resolvedOutcome: null,
  priceHistory: [],
  registrationDeadline: null,
  auctionTime: null,
  assetOwnerId: null,
  ...over,
});

const days = (...d: string[]) => d.map((date) => ({ date }));

describe("pushMarketingCandidates", () => {
  it("chọn tài sản có ≥ 2 phiên đã qua mà chưa bán", () => {
    const out = pushMarketingCandidates(
      [
        row({ id: "a", priceHistory: days("2026-07-15", "2026-08-26") }),
        row({ id: "b", priceHistory: days("2026-08-26") }),
        // phiên hôm nay chưa tính là đã qua
        row({ id: "c", priceHistory: days("2026-08-26", TODAY) }),
      ],
      new Map(),
      TODAY,
    );
    expect(out.map((c) => c.listingId)).toEqual(["a"]);
    expect(out[0]).toMatchObject({ failedRounds: 2, reasons: ["failed_rounds"] });
  });

  it("bỏ tài sản đã bán và claim chưa xác nhận", () => {
    const failed = days("2026-07-15", "2026-08-26");
    const out = pushMarketingCandidates(
      [
        row({ id: "sold", priceHistory: failed, resolvedOutcome: "sold" }),
        row({ id: "pending", priceHistory: failed, claimStatus: "pending_confirmation" }),
        row({ id: "auto", priceHistory: failed, claimStatus: "auto_claimed" }),
      ],
      new Map(),
      TODAY,
    );
    expect(out.map((c) => c.listingId)).toEqual(["auto"]);
  });

  it("còn ≤ 5 ngày tới hạn đăng ký và < 3 hồ sơ ⇒ ít đăng ký", () => {
    const regs = new Map([
      ["enough", 3],
      ["few", 2],
    ]);
    const out = pushMarketingCandidates(
      [
        row({ id: "few", registrationDeadline: "2026-10-04T17:00:00+07:00" }),
        row({ id: "enough", registrationDeadline: "2026-10-04T17:00:00+07:00" }),
        row({ id: "far", registrationDeadline: "2026-10-07T17:00:00+07:00" }),
        row({ id: "past", registrationDeadline: "2026-09-30T17:00:00+07:00" }),
        // không có phiên trên sàn ⇒ 0 hồ sơ
        row({ id: "offplatform", registrationDeadline: "2026-10-06T17:00:00+07:00" }),
      ],
      regs,
      TODAY,
    );
    expect(out.map((c) => [c.listingId, c.deadlineInDays, c.registrations])).toEqual([
      ["few", 3, 2],
      ["offplatform", 5, 0],
    ]);
  });

  it("xếp: sắp hết hạn → còn phiên sắp tới → còn lại", () => {
    const failed = days("2026-05-01", "2026-06-01", "2026-07-01");
    const out = pushMarketingCandidates(
      [
        row({ id: "stuck-no-session", priceHistory: failed }),
        row({ id: "stuck-upcoming", priceHistory: days("2026-07-15", "2026-08-26"), auctionTime: "2026-12-18T09:00:00+07:00" }),
        row({ id: "deadline", registrationDeadline: "2026-10-02" }),
      ],
      new Map(),
      TODAY,
    );
    expect(out.map((c) => c.listingId)).toEqual(["deadline", "stuck-upcoming", "stuck-no-session"]);
  });

  it("ghi chú theo lý do đứng đầu", () => {
    const [deadline] = pushMarketingCandidates([row({ id: "d", title: "Đất nền", registrationDeadline: TODAY })], new Map(), TODAY);
    expect(pushCandidateNote(deadline)).toBe("Đất nền — hết hạn đăng ký hôm nay, 0 hồ sơ");
    const [stuck] = pushMarketingCandidates(
      [row({ id: "s", title: "Nhà phố", priceHistory: days("2026-07-15", "2026-08-26") })],
      new Map(),
      TODAY,
    );
    expect(pushCandidateNote(stuck)).toBe("Nhà phố — 2 phiên không thành");
  });
});
