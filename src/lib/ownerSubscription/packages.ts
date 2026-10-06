// Bộ gói (design "Danh Muc Goi - Admin v3") — nháp form, số liệu danh sách, kỳ mua.
//
// Luật ở server (migration 20261004230000): mỗi Trạm thuộc đúng một bộ (chưa gán = bộ mặc
// định), trong một bộ không có hai kỳ trùng số tháng, gói chỉ ngừng bán chứ không xoá.

import { formatVndNumber } from "./catalog";
import type {
  AdminOwnerSubRow,
  AdminSubPackage,
  BenefitLineInput,
  OverageMode,
  OwnerSubPlan,
  PlanTier,
  SubBenefitDef,
  SubTerm,
} from "./types";

// ─── Nháp ────────────────────────────────────────────────────────────────────

/** Gói đang sửa trong form. `key` định danh cả gói chưa lưu (id = null). */
export interface PlanDraft {
  key: string;
  id: string | null;
  name: string;
  fit_line: string;
  highlight_line: string;
  tier: PlanTier;
  monthly_price_vnd: number;
  overage_mode: OverageMode;
  is_active: boolean;
  benefits: BenefitLineInput[];
}

export interface PackageDraft {
  id: string | null;
  name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  /** `key` của gói "Phổ biến". */
  featured_key: string | null;
  term_ids: string[];
  workspace_ids: string[];
  plans: PlanDraft[];
}

let draftSeq = 0;
export const newDraftKey = () => `new-${Date.now().toString(36)}-${++draftSeq}`;

export const blankPlanDraft = (): PlanDraft => ({
  key: newDraftKey(),
  id: null,
  name: "",
  fit_line: "",
  highlight_line: "",
  tier: "standard",
  monthly_price_vnd: 0,
  overage_mode: "credits",
  is_active: true,
  benefits: [{ benefit_key: "scan_3d_owner", quota: 10, cycle: "month" }],
});

export const blankPackageDraft = (): PackageDraft => ({
  id: null,
  name: "",
  description: "",
  is_default: false,
  is_active: true,
  featured_key: null,
  term_ids: [],
  workspace_ids: [],
  plans: [],
});

export const planToDraft = (p: OwnerSubPlan): PlanDraft => ({
  key: p.id,
  id: p.id,
  name: p.name,
  fit_line: p.fit_line ?? "",
  highlight_line: p.highlight_line ?? "",
  tier: p.tier,
  monthly_price_vnd: p.monthly_price_vnd,
  overage_mode: p.overage_mode,
  is_active: p.is_active,
  benefits: p.benefits.map((l) => ({ benefit_key: l.benefit_key, quota: l.quota, cycle: l.cycle })),
});

export const packageToDraft = (k: AdminSubPackage): PackageDraft => ({
  id: k.id,
  name: k.name,
  description: k.description ?? "",
  is_default: k.is_default,
  is_active: k.is_active,
  featured_key: k.featured_plan_id,
  term_ids: [...k.term_ids],
  workspace_ids: [...k.workspace_ids],
  plans: k.plans.map(planToDraft),
});

/** Thân gói gửi admin_owner_sub_plan_save / phần tử gói mới của admin_owner_sub_package_save. */
export const planPayload = (d: PlanDraft) => ({
  name: d.name.trim(),
  fit_line: d.fit_line.trim(),
  highlight_line: d.highlight_line.trim(),
  tier: d.tier,
  monthly_price_vnd: d.monthly_price_vnd,
  overage_mode: d.overage_mode,
  is_active: d.is_active,
  benefits: d.benefits,
});

/** p_plans của admin_owner_sub_package_save: gói đã có chỉ gửi id (đổi thứ tự), gói mới gửi đủ. */
export const packagePlansPayload = (d: PackageDraft) =>
  d.plans.map((p) => ({
    ...(p.id ? { id: p.id } : planPayload(p)),
    featured: p.key === d.featured_key,
  }));

/** Gói nháp → dạng cổng chủ tài sản đọc (xem trước thẻ gói). Dòng thiếu định nghĩa bị bỏ. */
export function draftToOwnerPlan(d: PlanDraft, defs: Map<string, SubBenefitDef>, featured: boolean, sort = 0): OwnerSubPlan {
  return {
    id: d.key,
    name: d.name.trim() || "Tên gói",
    fit_line: d.fit_line.trim() || null,
    highlight_line: d.highlight_line.trim() || null,
    tier: d.tier,
    monthly_price_vnd: d.monthly_price_vnd,
    overage_mode: d.overage_mode,
    is_featured: featured,
    is_active: d.is_active,
    sort_order: sort,
    benefits: d.benefits.flatMap((l, i) => {
      const benefit = defs.get(l.benefit_key);
      return benefit ? [{ ...l, sort_order: i + 1, benefit }] : [];
    }),
  };
}

/** Lý do chưa lưu được bộ gói (rỗng = hợp lệ). */
export function packageMissing(d: PackageDraft): string[] {
  const out: string[] = [];
  if (d.name.trim().length < 2) out.push("tên bộ");
  if (!d.plans.length) out.push("ít nhất 1 gói");
  if (!d.term_ids.length) out.push("ít nhất 1 kỳ mua");
  return out;
}

// ─── Kỳ mua ──────────────────────────────────────────────────────────────────

export const sortTerms = (terms: SubTerm[]) =>
  [...terms].sort((a, b) => a.months - b.months || a.discount_pct - b.discount_pct);

/** "12 tháng · −10%" — dùng ở nút chọn kỳ và tiêu đề cột giá. */
export const termLabel = (t: Pick<SubTerm, "months" | "discount_pct">, sep = " · ") =>
  `${t.months} tháng${t.discount_pct ? `${sep}−${t.discount_pct}%` : ""}`;

