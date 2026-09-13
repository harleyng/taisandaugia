// Dự thảo hợp đồng mua bán — kiểm cây nội dung, KHÔNG dựng PDF thật.
//
// Điều đáng canh nhất ở văn bản này: phải có ĐỦ HAI BÊN, tiền phải in kèm chữ,
// và dấu "DỰ THẢO" cùng phiên bản mẫu phải còn nguyên — đó là những thứ giữ
// cho một bản chưa rà soát pháp lý không bị nhầm là bản chính thức.

import { describe, expect, it } from "vitest";
import { BLANK, buildSaleDocDefinition } from "./document";
import { HDMB_TEMPLATE_VERSION } from "./clauses";
import type { SalePdfInput } from "./input";

const base: SalePdfInput = {
  code: "HDMB000001",
  contractNo: null,
  buyer: {
    full_name: "Nguyễn Văn Mua",
    id_type: "cccd",
    id_number: "079201004567",
    date_of_birth: "1985-04-12",
    phone: "0912345679",
    email: "mua@example.com",
    address: "12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh",
    bidder_no: 1,
    dossier_code: "HSDG000031",
  },
  seller: {
    kind: "individual",
    full_name: "Lê Thị Bán",
    id_type: "cccd",
    id_number: "079188002345",
    address: "45 Lê Lợi",
    ward: "Phường Bến Nghé",
    province: "TP. Hồ Chí Minh",
    phone: "0911111111",
    email: "ban@example.com",
  },
  org: {
    name: "Công ty đấu giá hợp danh Bảo Tín",
    tax_code: "0101234567",
    address: "1 Lê Lợi",
    province: "Hà Nội",
    phone: "0900000000",
    legal_rep_name: "Trần Văn Bình",
    legal_rep_position: "Giám đốc",
  },
  asset: {
    lot_no: 1,
    title: "Nhà phố 4 tầng hẻm xe hơi, Quận 5",
    province: "TP. Hồ Chí Minh",
    district: "Quận 5",
    starting_price: 12_500_000_000,
    session_code: "PDG000014",
  },
  price: 12_700_000_000,
  depositCredit: 4_590_000_000,
  payable: 8_110_000_000,
  installments: [
    { seq: 1, label: "Đợt 1", dueAt: "2026-10-13T00:00:00Z", amount: 4_055_000_000 },
    { seq: 2, label: "Đợt 2", dueAt: "2026-10-28T00:00:00Z", amount: 4_055_000_000 },
  ],
  payeeSide: "org",
  payeeBankInfo: "Vietcombank – 0011000123456 – CTY BAO TIN",
  orgSigns: false,
  notarizationRequired: false,
  handoverDueAt: "2026-11-05T00:00:00Z",
  sellerIsRegistry: false,
  categoryLabel: "Nhà ở",
  generatedAt: new Date("2026-09-12T03:00:00Z"),
};

/** Gom mọi chuỗi trong cây nội dung để tìm kiếm. */
const textOf = (doc: unknown): string => JSON.stringify(doc);

describe("buildSaleDocDefinition — khung văn bản", () => {
  const doc = buildSaleDocDefinition(base);
  const s = textOf(doc);

  it("đóng dấu DỰ THẢO trên mọi trang", () => {
    expect((doc.watermark as { text: string }).text).toBe("DỰ THẢO");
  });

  it("chân trang mang phiên bản mẫu để truy ngược bản đã chia sẻ", () => {
    expect(textOf((doc.footer as (a: number, b: number) => unknown)(1, 2))).toContain(
      HDMB_TEMPLATE_VERSION,
    );
  });

  it("chân trang có số trang", () => {
    expect(textOf((doc.footer as (a: number, b: number) => unknown)(2, 3))).toContain("Trang 2/3");
  });

  it("tiêu đề đúng loại hợp đồng", () => {
    expect(s).toContain("HỢP ĐỒNG MUA BÁN TÀI SẢN ĐẤU GIÁ");
  });

  it("khổ A4", () => {
    expect(doc.pageSize).toBe("A4");
  });
});

describe("các bên — hợp đồng phải nêu ĐỦ hai bên", () => {
  const s = textOf(buildSaleDocDefinition(base));

  it("có tên và CCCD của bên mua", () => {
    expect(s).toContain("Nguyễn Văn Mua");
    expect(s).toContain("079201004567");
  });

  it("có tên và CCCD của bên bán", () => {
    expect(s).toContain("Lê Thị Bán");
    expect(s).toContain("079188002345");
  });

  it("có số báo danh của người trúng", () => {
    expect(s).toContain("Số báo danh");
  });

  it("hai cột chữ ký khi tổ chức KHÔNG ký", () => {
    expect(s).toContain("BÊN BÁN");
    expect(s).toContain("BÊN MUA");
    expect(s).not.toContain("TỔ CHỨC ĐẤU GIÁ TÀI SẢN");
  });

  it("ba cột chữ ký khi tổ chức là bên ký thứ ba", () => {
    const s3 = textOf(buildSaleDocDefinition({ ...base, orgSigns: true }));
    expect(s3).toContain("TỔ CHỨC ĐẤU GIÁ");
    expect(s3).toContain("Trần Văn Bình");
  });
});

