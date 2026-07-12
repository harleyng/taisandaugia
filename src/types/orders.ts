// Domain types cho module Dịch vụ (Services) + Đơn hàng (Orders).
// Hình dạng "đã hydrate" (kèm quan hệ join) dùng trong UI; truy cập DB qua untyped
// cast như các module back-office khác (useCustomers.ts / useAdvertisements.ts).

import type { AdStatus } from "@/types/advertising";

export type ServiceKind = "credit" | "direct";
export type ServiceCategory = "package" | "unlock" | "feature" | "advertising" | string;
export type ServiceAudience = "buyer" | "owner" | "company" | "all";
export type FulfillmentStatus = "pending" | "fulfilled" | "cancelled";

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
  created_by: string | null;
  created_at: string;
  updated_at: string;
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
}

// Nhóm dịch vụ đã hydrate kèm biến thể (dùng ở admin + catalog).
export interface ServiceGroup extends Service {
  variants: ServiceVariant[];
}

export interface Order {
  id: string;
  code: string | null;
  customer_id: string;
  service_id: string;
  quantity: number;
  amount: number;
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
  advertisement?: { id: string; code: string | null; name: string; status: AdStatus } | null;
}

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
}
