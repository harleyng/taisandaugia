import { describe, expect, it } from "vitest";
import { bandGeometry, hasQuartiles, parseBenchmark, positionSentence } from "./ownerBenchmark";

describe("parseBenchmark", () => {
  it("payload lạ / available:false ⇒ ẩn khối", () => {
    expect(parseBenchmark(null).available).toBe(false);
    expect(parseBenchmark([]).available).toBe(false);
    expect(parseBenchmark({ available: false }).available).toBe(false);
    // available:true nhưng không có chỉ số nào dùng được ⇒ vẫn ẩn.
    expect(parseBenchmark({ available: true, success_rate: null, days_to_sale: "x" }).available).toBe(false);
  });

  it("3–4 chi nhánh: chỉ vị trí, không có tứ phân vị", () => {
    const b = parseBenchmark({
      available: true,
      window_days: 365,
      success_rate: { n: 3, position: "better" },
      days_to_sale: null,
    });
    expect(b.available).toBe(true);
    expect(b.successRate).toMatchObject({ n: 3, position: "better", self: null });
    expect(hasQuartiles(b.successRate)).toBe(false);
    expect(b.daysToSale).toBeNull();
  });

  it("từ 5 chi nhánh: đủ tứ phân vị; vị trí lạ ⇒ null", () => {
    const b = parseBenchmark({
      available: true,
      success_rate: { n: 5, position: "weird", self: 75, p25: 35, p50: 50, p75: 75 },
    });
    expect(hasQuartiles(b.successRate)).toBe(true);
    expect(b.successRate?.position).toBeNull();
    expect(b.windowDays).toBe(365);
  });
});

describe("positionSentence", () => {
  it("câu theo chiều tốt của từng chỉ số", () => {
    expect(positionSentence({ n: 4, position: "better" }, "success")).toBe(
      "Cao hơn trung vị của 4 chi nhánh cùng hệ thống",
    );
    expect(positionSentence({ n: 4, position: "better" }, "days")).toBe(
      "Nhanh hơn trung vị của 4 chi nhánh cùng hệ thống",
    );
    expect(positionSentence({ n: 6, position: "worse" }, "days")).toBe(
      "Chậm hơn trung vị của 6 chi nhánh cùng hệ thống",
    );
    expect(positionSentence({ n: 3, position: "same" }, "success")).toBe(
      "Ngang trung vị của 3 chi nhánh cùng hệ thống",
    );
  });

  it("chính mình chưa đủ số liệu ⇒ nói rõ thiếu gì", () => {
    expect(positionSentence({ n: 5, position: null }, "success")).toContain("chưa đủ 3 kết quả");
    expect(positionSentence({ n: 5, position: null }, "days")).toContain("chưa đủ 3 tài sản");
  });
});

describe("bandGeometry", () => {
  it("tỷ lệ thành công: thang cố định 0–100", () => {
    expect(bandGeometry({ n: 5, position: "better", self: 75, p25: 35, p50: 50, p75: 75 }, "success")).toEqual({
      bandLeft: 35,
      bandWidth: 40,
      median: 50,
      self: 75,
    });
  });

  it("số ngày: thang giãn theo giá trị lớn nhất đang vẽ, chấm mình không tràn thanh", () => {
    const g = bandGeometry({ n: 5, position: "worse", self: 200, p25: 40, p50: 60, p75: 100 }, "days");
    expect(g.self).toBe(80); // 200 / (200 × 1.25)
    expect(g.bandLeft).toBe(16);
    expect(g.median).toBe(24);
  });

  it("chưa có số của mình ⇒ không có chấm; toàn 0 ⇒ không chia cho 0", () => {
    const g = bandGeometry({ n: 5, position: null, self: null, p25: 0, p50: 0, p75: 0 }, "days");
    expect(g.self).toBeNull();
    expect(g).toMatchObject({ bandLeft: 0, bandWidth: 0, median: 0 });
  });
});
