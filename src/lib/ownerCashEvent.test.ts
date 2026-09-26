import { describe, expect, it } from "vitest";
import {
  cashEventErrorMessage,
  makeCashEventSchema,
  settleReasonMessage,
  signedAmount,
  toCashEventInsert,
  toCashEventUpdate,
  type CashEventContext,
} from "./ownerCashEvent";

const TODAY = "2026-09-26";
const sold: CashEventContext = { sold: true, defaulted: false, winningPrice: 1000, collected: 300, maxDay: TODAY };

const errorsOf = (ctx: CashEventContext, v: Record<string, string>) => {
  const r = makeCashEventSchema(ctx).safeParse({ occurredOn: TODAY, ...v });
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message]));
};

describe("makeCashEventSchema", () => {
  it("accepts a payment up to what is left", () => {
    expect(errorsOf(sold, { kind: "payment", amount: "700" })).toEqual({});
    expect(errorsOf(sold, { kind: "payment", amount: "701" }).amount).toContain("Vượt số còn phải thu");
  });

  it("allows payments only on a sold, non-defaulted result", () => {
    expect(errorsOf({ ...sold, sold: false }, { kind: "payment", amount: "1" }).kind).toContain("phiên đấu thành");
    expect(errorsOf({ ...sold, defaulted: true }, { kind: "payment", amount: "1" }).kind).toContain("bỏ cọc");
  });

  it("allows deposits and fees on any result", () => {
    expect(errorsOf({ ...sold, sold: false }, { kind: "deposit", amount: "50" })).toEqual({});
    expect(errorsOf({ ...sold, sold: false }, { kind: "fee", amount: "50" })).toEqual({});
  });

  it("caps a refund at what was collected", () => {
    expect(errorsOf(sold, { kind: "refund", amount: "300" })).toEqual({});
    expect(errorsOf(sold, { kind: "refund", amount: "301" }).amount).toContain("Hoàn trả");
  });

  it("removes the edited entry before checking", () => {
    const editing = { ...sold, collected: 1000, editing: { kind: "payment" as const, amount: 700 } };
    expect(errorsOf(editing, { kind: "payment", amount: "700" })).toEqual({});
    expect(errorsOf(editing, { kind: "payment", amount: "701" }).amount).toContain("Vượt");
  });

  it("requires a positive amount and a date not after today", () => {
    expect(errorsOf(sold, { kind: "fee", amount: "" }).amount).toBe("Nhập số tiền");
    expect(errorsOf(sold, { kind: "fee", amount: "0" }).amount).toBe("Số tiền phải lớn hơn 0");
    expect(errorsOf(sold, { kind: "fee", amount: "1", occurredOn: "2026-09-27" }).occurredOn).toContain("sau hôm nay");
  });
});

describe("payload builders", () => {
  const form = { kind: "fee" as const, amount: "250", occurredOn: TODAY, note: "  thù lao  " };

  it("insert sends exactly the granted columns", () => {
    const row = toCashEventInsert("o1", form);
    expect(row).toEqual({ outcome_id: "o1", kind: "fee", amount: 250, occurred_on: TODAY, note: "thù lao" });
    expect(Object.keys(row).sort()).toEqual(["amount", "kind", "note", "occurred_on", "outcome_id"]);
  });

  it("update never sends outcome_id / workspace_id / people", () => {
    const row = toCashEventUpdate({ ...form, note: " " });
    expect(Object.keys(row).sort()).toEqual(["amount", "kind", "note", "occurred_on"]);
    expect(row.note).toBeNull();
  });
});

describe("messages", () => {
  it("signs money out as negative", () => {
    expect(signedAmount("payment", 5)).toBe(5);
    expect(signedAmount("fee", 5)).toBe(-5);
    expect(signedAmount("refund", 5)).toBe(-5);
  });

  it("maps errors and settle reasons to Vietnamese", () => {
    expect(cashEventErrorMessage({ code: "42501" })).toContain("không có quyền");
    expect(cashEventErrorMessage({ code: "P0001", message: "Ngày ghi nhận không được sau hôm nay" })).toBe(
      "Ngày ghi nhận không được sau hôm nay",
    );
    expect(settleReasonMessage("already_paid")).toBe("Tài sản này đã thu đủ.");
    expect(settleReasonMessage("weird")).toContain("Không ghi nhận được");
  });
});
