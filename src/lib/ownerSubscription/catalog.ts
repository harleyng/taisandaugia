// Danh mục gói dịch vụ — giá theo kỳ, dòng "nâng lên" trên thẻ gói, bảng so sánh, nhãn nút.
//
// planTermPrice là BẢN SAO của owner_sub_plan_price() (SQL, migration 20260928100000).
// Giá thật khi thanh toán luôn do server tính lại (owner_sub_plan_quote).

import { benefitValueText, compareBenefitValue } from "./benefits";
import type { BenefitValue, OwnerSubPlan, OwnerSubTermOption, PlanBenefitLine, PlanTier } from "./types";

export const PLAN_TIER_LABELS: Record<PlanTier, string> = {
  basic: "Cơ bản (sáng)",
  standard: "Tiêu chuẩn (xanh đậm)",
  premium: "Chuyên nghiệp (vàng kim)",
};

export { formatCount } from "./benefits";

/** "25,650,000" — nhóm nghìn bằng dấu phẩy (quy ước tiền của cổng). */
export const formatVndNumber = (n: number) => Math.round(n).toLocaleString("en-US");

/** Giá một kỳ: giá tháng × số tháng × (1 − chiết khấu), làm tròn nghìn đồng. */
export function planTermPrice(monthly: number, months: number, discountPct: number): number {
  return Math.round((monthly * months * (1 - (discountPct || 0) / 100)) / 1000) * 1000;
}

export const sortPlans = (plans: OwnerSubPlan[]) => [...plans].sort((a, b) => a.sort_order - b.sort_order);

export const activeTerms = (terms: OwnerSubTermOption[]) =>
  terms.filter((t) => t.is_active).sort((a, b) => a.months - b.months);

const valueOf = (l: PlanBenefitLine): BenefitValue => ({
  kind: l.benefit.kind,
  unit: l.benefit.unit,
  level_format: l.benefit.level_format,
  quota: l.quota,
  cycle: l.cycle,
});

/** Chữ giá trị của một dòng quyền lợi trong gói: "20 hồ sơ / tháng". */
export const planBenefitText = (l: PlanBenefitLine) => benefitValueText(valueOf(l));

/** `next` tốt hơn `prev` không. Không so được (cả kỳ ↔ theo lịch) ⇒ coi là khác khi chữ khác. */
function improved(prev: PlanBenefitLine | undefined, next: PlanBenefitLine): boolean {
  if (!prev) return true;
  const d = compareBenefitValue(valueOf(prev), valueOf(next));
  return d === null ? planBenefitText(prev) !== planBenefitText(next) : d > 0;
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

/**
 * Dòng trên thẻ gói, theo thứ tự admin xếp. Gói đầu tiên: mọi thứ gói có. Các gói sau: chỉ
 * những gì NÂNG LÊN so với gói liền trước ("Mọi thứ trong X, nâng lên:").
 */
export function planCardLines(prev: OwnerSubPlan | null, plan: OwnerSubPlan): PlanCardLine[] {
  const prevByKey = new Map((prev?.benefits ?? []).map((l) => [l.benefit_key, l]));
  return plan.benefits
    .filter((l) => !prev || improved(prevByKey.get(l.benefit_key), l))
    .map((l) => ({
      key: l.benefit_key,
      before: `${l.benefit.label}: `,
      strong: planBenefitText(l),
      isNew: !!prev && !prevByKey.has(l.benefit_key),
    }));
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

/**
 * Bảng so sánh: hợp mọi dòng quyền lợi, thứ tự theo gói CAO nhất trước (gói cao thường liệt
 * kê đủ mọi dòng), nhóm theo thứ tự xuất hiện. `currentId` = gói danh mục đang dùng — ô tốt
 * hơn gói đó được đánh dấu `up`.
 */
export function compareGroups(plans: OwnerSubPlan[], currentId: string | null): CompareGroup[] {
  const current = plans.find((p) => p.id === currentId) ?? null;
  const lineOf = (p: OwnerSubPlan | null, key: string) => p?.benefits.find((l) => l.benefit_key === key);

  const seen = new Map<string, PlanBenefitLine>();
  for (const p of [...plans].reverse()) for (const l of p.benefits) if (!seen.has(l.benefit_key)) seen.set(l.benefit_key, l);

  const groups = new Map<string, CompareRow[]>();
  for (const [key, ref] of seen) {
    const cur = lineOf(current, key);
    const cells: Record<string, CompareCell> = {};
    for (const p of plans) {
      const l = lineOf(p, key);
      const d = l && cur ? compareBenefitValue(valueOf(cur), valueOf(l)) : null;
      const up = !!current && p.id !== current.id && !!l && (!cur || (d !== null && d > 0));
      cells[p.id] = { text: l ? planBenefitText(l) : "—", kind: l ? "value" : "no", up };
    }
    const group = ref.benefit.group_name;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push({ key, label: ref.benefit.label, cells });
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
