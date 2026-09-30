// Danh mục gói dịch vụ — giá theo kỳ, dòng "nâng lên" trên thẻ gói, bảng so sánh, nhãn nút.
//
// planTermPrice là BẢN SAO của owner_sub_plan_price() (SQL, migration 20260928100000).
// Giá thật khi thanh toán luôn do server tính lại (owner_sub_plan_quote).

import { SUB_FEATURE_LABELS, SUPPORTED_SUB_VARIANTS } from "./status";
import type { OwnerSubPlan, OwnerSubTermOption, PlanBenefit, PlanTier, SubVariantKey } from "./types";

/** Nhóm hiển thị của tính năng tính hạn mức (thẻ Hạn mức + bảng so sánh). */
export const SUB_FEATURE_GROUPS: Record<SubVariantKey, string> = {
  scan_3d_owner: "Tài sản",
  report_portfolio_owner: "Báo cáo",
};

/** Cụm danh từ trên thẻ gói: "10 lượt quét 3D / tháng". */
export const SUB_FEATURE_PHRASES: Record<SubVariantKey, string> = {
  scan_3d_owner: "lượt quét 3D",
  report_portfolio_owner: "lượt xem báo cáo danh mục",
};

/** Đơn vị trong bảng so sánh: "10 lượt / tháng". */
export const SUB_FEATURE_SHORT_UNITS: Record<SubVariantKey, string> = {
  scan_3d_owner: "lượt",
  report_portfolio_owner: "lượt xem",
};

export const PLAN_TIER_LABELS: Record<PlanTier, string> = {
  basic: "Cơ bản (sáng)",
  standard: "Tiêu chuẩn (xanh đậm)",
  premium: "Chuyên nghiệp (vàng kim)",
};

export const formatCount = (n: number) => n.toLocaleString("en-US");

/** "25,650,000" — nhóm nghìn bằng dấu phẩy (quy ước tiền của cổng). */
export const formatVndNumber = (n: number) => Math.round(n).toLocaleString("en-US");

/** Giá một kỳ: giá tháng × số tháng × (1 − chiết khấu), làm tròn nghìn đồng. */
export function planTermPrice(monthly: number, months: number, discountPct: number): number {
  return Math.round((monthly * months * (1 - (discountPct || 0) / 100)) / 1000) * 1000;
}

export const sortPlans = (plans: OwnerSubPlan[]) => [...plans].sort((a, b) => a.sort_order - b.sort_order);

export const activeTerms = (terms: OwnerSubTermOption[]) =>
  terms.filter((t) => t.is_active).sort((a, b) => a.months - b.months);

/** Hạn mức một tính năng trong gói: undefined = không có, null = không giới hạn. */
export function planQuota(plan: OwnerSubPlan, key: SubVariantKey): number | null | undefined {
  const e = plan.entitlements.find((x) => x.variant_key === key);
  return e ? e.monthly_quota : undefined;
}

const benefitKey = (b: Pick<PlanBenefit, "group" | "label">) => `${b.group.trim()}|${b.label.trim()}`;

/**
 * Độ lớn gần đúng của một giá trị quyền lợi tự nhập để so "nâng lên": "Không giới hạn" = ∞,
 * "1,000 thư / tháng" = 1000; không đọc được số ⇒ null (chỉ so khác / giống).
 */
