import { describe, expect, it } from "vitest";
import {
  craftMapErrorMessage,
  isVietnamCoord,
  matchesVillage,
  parseCraftAssets,
  parseCraftMapState,
  parseCraftVillageState,
  villageLabel,
  villageOfAsset,
  type PublicCraftVillage,
} from "./index";

describe("parseCraftMapState", () => {
  it("không phải làng nghề / dữ liệu lạ ⇒ eligible false", () => {
    expect(parseCraftMapState(null)).toEqual({ eligible: false });
    expect(parseCraftMapState({ ok: true, eligible: false })).toEqual({ eligible: false });
    expect(parseCraftMapState([1, 2])).toEqual({ eligible: false });
  });

  it("đọc cờ hiện của hồ sơ + trạng thái làng", () => {
    expect(
      parseCraftMapState({
        ok: true,
        eligible: true,
        can_edit: true,
        review_status: "approved",
        has_vr: false,
        has_image: true,
        is_published: true,
        village: { is_published: false, is_cover: true },
      }),
    ).toEqual({
      eligible: true,
      canEdit: true,
      reviewStatus: "approved",
      hasVr: false,
      hasImage: true,
      isPublished: true,
      village: { isPublished: false, isCover: true },
    });
  });

  it("Trạm chưa thiết lập hồ sơ làng ⇒ village null", () => {
    const s = parseCraftMapState({ eligible: true, village: null });
    expect(s.eligible && s.village).toBeNull();
  });
});

describe("parseCraftVillageState", () => {
  it("ép numeric vị trí (Postgres trả numeric dạng số hoặc chuỗi) + đọc danh sách hồ sơ", () => {
    const s = parseCraftVillageState({
      ok: true,
      eligible: true,
      can_edit: true,
      can_edit_assets: false,
      village_name: "Làng rèn Đa Sỹ",
      profile: {
        latitude: "20.9575", longitude: 105.7855, province: "Hà Nội", product: "Dao kéo",
        intro: null, cover_posting_id: "p1", is_published: true, published_at: "2026-10-18T00:00:00Z",
      },
      assets: [
        { posting_id: "p1", code: "HS-1", title: "Dao", image: "a.jpg", status: "active", review_status: "approved",
          is_published: true, visible: true, has_vr: false },
        { title: "thiếu id" },
      ],
    });
    expect(s.eligible && s.profile?.latitude).toBe(20.9575);
    expect(s.eligible && s.canEditAssets).toBe(false);
    expect(s.eligible && s.assets.map((a) => a.postingId)).toEqual(["p1"]);
  });

  it("chưa có hồ sơ làng ⇒ profile null, assets rỗng", () => {
    const s = parseCraftVillageState({ eligible: true, profile: null });
    expect(s.eligible && s.profile).toBeNull();
    expect(s.eligible && s.assets).toEqual([]);
  });
});

describe("parseCraftAssets", () => {
  it("bỏ phần tử lạ, chỉ giữ ảnh dạng chuỗi", () => {
    expect(
      parseCraftAssets([
        { posting_id: "p1", title: "Dao", description: null, image_urls: ["a.jpg", 3], vr_url: null },
        "rác",
        { title: "thiếu id" },
      ]),
    ).toEqual([{ posting_id: "p1", title: "Dao", description: null, image_urls: ["a.jpg"], vr_url: null }]);
    expect(parseCraftAssets(null)).toEqual([]);
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
  const v = {
    village_name: "HTX Lụa Vạn Phúc",
    province: "Hà Nội",
    product: "Lụa tơ tằm",
    assets: [{ title: "Khăn lụa vân hoa" }, { title: "Áo dài thêu tay" }],
  };
  it("khớp không phân biệt dấu trên tên làng, tỉnh, sản phẩm và MỌI hồ sơ", () => {
    expect(matchesVillage(v, "van phuc")).toBe(true);
    expect(matchesVillage(v, "hà nội")).toBe(true);
    expect(matchesVillage(v, "to tam")).toBe(true);
    expect(matchesVillage(v, "van hoa")).toBe(true);
    expect(matchesVillage(v, "ao dai")).toBe(true);
    expect(matchesVillage(v, "gốm")).toBe(false);
    expect(matchesVillage(v, "  ")).toBe(true);
  });
});

describe("craftMapErrorMessage / villageLabel / villageOfAsset", () => {
  it("lý do đã biết ⇒ câu tiếng Việt; lạ ⇒ câu chung", () => {
    expect(craftMapErrorMessage("not_approved")).toMatch(/duyệt/);
    expect(craftMapErrorMessage("boom")).toBe("Không lưu được, vui lòng thử lại");
  });
  it("ưu tiên tên làng, rồi tên hồ sơ bìa", () => {
    expect(villageLabel({ village_name: " ", assets: [{ title: "Bình gốm" }] })).toBe("Bình gốm");
    expect(villageLabel({ village_name: null as unknown as string, assets: [] })).toBe("Làng nghề");
  });
  it("tìm làng chứa hồ sơ cho link cũ ?ho-so=", () => {
    const villages = [
      { workspace_id: "w1", assets: [{ posting_id: "p1" }] },
      { workspace_id: "w2", assets: [{ posting_id: "p2" }, { posting_id: "p3" }] },
    ] as unknown as PublicCraftVillage[];
    expect(villageOfAsset(villages, "p3")?.workspace_id).toBe("w2");
    expect(villageOfAsset(villages, "x")).toBeNull();
    expect(villageOfAsset(villages, null)).toBeNull();
  });
});
