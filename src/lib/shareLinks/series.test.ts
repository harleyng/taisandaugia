import { describe, expect, it } from "vitest";
import { conversionRate, formatRate, mapShareSeries, periodRange, pointLabel, pointTitle } from "./series";

describe("periodRange", () => {
  // 03/10/2026 20:00 UTC = 04/10/2026 03:00 giờ VN ⇒ "hôm nay" là 04/10.
  const now = new Date("2026-10-03T20:00:00Z");
  it("đếm cả hôm nay, theo ngày giờ Việt Nam", () => {
    expect(periodRange("7", now)).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(periodRange("30", now)).toEqual({ from: "2026-09-05", to: "2026-10-04" });
  });
  it("'Từ khi tạo' ⇒ from null (server lấy ngày tạo link)", () => {
    expect(periodRange("all", now)).toEqual({ from: null, to: "2026-10-04" });
  });
});

describe("conversionRate", () => {
  it("người bấm / người xem; chưa ai xem ⇒ null; chặn trần 100%", () => {
    expect(conversionRate(16, 410)).toBeCloseTo(0.039, 3);
    expect(conversionRate(3, 0)).toBeNull();
    expect(conversionRate(5, 2)).toBe(1);
  });
  it("định dạng %", () => {
    expect(formatRate(0.0984)).toBe("9.84%");
    expect(formatRate(null)).toBe("—");
  });
});

describe("mapShareSeries", () => {
  it("đọc chuỗi + tổng, tính tỷ lệ từng ngày và cả kỳ", () => {
    const s = mapShareSeries({
      ok: true,
      unit: "day",
      from: "2026-10-01",
      to: "2026-10-02",
      series: [
        { date: "2026-10-01", views: 10, viewers: 8, dossier: 2, dossier_people: 2, pdf: 1, follow: 0, call: 0 },
        { date: "2026-10-02", views: 0, viewers: 0, dossier: 0, dossier_people: 0, pdf: 0, follow: 0, call: 0 },
      ],
      totals: { views: 10, viewers: 8, dossier: 2, dossier_people: 2, pdf: 1, follow: 0, call: 0 },
    });
    expect(s.points).toHaveLength(2);
    expect(s.points[0].conversion).toBe(0.25);
    expect(s.points[1].conversion).toBeNull();
    expect(s.totals).toMatchObject({ views: 10, viewers: 8, dossierPeople: 2, conversion: 0.25 });
  });
  it("dữ liệu hỏng ⇒ chuỗi rỗng, không ném lỗi", () => {
    expect(mapShareSeries(null)).toMatchObject({ unit: "day", points: [], totals: { views: 0, conversion: null } });
  });
});

describe("nhãn trục / tooltip", () => {
  it("ngày và tuần", () => {
    expect(pointLabel("2026-10-04", "day")).toBe("04/10");
    expect(pointLabel("2026-09-28", "week")).toBe("Tuần 28/09");
    expect(pointTitle("2026-10-04", "day")).toBe("Ngày 04/10/2026");
    expect(pointTitle("2026-09-28", "week")).toBe("Tuần từ 28/09/2026");
  });
});
