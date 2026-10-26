import { describe, expect, it } from "vitest";
import {
  adminUnitFullLabel,
  adminUnitLevelOfCode,
  adminUnitShortName,
  matchesAdminUnit,
  normalizeAdminSearch,
  sortAdminUnits,
  type AdminUnit,
} from "./adminUnits";

const unit = (over: Partial<AdminUnit>): AdminUnit => ({
  code: "07228",
  name: "Phường Đa Mai",
  level: "commune",
  unit_type: "phuong",
  parent_code: "24",
  legacy_names: [],
  is_active: true,
  ...over,
});

describe("adminUnitShortName", () => {
  it("bỏ tiền tố hành chính", () => {
    expect(adminUnitShortName("Tỉnh Bắc Ninh")).toBe("Bắc Ninh");
    expect(adminUnitShortName("Thành phố Hà Nội")).toBe("Hà Nội");
    expect(adminUnitShortName("Xã Tân Dĩnh")).toBe("Tân Dĩnh");
    expect(adminUnitShortName("Đặc khu Phú Quốc")).toBe("Phú Quốc");
  });

  it("giữ nguyên tên không có tiền tố", () => {
    expect(adminUnitShortName("Bắc Ninh")).toBe("Bắc Ninh");
  });
});

describe("adminUnitLevelOfCode", () => {
  it("suy cấp từ độ dài mã — admin_unit_resolve trả mã tỉnh khi chưa xuống được xã", () => {
    expect(adminUnitLevelOfCode("24")).toBe("province");
    expect(adminUnitLevelOfCode("07228")).toBe("commune");
    expect(adminUnitLevelOfCode(null)).toBeNull();
    expect(adminUnitLevelOfCode("abc")).toBeNull();
  });
});

describe("matchesAdminUnit", () => {
  const bacNinh = unit({
    code: "24",
    name: "Tỉnh Bắc Ninh",
    level: "province",
    unit_type: "tinh",
    parent_code: null,
    legacy_names: ["Bắc Giang"],
  });

  it("không phân biệt dấu và chữ hoa", () => {
    expect(matchesAdminUnit(bacNinh, "bac ninh")).toBe(true);
    expect(matchesAdminUnit(bacNinh, "BẮC NINH")).toBe(true);
  });

  it("khớp tên trước sáp nhập", () => {
    expect(matchesAdminUnit(bacNinh, "Bắc Giang")).toBe(true);
    expect(matchesAdminUnit(bacNinh, "bac giang")).toBe(true);
  });

  it("khớp theo mã và trả true khi từ khoá rỗng", () => {
    expect(matchesAdminUnit(bacNinh, "24")).toBe(true);
    expect(matchesAdminUnit(bacNinh, "")).toBe(true);
  });

  it("không khớp tên khác", () => {
    expect(matchesAdminUnit(bacNinh, "Cà Mau")).toBe(false);
  });
});

describe("adminUnitFullLabel", () => {
  it("ghép xã với tỉnh", () => {
    expect(
      adminUnitFullLabel(unit({ name: "Xã Tân Dĩnh" }), { name: "Tỉnh Bắc Ninh" }),
    ).toBe("Xã Tân Dĩnh, Tỉnh Bắc Ninh");
  });

  it("cấp tỉnh chỉ in tên của chính nó", () => {
    expect(adminUnitFullLabel({ name: "Tỉnh Bắc Ninh", level: "province" }, null)).toBe(
      "Tỉnh Bắc Ninh",
    );
  });
});

describe("normalizeAdminSearch / sortAdminUnits", () => {
  it("gom dấu câu thành khoảng trắng", () => {
    expect(normalizeAdminSearch("TP. Hồ Chí Minh")).toBe("tp ho chi minh");
  });

  it("sắp theo tên tiếng Việt, bỏ tiền tố", () => {
    const names = sortAdminUnits([
      unit({ code: "2", name: "Xã Bình Minh" }),
      unit({ code: "1", name: "Phường An Khê" }),
      unit({ code: "3", name: "Xã Ân Thi" }),
    ]).map((u) => u.name);
    expect(names).toEqual(["Phường An Khê", "Xã Ân Thi", "Xã Bình Minh"]);
  });
});
