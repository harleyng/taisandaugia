import { describe, expect, it } from "vitest";
import { maxBid, nextMinBid, quickSteps, validateBid, type BidLot, type BidSession } from "./rules";
import type { LotState } from "@/types/auction-bidding";

const at = (iso: string) => new Date(iso);
const NOW = at("2026-10-10T10:00:00Z");

// Số liệu lấy từ lô 1 của phiên demo PDG000013.
const START = 6_400_000_000;
const STEP = 50_000_000;

const lot: BidLot = { starting_price: START, bid_step: STEP };

const session = (patch: Partial<BidSession> = {}): BidSession => ({
  status: "published",
  auction_format: "ca_hai",
  starts_at: "2026-10-10T09:00:00Z",
  max_bid_steps: 10,
  ...patch,
});

const lotState = (patch: Partial<LotState> = {}): LotState => ({
  lot_id: "11111111-1111-1111-1111-111111111111",
  session_id: "22222222-2222-2222-2222-222222222222",
  status: "open",
  opened_at: "2026-10-10T09:00:00Z",
  paused_at: null,
  closed_at: null,
  ends_at: "2026-10-10T11:00:00Z",
  pause_reason: null,
  withdraw_reason: null,
  current_price: null,
  current_bid_id: null,
  leading_bidder_no: null,
  bid_count: 0,
  extension_count: 0,
  result: null,
  winner_contract_id: null,
  winning_amount: null,
  payment_due_at: null,
  payment_status: null,
  payment_confirmed_at: null,
  created_at: "2026-10-10T09:00:00Z",
  updated_at: "2026-10-10T09:00:00Z",
  ...patch,
});

const base = {
  amount: START,
  lot,
  state: lotState(),
  session: session(),
  bidderNo: 1,
  eligible: true,
  userId: "u1",
  nonce: "nonce-1234",
  now: NOW,
};

describe("nextMinBid / maxBid", () => {
  it("lượt đầu = ĐÚNG giá khởi điểm, không phải giá khởi điểm + 1 bước", () => {
    expect(nextMinBid(lotState(), lot)).toBe(START);
  });

  it("sau khi có giá = giá hiện tại + 1 bước", () => {
    expect(nextMinBid(lotState({ current_price: START }), lot)).toBe(START + STEP);
  });

  it("trần tính CẢ lượt đang trả là bước thứ 1", () => {
    // 10 bước ⇒ lượt đầu cao nhất = khởi điểm + 9 bước.
    expect(maxBid(lotState(), lot, 10)).toBe(START + 9 * STEP);
    expect(maxBid(lotState({ current_price: START }), lot, 10)).toBe(START + 10 * STEP);
  });

  it("lô thiếu giá khởi điểm / bước giá ⇒ null", () => {
    expect(nextMinBid(lotState(), { starting_price: null, bid_step: STEP })).toBeNull();
    expect(nextMinBid(lotState(), { starting_price: START, bid_step: null })).toBeNull();
  });
});

