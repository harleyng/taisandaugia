// Gói thuê bao tổ chức chủ tài sản — kiểu dữ liệu trả về từ RPC
// (migration 20260927200000_owner_subscriptions.sql).

/** Trạng thái lưu trong DB. */
export type SubStoredStatus = "draft" | "offered" | "active" | "cancelled";
/** Trạng thái hiệu lực: 'active' quá ends_on ⇒ 'expired', chưa tới starts_on ⇒ 'scheduled'. */
export type SubStatus = SubStoredStatus | "expired" | "scheduled";

export type OverageMode = "block" | "credits";

export type SubVariantKey = "scan_3d_owner" | "report_portfolio_owner";

export interface SubLine {
  variant_key: SubVariantKey;
  name: string;
  credit_cost: number | null;
  /** null = không giới hạn. */
  monthly_quota: number | null;
  used: number;
  /** null = không giới hạn. */
  remaining: number | null;
}

/** owner_subscription_status(p_workspace_id) — null khi Trạm chưa có gói (hoặc gói còn nháp). */
export interface OwnerSubscriptionStatus {
  id: string;
  code: string;
  workspace_id: string;
  workspace_name: string;
  plan_name: string;
  status: SubStatus;
  starts_on: string | null;
  ends_on: string | null;
  term_months: number;
  price_vnd: number;
  overage_mode: OverageMode;
  period_month: string;
  next_reset_on: string;
  /** Người đang xem được gói bao (thành viên trực tiếp + gói đang hiệu lực). */
  covered_for_me: boolean;
  /** Chỉ Trưởng đơn vị, gói có giá > 0 và đang chào / hiệu lực / hết hạn. */
  can_pay: boolean;
  /** Người đang xem là Trưởng đơn vị của Trạm. */
  is_owner: boolean;
  /** Gói danh mục đang dùng (null = gói riêng do admin cấu hình). */
  plan_id: string | null;
  plan_tier: PlanTier | null;
  /** Đổi gói đã trả tiền, chờ áp dụng từ kỳ kế tiếp. */
  pending: SubPendingSwitch | null;
  lines: SubLine[];
}

export interface SubPendingSwitch {
  plan_id: string | null;
  plan_name: string;
  tier: PlanTier;
  from: string;
  months: number;
  price_vnd: number;
}

// ─── Danh mục gói dịch vụ (migration 20260928100000_owner_sub_plan_catalog.sql) ──

export type PlanTier = "basic" | "standard" | "premium";

/** Dòng quyền lợi admin tự nhập — CHỈ hiển thị, hệ thống không kiểm. */
export interface PlanBenefit {
  group: string;
  label: string;
  value: string;
}

export interface PlanEntitlement {
  variant_key: SubVariantKey;
  /** null = không giới hạn. */
  monthly_quota: number | null;
}

export interface OwnerSubPlan {
  id: string;
  name: string;
  fit_line: string | null;
  highlight_line: string | null;
  tier: PlanTier;
  monthly_price_vnd: number;
  overage_mode: OverageMode;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  benefits: PlanBenefit[];
  entitlements: PlanEntitlement[];
}

export interface OwnerSubTermOption {
  months: number;
  discount_pct: number;
  is_active: boolean;
}

export type PlanPurchaseEffect = "now" | "extend" | "next_term";

/** owner_sub_plan_quote(p_workspace_id, p_plan_id, p_months). */
export interface OwnerSubPlanQuote {
  ok: boolean;
  workspace_id: string;
  workspace_name: string;
  plan_id: string;
  plan_name: string;
  tier: PlanTier;
  months: number;
  discount_pct: number;
  monthly_price_vnd: number;
  amount_vnd: number;
  effect: PlanPurchaseEffect;
  starts_on: string;
  ends_on: string;
  subscription_id: string | null;
  current_plan_name: string | null;
  can_pay: boolean;
  reason: string | null;
}

export interface PayOwnerSubPlanResult {
  ok: true;
  status: "paid" | "already_paid";
  code: string;
  workspace_id: string;
  workspace_name: string;
  plan_name: string | null;
  effect: PlanPurchaseEffect;
  starts_on: string;
  ends_on: string;
}

/** owner_subscription_quote(p_sub_id). */
export interface OwnerSubscriptionQuote {
  ok: boolean;
  id: string;
  code: string;
  workspace_id: string;
  workspace_name: string;
  plan_name: string;
  price_vnd: number;
  term_months: number;
  status: SubStatus;
  next_starts_on: string;
  next_ends_on: string;
  can_pay: boolean;
  reason: string | null;
}

export interface PayOwnerSubscriptionResult {
  ok: true;
  status: "paid" | "already_paid";
  code: string;
  workspace_id: string;
  workspace_name: string;
  starts_on: string;
  ends_on: string;
}

/** Dòng danh sách admin_owner_subscription_list(). */
export interface AdminOwnerSubRow {
  workspace_id: string;
  workspace_name: string;
  match_scope: string;
  parent_name: string | null;
  owner_name: string | null;
  owner_email: string | null;
  member_count: number;
  workspace_created_at: string;
  subscription_id: string | null;
  code: string | null;
  plan_name: string | null;
  status: SubStatus | null;
  starts_on: string | null;
  ends_on: string | null;
  price_vnd: number | null;
  term_months: number | null;
  overage_mode: OverageMode | null;
}

export interface EntitlementInput {
  variant_key: SubVariantKey;
  monthly_quota: number | null;
}

export type ActivationMethod = "bank_transfer" | "contract" | "complimentary" | "other";
