import { describe, expect, it } from "vitest";
import { isSmsSafe, SMS_MAX } from "@/lib/outreach/sms";
import { EMPTY_DRAFTS, parseFacts, type FactsSnapshot } from "./campaigns";
import {
  factLines,
  factsDiffer,
  LINK_PLACEHOLDER,
  NOT_ANNOUNCED_NOTE,
  renderChannel,
  renderFlyer,
  smsSenderShort,
  suggestDrafts,
} from "./composer";

const announced = {
  listing_id: "l1",
  title: "Kho bãi 84.4m² tại Trung tâm, Quảng Ninh",
  category_slug: "kho-xuong",
  province: "Quảng Ninh",
  district: "Trung tâm",
  area: 84.4,
  announced: true,
  source: "notice",
  starting_price: 36054723587,
  deposit: 3600000000,
  auction_at: "2026-10-22T02:00:00+00:00",
  registration_end_at: "2026-10-17T10:00:00+00:00",
  org_name: "Công ty Đấu giá Hợp danh Đông Dương",
  org_phone: "0236 3654 321",
};
const notAnnounced: Record<string, unknown> = { ...announced, listing_id: "l2", title: "Nhà phố Đống Đa", announced: false, source: null };

const facts = (assets: object[]): FactsSnapshot => parseFacts({ assets });

describe("factLines", () => {
  it("tài sản đã công bố: giá + hạn + tổ chức, tiền tách dấu phẩy", () => {
    const lines = factLines(facts([announced]).assets[0]);
    const byLabel = Object.fromEntries(lines.map((l) => [l.label, l.value]));
    expect(byLabel["Giá khởi điểm"]).toBe("36,054,723,587₫");
    expect(byLabel["Hạn đăng ký"]).toBe("17:00 ngày 17/10/2026");
    expect(byLabel["Tổ chức đấu giá"]).toBe("Công ty Đấu giá Hợp danh Đông Dương — 0236 3654 321");
    expect(byLabel["Vị trí"]).toBe("Quảng Ninh");
  });

  it("chưa công bố (D4): không có giá, đặt trước, hạn, giờ", () => {
    const labels = factLines(facts([notAnnounced]).assets[0]).map((l) => l.label);
    expect(labels).not.toContain("Giá khởi điểm");
    expect(labels).not.toContain("Tiền đặt trước");
    expect(labels).not.toContain("Hạn đăng ký");
    expect(labels).not.toContain("Thời gian đấu giá");
    expect(labels).toContain("Tổ chức đấu giá");
  });
});

describe("suggestDrafts", () => {
  it("không chứa giá hay ngày — những thứ đó nằm ở khối khoá", () => {
    const d = suggestDrafts(facts([announced]));
    for (const text of [d.email.subject, d.email.body, d.zalo.body, d.facebook.body, d.sms.body]) {
      expect(text).not.toMatch(/36,054|₫|2026/);
    }
    expect(d.email.subject).toMatch(/^Tài sản đấu giá: /);
  });

  it("SMS gợi ý không dấu và vừa giới hạn", () => {
    const d = suggestDrafts(facts([announced, notAnnounced]));
    expect(isSmsSafe(d.sms.body)).toBe(true);
    expect(d.sms.body.length).toBeLessThanOrEqual(80);
    expect(d.zalo.body).toMatch(/^2 tài sản/);
  });
});

describe("renderChannel", () => {
  const f = facts([announced, notAnnounced]);
  const drafts = { ...EMPTY_DRAFTS, zalo: { body: "Mô tả của cán bộ" }, sms: { body: "Kho bai Quang Ninh" } };

  it("chưa duyệt ⇒ chỗ giữ link; đã duyệt ⇒ link riêng từng tài sản", () => {
    expect(renderChannel("zalo", f, drafts, null, "BIDV").texts[0]).toContain(LINK_PLACEHOLDER);
    const text = renderChannel("zalo", f, drafts, { l1: "https://x/l/aaaa1111", l2: "https://x/l/bbbb2222" }, "BIDV").texts[0];
    expect(text).toContain("https://x/l/aaaa1111");
    expect(text).toContain("https://x/l/bbbb2222");
    expect(text.startsWith("Mô tả của cán bộ")).toBe(true);
    expect(text).toContain(NOT_ANNOUNCED_NOTE);
  });

  it("SMS: mỗi tài sản một tin, ≤ 160 ký tự, không dấu, luôn giữ link", () => {
    const { texts } = renderChannel("sms", f, drafts, { l1: "https://tsdg.vn/l/aaaa1111", l2: "https://tsdg.vn/l/bbbb2222" }, "BIDV");
    expect(texts).toHaveLength(2);
    for (const t of texts) {
      expect(t.length).toBeLessThanOrEqual(SMS_MAX);
      expect(isSmsSafe(t)).toBe(true);
      expect(t.startsWith("[BIDV]")).toBe(true);
    }
    expect(texts[0]).toContain("https://tsdg.vn/l/aaaa1111");
    expect(texts[0]).toContain("gia KD");
    expect(texts[1]).not.toContain("gia KD");
  });

  it("Email tách tiêu đề", () => {
    const r = renderChannel("email", f, { ...drafts, email: { subject: " Tiêu đề ", body: "Thân" } }, null, "BIDV");
    expect(r.subject).toBe("Tiêu đề");
    expect(r.texts[0].startsWith("Thân")).toBe(true);
  });
});

describe("smsSenderShort", () => {
  it("ưu tiên viết tắt, bỏ dấu và chữ thừa", () => {
    expect(smsSenderShort({ abbreviations: ["BIDV"], primary_name: "Ngân hàng TMCP Đầu tư" })).toBe("BIDV");
    expect(smsSenderShort({ abbreviations: [], primary_name: "Ngân hàng TMCP Á Châu" })).toBe("A Chau");
    expect(smsSenderShort(null)).toBe("Thong bao");
  });
});

describe("renderFlyer", () => {
  it("dòng 3 là tên chiến dịch; mỗi tài sản có link", () => {
    const t = renderFlyer("Đẩy kho bãi", "BIDV CN Quảng Ninh", facts([announced]), EMPTY_DRAFTS, { l1: "https://x/l/aaaa1111" });
    expect(t.split("\n")[2]).toBe("Đẩy kho bãi");
    expect(t).toContain("Xem chi tiết: https://x/l/aaaa1111");
  });
});

describe("factsDiffer", () => {
  it("chỉ báo khi dòng dữ kiện hiển thị đổi", () => {
    const a = facts([announced]);
    expect(factsDiffer(a, facts([{ ...announced, image_url: "https://x/y.jpg" }]))).toBe(false);
    expect(factsDiffer(a, facts([{ ...announced, starting_price: 30000000000 }]))).toBe(true);
    expect(factsDiffer(a, facts([{ ...announced, announced: false }]))).toBe(true);
  });
});
