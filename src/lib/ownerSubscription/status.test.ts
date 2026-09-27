import { describe, expect, it } from "vitest";
import { daysLeft, formatSubDate, termEnd, vnToday } from "./status";

describe("termEnd — bản sao owner_sub_term_end()", () => {
  it("kỳ thường: start + n tháng − 1 ngày", () => {
    expect(termEnd("2026-09-27", 12)).toBe("2027-09-26");
    expect(termEnd("2026-10-01", 3)).toBe("2026-12-31");
    expect(termEnd("2026-01-15", 1)).toBe("2026-02-14");
  });

  it("ngày cuối tháng: Postgres kẹp về cuối tháng đích rồi mới trừ 1 ngày", () => {
    // '2027-01-31' + 1 month = 2027-02-28 ⇒ − 1 ngày = 2027-02-27 (SQL test T50)
    expect(termEnd("2027-01-31", 1)).toBe("2027-02-27");
    expect(termEnd("2028-01-31", 1)).toBe("2028-02-28"); // năm nhuận
    expect(termEnd("2026-08-31", 6)).toBe("2027-02-27");
  });

  it("qua năm", () => {
    expect(termEnd("2026-11-15", 3)).toBe("2027-02-14");
  });
});

describe("daysLeft", () => {
  it("tính cả ngày hết hạn; hết hạn ⇒ ≤ 0", () => {
    expect(daysLeft("2026-09-27", "2026-09-27")).toBe(1);
    expect(daysLeft("2026-10-10", "2026-09-27")).toBe(14);
    expect(daysLeft("2026-09-26", "2026-09-27")).toBe(0);
    expect(daysLeft(null, "2026-09-27")).toBeNull();
  });
});

describe("formatSubDate / vnToday", () => {
  it("dd/MM/yyyy", () => {
    expect(formatSubDate("2026-09-27")).toBe("27/09/2026");
    expect(formatSubDate("2026-09-27T10:00:00+07:00")).toBe("27/09/2026");
    expect(formatSubDate(null)).toBe("—");
  });

  it("vnToday theo giờ Việt Nam (UTC+7)", () => {
    expect(vnToday(new Date("2026-09-27T18:30:00Z"))).toBe("2026-09-28");
    expect(vnToday(new Date("2026-09-27T16:59:00Z"))).toBe("2026-09-27");
  });
});