/** "12 th −10%" — chip gọn trong bảng danh sách. */
export const termChip = (t: Pick<SubTerm, "months" | "discount_pct">) =>
  `${t.months} th${t.discount_pct ? ` −${t.discount_pct}%` : ""}`;

/**
 * Bật / tắt một kỳ của bộ. Bật một kỳ trùng số tháng với kỳ đã chọn ⇒ THAY kỳ đó (một bộ
 * không có hai kỳ cùng số tháng — checkout định danh kỳ bằng số tháng).
 */
export function toggleTerm(selected: string[], term: SubTerm, library: SubTerm[]): string[] {
  if (selected.includes(term.id)) return selected.filter((id) => id !== term.id);
  const byId = new Map(library.map((t) => [t.id, t]));
  return [...selected.filter((id) => byId.get(id)?.months !== term.months), term.id];
}

/** Kỳ đã chọn của bộ, theo số tháng. */
export const packageTerms = (termIds: string[], library: SubTerm[]) =>
  sortTerms(library.filter((t) => termIds.includes(t.id)));

export const TERM_MONTHS_MAX = 36;
export const TERM_DISCOUNT_MAX = 50;

export interface TermInput {
  months: string;
  discount: string;
  note: string;
}

/** Kỳ nhập tay hợp lệ: 1–36 tháng nguyên, chiết khấu 0–50 %, không trùng (tháng, %) kỳ khác. */
export function termInputError(r: TermInput, library: SubTerm[], selfId: string | null): string | null {
  const m = Number(r.months);
  const d = Number(r.discount === "" ? NaN : r.discount);
  if (!Number.isInteger(m) || m < 1 || m > TERM_MONTHS_MAX) return "Kỳ từ 1 đến 36 tháng.";
  if (!Number.isFinite(d) || d < 0 || d > TERM_DISCOUNT_MAX) return "Chiết khấu từ 0 đến 50%.";
  if (library.some((t) => t.id !== selfId && t.months === m && Math.abs(t.discount_pct - d) < 0.005)) return "Trùng kỳ đã có.";
  return null;
}

// ─── Số liệu danh sách ───────────────────────────────────────────────────────

/** Trạm đang chạy một gói (còn hiệu lực hoặc chờ bắt đầu). */
const running = (r: AdminOwnerSubRow) => r.status === "active" || r.status === "scheduled";

export type PackageIssueKey = "noorg" | "noplan" | "noterm" | "stuck";

export interface PackageIssue {
  key: PackageIssueKey;
  /** 'warn' = thiếu cấu hình; 'error' = Trạm đang dùng không gia hạn được. */
  tone: "warn" | "error";
  label: string;
}

export interface PackageStats {
  /** Trạm đang chạy một gói của bộ. */
  using: AdminOwnerSubRow[];
  /** Trạm thấy bộ này (được gán, hoặc chưa gán bộ nào nếu là bộ mặc định). */
  members: AdminOwnerSubRow[];
  /** Trạm đang dùng gói của bộ nhưng không gia hạn được (đổi bộ / bộ hoặc gói ngừng bán). */
  stuck: AdminOwnerSubRow[];
  issues: PackageIssue[];
}

export function packageStats(k: AdminSubPackage, rows: AdminOwnerSubRow[]): PackageStats {
  const plans = new Map(k.plans.map((p) => [p.id, p]));
  const using = rows.filter((r) => r.plan_id && plans.has(r.plan_id) && running(r));
  const members = rows.filter((r) => r.package_id === k.id);
  const stuck = using.filter((r) => r.package_id !== k.id || !k.is_active || !plans.get(r.plan_id!)?.is_active);
  const issues: PackageIssue[] = [];
  if (k.is_active && !k.is_default && k.workspace_ids.length === 0) issues.push({ key: "noorg", tone: "warn", label: "Chưa gán tổ chức" });
  if (k.is_active && !k.plans.some((p) => p.is_active)) issues.push({ key: "noplan", tone: "warn", label: "Không có gói đang bán" });
  if (k.is_active && k.term_ids.length === 0) issues.push({ key: "noterm", tone: "warn", label: "Chưa chọn kỳ mua" });
  if (stuck.length) issues.push({ key: "stuck", tone: "error", label: `${stuck.length} tổ chức không gia hạn được` });
  return { using, members, stuck, issues };
}

/** "2.5 tr" — giá gọn trong danh sách bộ gói. */
export const vndShort = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })} tr`
    : `${formatVndNumber(n)} ₫`;

/** Khoảng giá tháng của các gói đang bán ("2.5–9 tr"); bộ ngừng bán tính mọi gói. */
export function packagePriceRange(k: AdminSubPackage): string {
  const prices = k.plans.filter((p) => p.is_active || !k.is_active).map((p) => p.monthly_price_vnd);
  if (!prices.length) return "—";
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  if (lo === hi) return vndShort(lo);
  return lo >= 1_000_000 ? `${vndShort(lo).replace(" tr", "")}–${vndShort(hi)}` : `${vndShort(lo)} – ${vndShort(hi)}`;
}

/** Hạn mức một quyền lợi trong gói cho bảng tóm tắt: "∞", "12" hoặc "—" khi gói không có. */
export function planQuotaCell(p: Pick<PlanDraft, "benefits">, key: string): string {
  const l = p.benefits.find((x) => x.benefit_key === key);
  if (!l) return "—";
  return l.quota === null ? "∞" : l.quota.toLocaleString("en-US");
}
