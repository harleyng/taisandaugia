import { describe, it, expect } from "vitest";
import { orgFitSentence } from "./orgFit";
import {
  MATCH_WEIGHTS,
  type AuctionOrgRow,
  type MatchBreakdown,
  type MatchCriteria,
  type OrgMatchResult,
  type OrgMockAttributes,
} from "./orgMatching";

// Dựng OrgMatchResult TRỰC TIẾP thay vì gọi scoreOrg(): attrs sinh tất định từ
// org.id nên đi qua engine sẽ khiến test phụ thuộc vào seededRand. Ở đây chỉ kiểm
// một việc: từ breakdown + tiêu chí, câu chữ có nói đúng sự thật không.

const org = (over: Partial<AuctionOrgRow> = {}): AuctionOrgRow =>
  ({
    id: "org-1",
    name: "Công ty Đấu giá Hợp Thành",
    province: "TP. Hồ Chí Minh",
    address: null,
    created_at: "2026-01-01T00:00:00Z",
    email: null,
    group_id: null,
    logo_url: null,
    name_tokens: null,
    normalized_name: null,
    org_type: 2,
    parent_org_id: null,
    parent_source: null,
    phone: null,
    tax_code: null,
    ...over,
  }) as AuctionOrgRow;

const attrs = (over: Partial<OrgMockAttributes> = {}): OrgMockAttributes => ({
  specialties: ["bat-dong-san"],
  has_online_platform: true,
  experience_tier: 3,
  successful_sessions: 312,
  total_sessions: 380,
  commission_rate: 1.8,
  facilities: [],
  ...over,
});

/** breakdown theo TỈ LỆ đạt được của từng tín hiệu (1 = full điểm). */
const bd = (r: Partial<Record<keyof MatchBreakdown, number>>): MatchBreakdown => ({
  specialty: MATCH_WEIGHTS.specialty * (r.specialty ?? 0.5),
  locality: MATCH_WEIGHTS.locality * (r.locality ?? 0.5),
  format: MATCH_WEIGHTS.format * (r.format ?? 0.5),
  experience: MATCH_WEIGHTS.experience * (r.experience ?? 0.5),
  commission: MATCH_WEIGHTS.commission * (r.commission ?? 0.5),
});

const result = (
  breakdown: MatchBreakdown,
  overrides: { org?: Partial<AuctionOrgRow>; attrs?: Partial<OrgMockAttributes> } = {},
): OrgMatchResult => ({
  org: org(overrides.org),
  attrs: attrs(overrides.attrs),
  score: Object.values(breakdown).reduce((a, b) => a + b, 0),
  breakdown,
});

/** Tiêu chí ĐẦY ĐỦ — mọi tín hiệu đều được phép nhắc tới. */
const full: MatchCriteria = {
  parentSlug: "bat-dong-san",
  province: "TP. Hồ Chí Minh",
  format: "truc_tuyen",
  startingPrice: 8_500_000_000,
  acceptableCommissionPct: 2,
};

describe("orgFitSentence — điểm mạnh", () => {
  it("nêu chuyên môn và địa bàn khi cả hai đạt full", () => {
    const s = orgFitSentence(result(bd({ specialty: 1, locality: 1 })), full);
    expect(s).toContain("bất động sản");
    expect(s).toContain("TP. Hồ Chí Minh");
  });

  it("luôn kèm số phiên thành công làm mốc uy tín", () => {
    const s = orgFitSentence(result(bd({ specialty: 1 })), full);
    expect(s).toContain("312 phiên đấu giá thành công");
  });

  it("giới hạn 2 mệnh đề khẳng định dù cả 5 tín hiệu đều full", () => {
    const s = orgFitSentence(
      result(bd({ specialty: 1, locality: 1, format: 1, experience: 1, commission: 1 })),
      full,
    );
    // 2 mệnh đề + số phiên = tối đa 2 dấu phẩy trước "và"/hết câu.
    expect(s.split(",").length).toBeLessThanOrEqual(3);
  });

  it("viết hoa chữ đầu câu và kết bằng dấu chấm", () => {
    const s = orgFitSentence(result(bd({ specialty: 1 })), full);
    expect(s[0]).toBe(s[0].toUpperCase());
    expect(s.endsWith(".")).toBe(true);
  });
});

