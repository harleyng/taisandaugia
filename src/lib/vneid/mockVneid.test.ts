import { describe, expect, it } from "vitest";
import { mockVneidIdentity } from "./mockVneid";

describe("mockVneidIdentity", () => {
  it("tất định theo userId", () => {
    expect(mockVneidIdentity("user-a")).toEqual(mockVneidIdentity("user-a"));
    expect(mockVneidIdentity("user-a").id_number).not.toBe(mockVneidIdentity("user-b").id_number);
  });

  it("CCCD đúng 12 chữ số và khớp giới tính / năm sinh", () => {
    for (const uid of ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8"]) {
      const id = mockVneidIdentity(uid);
      expect(id.id_number).toMatch(/^[0-9]{12}$/);
      const year = Number(id.date_of_birth.slice(0, 4));
      const centuryDigit = Number(id.id_number[3]);
      expect(centuryDigit % 2 === 1).toBe(id.gender === "female");
      expect(centuryDigit >= 2).toBe(year >= 2000);
      expect(id.id_number.slice(4, 6)).toBe(String(year % 100).padStart(2, "0"));
      expect(id.address.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("dùng tên trong profile nếu có", () => {
    expect(mockVneidIdentity("u1", "  Trần Minh Khoa ").full_name).toBe("Trần Minh Khoa");
    expect(mockVneidIdentity("u1", "A").full_name.split(" ").length).toBe(3);
  });
});
