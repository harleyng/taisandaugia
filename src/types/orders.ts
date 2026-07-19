// Domain types cho module Dịch vụ (Services) + Đơn hàng (Orders).
// Hình dạng "đã hydrate" (kèm quan hệ join) dùng trong UI; truy cập DB qua untyped
// cast như các module back-office khác (useCustomers.ts / useAdvertisements.ts).

import type { AdStatus } from "@/types/advertising";

export type ServiceKind = "credit" | "direct" | "commission";
export type ServiceCategory =
  | "package" | "unlock" | "feature" | "advertising" | "brokerage" | string;
export type ServiceAudience = "buyer" | "owner" | "company" | "all";
export type FulfillmentStatus = "pending" | "fulfilled" | "cancelled";

/** Cách tính hoa hồng: % trên giá trị hợp đồng, hoặc số tiền cố định / đơn vị. */
export type CommissionType = "percent" | "fixed";

export interface Service {
  id: string;
  code: string | null;
  name: string;
  kind: ServiceKind;
  category: string | null;
  audience: ServiceAudience;
  credit_feature_key: string | null;
  price: number;
  credit_cost: number | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  /** Bắt buộc khi kind='commission' — bên cung cấp dịch vụ sàn môi giới. */
  supplier_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  supplier?: { id: string; name: string; code: string | null } | null;
}

export interface ServiceUpsert {
  id?: string;
  name: string;
  kind: ServiceKind;
  category?: string | null;
  audience: ServiceAudience;
  credit_feature_key?: string | null;
  price: number;
  credit_cost?: number | null;
  description?: string | null;
  is_active: boolean;
  sort_order?: number;
  supplier_id?: string | null;
}

// Biến thể (dịch vụ con) — chứa giá thực: price (VND, gói) hoặc credit_cost (tier/feature).
export interface ServiceVariant {
  id: string;
  service_id: string;
  code: string | null;
  variant_key: string;
  name: string;
  price: number;
  base_credits: number | null;
  credits: number | null;
  credit_cost: number | null;
  is_popular: boolean;
  is_best: boolean;
  sort_order: number;
  is_active: boolean;
  /** Điều khoản hoa hồng của biến thể (chỉ nhóm kind='commission'). */
  commission_type: CommissionType | null;
  commission_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceVariantUpsert {
  id?: string;
  service_id: string;
  variant_key: string;
  name: string;
  price: number;
  base_credits?: number | null;
  credits?: number | null;
  credit_cost?: number | null;
  is_popular?: boolean;
  is_best?: boolean;
  sort_order?: number;
  is_active?: boolean;
  commission_type?: CommissionType | null;
  commission_value?: number | null;
}

// Nhóm dịch vụ đã hydrate kèm biến thể (dùng ở admin + catalog).
export interface ServiceGroup extends Service {
  variants: ServiceVariant[];
}

export interface Order {
  id: string;
  code: string | null;
  /** NULL với đơn nạp credit (B2C) — khi đó user_id có giá trị. */
  customer_id: string | null;
  user_id: string | null;
  service_id: string;
  quantity: number;
  /** Tiền THỰC VỀ SÀN — đây là con số báo cáo doanh thu cộng. */
  amount: number;
  /** Giá trị hợp đồng (GMV). Bằng amount với direct/credit; lớn hơn với hoa hồng. */
  gross_amount: number;
  /** Snapshot loại dịch vụ lúc chốt đơn — báo cáo tách nguồn theo cột này. */
  service_kind: ServiceKind;
  supplier_id: string | null;
  commission_type: CommissionType | null;
  commission_value: number | null;
  /** Đơn nạp credit luôn trỏ về giao dịch nạp đã sinh ra nó. */
  credit_transaction_id: string | null;
  fulfillment_status: FulfillmentStatus;
  advertisement_id: string | null;
  service_variant_id: string | null;
  note: string | null;
  ordered_at: string;
  fulfilled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  customer?: { id: string; name: string; code: string | null } | null;
  service?: { id: string; name: string; kind: ServiceKind } | null;
  supplier?: { id: string; name: string; code: string | null } | null;
  advertisement?: { id: string; code: string | null; name: string; status: AdStatus } | null;
}

/** Payload ghi đơn. Cố ý KHÔNG có `service_kind` và (với hoa hồng) `amount` —
 *  trigger orders_sync_kind_and_commission sở hữu hai cột đó. */
export interface OrderUpsert {
  id?: string;
  customer_id: string;
  service_id: string;
  quantity: number;
  amount: number;
  fulfillment_status: FulfillmentStatus;
  advertisement_id?: string | null;
  service_variant_id?: string | null;
  note?: string | null;
  ordered_at: string;
  gross_amount?: number;
  supplier_id?: string | null;
  commission_type?: CommissionType | null;
  commission_value?: number | null;
}
