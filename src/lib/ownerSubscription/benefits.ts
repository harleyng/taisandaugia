// Quyền lợi gói dịch vụ — chữ hiển thị và phép so "tốt hơn" từ danh mục cố định
// (owner_sub_benefits, migration 20261001300000). Không parse chữ tự do nữa: mọi giá trị
// là (hạn mức, chu kỳ) hoặc một mức số dạng 'level'.

import type { BenefitCycle, BenefitLineInput, BenefitValue, SubBenefitDef } from "./types";

export const BENEFIT_CYCLES: readonly BenefitCycle[] = ["day", "week", "month", "quarter", "year", "term"];

/** Nhãn chọn chu kỳ trong form admin. */
export const CYCLE_LABELS: Record<BenefitCycle, string> = {
  day: "Mỗi ngày",
  week: "Mỗi tuần",
  month: "Mỗi tháng",
  quarter: "Mỗi quý",
  year: "Mỗi năm",
  term: "Cả kỳ gói",
};

/** Hậu tố sau số lượng: "20 hồ sơ / tháng". 'term' không hậu tố ("5 GB"). */
export const CYCLE_SUFFIX: Record<BenefitCycle, string> = {
  day: " / ngày",
  week: " / tuần",
  month: " / tháng",
  quarter: " / quý",
  year: " / năm",
  term: "",
};

/** "còn 3 lượt quét tháng này". */
export const CYCLE_THIS: Record<BenefitCycle, string> = {
  day: "hôm nay",
  week: "tuần này",
  month: "tháng này",
  quarter: "quý này",
  year: "năm nay",
  term: "trong kỳ gói",
};

export const formatCount = (n: number) => n.toLocaleString("en-US");

/** Chữ của một dòng quyền lợi: "20 hồ sơ / tháng", "Không giới hạn", "Phản hồi trong 48 giờ". */
export function benefitValueText(v: BenefitValue): string {
  if (v.kind === "level") {
    return (v.level_format ?? "{n} " + v.unit).replace("{n}", formatCount(v.quota ?? 0));
  }
  if (v.quota === null) return "Không giới hạn";
  return `${formatCount(v.quota)} ${v.unit}${v.cycle ? CYCLE_SUFFIX[v.cycle] : ""}`;
}

/** Số tháng của một chu kỳ có lịch ('term' không quy đổi được). */
const CYCLE_MONTHS: Record<Exclude<BenefitCycle, "term">, number> = {
  day: 12 / 365,
  week: 12 / 52,
  month: 1,
  quarter: 3,
  year: 12,
};

/**
 * So hai giá trị cùng một quyền lợi: > 0 nếu `next` tốt hơn `prev`, < 0 nếu kém hơn, 0 nếu
 * ngang. null = không so được (một bên 'term', bên kia theo lịch). Hạn mức có lịch quy về
 * mỗi tháng; dạng 'level' càng nhỏ càng tốt.
 */
export function compareBenefitValue(prev: BenefitValue, next: BenefitValue): number | null {
  if (next.kind === "level" || prev.kind === "level") {
    return (prev.quota ?? 0) - (next.quota ?? 0);
  }
  if (prev.quota === null || next.quota === null) {
    return prev.quota === next.quota ? 0 : next.quota === null ? 1 : -1;
  }
  if (prev.cycle === next.cycle) return next.quota - prev.quota;
  if (prev.cycle === "term" || next.cycle === "term" || !prev.cycle || !next.cycle) return null;
  return next.quota / CYCLE_MONTHS[next.cycle] - prev.quota / CYCLE_MONTHS[prev.cycle];
}

/** Dòng form gói hợp lệ: hạn mức 0 = chưa nhập; null = không giới hạn (chỉ dạng 'quota', cần chu kỳ). */
export const benefitLineValid = (l: BenefitLineInput, def: SubBenefitDef | undefined) =>
  !!def && (def.kind === "level" ? (l.quota ?? 0) > 0 : (l.quota === null || l.quota > 0) && !!l.cycle);
