// Gói thuê bao tổ chức chủ tài sản — kiểu dữ liệu trả về từ RPC
// (migration 20260927200000_owner_subscriptions.sql).

/** Trạng thái lưu trong DB. */
export type SubStoredStatus = "draft" | "offered" | "active" | "cancelled";
/** Trạng thái hiệu lực: 'active' quá ends_on ⇒ 'expired', chưa tới starts_on ⇒ 'scheduled'. */
export type SubStatus = SubStoredStatus | "expired" | "scheduled";

export type OverageMode = "block" | "credits";

/** Quyền lợi hệ thống KIỂM hạn mức (source 'enforced' — key trùng service_variants). */
export type SubVariantKey = "scan_3d_owner" | "report_portfolio_owner" | "priority_listing";

// ─── Danh mục quyền lợi CỐ ĐỊNH (migration 20261001300000_owner_sub_benefit_catalog.sql) ──

/** Chu kỳ làm mới hạn mức: theo lịch giờ VN; 'term' = cả kỳ gói đã trả, không làm mới. */
export type BenefitCycle = "day" | "week" | "month" | "quarter" | "year" | "term";
/** 'quota' = hạn mức + chu kỳ; 'level' = một mức số, càng nhỏ càng tốt (giờ phản hồi). */
export type BenefitKind = "quota" | "level";
/** 'enforced' = hệ thống chặn / trừ credit; 'live' = đếm thật, không chặn; 'display' = chỉ hiển thị. */
export type BenefitSource = "enforced" | "live" | "display";

/** Một dòng của owner_sub_benefits — chỉ đọc, đổi danh mục = viết migration. */
export interface SubBenefitDef {
  key: string;
  group_name: string;
  label: string;
  unit: string;
  kind: BenefitKind;
  /** Chỉ dạng 'level': "Phản hồi trong {n} giờ". */
  level_format: string | null;
  source: BenefitSource;
  default_cycle: BenefitCycle | null;
  sort_order: number;
}

/** Giá trị đủ để viết chữ một dòng quyền lợi ("20 hồ sơ / tháng"). */
export interface BenefitValue {
  kind: BenefitKind;
  unit: string;
  level_format: string | null;
  /** null = không giới hạn (dạng 'quota'). */
  quota: number | null;
  /** null với dạng 'level'. */
  cycle: BenefitCycle | null;
}

/** Dòng quyền lợi của gói danh mục, kèm định nghĩa trong danh mục. THỨ TỰ = thứ tự lên thẻ. */
export interface PlanBenefitLine {
  benefit_key: string;
  quota: number | null;
  cycle: BenefitCycle | null;
  sort_order: number;
  benefit: SubBenefitDef;
}

/** Dữ liệu gửi admin_owner_sub_plan_upsert (p_benefits), theo thứ tự hiển thị. */
export interface BenefitLineInput {
  benefit_key: string;
  quota: number | null;
  cycle: BenefitCycle | null;
}

/** Một dòng quyền lợi của gói Trạm kèm lượt dùng trong cửa sổ hiện tại (_owner_sub_lines). */
export interface SubLine extends BenefitValue {
  benefit_key: string;
  group: string;
  label: string;
  source: BenefitSource;
  credit_cost: number | null;
  /** Có số lượt dùng để lên thẻ Hạn mức (enforced / live / display đã có số giữ chỗ). */
  tracked: boolean;
  used: number;
  /** null = không giới hạn hoặc dạng 'level'. */
  remaining: number | null;
  window_start: string | null;
  /** Ngày làm mới kế tiếp; null với 'term' / 'level'. */
  resets_on: string | null;
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
  /** Dòng quyền lợi theo thứ tự hiển thị (8 dòng đầu lên thẻ gói). */
  benefits: PlanBenefitLine[];
  /** Chỉ có ở màn admin: các Trạm được dùng gói (gói không có Trạm nào = ẩn với chủ tài sản). */
  workspace_ids?: string[];
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
  /** Gói danh mục hiện tại của Trạm (null = chưa có / gói riêng cũ). */
  plan_id: string | null;
  /** Các gói danh mục admin đã mở cho Trạm này. */
  allowed_plan_ids: string[];
}

export type ActivationMethod = "bank_transfer" | "contract" | "complimentary" | "other";
