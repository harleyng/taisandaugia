import { describe, expect, it } from "vitest";
import { depositFromPlan } from "./deposit";

describe("depositFromPlan", () => {
  it("percent ⇒ % của giá khởi điểm, làm tròn tới đồng", () => {
    expect(depositFromPlan("percent", 10, 1_234_567_891)).toBe(123_456_789);
  });

  it("percent nhưng thiếu giá khởi điểm ⇒ không đoán", () => {
    expect(depositFromPlan("percent", 10, null)).toBeNull();
    expect(depositFromPlan("percent", 10, 0)).toBeNull();
  });

  it("amount ⇒ dùng thẳng giá trị", () => {
    expect(depositFromPlan("amount", 50_000_000, null)).toBe(50_000_000);
  });

  it("không có giá trị hoặc giá trị âm ⇒ null", () => {
    expect(depositFromPlan("amount", null, 1_000)).toBeNull();
    expect(depositFromPlan("percent", -5, 1_000)).toBeNull();
    expect(depositFromPlan(undefined, undefined, undefined)).toBeNull();
  });
});
