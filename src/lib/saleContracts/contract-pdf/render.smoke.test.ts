// @vitest-environment node
// Dựng PDF THẬT một lần: bắt những lỗi mà kiểm cây nội dung không thấy được
// (font thiếu ký tự tiếng Việt, cột chữ ký tràn trang, layout bảng sai kiểu).
import { describe, expect, it } from "vitest";
import { salePdfBlob } from "./index";
import type { SalePdfInput } from "./input";

const input: SalePdfInput = {
  code: "HDMB000001",
  contractNo: "01/2026/HĐMB",
  buyer: {
    full_name: "Nguyễn Văn Mua", id_type: "cccd", id_number: "079201004567",
    date_of_birth: "1985-04-12", phone: "0912345679", email: "mua@example.com",
    address: "12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh", bidder_no: 1,
  },
  seller: {
    kind: "individual", full_name: "Lê Thị Bán", id_type: "cccd", id_number: "079188002345",
    address: "45 Lê Lợi", ward: "Phường Bến Nghé", province: "TP. Hồ Chí Minh",
    phone: "0911111111", email: "ban@example.com",
  },
  org: {
    name: "Công ty đấu giá hợp danh Bảo Tín", tax_code: "0101234567",
    address: "1 Lê Lợi", province: "Hà Nội", phone: "0900000000",
    legal_rep_name: "Trần Văn Bình", legal_rep_position: "Giám đốc",
  },
  asset: {
    lot_no: 1, title: "Nhà phố 4 tầng hẻm xe hơi, Quận 5",
    province: "TP. Hồ Chí Minh", district: "Quận 5",
    starting_price: 12_500_000_000, session_code: "PDG000014",
  },
  price: 12_700_000_000,
  depositCredit: 4_590_000_000,
  payable: 8_110_000_000,
  installments: [
    { seq: 1, label: "Đợt 1", dueAt: "2026-10-13T00:00:00Z", amount: 4_055_000_000 },
    { seq: 2, label: "Đợt 2", dueAt: "2026-10-28T00:00:00Z", amount: 4_055_000_000 },
  ],
  payeeSide: "org",
  payeeBankInfo: "Vietcombank – 0011000123456",
  orgSigns: true,
  notarizationRequired: true,
  handoverDueAt: "2026-11-05T00:00:00Z",
  sellerIsRegistry: false,
  categoryLabel: "Nhà ở",
  generatedAt: new Date("2026-09-12T03:00:00Z"),
};

describe("salePdfBlob — dựng PDF thật", () => {
  it("ra được tệp PDF khác rỗng", async () => {
    const blob = await salePdfBlob(input);
    expect(blob.size).toBeGreaterThan(3000);
    const head = new Uint8Array(await blob.arrayBuffer()).subarray(0, 5);
    expect(String.fromCharCode(...head)).toBe("%PDF-");
  }, 30_000);

  it("bản bên bán danh bạ (3 chữ ký) cũng dựng được", async () => {
    const blob = await salePdfBlob({
      ...input,
      sellerIsRegistry: true,
      seller: { kind: "registry", name: "Chi cục Thi hành án dân sự Quận 1", address: "1 Nam Kỳ Khởi Nghĩa" },
    });
    expect(blob.size).toBeGreaterThan(3000);
  }, 30_000);
});
