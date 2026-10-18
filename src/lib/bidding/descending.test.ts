import { describe, expect, it } from "vitest";
import {
  descendingDurationSeconds,
  descendingPriceAt,
  dropsLeft,
  floorPriceError,
  nextDropAt,
  previewDescendingEndsAt,
  validateAccept,
} from "./descending";
import type { BidSession } from "./rules";
import type { LotState } from "@/types/auction-bidding";

const START = 1_000_000_000;
const STEP = 10_000_000;
const FLOOR = 900_000_000;
const lot = { starting_price: START, bid_step: STEP, floor_price: FLOOR };
const OPEN = "2026-10-10T10:00:00Z";
const at = (sec: number) => new Date(Date.parse(OPEN) + sec * 1000);

const state = (patch: Partial<LotState> = {}): LotState =>
  ({
    lot_id: "lot-1",
    session_id: "s-1",
    status: "open",
    opened_at: OPEN,
    ends_at: at(660).toISOString(),
    paused_at: null,
    price_anchor_at: OPEN,
    price_anchor_amount: START,
    bid_count: 0,
    extension_count: 0,
    round_no: 1,
    ...patch,
  }) as LotState;

const session: BidSession = {
  status: "published",
  auction_format: "truc_tuyen",
  starts_at: "2026-10-10T09:00:00Z",
  max_bid_steps: 5,
  bidding_method: "descending",
};

describe("descendingPriceAt — bản sao _descending_price", () => {
  it("giảm một bước sau mỗi nhịp, tính theo phần nguyên", () => {
    expect(descendingPriceAt(state(), lot, 60, at(0))).toBe(START);
    expect(descendingPriceAt(state(), lot, 60, at(59))).toBe(START);
    expect(descendingPriceAt(state(), lot, 60, at(60))).toBe(START - STEP);
    expect(descendingPriceAt(state(), lot, 60, at(125))).toBe(START - 2 * STEP);
  });

  it("không bao giờ thấp hơn giá sàn", () => {
    expect(descendingPriceAt(state(), lot, 60, at(60 * 50))).toBe(FLOOR);
  });

  it("đứng yên ở paused_at khi tạm dừng", () => {
    const paused = state({ status: "paused", paused_at: at(130).toISOString() });
    expect(descendingPriceAt(paused, lot, 60, at(600))).toBe(START - 2 * STEP);
  });

  it("thiếu mốc hoặc giá sàn ⇒ null", () => {
    expect(descendingPriceAt(state({ price_anchor_at: null }), lot, 60, at(0))).toBeNull();
    expect(descendingPriceAt(state(), { ...lot, floor_price: null }, 60, at(0))).toBeNull();
  });
});

describe("nhịp giảm + thời lượng", () => {
  it("mốc giảm kế tiếp; null khi đã chạm sàn hoặc tạm dừng", () => {
    expect(nextDropAt(state(), lot, 60, at(125))?.toISOString()).toBe(at(180).toISOString());
    expect(nextDropAt(state(), lot, 60, at(60 * 50))).toBeNull();
    expect(nextDropAt(state({ status: "paused", paused_at: at(10).toISOString() }), lot, 60, at(20))).toBeNull();
  });

  it("số lần giảm còn lại", () => {
    expect(dropsLeft(START - 2 * STEP, lot)).toBe(8);
    expect(dropsLeft(FLOOR, lot)).toBe(0);
  });

  it("thời lượng = (số bước tới sàn + 1) × nhịp — khớp _lot_open_ends", () => {
    expect(descendingDurationSeconds(lot, 60)).toBe(660);
  });

  it("xem trước bị giờ kết thúc phiên cắt ngắn", () => {
    const now = new Date(OPEN);
    expect(previewDescendingEndsAt(now, lot, 60, "2026-10-10T12:00:00Z")).toEqual({
      endsAt: at(660).toISOString(),
      clamped: false,
    });
    expect(previewDescendingEndsAt(now, lot, 60, at(300).toISOString())?.clamped).toBe(true);
  });
});

describe("floorPriceError — khớp _lot_open_reject", () => {
  it("bắt buộc, ≤ giá khởi điểm, trên lưới bước giá", () => {
    expect(floorPriceError(START, STEP, null)).toMatch(/cần giá sàn/);
    expect(floorPriceError(START, STEP, START + STEP)).toMatch(/không được cao hơn/);
    expect(floorPriceError(START, STEP, FLOOR + 5_000_000)).toMatch(/số tròn bước giá/);
    expect(floorPriceError(START, STEP, FLOOR)).toBeNull();
    expect(floorPriceError(START, STEP, START)).toBeNull();
  });
});

describe("validateAccept — thứ tự của accept_descending_price", () => {
  const base = {
    lot,
    state: state(),
    session,
    bidderNo: 7,
    eligible: true,
    userId: "u-1",
    nonce: "nonce-1234",
    now: at(30),
  };

  it("hợp lệ ⇒ null (price_changed chỉ server biết)", () => {
    expect(validateAccept(base)).toBeNull();
  });

  it("phiên khác phương thức ⇒ method_mismatch", () => {
    expect(validateAccept({ ...base, session: { ...session, bidding_method: "ascending" } })).toBe("method_mismatch");
  });

  it("tạm dừng / hết giờ / chưa đủ điều kiện / nonce", () => {
    expect(validateAccept({ ...base, state: state({ status: "paused", paused_at: at(10).toISOString() }) })).toBe(
      "lot_paused",
    );
    expect(validateAccept({ ...base, now: at(700) })).toBe("lot_closed");
    expect(validateAccept({ ...base, eligible: false })).toBe("not_eligible");
    expect(validateAccept({ ...base, nonce: "short" })).toBe("invalid_nonce");
  });
});