export function benefitMagnitude(value: string | undefined): number | null {
  if (value === undefined) return null;
  const v = value.trim();
  if (/^không giới hạn/i.test(v)) return Infinity;
  const m = v.match(/^(\d[\d,.]*)/);
  if (!m) return null;
  const n = Number(m[1].replace(/[,.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Giá trị B có tốt hơn A không (A undefined = gói kia không có dòng này). */
function benefitImproved(prev: string | undefined, next: string): boolean {
  if (prev === undefined) return true;
  const a = benefitMagnitude(prev);
  const b = benefitMagnitude(next);
  if (a !== null && b !== null) return b > a;
  return prev.trim() !== next.trim();
}

/** Thẻ gói chỉ hiện chừng này dòng đầu; phần còn lại xem ở bảng so sánh ngay dưới. */
export const PLAN_CARD_MAX_LINES = 8;

export interface PlanCardLine {
  key: string;
  /** Phần chữ đậm. */
  strong: string;
  before?: string;
  after?: string;
  /** Gói liền trước không có dòng này. */
  isNew: boolean;
}

function meteredLine(key: SubVariantKey, quota: number | null, isNew: boolean): PlanCardLine {
  if (quota === null) {
    return { key, before: `${SUB_FEATURE_LABELS[key]} `, strong: "không giới hạn", isNew };
  }
  return { key, strong: formatCount(quota), after: ` ${SUB_FEATURE_PHRASES[key]} / tháng`, isNew };
}

const benefitLine = (b: PlanBenefit, isNew: boolean): PlanCardLine => ({
  key: benefitKey(b),
  before: `${b.label}: `,
  strong: b.value,
  isNew,
});

/**
 * Dòng trên thẻ gói. Gói đầu tiên: mọi thứ gói có. Các gói sau: chỉ những gì NÂNG LÊN so
 * với gói liền trước ("Mọi thứ trong X, nâng lên:").
 */
export function planCardLines(prev: OwnerSubPlan | null, plan: OwnerSubPlan): PlanCardLine[] {
  const lines: PlanCardLine[] = [];
  for (const key of SUPPORTED_SUB_VARIANTS) {
    const q = planQuota(plan, key);
    if (q === undefined) continue;
    if (!prev) {
      lines.push(meteredLine(key, q, false));
      continue;
    }
    const pq = planQuota(prev, key);
    if (pq === null) continue;
    if (pq === undefined || q === null || q > pq) lines.push(meteredLine(key, q, pq === undefined));
  }
  const prevBenefits = new Map((prev?.benefits ?? []).map((b) => [benefitKey(b), b.value]));
  for (const b of plan.benefits) {
    if (!prev) {
      lines.push(benefitLine(b, false));
      continue;
    }
    const pv = prevBenefits.get(benefitKey(b));
    if (benefitImproved(pv, b.value)) lines.push(benefitLine(b, pv === undefined));
  }
  return lines;
}

export type CompareCellKind = "no" | "value";

export interface CompareCell {
  text: string;
  kind: CompareCellKind;
  /** Tốt hơn gói hiện tại của Trạm (tô màu nhấn). */
  up: boolean;
}

export interface CompareRow {
  key: string;
  label: string;
  cells: Record<string, CompareCell>;
}

export interface CompareGroup {
  group: string;
  rows: CompareRow[];
}

const quotaText = (key: SubVariantKey, q: number | null | undefined) =>
  q === undefined ? "—" : q === null ? "Không giới hạn" : `${formatCount(q)} ${SUB_FEATURE_SHORT_UNITS[key]} / tháng`;

/**
 * Bảng so sánh: nhóm theo thứ tự xuất hiện; trong nhóm, tính năng tính hạn mức đứng trước,
 * rồi tới dòng quyền lợi (hợp của mọi gói, theo thứ tự gói). `currentId` = gói danh mục
 * đang dùng — ô tốt hơn gói đó được đánh dấu `up`.
 */
export function compareGroups(plans: OwnerSubPlan[], currentId: string | null): CompareGroup[] {
  const groups = new Map<string, CompareRow[]>();
  const push = (group: string, row: CompareRow) => {
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(row);
  };
  const current = plans.find((p) => p.id === currentId) ?? null;

  for (const key of SUPPORTED_SUB_VARIANTS) {
    if (!plans.some((p) => planQuota(p, key) !== undefined)) continue;
    const cells: Record<string, CompareCell> = {};
    const cq = current ? planQuota(current, key) : undefined;
    for (const p of plans) {
      const q = planQuota(p, key);
      const up = !!current && p.id !== current.id && q !== undefined && cq !== null && (cq === undefined || q === null || q > cq);
      cells[p.id] = { text: quotaText(key, q), kind: q === undefined ? "no" : "value", up };
    }
    push(SUB_FEATURE_GROUPS[key], { key, label: SUB_FEATURE_LABELS[key], cells });
  }

  // Thứ tự dòng theo gói CAO nhất trước — gói cao thường liệt kê đủ mọi dòng.
  const seen = new Map<string, PlanBenefit>();
  for (const p of [...plans].reverse()) for (const b of p.benefits) if (!seen.has(benefitKey(b))) seen.set(benefitKey(b), b);
  for (const [key, b] of seen) {
    const valueOf = (p: OwnerSubPlan | null) => p?.benefits.find((x) => benefitKey(x) === key)?.value;
    const cv = valueOf(current);
    const cells: Record<string, CompareCell> = {};
    for (const p of plans) {
      const v = valueOf(p);
      // Chữ tự do không đọc được số ⇒ không khẳng định "tốt hơn".
      const a = benefitMagnitude(cv);
      const bm = benefitMagnitude(v);
      const up = !!current && p.id !== current.id && v !== undefined
        && (cv === undefined || (a !== null && bm !== null && bm > a));
      cells[p.id] = { text: v ?? "—", kind: v === undefined ? "no" : "value", up };
    }
    push(b.group.trim(), { key, label: b.label, cells });
  }

  return [...groups].map(([group, rows]) => ({ group, rows }));
}

export type PlanCtaTone = "solid" | "gold" | "ghost";

export interface PlanCta {
  label: string;
  tone: PlanCtaTone;
  disabled: boolean;
}

interface CtaContext {
  plans: OwnerSubPlan[];
  /** Gói danh mục đang dùng (null: chưa có gói / gói riêng / đã huỷ). */
  currentPlanId: string | null;
  /** Trạm đang có gói (kể cả gói riêng) — quyết định "Đăng ký" hay "Chuyển sang". */
  hasPlan: boolean;
  pendingPlanId: string | null;
}

/** Nhãn + kiểu nút của một thẻ gói (theo design: Đăng ký / Nâng cấp lên / Chuyển sang). */
export function planCta(plan: OwnerSubPlan, ctx: CtaContext): PlanCta {
  if (plan.id === ctx.pendingPlanId) return { label: "Đã đặt từ kỳ sau", tone: "ghost", disabled: true };
  if (plan.id === ctx.currentPlanId) return { label: "Gói hiện tại", tone: "ghost", disabled: true };
  const strong: PlanCtaTone = plan.tier === "premium" ? "gold" : "solid";
  if (!ctx.hasPlan) return { label: `Đăng ký ${plan.name}`, tone: strong, disabled: false };
  const rank = (id: string | null) => ctx.plans.findIndex((p) => p.id === id);
  const cur = rank(ctx.currentPlanId);
  if (cur < 0 || rank(plan.id) > cur) {
    return { label: cur < 0 ? `Chuyển sang ${plan.name}` : `Nâng cấp lên ${plan.name}`, tone: strong, disabled: false };
  }
  return { label: `Chuyển sang ${plan.name}`, tone: "ghost", disabled: false };
}
