import { describe, expect, it } from "vitest";
import { groupByRound, inCurrentRound, myRoundBid, roundLabel, sealedMinBid, validateSealedBid } from "./sealed";
import type { BidSession } from "./rules";
import type { LotState, SealedBid } from "@/types/auction-bidding";

const START = 1_000_000_000;
const STEP = 10_000_000;
const lot = { starting_price: START, bid_step: STEP };
const NOW = new Date("2026-10-10T10:05:00Z");

const state = (patch: Partial<LotState> = {}): LotState =>
  ({
    lot_id: "lot-1",
    session_id: "s-1",
    status: "open",
    opened_at: "2026-10-10T10:00:00Z",
    ends_at: "2026-10-10T10:10:00Z",
    bid_count: 0,
    extension_count: 0,
    round_no: 1,
    round_bid_count: 0,
    tie_amount: null,
    tied_bidder_nos: null,
    ...patch,
  }) as LotState;

const tieRound = () => state({ round_no: 2, tie_amount: 1_100_000_000, tied_bidder_nos: [3, 8] });

const session: BidSession = {
  status: "published",
  auction_format: "truc_tuyen",
  starts_at: "2026-10-10T09:00:00Z",
  max_bid_steps: 5,
  bidding_method: "sealed",
};

const bid = (patch: Partial<SealedBid>): SealedBid => ({
  id: "b",
  lot_id: "lot-1",
  session_id: "s-1",
  contract_id: "c-1",
  bidder_no: 3,
  round_no: 1,
  amount: START,
  placed_at: "2026-10-10T10:01:00Z",
  client_nonce: "nonce-1234",
  ...patch,
});

describe("vòng và giá tối thiểu", () => {
  it("vòng 1 từ giá khởi điểm; vòng phụ từ giá bằng nhau", () => {
    expect(sealedMinBid(state(), lot)).toBe(START);
    expect(sealedMinBid(tieRound(), lot)).toBe(1_100_000_000);
  });

  it("vòng phụ chỉ cho số báo danh bằng giá", () => {
    expect(inCurrentRound(state(), 5)).toBe(true);
    expect(inCurrentRound(tieRound(), 3)).toBe(true);
    expect(inCurrentRound(tieRound(), 5)).toBe(false);
  });

  it("nhãn vòng", () => {
    expect(roundLabel(1)).toBe("Vòng 1");
    expect(roundLabel(3)).toBe("Vòng phụ 2");
  });
});

describe("validateSealedBid — thứ tự của submit_sealed_bid", () => {
  const base = {
    amount: START + 2 * STEP,
    lot,
    state: state(),
    session,
    bidderNo: 3,
    eligible: true,
    userId: "u-1",
    nonce: "nonce-1234",
    now: NOW,
    alreadySubmitted: false,
  };

  it("hợp lệ ⇒ null; không có trần số bước như trả giá lên", () => {
    expect(validateSealedBid(base)).toBeNull();
    expect(validateSealedBid({ ...base, amount: START + 500 * STEP })).toBeNull();
  });

  it("bằng giá đang chờ vòng phụ ⇒ round_closed", () => {
    expect(validateSealedBid({ ...base, state: state({ status: "tied", tie_amount: START, tied_bidder_nos: [3, 8] }) })).toBe(
      "round_closed",
    );
  });

  it("not_in_tie_round trước already_submitted trước giá", () => {
    expect(validateSealedBid({ ...base, state: tieRound(), bidderNo: 5, alreadySubmitted: true, amount: 1 })).toBe(
      "not_in_tie_round",
    );
    expect(validateSealedBid({ ...base, alreadySubmitted: true, amount: 1 })).toBe("already_submitted");
  });

  it("giá thấp / lệch lưới", () => {
    expect(validateSealedBid({ ...base, amount: START - STEP })).toBe("bid_too_low");
    expect(validateSealedBid({ ...base, state: tieRound(), amount: 1_090_000_000 })).toBe("bid_too_low");
    expect(validateSealedBid({ ...base, amount: START + 5_000_000 })).toBe("bid_step_mismatch");
  });

  it("phiên khác phương thức ⇒ method_mismatch", () => {
    expect(validateSealedBid({ ...base, session: { ...session, bidding_method: "ascending" } })).toBe("method_mismatch");
  });
});

describe("đọc phiếu", () => {
  it("phiếu của mình theo vòng", () => {
    const bids = [bid({ id: "a", round_no: 1 }), bid({ id: "b", round_no: 2 }), bid({ id: "c", contract_id: "c-2" })];
    expect(myRoundBid(bids, "c-1", 2)?.id).toBe("b");
    expect(myRoundBid(bids, "c-9", 1)).toBeNull();
  });

  it("nhóm theo vòng: vòng mới trước, giá cao trước, cùng giá thì nộp sớm trước", () => {
    const groups = groupByRound([
      bid({ id: "a", round_no: 1, amount: START }),
      bid({ id: "b", round_no: 1, amount: START + STEP, placed_at: "2026-10-10T10:03:00Z" }),
      bid({ id: "c", round_no: 1, amount: START + STEP, placed_at: "2026-10-10T10:02:00Z" }),
      bid({ id: "d", round_no: 2, amount: START + 2 * STEP }),
    ]);
    expect(groups.map((g) => g.roundNo)).toEqual([2, 1]);
    expect(groups[1].bids.map((b) => b.id)).toEqual(["c", "b", "a"]);
  });
});
