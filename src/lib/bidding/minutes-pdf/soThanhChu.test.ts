import { describe, expect, it } from "vitest";
import { docSoThanhChu, tienBangChu } from "./soThanhChu";

describe("docSoThanhChu", () => {
  it("số nhỏ", () => {
    expect(docSoThanhChu(0)).toBe("không");
    expect(docSoThanhChu(1)).toBe("một");
    expect(docSoThanhChu(9)).toBe("chín");
  });

  it("hàng chục có biến thể lăm / mốt / mười", () => {
    expect(docSoThanhChu(10)).toBe("mười");
    expect(docSoThanhChu(15)).toBe("mười lăm");
    expect(docSoThanhChu(20)).toBe("hai mươi");
    expect(docSoThanhChu(21)).toBe("hai mươi mốt");
    expect(docSoThanhChu(25)).toBe("hai mươi lăm");
  });

  it("hàng trăm có 'linh' khi hàng chục bằng 0", () => {
    expect(docSoThanhChu(100)).toBe("một trăm");
    expect(docSoThanhChu(105)).toBe("một trăm linh năm");
    expect(docSoThanhChu(115)).toBe("một trăm mười lăm");
    expect(docSoThanhChu(999)).toBe("chín trăm chín mươi chín");
  });

  it("nghìn và triệu", () => {
    expect(docSoThanhChu(1_000)).toBe("một nghìn");
    expect(docSoThanhChu(1_005)).toBe("một nghìn không trăm linh năm");
    expect(docSoThanhChu(1_000_000)).toBe("một triệu");
    expect(docSoThanhChu(50_000_000)).toBe("năm mươi triệu");
  });

  it("giá trúng thật của phiên demo", () => {
    expect(docSoThanhChu(6_450_000_000)).toBe("sáu tỷ bốn trăm năm mươi triệu");
    expect(docSoThanhChu(28_450_000_000)).toBe("hai mươi tám tỷ bốn trăm năm mươi triệu");
  });

  it("nhóm tỷ lặp lại trên 10^12", () => {
    expect(docSoThanhChu(1_000_000_000_000)).toBe("một nghìn tỷ");
    expect(docSoThanhChu(2_500_000_000_000)).toBe("hai nghìn năm trăm tỷ");
  });

  it("nhóm 0 ở giữa vẫn đọc đủ hàng", () => {
    expect(docSoThanhChu(2_030_000_000)).toBe("hai tỷ không trăm ba mươi triệu");
  });

  it("làm tròn và bỏ dấu âm thay vì trả chuỗi rác", () => {
    expect(docSoThanhChu(1.4)).toBe("một");
    expect(docSoThanhChu(-5)).toBe("năm");
    expect(docSoThanhChu(Number.NaN)).toBe("không");
  });
});

describe("tienBangChu", () => {
  it("thêm đơn vị đồng", () => {
    expect(tienBangChu(6_450_000_000)).toBe("sáu tỷ bốn trăm năm mươi triệu đồng");
    expect(tienBangChu(0)).toBe("không đồng");
  });
});
