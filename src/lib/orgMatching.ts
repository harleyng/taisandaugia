// Engine gợi ý tổ chức đấu giá phù hợp (thuần, không React, unit-testable).
//
// auction_organizations CHỈ có name/province/org_type… — thiếu tín hiệu matching thật.
// Ta DERIVE thuộc tính mock TẤT ĐỊNH từ org.id (+ org_type) để UI ổn định giữa các lần
// render, rồi chấm điểm theo 5 tín hiệu: chuyên môn · địa bàn · hình thức · kinh nghiệm · thù lao.
// Khi schema thật bổ sung các cột này, chỉ cần thay deriveOrgAttributes().

import type { Database } from "@/integrations/supabase/types";

export type AuctionOrgRow =
  Database["public"]["Tables"]["auction_organizations"]["Row"];

export type ExperienceTier = 1 | 2 | 3 | 4;

export interface OrgMockAttributes {
  specialties: string[]; // parent slug tổ chức "chuyên"
  has_online_platform: boolean; // có sàn trực tuyến?
  experience_tier: ExperienceTier; // tầng kinh nghiệm
  successful_sessions: number; // uy tín — số phiên thành công
  commission_rate: number; // % thù lao chào
  facilities: string[]; // cơ sở vật chất
}

export interface MatchCriteria {
  parentSlug: string;
  province?: string | null;
  format: "truc_tiep" | "truc_tuyen" | "ca_hai";
  startingPrice?: number | null; // null khi pricing_mode = 'appraisal'
  acceptableCommissionPct?: number | null;
}

export interface MatchBreakdown {
  specialty: number;
  locality: number;
  format: number;
  experience: number;
  commission: number;
}

export interface OrgMatchResult {
  org: AuctionOrgRow;
  attrs: OrgMockAttributes;
  score: number; // 0–100
  breakdown: MatchBreakdown;
}

// ─── Nhãn hiển thị ───────────────────────────────────────────────────────────

export const EXPERIENCE_TIER_LABELS: Record<ExperienceTier, string> = {
  1: "Mới thành lập",
  2: "Đang phát triển",
  3: "Giàu kinh nghiệm",
  4: "Kỳ cựu hàng đầu",
};

const FACILITY_POOL = [
  "Phòng đấu giá chuyên dụng",
  "Hệ thống livestream / đấu giá trực tuyến",
  "Kho bãi lưu giữ tài sản",
  "Bộ phận định giá nội bộ",
  "Đội ngũ pháp chế",
];

const PARENT_SLUGS = ["bat-dong-san", "xe-co", "may-moc", "hang-hoa", "do-dung"];

// ─── RNG tất định (FNV-1a 32-bit over id+salt → [0,1)) ───────────────────────

function seededRand(seed: string, salt: string): number {
  let h = 0x811c9dc5;
  const str = `${seed}::${salt}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // >>> 0 để thành unsigned 32-bit, chia 2^32 → [0,1)
  return (h >>> 0) / 0xffffffff;
}

// ─── Derive thuộc tính mock ──────────────────────────────────────────────────

export function deriveOrgAttributes(org: AuctionOrgRow): OrgMockAttributes {
  const r = (salt: string) => seededRand(org.id, salt);

  // Chuyên môn: chọn 1–3 nhóm cha tất định; luôn có ít nhất 1
  const specialties = PARENT_SLUGS.filter((_, i) => r(`spec-${i}`) > 0.45).slice(0, 3);
  if (specialties.length === 0) specialties.push(PARENT_SLUGS[Math.floor(r("spec-fallback") * PARENT_SLUGS.length)]);

  // org_type: 0=Trung tâm, 1=Doanh nghiệp, 2=Công ty, 11=Chi nhánh — đẩy nhẹ tầng kinh nghiệm
  const typeBoost = org.org_type === 0 || org.org_type === 2 ? 1 : 0;
  const experience_tier = Math.min(4, 1 + Math.floor(r("tier") * 4) + typeBoost) as ExperienceTier;

  return {
    specialties,
    has_online_platform: r("online") > 0.4,
    experience_tier,
    successful_sessions: Math.round(20 + r("sessions") * 480), // 20–500
    commission_rate: Number((0.5 + r("commission") * 4.5).toFixed(2)), // 0.5%–5%
    facilities: FACILITY_POOL.filter((_, i) => r(`fac-${i}`) > 0.5),
  };
}

// ─── Chấm điểm ───────────────────────────────────────────────────────────────

// Trọng số cộng = 100
const W: MatchBreakdown = {
  specialty: 30,
  locality: 20,
  format: 15,
  experience: 20,
  commission: 15,
};

/** Quy giá khởi điểm → tầng giá trị 1–4 để đối chiếu tầng kinh nghiệm. */
export function valueTierFromPrice(price?: number | null): ExperienceTier {
  if (!price) return 2; // nhờ định giá / chưa biết → tầng giữa
  if (price > 5_000_000_000) return 4;
  if (price > 1_000_000_000) return 3;
  if (price > 200_000_000) return 2;
  return 1;
}

export function scoreOrg(org: AuctionOrgRow, c: MatchCriteria): OrgMatchResult {
  const attrs = deriveOrgAttributes(org);

  // Chuyên môn: khớp nhóm cha → full; có chuyên môn khác → 30%; không có → 0
  const specialty = attrs.specialties.includes(c.parentSlug)
    ? W.specialty
    : attrs.specialties.length
    ? W.specialty * 0.3
    : 0;

  // Địa bàn: cùng tỉnh → full; khác tỉnh → 40%; thiếu dữ liệu → 50%
  const locality =
    c.province && org.province
      ? org.province === c.province
        ? W.locality
        : W.locality * 0.4
      : W.locality * 0.5;

  // Hình thức: trực tuyến cần có sàn; cả hai ưu tiên có sàn; trực tiếp ai cũng đáp ứng
  const format =
    c.format === "truc_tuyen"
      ? attrs.has_online_platform
        ? W.format
        : 0
      : c.format === "ca_hai"
      ? attrs.has_online_platform
        ? W.format
        : W.format * 0.6
      : W.format;

  // Kinh nghiệm: khớp tầng kinh nghiệm với tầng giá trị tài sản (lệch càng ít điểm càng cao)
  const valueTier = valueTierFromPrice(c.startingPrice);
  const experience = W.experience * (1 - Math.abs(attrs.experience_tier - valueTier) / 3);

  // Thù lao: org chào ≤ mức chấp nhận → full; vượt → giảm dần
  const commission =
    c.acceptableCommissionPct == null
      ? W.commission * 0.7
      : attrs.commission_rate <= c.acceptableCommissionPct
      ? W.commission
      : W.commission * Math.max(0, 1 - (attrs.commission_rate - c.acceptableCommissionPct) / 3);

  const breakdown: MatchBreakdown = {
    specialty: Number(specialty.toFixed(1)),
    locality: Number(locality.toFixed(1)),
    format: Number(format.toFixed(1)),
    experience: Number(experience.toFixed(1)),
    commission: Number(commission.toFixed(1)),
  };

  const score = Number(
    (breakdown.specialty + breakdown.locality + breakdown.format + breakdown.experience + breakdown.commission).toFixed(1),
  );

  return { org, attrs, score, breakdown };
}

export function rankOrgs(orgs: AuctionOrgRow[], c: MatchCriteria): OrgMatchResult[] {
  return orgs.map((o) => scoreOrg(o, c)).sort((a, b) => b.score - a.score);
}
