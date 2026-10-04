import { describe, expect, it } from "vitest";
import { featuredFirst, isFeaturedNow } from "./featured";

const NOW = new Date("2026-10-02T10:00:00Z").getTime();

describe("tin nổi bật", () => {
  it("cờ + hạn chưa qua (hoặc không hạn) mới tính", () => {
    expect(isFeaturedNow({ featured: true, featured_until: "2026-10-09T10:00:00Z" }, NOW)).toBe(true);
    expect(isFeaturedNow({ featured: true, featured_until: null }, NOW)).toBe(true);
    expect(isFeaturedNow({ featured: true, featured_until: "2026-10-01T10:00:00Z" }, NOW)).toBe(false);
    expect(isFeaturedNow({ featured: false, featured_until: "2026-10-09T10:00:00Z" }, NOW)).toBe(false);
    expect(isFeaturedNow({}, NOW)).toBe(false);
  });

  it("đưa tin nổi bật lên đầu, giữ thứ tự còn lại", () => {
    const rows = [
      { id: "a", featured: false },
      { id: "b", featured: true, featured_until: "2026-10-09T10:00:00Z" },
      { id: "c", featured: true, featured_until: "2026-09-01T10:00:00Z" },
      { id: "d", featured: false },
    ];
    expect(featuredFirst(rows, NOW).map((r) => r.id)).toEqual(["b", "a", "c", "d"]);
  });
});
