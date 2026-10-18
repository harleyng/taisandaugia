import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, optionsSummary, parseOptions, writeChannelPost, writeSharedPost, type WriterContext } from "./aiWriter";
import { buildBulletin } from "./bulletin";
import { parseCaseFile } from "./caseFile";

const lots = [
  { id: "a", lot_no: 2, title: "Ô tô", category_slug: "o-to", starting_price: 1, deposit_amount: 1 },
  { id: "b", lot_no: 1, title: "Nhà", category_slug: "nha-pho", starting_price: 2, deposit_amount: 1 },
];

const ctx: WriterContext = {
  orgName: "Công ty Đấu giá Hợp danh Nam Việt",
  head: "Đấu giá máy móc thiết bị nhà xưởng",
  totalStart: "2,450,000,000₫",
  totalDeposit: "245,000,000₫",
  regEnd: "05/10/2026",
  auctionDate: "10/10/2026",
  viewing: "",
  province: "TP. Hồ Chí Minh",
  lots: [
    { lot_no: 1, title: "Máy CNC", starting_price: "1,200,000,000₫", place: "Quận 7", description: "Máy CNC 5 trục.", condition: "Đang hoạt động tốt.", legal: "Có hoá đơn." },
    { lot_no: 2, title: "Xe nâng", starting_price: "", place: "", description: "", condition: "", legal: "" },
  ],
  link: (src) => `https://x.vn/sessions/1${src ? `?src=${src}` : ""}`,
};

describe("bulletin", () => {
  it("ghép theo lô, theo thứ tự số lô, tiêu đề rơi về tên phiên", () => {
    const cf = parseCaseFile({ lots: { a: { description: "Xe 2020" }, b: { description: "Nhà 3 tầng", condition: "Trống" } } });
    const b = buildBulletin(cf, { title: "Phiên A", auction_session_items: lots });
    expect(b.head).toBe("Phiên A");
    expect(b.description).toBe("Tài sản 1: Nhà 3 tầng\nTài sản 2: Xe 2020");
    expect(b.condition).toBe("Tài sản 1: Trống");
  });
});

describe("aiWriter", () => {
  it("tuỳ chọn hỏng rơi về mặc định", () => {
    expect(parseOptions(null)).toEqual(DEFAULT_OPTIONS);
    expect(parseOptions({ tone: "x", hl: ["vitri", "zzz"] }).hl).toEqual(["vitri"]);
    expect(optionsSummary(DEFAULT_OPTIONS)).toBe("Thân thiện · Vừa · Mọi khách · Giá khởi điểm · Hạn nộp hồ sơ");
  });

  it("bài chung nhắc đủ mọi tài sản, mốc và liên kết; chỉ dùng dữ liệu có sẵn", () => {
    const t = writeSharedPost(ctx, DEFAULT_OPTIONS);
    expect(t).toContain("Tài sản 1: Máy CNC — giá khởi điểm 1,200,000,000₫");
    expect(t).toContain("Tài sản 2: Xe nâng");
    expect(t).not.toContain("Tài sản 2: Xe nâng —");
    expect(t).toContain("Hạn nhận hồ sơ: 05/10/2026");
    expect(t).toContain("https://x.vn/sessions/1");
    expect(t).toContain("🔔");
  });

  it("tắt emoji, thêm hashtag, giọng trang trọng", () => {
    const t = writeSharedPost(ctx, { ...DEFAULT_OPTIONS, tone: "trang", x: ["hashtag"] });
    expect(t.startsWith("THÔNG BÁO ĐẤU GIÁ TÀI SẢN")).toBe(true);
    expect(t).not.toMatch(/🔔|👉/u);
    expect(t).toContain("#TPHoChiMinh");
  });

  it("SMS không dấu, tối đa 160 ký tự; email có dòng tiêu đề", () => {
    const sms = writeChannelPost(ctx, "sms", DEFAULT_OPTIONS);
    expect(sms.length).toBeLessThanOrEqual(160);
    expect(sms).not.toMatch(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i);
    expect(sms).toContain("?src=sms");
    const mail = writeChannelPost(ctx, "mail", DEFAULT_OPTIONS);
    expect(mail.startsWith("Tiêu đề: [Đấu giá]")).toBe(true);
    expect(mail).toContain("?src=mail");
  });
});
