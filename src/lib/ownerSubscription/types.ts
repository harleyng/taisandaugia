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
  lines: SubLine[];
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
