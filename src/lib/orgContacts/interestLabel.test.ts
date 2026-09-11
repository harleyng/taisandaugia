import { describe, expect, it } from "vitest";
import { categoryLabel, interestSummary, priceBandLabel } from "./interestLabel";

describe("interestLabel", () => {
  it("dịch slug cha và con sang tên", () => {
    expect(categoryLabel("bat-dong-san")).toBe("Bất động sản");
    expect(categoryLabel("nha-pho")).toBe("Nhà phố");
    expect(categoryLabel("khong-ton-tai")).toBe("khong-ton-tai");
  });

  it("khoảng giá tách nhóm bằng dấu phẩy", () => {
    expect(priceBandLabel(10_000_000_000, 15_000_000_000)).toBe("10,000,000,000₫ – 15,000,000,000₫");
    expect(priceBandLabel(500_000_000, null)).toBe("Từ 500,000,000₫");
    expect(priceBandLabel(null, 2_000_000_000)).toBe("Đến 2,000,000,000₫");
    expect(priceBandLabel(null, null)).toBeNull();
  });

  it("chiều bỏ trống đọc là không giới hạn", () => {
    expect(interestSummary({ categories: [], provinces: [], price_min: null, price_max: 2_000_000_000 })).toBe(
      "Mọi loại tài sản · Toàn quốc · Đến 2,000,000,000₫",
    );
    expect(
      interestSummary({ categories: ["nha-pho"], provinces: ["Hồ Chí Minh"], price_min: null, price_max: null }),
    ).toBe("Nhà phố · Hồ Chí Minh");
  });
});
