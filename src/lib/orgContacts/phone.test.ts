import { describe, expect, it } from "vitest";
import { isVietnamPhone, phoneDigits } from "./phone";

describe("phoneDigits — bản sao cột org_contacts.phone_digits", () => {
  it("bỏ mọi ký tự không phải số", () => {
    expect(phoneDigits("0912 345.678")).toBe("0912345678");
    expect(phoneDigits("(028) 3822-1234")).toBe("02838221234");
  });

  it("đổi mã quốc gia 84 thành 0", () => {
    expect(phoneDigits("+84 912 345 678")).toBe("0912345678");
    expect(phoneDigits("84912345678")).toBe("0912345678");
    expect(phoneDigits("+84 28 3822 1234")).toBe("02838221234");
  });

  it("không đụng số nội địa bắt đầu bằng 0", () => {
    expect(phoneDigits("0841234567")).toBe("0841234567");
  });

  it("rỗng hoặc không có chữ số → null", () => {
    expect(phoneDigits("")).toBeNull();
    expect(phoneDigits(null)).toBeNull();
    expect(phoneDigits("không có")).toBeNull();
  });
});

describe("isVietnamPhone", () => {
  it("nhận di động 10 số và cố định 11 số", () => {
    expect(isVietnamPhone("0912345678")).toBe(true);
    expect(isVietnamPhone("+84912345678")).toBe(true);
    expect(isVietnamPhone("02838221234")).toBe(true);
  });

  it("từ chối số quá ngắn / không bắt đầu bằng 0", () => {
    expect(isVietnamPhone("091234")).toBe(false);
    expect(isVietnamPhone("912345678")).toBe(false);
  });
});
