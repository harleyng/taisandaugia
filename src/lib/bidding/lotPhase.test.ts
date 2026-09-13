import { describe, expect, it } from "vitest";
import { lotAcceptsBids, lotIsOpen, lotPhaseOf, remainingMs } from "./lotPhase";
import type { LotState } from "@/types/auction-bidding";

const at = (iso: string) => new Date(iso);

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

describe("lotPhaseOf", () => {
  it("KHÔNG có dòng trạng thái ⇒ chưa mở (không phải 'đang tải')", () => {
    expect(lotPhaseOf(null, at("2026-10-10T10:00:00Z"))).toBe("pending");
  });

  it("đang trong giờ trả giá ⇒ open", () => {
    expect(lotPhaseOf(lotState(), at("2026-10-10T10:00:00Z"))).toBe("open");
  });

  it("đã gia hạn ⇒ extended (suy diễn từ extension_count, không phải cột DB)", () => {
    expect(lotPhaseOf(lotState({ extension_count: 2 }), at("2026-10-10T10:00:00Z"))).toBe("extended");
  });

  it("quá ends_at mà cron chưa chạy vẫn phải là closed", () => {
    expect(lotPhaseOf(lotState(), at("2026-10-10T11:00:00Z"))).toBe("closed");
    expect(lotPhaseOf(lotState({ extension_count: 3 }), at("2026-10-10T11:00:01Z"))).toBe("closed");
  });

  it("tạm dừng / đã đóng / đã rút giữ nguyên, không phụ thuộc thời gian", () => {
    const late = at("2027-01-01T00:00:00Z");
    expect(lotPhaseOf(lotState({ status: "paused", paused_at: "x", pause_reason: "Sự cố" }), late)).toBe("paused");
    expect(lotPhaseOf(lotState({ status: "closed", result: "unsold" }), late)).toBe("closed");
    expect(lotPhaseOf(lotState({ status: "withdrawn" }), late)).toBe("withdrawn");
    expect(lotPhaseOf(lotState({ status: "pending" }), late)).toBe("pending");
  });
});

describe("lotIsOpen", () => {
  it("chỉ đúng khi status='open' VÀ chưa tới ends_at", () => {
    expect(lotIsOpen(lotState(), at("2026-10-10T10:59:59Z"))).toBe(true);
    expect(lotIsOpen(lotState(), at("2026-10-10T11:00:00Z"))).toBe(false);
    expect(lotIsOpen(lotState({ status: "paused" }), at("2026-10-10T10:00:00Z"))).toBe(false);
    expect(lotIsOpen(null, at("2026-10-10T10:00:00Z"))).toBe(false);
  });
});

describe("remainingMs", () => {
  it("đếm ngược tới ends_at, không bao giờ âm", () => {
    expect(remainingMs(lotState(), at("2026-10-10T10:59:00Z"))).toBe(60_000);
    expect(remainingMs(lotState(), at("2026-10-10T12:00:00Z"))).toBe(0);
  });

  it("chưa có mốc đóng ⇒ null", () => {
    expect(remainingMs(lotState({ ends_at: null }), at("2026-10-10T10:00:00Z"))).toBeNull();
    expect(remainingMs(null, at("2026-10-10T10:00:00Z"))).toBeNull();
  });
});

describe("lotAcceptsBids", () => {
  it("chỉ open / extended mới nhận lượt mới", () => {
    const now = at("2026-10-10T10:00:00Z");
    expect(lotAcceptsBids(lotState(), now)).toBe(true);
    expect(lotAcceptsBids(lotState({ extension_count: 1 }), now)).toBe(true);
    expect(lotAcceptsBids(lotState({ status: "paused" }), now)).toBe(false);
    expect(lotAcceptsBids(null, now)).toBe(false);
  });
});
