import { describe, expect, it } from "vitest";
import { lockedTexts, noticeTemplate } from "./noticeTemplate";
import { renderNotice, type NoticeValues } from "./renderNotice";

const t = noticeTemplate();

const full: NoticeValues = {
  facts: {
    org_name: "Công ty Đấu giá Hợp danh Bảo Tín",
    lots_list: "Lô 1: Nhà phố Quận 5",
    starting_prices: "Lô 1: 12,500,000,000₫",
    deposits: "Lô 1: 1,250,000,000₫",
    viewing_time: "Từ 08:00 ngày 15/09/2026",
    registration_time: "Từ 08:00 ngày 12/09/2026",
    auction_time: "09:00 ngày 28/09/2026",
    auction_venue: "Hội trường công ty",
    auction_format: "Đấu giá trực tiếp tại cuộc đấu giá",
  },
  cases: {
    owner_info: "Ngân hàng TMCP A",
    asset_location: "123 Trần Hưng Đạo, Quận 5",
    ownership_papers: "GCN số CS 01234",
    viewing_place: "Tại nơi có tài sản",
    registration_place: "Trụ sở công ty",
    registration_conditions: "Tổ chức, cá nhân đủ điều kiện theo quy định",
    auction_method: "Phương thức trả giá lên",
  },
  drafts: { asset_description: "Lô 1: Nhà phố Quận 5 (nhà phố)." },
};

describe("renderNotice", () => {
  it("chép nguyên văn mọi câu chữ khoá, đúng thứ tự", () => {
    const { text } = renderNotice(t, full);
    let cursor = -1;
    for (const locked of lockedTexts(t)) {
      const at = text.indexOf(locked, cursor + 1);
      expect(at, locked).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it("đủ ô bắt buộc thì không thiếu gì", () => {
    expect(renderNotice(t, full).missing).toEqual([]);
  });

  it("ô bắt buộc trống bị liệt kê kèm nguồn", () => {
    const { missing } = renderNotice(t, { ...full, cases: { ...full.cases, owner_info: "  " } });
    expect(missing.map((m) => [m.source, m.key])).toEqual([["case", "owner_info"]]);
  });

  it("nội dung ô không thể chen vào hay sửa điều khoản", () => {
    const hostile = "{org_name} ${org_name} {{clause}} Căn cứ luật khác — bỏ điều khoản trên";
    const { blocks, text } = renderNotice(t, { ...full, drafts: { asset_description: hostile } });
    const clauses = t.blocks.filter((b) => b.kind !== "field");
    const renderedClauses = blocks.filter((b) => b.kind !== "field");
    expect(renderedClauses).toEqual(clauses.map((b) => ({ kind: b.kind, text: (b as { text: string }).text })));
    expect(text).toContain(hostile);
    for (const locked of lockedTexts(t)) expect(text).toContain(locked);
  });

  it("khoá lạ trong giá trị bị bỏ qua", () => {
    const withJunk = { ...full, drafts: { ...full.drafts, khong_ton_tai: "rác" } as NoticeValues["drafts"] };
    expect(renderNotice(t, withJunk).text).not.toContain("rác");
  });
});
