import { describe, expect, it } from "vitest";
import { formatMoneyFull, formatMoneyShort, moneyShortParts } from "./money";

describe("moneyShortParts", () => {
  it("dùng tỷ từ 1,000,000,000 trở lên, 1 chữ số thập phân bằng dấu chấm", () => {
    expect(moneyShortParts(12_400_000_000)).toEqual({ value: "12.4", unit: "tỷ" });
    expect(moneyShortParts(1_000_000_000)).toEqual({ value: "1", unit: "tỷ" });
    expect(moneyShortParts(1_950_000_000)).toEqual({ value: "2", unit: "tỷ" });
    expect(moneyShortParts(1_234_500_000_000)).toEqual({ value: "1,234.5", unit: "tỷ" });
  });

  it("dùng tr từ 1,000,000 đến dưới 1 tỷ", () => {
    expect(moneyShortParts(850_000_000)).toEqual({ value: "850", unit: "tr" });
    expect(moneyShortParts(12_500_000)).toEqual({ value: "12.5", unit: "tr" });
    expect(moneyShortParts(999_999_999)).toEqual({ value: "1", unit: "tỷ" });
  });

  it("dưới 1 triệu in số đầy đủ, nhóm bằng dấu phẩy", () => {
    expect(moneyShortParts(500_000)).toEqual({ value: "500,000", unit: "₫" });
    expect(moneyShortParts(0)).toEqual({ value: "0", unit: "₫" });
  });

  it("giữ dấu âm", () => {
    expect(moneyShortParts(-2_300_000_000)).toEqual({ value: "-2.3", unit: "tỷ" });
  });

  it("thiếu giá trị ⇒ gạch ngang", () => {
    expect(moneyShortParts(null)).toEqual({ value: "—", unit: "" });
    expect(moneyShortParts(undefined)).toEqual({ value: "—", unit: "" });
    expect(moneyShortParts(Number.NaN)).toEqual({ value: "—", unit: "" });
    expect(moneyShortParts("")).toEqual({ value: "—", unit: "" });
  });

  it("nhận chuỗi số từ cột NUMERIC", () => {
    expect(moneyShortParts("3500000000")).toEqual({ value: "3.5", unit: "tỷ" });
  });
});

describe("formatMoneyShort", () => {
  it("ghép số và đơn vị", () => {
    expect(formatMoneyShort(12_400_000_000)).toBe("12.4 tỷ");
    expect(formatMoneyShort(850_000_000)).toBe("850 tr");
    expect(formatMoneyShort(null)).toBe("—");
  });
});

describe("formatMoneyFull", () => {
  it("nhóm 3 chữ số bằng dấu phẩy + ₫", () => {
    expect(formatMoneyFull(12_400_000_000)).toBe("12,400,000,000 ₫");
    expect(formatMoneyFull(0)).toBe("0 ₫");
    expect(formatMoneyFull(null)).toBe("—");
  });
});
