import { describe, it, expect } from "vitest";
import {
  deriveOrgAttributes,
  scoreOrg,
  rankOrgs,
  valueTierFromPrice,
  type AuctionOrgRow,
  type MatchCriteria,
} from "./orgMatching";

const mkOrg = (over: Partial<AuctionOrgRow> = {}): AuctionOrgRow => ({
  id: "00000000-0000-0000-0000-000000000001",
  name: "Công ty Đấu giá A",
  address: null,
  created_at: "2026-01-01T00:00:00Z",
  email: null,
  logo_url: null,
  org_type: 2,
  phone: null,
  province: "TP. Hồ Chí Minh",
  tax_code: null,
  // Các cột thêm sau bởi luồng Chi nhánh/AMC (prospects). Fixture phải phủ đủ
  // một dòng auction_organizations, nếu không kiểu AuctionOrgRow không thoả.
  group_id: null,
  name_tokens: null,
  normalized_name: null,
  parent_org_id: null,
  parent_source: null,
  ...over,
});

describe("deriveOrgAttributes", () => {
  it("là tất định cho cùng một id", () => {
    const org = mkOrg();
    const a = deriveOrgAttributes(org);
    const b = deriveOrgAttributes(org);
    expect(a).toEqual(b);
  });

  it("id khác nhau cho thuộc tính khác nhau", () => {
    const a = deriveOrgAttributes(mkOrg({ id: "aaaaaaaa-0000-0000-0000-000000000001" }));
    const b = deriveOrgAttributes(mkOrg({ id: "bbbbbbbb-0000-0000-0000-000000000002" }));
    // ít nhất một trường khác — xác suất trùng toàn bộ gần như 0
    const differs =
      a.successful_sessions !== b.successful_sessions ||
      a.commission_rate !== b.commission_rate ||
      a.has_online_platform !== b.has_online_platform;
    expect(differs).toBe(true);
  });

  it("luôn có ít nhất một chuyên môn và trong khoảng giá trị hợp lệ", () => {
    const attrs = deriveOrgAttributes(mkOrg());
    expect(attrs.specialties.length).toBeGreaterThanOrEqual(1);
    expect(attrs.commission_rate).toBeGreaterThanOrEqual(0.5);
    expect(attrs.commission_rate).toBeLessThanOrEqual(5);
    expect(attrs.successful_sessions).toBeGreaterThanOrEqual(20);
    expect(attrs.successful_sessions).toBeLessThanOrEqual(500);
    expect(attrs.experience_tier).toBeGreaterThanOrEqual(1);
    expect(attrs.experience_tier).toBeLessThanOrEqual(4);
  });
});

describe("valueTierFromPrice", () => {
  it("ánh xạ ngưỡng giá đúng", () => {
    expect(valueTierFromPrice(null)).toBe(2);
    expect(valueTierFromPrice(100_000_000)).toBe(1);
    expect(valueTierFromPrice(500_000_000)).toBe(2);
    expect(valueTierFromPrice(2_000_000_000)).toBe(3);
    expect(valueTierFromPrice(9_000_000_000)).toBe(4);
  });
});

describe("scoreOrg", () => {
  const criteria: MatchCriteria = {
    parentSlug: "bat-dong-san",
    province: "TP. Hồ Chí Minh",
    format: "truc_tiep",
    startingPrice: 2_000_000_000,
    acceptableCommissionPct: 3,
  };

  it("trả điểm 0–100 và breakdown cộng lại bằng score", () => {
    const r = scoreOrg(mkOrg(), criteria);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    const sum =
      r.breakdown.specialty +
      r.breakdown.locality +
      r.breakdown.format +
      r.breakdown.experience +
      r.breakdown.commission;
    expect(Number(sum.toFixed(1))).toBeCloseTo(r.score, 1);
  });

  it("cùng tỉnh được điểm địa bàn cao hơn khác tỉnh", () => {
    const same = scoreOrg(mkOrg({ province: "TP. Hồ Chí Minh" }), criteria);
    const diff = scoreOrg(mkOrg({ province: "Hà Nội" }), criteria);
    expect(same.breakdown.locality).toBeGreaterThan(diff.breakdown.locality);
  });

  it("đấu giá trực tuyến: org không có sàn bị 0 điểm hình thức", () => {
    // tìm một id mà has_online_platform = false
    let org = mkOrg();
    for (let i = 0; i < 50; i++) {
      const candidate = mkOrg({ id: `00000000-0000-0000-0000-0000000000${i.toString().padStart(2, "0")}` });
      if (!deriveOrgAttributes(candidate).has_online_platform) {
        org = candidate;
        break;
      }
    }
    const r = scoreOrg(org, { ...criteria, format: "truc_tuyen" });
    if (!deriveOrgAttributes(org).has_online_platform) {
      expect(r.breakdown.format).toBe(0);
    }
  });
});

describe("rankOrgs", () => {
  it("sắp xếp giảm dần theo score", () => {
    const orgs = Array.from({ length: 8 }, (_, i) =>
      mkOrg({ id: `00000000-0000-0000-0000-00000000000${i}`, province: i % 2 ? "Hà Nội" : "TP. Hồ Chí Minh" }),
    );
    const ranked = rankOrgs(orgs, {
      parentSlug: "xe-co",
      province: "TP. Hồ Chí Minh",
      format: "ca_hai",
      startingPrice: 800_000_000,
      acceptableCommissionPct: 2.5,
    });
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });
});
