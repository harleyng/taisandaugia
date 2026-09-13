// Số học tiền hợp đồng mua bán. Các con số ở đây là bản sao của vòng lặp SQL
// `_sale_reallocate` — nếu một ngày SQL đổi cách chia, test này phải đỏ.

import { describe, expect, it } from "vitest";
import {
  allocateFifo,
  balanceOf,
  defaultInstallments,
  installmentsMatch,
  netPaidOf,
  payableOf,
  splitEvenly,
  type MoneyInstallment,
} from "./money";

const contract = { price: 12_700_000_000, deposit_credit: 4_590_000_000 };
const inst = (seq: number, amount: number): MoneyInstallment => ({ seq, amount });

describe("netPaidOf — dòng hoàn mang dấu trừ", () => {
  it("sổ rỗng là 0", () => {
    expect(netPaidOf([])).toBe(0);
  });

  it("cộng các dòng thu", () => {
    expect(netPaidOf([{ amount: 5_000_000_000 }, { amount: 3_110_000_000 }])).toBe(8_110_000_000);
  });

  it("trừ đúng dòng hoàn", () => {
    const sổ = [
      { amount: 5_000_000_000 },
      { amount: 3_110_000_000 },
      { amount: 3_110_000_000, reversed_payment_id: "p2" },
    ];
    expect(netPaidOf(sổ)).toBe(5_000_000_000);
  });

  it("hoàn hết thì về 0, KHÔNG âm do làm tròn", () => {
    const sổ = [{ amount: 999 }, { amount: 999, reversed_payment_id: "p1" }];
    expect(netPaidOf(sổ)).toBe(0);
  });

  it("bỏ qua phần thập phân — tiền là số nguyên đồng", () => {
    expect(netPaidOf([{ amount: 100.9 }])).toBe(100);
  });
});

describe("balanceOf / payableOf", () => {
  it("chưa trả đồng nào: số dư = giá − tiền đặt trước", () => {
    expect(balanceOf(contract, [])).toBe(8_110_000_000);
    expect(payableOf(contract)).toBe(8_110_000_000);
  });

  it("trả đủ thì số dư về 0", () => {
    expect(balanceOf(contract, [{ amount: 8_110_000_000 }])).toBe(0);
  });

  it("hoàn bút toán cuối mở lại đúng số dư cũ", () => {
    const sổ = [
      { amount: 5_000_000_000 },
      { amount: 3_110_000_000 },
      { amount: 3_110_000_000, reversed_payment_id: "p2" },
    ];
    expect(balanceOf(contract, sổ)).toBe(3_110_000_000);
  });

  it("tiền đặt trước bằng giá ⇒ không còn phải trả", () => {
    expect(balanceOf({ price: 1_000, deposit_credit: 1_000 }, [])).toBe(0);
  });
});

describe("allocateFifo — tính lại từ đầu, không cộng dồn", () => {
  const kỳ = [inst(1, 4_055_000_000), inst(2, 4_055_000_000)];

  it("chưa có tiền: mọi kỳ đều trống", () => {
    const r = allocateFifo(kỳ, 0);
    expect(r.map((x) => x.paid_amount)).toEqual([0, 0]);
    expect(r.every((x) => !x.settled)).toBe(true);
  });

  it("đổ đầy kỳ đầu trước", () => {
    const r = allocateFifo(kỳ, 5_000_000_000);
    expect(r[0].paid_amount).toBe(4_055_000_000);
    expect(r[0].settled).toBe(true);
    expect(r[1].paid_amount).toBe(945_000_000);
    expect(r[1].settled).toBe(false);
    expect(r[1].remaining).toBe(3_110_000_000);
  });

  it("trả đủ thì mọi kỳ đóng", () => {
    const r = allocateFifo(kỳ, 8_110_000_000);
    expect(r.every((x) => x.settled)).toBe(true);
    expect(r.reduce((s, x) => s + x.remaining, 0)).toBe(0);
  });

  it("thừa tiền cũng không phân bổ quá số kỳ", () => {
    const r = allocateFifo(kỳ, 99_000_000_000);
    expect(r.map((x) => x.paid_amount)).toEqual([4_055_000_000, 4_055_000_000]);
  });

  it("sắp theo seq chứ không theo thứ tự mảng đầu vào", () => {
    const r = allocateFifo([inst(2, 100), inst(1, 100)], 100);
    expect(r[0].seq).toBe(1);
    expect(r[0].paid_amount).toBe(100);
    expect(r[1].paid_amount).toBe(0);
  });

  it("số âm (không nên có) được kẹp về 0, không phân bổ ngược", () => {
    const r = allocateFifo(kỳ, -500);
    expect(r.map((x) => x.paid_amount)).toEqual([0, 0]);
  });
});

describe("defaultInstallments", () => {
  it("một kỳ duy nhất cho phần còn lại", () => {
    const r = defaultInstallments(12_700_000_000, 4_590_000_000, "2026-10-13T00:00:00Z");
    expect(r).toHaveLength(1);
    expect(r[0].amount).toBe(8_110_000_000);
    expect(r[0].seq).toBe(1);
  });

  it("cọc đã phủ hết giá ⇒ không sinh kỳ nào", () => {
    expect(defaultInstallments(1_000, 1_000, null)).toEqual([]);
  });
});

describe("splitEvenly — dư dồn vào kỳ CUỐI", () => {
  it("chia hết", () => {
    expect(splitEvenly(900, 3)).toEqual([300, 300, 300]);
  });

  it("dư 2 đồng dồn vào kỳ cuối để các kỳ đầu tròn số", () => {
    expect(splitEvenly(1_001, 3)).toEqual([333, 333, 335]);
    expect(splitEvenly(1_001, 3).reduce((a, b) => a + b, 0)).toBe(1_001);
  });

  it("tổng luôn khớp, với mọi số kỳ", () => {
    for (let n = 1; n <= 6; n += 1) {
      expect(splitEvenly(8_110_000_000, n).reduce((a, b) => a + b, 0), `n=${n}`).toBe(8_110_000_000);
    }
  });

  it("số tiền 0 ⇒ không kỳ nào", () => {
    expect(splitEvenly(0, 3)).toEqual([]);
  });
});

describe("installmentsMatch — cổng của installments_mismatch phía server", () => {
  it("đúng tổng thì qua", () => {
    expect(installmentsMatch([inst(1, 4_055_000_000), inst(2, 4_055_000_000)], contract)).toBe(true);
  });

  it("thiếu một đồng cũng trượt", () => {
    expect(installmentsMatch([inst(1, 8_109_999_999)], contract)).toBe(false);
  });

  it("mảng rỗng trượt (trừ khi không còn phải trả)", () => {
    expect(installmentsMatch([], contract)).toBe(false);
    expect(installmentsMatch([], { price: 100, deposit_credit: 100 })).toBe(true);
  });
});
