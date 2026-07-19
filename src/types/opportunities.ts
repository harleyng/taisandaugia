// Cơ hội (opportunities) — bán MỘT dịch vụ cho MỘT bên.
// Bên đó là lead (chưa chuyển đổi) HOẶC customer — đúng một trong hai
// (CHECK num_nonnulls(lead_id, customer_id) = 1 ở DB).

import type { CommissionType, ServiceKind } from "@/types/orders";

/** 5 giai đoạn khớp bảng kanban. */
export type OpportunityStage =
  | "selling" | "pending_approval" | "rejected" | "won" | "lost";

export type OpportunityType =
  | "new_business" | "renewal" | "upsell" | "cross_sell" | "referral";

/** Phân biệt "cố ý không sinh đơn" với "đơn bị xóa". */
export type RevenueMode = "order" | "credit_ledger" | "none";

export interface Opportunity {
  id: string;
  code: string | null;
  name: string;
  lead_id: string | null;
  customer_id: string | null;
  opportunity_type: OpportunityType;
  stage: OpportunityStage;
  service_id: string;
  service_variant_id: string | null;
  /** Snapshot lúc tạo — quyết định chốt thắng có sinh đơn hay không. */
  service_kind: ServiceKind;
  amount: number;
  gross_amount: number;
  commission_type: CommissionType | null;
  commission_value: number | null;
  expected_close_at: string | null;
  closed_at: string | null;
  lost_reason: string | null;
  won_order_id: string | null;
  revenue_mode: RevenueMode;
  assigned_to: string | null;
  sort_order: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  lead?: { id: string; code: string | null; name: string } | null;
  customer?: { id: string; code: string | null; name: string } | null;
  service?: { id: string; name: string; kind: ServiceKind } | null;
  assignee?: { id: string; name: string | null; email: string } | null;
}

/** Payload ghi cơ hội. Cố ý KHÔNG có `stage='won'`, `won_order_id`,
 *  `revenue_mode`, `closed_at`, `service_kind` — chốt thắng phải đi qua RPC
 *  admin_win_opportunity (trigger opportunities_guard_won chặn UPDATE trần). */
export interface OpportunityUpsert {
  id?: string;
  name: string;
  lead_id?: string | null;
  customer_id?: string | null;
  opportunity_type: OpportunityType;
  stage?: Exclude<OpportunityStage, "won">;
  service_id: string;
  service_variant_id?: string | null;
  amount: number;
  gross_amount?: number;
  commission_type?: CommissionType | null;
  commission_value?: number | null;
  expected_close_at?: string | null;
  lost_reason?: string | null;
  assigned_to?: string | null;
  sort_order?: number;
  note?: string | null;
}

/** Kết quả JSONB của admin_win_opportunity. */
export interface WinOpportunityResult {
  customer_id: string;
  order_id: string | null;
  revenue_mode: RevenueMode;
}
