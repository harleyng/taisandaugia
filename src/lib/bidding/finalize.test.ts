import { describe, expect, it } from "vitest";
import { finalizeBlockersOf, finalizePreviewOf } from "./finalize";
import type { LotState } from "@/types/auction-bidding";

const NOW = new Date("2026-10-16T10:00:00Z");
const PAST = "2026-10-16T09:00:00Z";
const FUTURE = "2026-10-16T11:00:00Z";

const lot = (n: number) => ({ id: `lot${n}`, lot_no: n, title: `Tài sản ${n}` });

const state = (lotId: string, o: Partial<LotState> = {}): LotState =>
  ({
    lot_id: lotId,
    session_id: "s1",
    status: "pending",
    result: null,
    winner_contract_id: null,
    winning_amount: null,
    ends_at: null,
    extension_count: 0,
    ...o,
  }) as LotState;

const map = (...rows: LotState[]) => new Map(rows.map((r) => [r.lot_id, r]));

const contract = (id: string, o: Partial<{ status: string; deposit_status: string }> = {}) => ({
  id,
  status: "paid",
  deposit_status: "received",
  ...o,
});

describe("finalizeBlockersOf", () => {
  it("không có lô ⇒ không chặn", () => {
    expect(finalizeBlockersOf([], map(), NOW)).toEqual([]);
  });

  it("lô chưa mở (không có dòng trạng thái) chặn, kèm việc cần làm", () => {
    const [b] = finalizeBlockersOf([lot(2)], map(), NOW);
    expect(b.phase).toBe("pending");
    expect(b.lotNo).toBe(2);
    expect(b.advice).toMatch(/Mở lô rồi chờ đóng/);
  });

  it("dòng 'open' đã quá ends_at KHÔNG chặn — server tự đóng lười trước khi đếm", () => {
    const s = state("lot1", { status: "open", ends_at: PAST });
    expect(finalizeBlockersOf([lot(1)], map(s), NOW)).toEqual([]);
  });

  it("lô đang trả giá thật sự thì chặn", () => {
    const s = state("lot1", { status: "open", ends_at: FUTURE });
    const [b] = finalizeBlockersOf([lot(1)], map(s), NOW);
    expect(b.phase).toBe("open");
    expect(b.advice).toMatch(/Chờ lô đóng/);
  });

  it("lô đã gia hạn vẫn chặn, đúng giai đoạn extended", () => {
    const s = state("lot1", { status: "open", ends_at: FUTURE, extension_count: 2 });
    expect(finalizeBlockersOf([lot(1)], map(s), NOW)[0].phase).toBe("extended");
  });

  it("lô tạm dừng chặn với lời khuyên riêng", () => {
    const s = state("lot1", { status: "paused", ends_at: FUTURE });
    const [b] = finalizeBlockersOf([lot(1)], map(s), NOW);
    expect(b.phase).toBe("paused");
    expect(b.advice).toMatch(/Tiếp tục lô/);
  });

  it("closed + withdrawn không chặn", () => {
    const a = state("lot1", { status: "closed", result: "sold" });
    const b = state("lot2", { status: "withdrawn" });
    expect(finalizeBlockersOf([lot(1), lot(2)], map(a, b), NOW)).toEqual([]);
  });

  it("xếp theo số lô, không theo thứ tự đầu vào", () => {
    const got = finalizeBlockersOf([lot(3), lot(1), lot(2)], map(), NOW);
    expect(got.map((b) => b.lotNo)).toEqual([1, 2, 3]);
  });
});

describe("finalizePreviewOf", () => {
  it("lô đã rút không nằm trong sold lẫn unsold", () => {
    const a = state("lot1", { status: "closed", result: "sold", winner_contract_id: "c1" });
    const b = state("lot2", { status: "withdrawn" });
    const p = finalizePreviewOf([lot(1), lot(2)], map(a, b), [], NOW);
    expect(p).toMatchObject({ sold: 1, unsold: 0, withdrawn: 1 });
  });

  it("một hồ sơ trúng HAI lô vẫn chỉ đếm applied một lần", () => {
    const a = state("lot1", { status: "closed", result: "sold", winner_contract_id: "c1" });
    const b = state("lot2", { status: "closed", result: "sold", winner_contract_id: "c1" });
    const p = finalizePreviewOf([lot(1), lot(2)], map(a, b), [contract("c1")], NOW);
    expect(p).toMatchObject({ sold: 2, applied: 1, pendingRefund: 0 });
  });

  it("hồ sơ không trúng ⇒ chờ hoàn trả", () => {
    const a = state("lot1", { status: "closed", result: "sold", winner_contract_id: "c1" });
    const p = finalizePreviewOf([lot(1)], map(a), [contract("c1"), contract("c2")], NOW);
    expect(p).toMatchObject({ applied: 1, pendingRefund: 1 });
  });

  it("hồ sơ đã tịch thu không vào applied lẫn pendingRefund", () => {
    const a = state("lot1", { status: "closed", result: "sold", winner_contract_id: "c1" });
    const p = finalizePreviewOf([lot(1)], map(a), [contract("c1", { deposit_status: "forfeited" })], NOW);
    expect(p).toMatchObject({ applied: 0, pendingRefund: 0 });
  });

  it("hồ sơ chưa thanh toán hoặc chưa nộp tiền đặt trước bị loại", () => {
    const p = finalizePreviewOf(
      [lot(1)],
      map(state("lot1", { status: "closed", result: "unsold" })),
      [contract("c1", { status: "pending_payment" }), contract("c2", { deposit_status: "pending" })],
      NOW,
    );
    expect(p).toMatchObject({ unsold: 1, applied: 0, pendingRefund: 0 });
  });

  it("lô 'open' quá giờ đã mang result nên được đếm như server sẽ thấy", () => {
    const a = state("lot1", { status: "open", ends_at: PAST, result: "sold", winner_contract_id: "c1" });
    const p = finalizePreviewOf([lot(1)], map(a), [contract("c1")], NOW);
    expect(p).toMatchObject({ sold: 1, applied: 1 });
  });

  it("phiên chưa mở lô nào: tất cả bằng 0", () => {
    expect(finalizePreviewOf([lot(1), lot(2)], map(), [contract("c1")], NOW)).toEqual({
      sold: 0,
      unsold: 0,
      withdrawn: 0,
      applied: 0,
      pendingRefund: 1,
    });
  });
});
