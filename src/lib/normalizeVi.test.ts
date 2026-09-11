import { describe, expect, it } from "vitest";
import { normalizeVi, stripViDiacritics, tokensVi } from "./normalizeVi";

describe("normalizeVi", () => {
  it("bỏ dấu, đ→d, thường hoá", () => {
    expect(normalizeVi("Tiền Đặt Trước")).toBe("tien dat truoc");
  });

  it("dấu câu thành khoảng trắng, gộp khoảng trắng", () => {
    expect(normalizeVi("  TP.HCM,   Quận 1?! ")).toBe("tp hcm quan 1");
    expect(tokensVi("Lô số 2: 50.000.000₫")).toEqual(["lo", "so", "2", "50", "000", "000"]);
    expect(tokensVi("   ")).toEqual([]);
  });

  it("chuỗi dựng sẵn (NFD) và dựng hợp (NFC) ra cùng kết quả", () => {
    expect(normalizeVi("Tiền".normalize("NFD"))).toBe(normalizeVi("Tiền".normalize("NFC")));
  });

  it("stripViDiacritics giữ dấu câu (hành vi cũ của OrgPicker)", () => {
    expect(stripViDiacritics(" Công ty Đấu giá T.H. ")).toBe("cong ty dau gia t.h.");
  });
});
