import { describe, expect, it } from "vitest";
import { bankBinOf, crc16, groupAccountNumber, transferMemo, vietQrPayload } from "./depositTransfer";

describe("transferMemo", () => {
  it("mã hồ sơ + họ tên không dấu viết hoa", () => {
    expect(transferMemo("HS131-007", "Nguyễn Văn An")).toBe("HS131007 NGUYEN VAN AN");
    expect(transferMemo("HSDG000017", "Trần Thị Đào")).toBe("HSDG000017 TRAN THI DAO");
  });
  it("cắt còn 50 ký tự", () => {
    expect(transferMemo("HSDG000017", "A".repeat(80)).length).toBe(50);
  });
});

describe("bankBinOf", () => {
  it("nhận tên phổ biến, có / không dấu", () => {
    expect(bankBinOf("Vietcombank — CN Sài Gòn")).toBe("970436");
    expect(bankBinOf("Ngân hàng TMCP Ngoại thương Việt Nam")).toBe("970436");
    expect(bankBinOf("BIDV")).toBe("970418");
    expect(bankBinOf("MB Bank")).toBe("970422");
    expect(bankBinOf("Ngân hàng lạ")).toBeNull();
    expect(bankBinOf("")).toBeNull();
  });
});

describe("VietQR", () => {
  it("CRC-16/CCITT-FALSE chuẩn", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
  it("payload có số tiền, nội dung và CRC đúng", () => {
    const p = vietQrPayload({ bin: "970436", accountNumber: "0071 0012 34567", amount: 2820000000, memo: "HS131007 NGUYEN VAN AN" });
    expect(p).toContain("0010A000000727");
    expect(p).toContain("00069704360113007100123456");
    expect(p).toContain("54102820000000");
    expect(p.slice(-8, -4)).toBe("6304");
    expect(crc16(p.slice(0, -4))).toBe(p.slice(-4));
  });
  it("nhóm số tài khoản", () => {
    expect(groupAccountNumber("0071001234567")).toBe("0071 0012 34567");
  });
});
