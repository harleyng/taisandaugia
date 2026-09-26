import { describe, it, expect } from "vitest";
import {
  DEFAULTED_PATCH,
  makePartialPaymentSchema,
  paidPercent,
  partialPaymentEvent,
  paymentErrorMessage,
  remainingOf,
} from "./ownerOutcomePayment";

const TODAY = "2026-09-26";

describe("status patch", () => {
  it("only flips the status when the winner defaults", () => {
    expect(DEFAULTED_PATCH).toEqual({ payment_status: "defaulted" });
  });
});

describe("remainingOf", () => {
  it("subtracts what is collected and never goes negative", () => {
    expect(remainingOf(6_000, 2_000)).toBe(4_000);
    expect(remainingOf(6_000, null)).toBe(6_000);
    expect(remainingOf(6_000, 9_000)).toBe(0);
    expect(remainingOf(null, 1)).toBeNull();
  });
});

describe("partialPaymentEvent", () => {
  it("records THIS payment as a ledger entry with only the granted columns", () => {
    const row = partialPaymentEvent("o1", { amount: "2000000000", paidAt: "2026-09-25" });
    expect(row).toEqual({
      outcome_id: "o1",
      kind: "payment",
      amount: 2_000_000_000,
      occurred_on: "2026-09-25",
      note: null,
    });
    expect(Object.keys(row).sort()).toEqual(["amount", "kind", "note", "occurred_on", "outcome_id"]);
  });
});

describe("makePartialPaymentSchema", () => {
  const schema = makePartialPaymentSchema(4_000_000_000, TODAY);
  const errorsOf = (v: { amount: string; paidAt: string }) => {
    const r = schema.safeParse(v);
    return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message]));
  };

  it("accepts an amount up to what is left (equal settles it)", () => {
    expect(schema.safeParse({ amount: "2000000000", paidAt: TODAY }).success).toBe(true);
    expect(schema.safeParse({ amount: "4000000000", paidAt: TODAY }).success).toBe(true);
  });

  it("requires an amount above zero", () => {
    expect(errorsOf({ amount: "", paidAt: TODAY }).amount).toBe("Nhập số tiền thu lần này");
    expect(errorsOf({ amount: "0", paidAt: TODAY }).amount).toBe("Số tiền phải lớn hơn 0");
  });

  it("refuses more than is left", () => {
    expect(errorsOf({ amount: "4000000001", paidAt: TODAY }).amount).toContain("Vượt số còn phải thu");
    expect(makePartialPaymentSchema(0, TODAY).safeParse({ amount: "1", paidAt: TODAY }).success).toBe(false);
  });

  it("rejects a future payment date", () => {
    expect(errorsOf({ amount: "1", paidAt: "2026-09-27" }).paidAt).toBe("Ngày thu không được sau hôm nay");
  });

  it("has no upper bound when the winning price is unknown", () => {
    expect(makePartialPaymentSchema(null, TODAY).safeParse({ amount: "9999999999999", paidAt: TODAY }).success).toBe(
      true,
    );
  });
});

describe("paidPercent", () => {
  it("floors to a whole percent and caps at 100", () => {
    expect(paidPercent(1_999, 10_000)).toBe(19);
    expect(paidPercent(20_000, 10_000)).toBe(100);
    expect(paidPercent(null, 10_000)).toBeNull();
    expect(paidPercent(1, null)).toBeNull();
  });
});

describe("paymentErrorMessage", () => {
  it("explains missing permission and passes guard messages through", () => {
    expect(paymentErrorMessage({ code: "42501" })).toContain("không có quyền");
    expect(paymentErrorMessage({ code: "P0001", message: "Chi nhánh không thuộc đơn vị này" })).toBe(
      "Chi nhánh không thuộc đơn vị này",
    );
    expect(paymentErrorMessage(new Error("x"))).toBe("Không cập nhật được thu tiền. Vui lòng thử lại.");
  });
});