describe("validateBid — các chốt trước khi xét số tiền", () => {
  it("đủ điều kiện ⇒ null", () => {
    expect(validateBid(base)).toBeNull();
  });

  it("chưa đăng nhập ⇒ not_authenticated", () => {
    expect(validateBid({ ...base, userId: null })).toBe("not_authenticated");
  });

  it("không có lô ⇒ lot_not_found; lô thiếu cấu hình giá ⇒ lot_not_configured", () => {
    expect(validateBid({ ...base, lot: null })).toBe("lot_not_found");
    expect(validateBid({ ...base, lot: { starting_price: null, bid_step: STEP } })).toBe("lot_not_configured");
    expect(validateBid({ ...base, lot: { starting_price: START, bid_step: 0 } })).toBe("lot_not_configured");
  });

  it("phiên chưa công bố / sai hình thức / chưa tới giờ ⇒ session_not_live", () => {
    expect(validateBid({ ...base, session: session({ status: "draft" }) })).toBe("session_not_live");
    expect(validateBid({ ...base, session: session({ auction_format: "truc_tiep" }) })).toBe("session_not_live");
    expect(validateBid({ ...base, now: at("2026-10-10T08:59:00Z") })).toBe("session_not_live");
  });

  it("đấu giá trực tuyến thuần cũng hợp lệ", () => {
    expect(validateBid({ ...base, session: session({ auction_format: "truc_tuyen" }) })).toBeNull();
  });

  it("lô chưa mở / đã rút ⇒ lot_not_open; không có dòng trạng thái cũng vậy", () => {
    expect(validateBid({ ...base, state: null })).toBe("lot_not_open");
    expect(validateBid({ ...base, state: lotState({ status: "pending" }) })).toBe("lot_not_open");
    expect(validateBid({ ...base, state: lotState({ status: "withdrawn" }) })).toBe("lot_not_open");
  });

  it("đang tạm dừng ⇒ lot_paused", () => {
    expect(validateBid({ ...base, state: lotState({ status: "paused" }) })).toBe("lot_paused");
  });

  it("quá ends_at ⇒ lot_closed (không chờ cron)", () => {
    expect(validateBid({ ...base, now: at("2026-10-10T11:00:00Z") })).toBe("lot_closed");
  });

  it("chưa nộp tiền đặt trước / chưa có số báo danh ⇒ not_eligible", () => {
    expect(validateBid({ ...base, eligible: false })).toBe("not_eligible");
    expect(validateBid({ ...base, bidderNo: null })).toBe("not_eligible");
  });

  it("đang là người trả cao nhất ⇒ already_leading", () => {
    const state = lotState({ current_price: START, current_bid_id: "b1", leading_bidder_no: 1 });
    expect(validateBid({ ...base, state, amount: START + STEP })).toBe("already_leading");
  });

  it("người khác đang dẫn thì vẫn trả giá được", () => {
    const state = lotState({ current_price: START, current_bid_id: "b1", leading_bidder_no: 2 });
    expect(validateBid({ ...base, state, amount: START + STEP })).toBeNull();
  });

  it("nonce sai độ dài ⇒ invalid_nonce", () => {
    expect(validateBid({ ...base, nonce: "short" })).toBe("invalid_nonce");
    expect(validateBid({ ...base, nonce: "x".repeat(101) })).toBe("invalid_nonce");
  });
});

describe("validateBid — số học tiền", () => {
  it("thấp hơn mức tối thiểu ⇒ bid_too_low", () => {
    expect(validateBid({ ...base, amount: START - STEP })).toBe("bid_too_low");
    const state = lotState({ current_price: START, current_bid_id: "b1", leading_bidder_no: 2 });
    expect(validateBid({ ...base, state, amount: START })).toBe("bid_too_low");
  });

  it("không nằm trên lưới bước giá ⇒ bid_step_mismatch", () => {
    expect(validateBid({ ...base, amount: START + STEP / 2 })).toBe("bid_step_mismatch");
  });

  it("số lẻ (cột NUMERIC(18,0)) ⇒ bid_step_mismatch", () => {
    expect(validateBid({ ...base, amount: START + 0.5 })).toBe("bid_step_mismatch");
  });

  it("MỐC CHIA HẾT LÀ GIÁ KHỞI ĐIỂM, không phải giá hiện tại", () => {
    // current_price lệch lưới (dữ liệu cũ / sửa tay): nếu lấy current_price làm
    // mốc thì số này hợp lệ, nhưng SQL lấy starting_price nên phải bị từ chối.
    const offGrid = lotState({ current_price: START + 10_000_000, current_bid_id: "b1", leading_bidder_no: 2 });
    expect(validateBid({ ...base, state: offGrid, amount: START + 10_000_000 + STEP })).toBe("bid_step_mismatch");
    // Số nằm đúng lưới của starting_price và vẫn ≥ min thì hợp lệ.
    expect(validateBid({ ...base, state: offGrid, amount: START + 2 * STEP })).toBeNull();
  });

  it("vượt trần số bước cho một lượt ⇒ bid_too_many_steps", () => {
    expect(validateBid({ ...base, amount: START + 9 * STEP })).toBeNull();
    expect(validateBid({ ...base, amount: START + 10 * STEP })).toBe("bid_too_many_steps");
  });
});

describe("quickSteps", () => {
  it("bước thứ k = min + (k−1) bước", () => {
    expect(quickSteps(lotState(), lot, 10)).toEqual([
      { steps: 1, amount: START },
      { steps: 2, amount: START + STEP },
      { steps: 5, amount: START + 4 * STEP },
    ]);
  });

  it("loại bỏ mốc vượt trần thay vì kẹp lại (tránh hai nút cùng số tiền)", () => {
    expect(quickSteps(lotState(), lot, 2)).toEqual([
      { steps: 1, amount: START },
      { steps: 2, amount: START + STEP },
    ]);
  });

  it("lô chưa cấu hình giá ⇒ rỗng", () => {
    expect(quickSteps(lotState(), { starting_price: null, bid_step: null }, 10)).toEqual([]);
  });
});
