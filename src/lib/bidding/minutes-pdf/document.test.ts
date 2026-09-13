import { describe, expect, it } from "vitest";
import { BLANK, buildMinutesDocDefinition } from "./document";
import type { MinutesLotRow, MinutesPdfInput } from "./input";
import { formatVnd } from "@/lib/advertising/slug";

/**
 * Gom mọi chuỗi văn bản trong cây nội dung.
 *
 * Bỏ mã màu: cây pdfmake để `color: '#5b6672'` ngay cạnh `text`, nên duyệt thô
 * sẽ chèn mã màu vào giữa nhãn và giá trị của bảng hai cột.
 */
const IS_COLOR = /^#[0-9a-fA-F]{3,8}$/;

function texts(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string") {
    if (!IS_COLOR.test(node)) out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((n) => texts(n, out));
    return out;
  }
  if (node && typeof node === "object") {
    Object.values(node as Record<string, unknown>).forEach((v) => texts(v, out));
  }
  return out;
}

const CCCD = "079085123456";
const ADDRESS = "12 Nguyễn Huệ, Quận 1, TP.HCM";

const lot = (patch: Partial<MinutesLotRow> = {}): MinutesLotRow => ({
  lotNo: 1,
  title: "Đất thổ cư 88.5m² — Đồng Nai",
  startingPrice: 6_400_000_000,
  bidStep: 50_000_000,
  bidCount: 3,
  result: "sold",
  withdrawn: false,
  withdrawReason: null,
  winningAmount: 6_450_000_000,
  winnerName: "Nguyễn Văn An",
  winnerBidderNo: 1,
  closedAt: "2026-10-16T04:00:00Z",
  paymentDueAt: "2026-11-15T04:00:00Z",
  ...patch,
});

const base: MinutesPdfInput = {
  session: {
    id: "f10d0009-0000-4000-8000-000000000001",
    code: "PDG000013",
    title: "Phiên đấu giá tài sản quý IV",
    startsAt: "2026-10-16T02:00:00Z",
    endsAt: "2026-12-31T10:00:00Z",
    venue: null,
    province: "Đồng Nai",
    auctionFormat: "ca_hai",
    extensionSeconds: 300,
    maxBidSteps: 10,
    finalizedAt: "2026-10-16T05:00:00Z",
  },
  org: { name: "Công ty đấu giá hợp danh Bảo Tín", address: "1 Lê Lợi, Hà Nội", phone: "0900000000" },
  auctioneer: { fullName: "Trần Văn Bình", licenseNumber: "1234/ĐGV" },
  lots: [lot(), lot({ lotNo: 2, title: "Nhà phố 449.6m²", result: null, withdrawn: true, withdrawReason: "Chủ tài sản rút tài sản", winningAmount: null, winnerName: null, winnerBidderNo: null, bidCount: 0 })],
  dossierCount: 2,
  bidderNoCount: 2,
  generatedAt: new Date(2026, 9, 16, 15, 4, 31),
};

const all = (i: MinutesPdfInput = base) => texts(buildMinutesDocDefinition(i).content);

