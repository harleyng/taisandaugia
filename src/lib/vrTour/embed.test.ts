import { describe, expect, it } from "vitest";
import { vrEmbedSrc, vrOpensInNewTab } from "./embed";

describe("vrOpensInNewTab", () => {
  it("claude.ai (kể cả subdomain) ⇒ mở tab mới", () => {
    expect(vrOpensInNewTab("https://claude.ai/artifact/U5YrpwygMxo2RruTB76ZLF")).toBe(true);
    expect(vrOpensInNewTab("https://www.claude.ai/x")).toBe(true);
  });
  it("trình xem nhúng được hoặc URL hỏng ⇒ nhúng như cũ", () => {
    expect(vrOpensInNewTab("https://cdn.pannellum.org/2.5/pannellum.htm#panorama=x")).toBe(false);
    expect(vrOpensInNewTab("https://notclaude.ai/x")).toBe(false);
    expect(vrOpensInNewTab("https://taisandaugia.vn/vr/bat-trang.html")).toBe(false);
    expect(vrOpensInNewTab("không phải url")).toBe(false);
  });
});

describe("vrEmbedSrc", () => {
  it("tour tự host ⇒ nạp theo origin hiện tại, giữ path/query/hash", () => {
    expect(vrEmbedSrc("https://taisandaugia.vn/vr/bat-trang.html", "http://localhost:8080")).toBe(
      "http://localhost:8080/vr/bat-trang.html",
    );
    expect(vrEmbedSrc("https://www.taisandaugia.vn/vr/x.html?a=1#b", "https://preview.vercel.app")).toBe(
      "https://preview.vercel.app/vr/x.html?a=1#b",
    );
  });
  it("host khác / URL hỏng ⇒ giữ nguyên", () => {
    const pano = "https://cdn.pannellum.org/2.5/pannellum.htm#panorama=x";
    expect(vrEmbedSrc(pano, "http://localhost:8080")).toBe(pano);
    expect(vrEmbedSrc("abc", "http://localhost:8080")).toBe("abc");
  });
});
