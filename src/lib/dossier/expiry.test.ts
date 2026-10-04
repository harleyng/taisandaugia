import { describe, expect, it } from "vitest";
import { appraisalExpiryOf } from "./expiry";

const today = new Date(2026, 9, 1); // 01/10/2026

describe("appraisalExpiryOf", () => {
  it("không có ngày ⇒ không có huy hiệu", () => {
    expect(appraisalExpiryOf(null, today)).toBeNull();
    expect(appraisalExpiryOf("", today)).toBeNull();
    expect(appraisalExpiryOf("không-phải-ngày", today)).toBeNull();
  });

  it("hôm nay vẫn còn hiệu lực (khớp valid_until >= current_date)", () => {
    expect(appraisalExpiryOf("2026-10-01", today)).toBe("expiring");
    expect(appraisalExpiryOf("2026-09-30", today)).toBe("expired");
  });

  it("trong 30 ngày là sắp hết hạn, xa hơn là còn hạn", () => {
    expect(appraisalExpiryOf("2026-10-31", today)).toBe("expiring");
    expect(appraisalExpiryOf("2026-11-01", today)).toBe("valid");
  });
});
