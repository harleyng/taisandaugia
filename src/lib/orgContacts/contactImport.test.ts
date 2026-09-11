import { describe, expect, it } from "vitest";
import {
  CONTACT_TEMPLATE_HEADERS,
  classifyContacts,
  detectColumns,
  parseConsent,
  parseVndAmount,
  rowsFromSheet,
} from "./contactImport";

const row = (over: Partial<Record<(typeof CONTACT_TEMPLATE_HEADERS)[number], unknown>>) =>
  CONTACT_TEMPLATE_HEADERS.map((h) => over[h] ?? "");

describe("detectColumns", () => {
  it("nhận đúng mọi cột của file mẫu", () => {
    const col = detectColumns(CONTACT_TEMPLATE_HEADERS);
    expect(col).toEqual({
      full_name: 0, contact_type: 1, company_name: 2, phone: 3, email: 4, zalo: 5, province: 6,
      consent: 7, categories: 8, interest_provinces: 9, price_min: 10, price_max: 11, groups: 12, note: 13,
    });
  });

  it("chịu được tiêu đề viết khác, không dấu, đảo thứ tự", () => {
    const col = detectColumns(["SDT", "Ho ten", "Tinh quan tam", "Tinh/thanh"]);
    expect(col).toMatchObject({ phone: 0, full_name: 1, interest_provinces: 2, province: 3 });
  });
});

describe("parseVndAmount", () => {
  it("đọc đơn vị tỷ/triệu và số có dấu phân cách", () => {
    expect(parseVndAmount("10 tỷ")).toBe(10_000_000_000);
    expect(parseVndAmount("1,5 tỷ")).toBe(1_500_000_000);
    expect(parseVndAmount("500 triệu")).toBe(500_000_000);
    expect(parseVndAmount("1,500,000,000")).toBe(1_500_000_000);
    expect(parseVndAmount("1.500.000.000 đ")).toBe(1_500_000_000);
    expect(parseVndAmount(800000000)).toBe(800_000_000);
  });

  it("rỗng / rác → null", () => {
    expect(parseVndAmount("")).toBeNull();
    expect(parseVndAmount("thoả thuận")).toBeNull();
  });
});

describe("parseConsent", () => {
  it("chỉ các giá trị khẳng định mới là đồng ý; trống = không", () => {
    expect(parseConsent("có")).toBe(true);
    expect(parseConsent("Đồng ý")).toBe(true);
    expect(parseConsent("x")).toBe(true);
    expect(parseConsent("")).toBe(false);
    expect(parseConsent("không")).toBe(false);
  });
});

describe("rowsFromSheet", () => {
  it("dịch loại tài sản theo tên, bỏ loại lạ, bù số 0 đầu SĐT", () => {
    const [r] = rowsFromSheet([
      CONTACT_TEMPLATE_HEADERS,
      row({
        "Họ tên *": "Trần B",
        "Loại (cá nhân/tổ chức)": "tổ chức",
        "Điện thoại": 912345678,
        "Email": "B@Example.com",
        "Loại tài sản quan tâm": "Nhà phố; bat-dong-san, Tàu bay",
        "Tỉnh quan tâm": "Hồ Chí Minh, Bình Dương",
        "Giá đến": "12 tỷ",
        "Nhóm": "VIP; Nhà đầu tư",
      }),
    ]);
    expect(r).toMatchObject({
      row: 2,
      full_name: "Trần B",
      contact_type: "company",
      phone: "0912345678",
      email: "b@example.com",
      categories: ["nha-pho", "bat-dong-san"],
      unknownCategories: ["Tàu bay"],
      provinces: ["Hồ Chí Minh", "Bình Dương"],
      price_min: null,
      price_max: 12_000_000_000,
      groups: ["VIP", "Nhà đầu tư"],
      notifications_enabled: false,
    });
  });

  it("bỏ dòng trống, giữ số dòng theo file", () => {
    const rows = rowsFromSheet([CONTACT_TEMPLATE_HEADERS, row({}), row({ "Họ tên *": "C", "Zalo": "0900" })]);
    expect(rows.map((r) => r.row)).toEqual([3]);
  });
});

describe("classifyContacts", () => {
  const base = rowsFromSheet([
    CONTACT_TEMPLATE_HEADERS,
    row({ "Họ tên *": "Có SĐT", "Điện thoại": "+84 900 000 101" }),
    row({ "Họ tên *": "Trùng trong file", "Điện thoại": "0900000101" }),
    row({ "Họ tên *": "Trùng danh bạ", "Email": "old@example.com" }),
    row({ "Họ tên *": "X" , "Email": "x@example.com" }),
    row({ "Họ tên *": "Không kênh" }),
    row({ "Họ tên *": "Email hỏng", "Email": "abc@" }),
    row({ "Họ tên *": "SĐT hỏng", "Điện thoại": "12345" }),
    row({ "Họ tên *": "Chỉ Zalo", "Zalo": "0900000999" }),
  ]);

  it("phân loại hợp lệ / trùng / lỗi theo thứ tự ưu tiên", () => {
    const res = classifyContacts(base, [{ phone_digits: null, email: "OLD@example.com" }]);
    expect(res.valid.map((r) => r.full_name)).toEqual(["Có SĐT", "Chỉ Zalo"]);
    expect(res.duplicates.map((r) => r.name)).toEqual(["Trùng trong file", "Trùng danh bạ"]);
    expect(res.invalid.map((r) => [r.name, r.reason])).toEqual([
      ["X", "Thiếu họ tên"],
      ["Không kênh", "Không có SĐT, email hoặc Zalo"],
      ["Email hỏng", "Email sai định dạng"],
      ["SĐT hỏng", "Số điện thoại không hợp lệ"],
    ]);
  });
});