describe("orgFitSentence — lưu ý", () => {
  it("nói thẳng khi tổ chức không chuyên nhóm tài sản này", () => {
    const s = orgFitSentence(result(bd({ specialty: 0.3, locality: 1 })), full);
    expect(s).toContain("nhưng");
    expect(s).toContain("chưa ghi nhận kinh nghiệm");
  });

  it("nói thẳng khi thiếu sàn trực tuyến mà hồ sơ cần trực tuyến", () => {
    const s = orgFitSentence(
      result(bd({ specialty: 1, format: 0 }), { attrs: { has_online_platform: false } }),
      full,
    );
    expect(s).toContain("chưa có sàn đấu giá trực tuyến");
  });

  it("chỉ nêu MỘT lưu ý khi đã có điểm mạnh để cân lại", () => {
    const s = orgFitSentence(result(bd({ specialty: 1, locality: 0, format: 0, commission: 0 })), full);
    expect(s.match(/nhưng/g)).toHaveLength(1);
    // Một mệnh đề lưu ý ⇒ không nối thêm bằng "và" ở phần sau chữ "nhưng".
    expect(s.split("nhưng")[1]).not.toContain(" và ");
  });

  it("nêu HAI lưu ý khi không có điểm mạnh nào — kể một nửa là khen hộ", () => {
    const s = orgFitSentence(result(bd({ specialty: 0.3, locality: 0, format: 0, experience: 0, commission: 0 })), full);
    expect(s).toContain("chưa có sàn đấu giá trực tuyến");
    expect(s.split("nhưng")[1]).toContain(" và ");
  });

  it("vẫn ra câu hoàn chỉnh khi không có điểm mạnh nào", () => {
    const s = orgFitSentence(result(bd({ specialty: 0.3, locality: 0, format: 0, experience: 0, commission: 0 })), full);
    expect(s.length).toBeGreaterThan(20);
    expect(s.endsWith(".")).toBe(true);
  });
});

describe("orgFitSentence — không bịa khi thiếu dữ liệu", () => {
  it("không nhắc địa bàn khi hồ sơ chưa chọn tỉnh", () => {
    const c: MatchCriteria = { ...full, province: null };
    // locality = 50% mặc định của engine; nếu bị coi là tín hiệu thật sẽ lọt vào câu.
    const s = orgFitSentence(result(bd({ specialty: 1, locality: 1 })), c);
    expect(s).not.toContain("địa bàn");
    expect(s).not.toContain("tỉnh/thành");
  });

  it("không nhắc kinh nghiệm theo tầm giá khi chủ tài sản nhờ định giá", () => {
    const c: MatchCriteria = { ...full, startingPrice: null };
    const s = orgFitSentence(result(bd({ specialty: 1, experience: 1 })), c);
    expect(s).not.toContain("tầm giá");
  });

  it("không nhắc thù lao khi chủ tài sản không khai mức chấp nhận", () => {
    const c: MatchCriteria = { ...full, acceptableCommissionPct: null };
    const s = orgFitSentence(result(bd({ specialty: 1, commission: 1 })), c);
    expect(s).not.toContain("thù lao");
  });

  it("không khen 'có sàn trực tuyến' khi hồ sơ chỉ cần đấu giá trực tiếp", () => {
    const c: MatchCriteria = { ...full, format: "truc_tiep" };
    const s = orgFitSentence(result(bd({ specialty: 1, format: 1 })), c);
    expect(s).not.toContain("sàn đấu giá trực tuyến");
  });
});
