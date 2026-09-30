import { describe, expect, it } from "vitest";
import { craftMapErrorMessage, isVietnamCoord, matchesVillage, parseCraftMapState, villageLabel } from "./index";

describe("parseCraftMapState", () => {
  it("không phải làng nghề / dữ liệu lạ ⇒ eligible false", () => {
    expect(parseCraftMapState(null)).toEqual({ eligible: false });
    expect(parseCraftMapState({ ok: true, eligible: false })).toEqual({ eligible: false });
    expect(parseCraftMapState([1, 2])).toEqual({ eligible: false });
  });

  it("đọc trạng thái + ép numeric (Postgres trả numeric dạng số hoặc chuỗi)", () => {
    expect(
      parseCraftMapState({
        ok: true,
        eligible: true,
        can_edit: true,
        review_status: "approved",
        has_vr: false,
        has_image: true,
        publication: { latitude: "20.976", longitude: 105.912, product: "Gốm sứ", is_published: true, published_at: "2026-09-30T00:00:00Z" },
      }),
    ).toEqual({
      eligible: true,
      canEdit: true,
      reviewStatus: "approved",
      hasVr: false,
      hasImage: true,
      publication: { latitude: 20.976, longitude: 105.912, product: "Gốm sứ", is_published: true, published_at: "2026-09-30T00:00:00Z" },
    });
  });

  it("chưa có dòng công khai ⇒ publication null", () => {
    const s = parseCraftMapState({ eligible: true, publication: null });
    expect(s.eligible && s.publication).toBeNull();
  });
});

describe("isVietnamCoord", () => {
  it("nhận đất liền và hai quần đảo, từ chối đảo ngược lat/lng", () => {
    expect(isVietnamCoord(20.976, 105.912)).toBe(true);
    expect(isVietnamCoord(16.5, 112)).toBe(true); // Hoàng Sa
    expect(isVietnamCoord(10, 114.3)).toBe(true); // Trường Sa
    expect(isVietnamCoord(105.9, 20.9)).toBe(false);
    expect(isVietnamCoord(Number.NaN, 105)).toBe(false);
  });
});

describe("matchesVillage", () => {
  const v = { village_name: "HTX Lụa Vạn Phúc", title: "Khăn lụa vân hoa", province: "Hà Nội", product: "Lụa tơ tằm" };
  it("khớp không phân biệt dấu trên tên làng, hồ sơ, tỉnh, sản phẩm", () => {
    expect(matchesVillage(v, "van phuc")).toBe(true);
    expect(matchesVillage(v, "hà nội")).toBe(true);
    expect(matchesVillage(v, "to tam")).toBe(true);
    expect(matchesVillage(v, "van hoa")).toBe(true);
    expect(matchesVillage(v, "gốm")).toBe(false);
    expect(matchesVillage(v, "  ")).toBe(true);
  });
});

describe("craftMapErrorMessage / villageLabel", () => {
  it("lý do đã biết ⇒ câu tiếng Việt; lạ ⇒ câu chung", () => {
    expect(craftMapErrorMessage("not_approved")).toMatch(/duyệt/);
    expect(craftMapErrorMessage("boom")).toBe("Không lưu được, vui lòng thử lại");
  });
  it("ưu tiên tên làng, rồi tên hồ sơ", () => {
    expect(villageLabel({ village_name: " ", title: "Bình gốm" })).toBe("Bình gốm");
    expect(villageLabel({ village_name: null as unknown as string, title: null })).toBe("Làng nghề");
  });
});