describe("buildMinutesDocDefinition", () => {
  it("có tiêu đề và quốc hiệu", () => {
    const s = all();
    expect(s).toContain("BIÊN BẢN ĐẤU GIÁ TÀI SẢN");
    expect(s).toContain("CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM");
    expect(s).toContain("Độc lập – Tự do – Hạnh phúc");
  });

  it("mọi lô đều xuất hiện, kèm lý do rút", () => {
    const s = all().join("\n");
    expect(s).toContain("Đất thổ cư 88.5m² — Đồng Nai");
    expect(s).toContain("Nhà phố 449.6m²");
    expect(s).toContain("Lý do rút: Chủ tài sản rút tài sản");
    expect(s).toContain("Đã rút khỏi phiên");
  });

  it("giá trúng in cả số lẫn chữ", () => {
    const s = all().join("\n");
    expect(s).toContain(formatVnd(6_450_000_000));
    expect(s).toContain("sáu tỷ bốn trăm năm mươi triệu đồng");
  });

  it("KHÔNG lộ CCCD hay địa chỉ của người trúng", () => {
    const s = all().join("\n");
    expect(s).not.toContain(CCCD);
    expect(s).not.toContain(ADDRESS);
  });

  it("người trúng chỉ hiện họ tên + số báo danh", () => {
    const s = all().join("\n");
    expect(s).toContain("Nguyễn Văn An");
    expect(s).toContain("SBD 001");
  });

  it("KHÔNG in số thứ tự phát hành ở bất cứ đâu", () => {
    // sequence_no do server cấp sau khi tải tệp lên ⇒ in vào là ký một tờ giấy
    // có thể mâu thuẫn với sổ. Xem chú thích đầu document.ts.
    const s = all().join("\n");
    expect(s).not.toMatch(/[Ll]ần phát hành/);
    expect(s).not.toMatch(/[Ss]ố thứ tự/);
    expect(s).not.toMatch(/[Bb]iên bản lần/);
  });

  it("có đủ ba mục chữ ký", () => {
    const s = all();
    expect(s).toContain("ĐẤU GIÁ VIÊN");
    expect(s).toContain("NGƯỜI TRÚNG ĐẤU GIÁ");
    expect(s).toContain("NGƯỜI CHỨNG KIẾN");
  });

  it("một người trúng duy nhất thì điền sẵn tên vào ô ký", () => {
    const dd = buildMinutesDocDefinition(base);
    const blocks = dd.content as unknown[];
    const signature = texts(blocks[blocks.length - 1]);
    expect(signature).toContain("Nguyễn Văn An");
  });

  it("nhiều người trúng thì ô ký để trống, không gợi ý sai ai phải ký", () => {
    const two = { ...base, lots: [lot(), lot({ lotNo: 2, winnerName: "Đỗ Thị Hà", winnerBidderNo: 2 })] };
    const s = all(two).join("\n");
    expect(s).toContain("Đỗ Thị Hà");
    const dd = buildMinutesDocDefinition(two);
    const signature = texts((dd.content as unknown[])[(dd.content as unknown[]).length - 1]);
    expect(signature).toContain(BLANK);
    expect(signature).not.toContain("Nguyễn Văn An");
  });

  it("đấu giá viên in kèm số thẻ; để trống thì ra chỗ điền tay", () => {
    expect(all().join("\n")).toContain("Trần Văn Bình — Thẻ ĐGV số 1234/ĐGV");
    const blank = all({ ...base, auctioneer: null }).join("\n");
    expect(blank).toContain(BLANK);
    expect(blank).not.toContain("Trần Văn Bình");
  });

  it("tổng hợp đếm đúng: lô đã rút không nằm trong thành / không thành", () => {
    const s = all().join("\n");
    expect(s).toContain("Tổng số tài sản đưa ra đấu giá");
    const dd = buildMinutesDocDefinition(base);
    const flat = texts(dd.content);
    const at = (label: string) => flat[flat.indexOf(label) + 1];
    expect(at("Số tài sản đấu giá thành")).toBe("1");
    expect(at("Số tài sản đấu giá không thành")).toBe("0");
    expect(at("Số tài sản đã rút khỏi phiên")).toBe("1");
  });

  it("phiên không có lô nào thành thì nói thẳng, không để mục trống", () => {
    const none = { ...base, lots: [lot({ result: "unsold", winningAmount: null, winnerName: null, winnerBidderNo: null })] };
    expect(all(none).join("\n")).toContain("không có tài sản nào đấu giá thành");
  });

  it("thiếu địa điểm thì ghi sàn trực tuyến, không để dấu chấm lửng", () => {
    expect(all().join("\n")).toContain("Sàn đấu giá trực tuyến taisandaugia.vn");
  });

  it("không có 'null' / 'undefined' lọt ra giấy", () => {
    const bare: MinutesPdfInput = {
      ...base,
      session: { ...base.session, code: null, venue: null },
      org: { name: "Tổ chức X", address: null, phone: null },
      auctioneer: null,
      lots: [lot({ startingPrice: null, winningAmount: null, winnerName: null, winnerBidderNo: null, result: "unsold" })],
    };
    expect(all(bare).some((s) => /null|undefined|NaN/.test(s))).toBe(false);
  });

  it("footer có thời điểm lập và đường dẫn tra cứu", () => {
    const dd = buildMinutesDocDefinition(base);
    const footer = texts((dd.footer as (a: number, b: number) => unknown)(1, 2)).join("\n");
    expect(footer).toContain("15:04 ngày 16/10/2026");
    expect(footer).toContain("SHA-256");
    expect(footer).toContain(base.session.code!);
    expect(footer).toContain("Trang 1/2");
  });

  it("in dọc A4 — biên bản là văn bản hành chính, không phải bảng tính", () => {
    expect(buildMinutesDocDefinition(base).pageOrientation).toBeUndefined();
  });
});