describe("bên bán là thực thể danh bạ (lô tin đăng)", () => {
  const registry = buildSaleDocDefinition({
    ...base,
    sellerIsRegistry: true,
    seller: { kind: "registry", name: "Chi cục Thi hành án dân sự Quận 1", address: "1 Nam Kỳ Khởi Nghĩa" },
  });
  const s = textOf(registry);

  it("in tên trong danh bạ", () => {
    expect(s).toContain("Chi cục Thi hành án dân sự Quận 1");
  });

  it("nói rõ tổ chức đấu giá ký thay", () => {
    expect(s).toContain("uỷ quyền cho");
  });

  it("KHÔNG bịa CCCD cho bên bán không có hồ sơ", () => {
    // Bên MUA vẫn có CCCD (từ hồ sơ tham gia) — chỉ được đúng MỘT ô CCCD trong
    // cả văn bản, và nó thuộc về bên mua.
    expect(s.split("Số CCCD")).toHaveLength(2);
    expect(s).toContain("Tên bên có tài sản");
  });
});

describe("tiền — số kèm chữ ở những chỗ pháp lý đòi hỏi", () => {
  const s = textOf(buildSaleDocDefinition(base));

  it("giá mua in cả số lẫn chữ", () => {
    expect(s).toContain("12,700,000,000");
    expect(s).toContain("mười hai tỷ bảy trăm triệu đồng");
  });

  it("tiền đặt cọc và số còn phải trả đều có mặt", () => {
    expect(s).toContain("4,590,000,000");
    expect(s).toContain("8,110,000,000");
  });

  it("có điều về tiền đặt trước chuyển thành tiền đặt cọc", () => {
    expect(s).toContain("tiền đặt cọc");
  });

  it("KHÔNG dùng chữ 'lần' cho kỳ thanh toán", () => {
    expect(s).not.toContain("lần thanh toán");
  });
});

describe("lịch thanh toán", () => {
  it("in đủ các kỳ", () => {
    const s = textOf(buildSaleDocDefinition(base));
    expect(s).toContain("Đợt 1");
    expect(s).toContain("Đợt 2");
    // dataTable in tiêu đề cột dạng chữ hoa.
    expect(s).toContain("HẠN THANH TOÁN");
  });

  it("không có kỳ nào vẫn ra câu dùng được, không vỡ", () => {
    const s = textOf(buildSaleDocDefinition({ ...base, installments: [] }));
    expect(s).toContain("Thời hạn do hai bên thống nhất");
  });

  it("nói rõ ai là bên thu tiền", () => {
    expect(textOf(buildSaleDocDefinition(base))).toContain("thông qua tổ chức đấu giá");
    expect(textOf(buildSaleDocDefinition({ ...base, payeeSide: "seller" }))).toContain(
      "trực tiếp cho Bên bán",
    );
  });
});

describe("điều khoản tuỳ chọn", () => {
  it("chỉ nhắc công chứng khi hợp đồng yêu cầu", () => {
    expect(textOf(buildSaleDocDefinition(base))).not.toContain("được công chứng, chứng thực");
    expect(textOf(buildSaleDocDefinition({ ...base, notarizationRequired: true }))).toContain(
      "được công chứng, chứng thực",
    );
  });

  it("chỉ in hạn bàn giao khi có", () => {
    expect(textOf(buildSaleDocDefinition({ ...base, handoverDueAt: null }))).not.toContain(
      "Thời hạn bàn giao dự kiến",
    );
  });
});

describe("thiếu dữ liệu thì để trống cho điền tay, KHÔNG in 'null'", () => {
  const trống = buildSaleDocDefinition({
    ...base,
    contractNo: null,
    categoryLabel: null,
    payeeBankInfo: null,
    buyer: {},
    seller: {},
    org: {},
    asset: {},
  });
  const s = textOf(trống);

  it("dùng ô trống chuẩn", () => {
    expect(s).toContain(BLANK);
  });

  it("không rò chữ null/undefined vào bản in", () => {
    expect(s).not.toContain(">null<");
    expect(s).not.toContain("undefined");
  });

  it("vẫn dựng được mà không ném", () => {
    expect(trống.content).toBeTruthy();
  });
});
