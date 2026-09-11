import { describe, expect, it } from "vitest";
import { formatDateTimeRange, fromLocalInput, toLocalInput } from "./datetime";

describe("datetime-local ↔ ISO", () => {
  it("khứ hồi giữ nguyên giá trị ô nhập, bất kể múi giờ máy chạy test", () => {
    expect(toLocalInput(fromLocalInput("2026-10-10T09:30"))).toBe("2026-10-10T09:30");
  });

  it("rỗng hoặc sai định dạng không ném lỗi", () => {
    expect(fromLocalInput("")).toBeNull();
    expect(fromLocalInput("không phải ngày")).toBeNull();
    expect(toLocalInput(null)).toBe("");
    expect(toLocalInput("rác")).toBe("");
  });
});

describe("formatDateTimeRange", () => {
  it("thiếu cả hai đầu ⇒ null để UI ẩn dòng", () => {
    expect(formatDateTimeRange(null, undefined)).toBeNull();
  });

  it("thiếu một đầu ⇒ nói rõ Từ / Đến", () => {
    expect(formatDateTimeRange("2026-10-10T02:00:00Z", null)).toMatch(/^Từ /);
    expect(formatDateTimeRange(null, "2026-10-10T02:00:00Z")).toMatch(/^Đến /);
  });
});
