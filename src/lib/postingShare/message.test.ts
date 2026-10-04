import { describe, expect, it } from "vitest";
import { buildZaloMessage, sharedPostingPath, sharedPostingPrintPath, sharedPostingUrl } from "./message";

describe("đường dẫn Hồ sơ online", () => {
  it("dựng /hs/:code và bản in", () => {
    expect(sharedPostingPath("Ab3_-xYz0123")).toBe("/hs/Ab3_-xYz0123");
    expect(sharedPostingPrintPath("Ab3_-xYz0123")).toBe("/hs/Ab3_-xYz0123/in");
    expect(sharedPostingUrl("Ab3_-xYz0123", "https://taisandaugia.vn")).toBe("https://taisandaugia.vn/hs/Ab3_-xYz0123");
  });
});

describe("buildZaloMessage", () => {
  const url = "https://taisandaugia.vn/hs/Ab3_-xYz0123";

  it("đủ thông tin: tên · diện tích · tỉnh, giá ngắn, link ở dòng cuối", () => {
    const msg = buildZaloMessage({
      title: "Nhà phố Quận 7",
      area: "120 m²",
      startingPrice: 12_400_000_000,
      province: "TP. Hồ Chí Minh",
      url,
    });
    expect(msg.split("\n")).toEqual([
      "Kính gửi Anh/Chị, xin giới thiệu tài sản:",
      "Nhà phố Quận 7 · 120 m² · TP. Hồ Chí Minh",
      "Giá khởi điểm: 12.4 tỷ",
      `Xem hồ sơ số hoá (ảnh, pháp lý, lịch phiên): ${url}`,
    ]);
  });

  it("link không cho hiện giá ⇒ không nhắc tới giá; thiếu diện tích / tỉnh thì bỏ", () => {
    const msg = buildZaloMessage({ title: "  Xe tải Hino ", area: null, startingPrice: null, province: null, url });
    expect(msg).not.toMatch(/Giá/);
    expect(msg.split("\n")[1]).toBe("Xe tải Hino");
  });

  it("giá 0 coi như chưa có giá", () => {
    expect(buildZaloMessage({ title: "A", area: null, startingPrice: 0, province: null, url })).not.toMatch(/Giá/);
  });
});
