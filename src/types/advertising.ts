// Domain types cho module Quảng cáo (Banner) + Khách hàng.
// Bảng đã có trong types.ts sinh tự động; các interface dưới đây là hình dạng
// "đã hydrate" (kèm quan hệ join) dùng trong UI.

export type AdStatus = "draft" | "scheduled" | "active" | "paused" | "ended";
export type PlacementType = "slide" | "unique";
export type NavType = "none" | "link";
export type AdStartType = "immediate" | "scheduled";
export type AdEndType = "continuous" | "scheduled";
export type StatDevice = "desktop" | "mobile";

// Customer đã dọn sang types/customers.ts (nó không còn là khái niệm của module
// quảng cáo nữa). Re-export để các file import từ đây không phải sửa.
export type {
  Customer,
  CustomerFields,
  CustomerStatus,
  CustomerType,
  CustomerUpsert,
} from "./customers";
import type { Customer } from "./customers";

export interface AdPage {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdPosition {
  id: string;
  page_id: string;
  name: string;
  code: string | null;
  placement_type: PlacementType;
  price: number;
  desktop_width: number;
  desktop_height: number;
  mobile_width: number;
  mobile_height: number;
  sort_order: number;
  is_active: boolean;
  auction_ends_at: string | null; // thời gian kết thúc phiên trả giá (đếm ngược)
  bidder_count: number; // số người đang trả giá
  created_at: string;
  updated_at: string;
  page?: Pick<AdPage, "id" | "name" | "slug"> | null;
}

export interface Advertisement {
  id: string;
  code: string | null;
  name: string;
  is_test: boolean;
  position_id: string;
  show_desktop: boolean;
  show_mobile: boolean;
  desktop_image_url: string | null;
  mobile_image_url: string | null;
  nav_type: NavType;
  nav_url: string | null;
  nav_filter: Record<string, unknown> | null;
  start_type: AdStartType;
  start_at: string | null;
  end_type: AdEndType;
  end_at: string | null;
  sort_order: number;
  status: AdStatus;
  view_count: number;
  click_count: number;
  customer_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  position?:
    | (Pick<AdPosition, "id" | "name" | "placement_type" | "price" | "page_id"> & {
        page?: Pick<AdPage, "id" | "name"> | null;
      })
    | null;
  customer?: Pick<Customer, "id" | "name" | "code"> | null;
}

export interface AdDailyStat {
  id: string;
  advertisement_id: string;
  stat_date: string;
  device: StatDevice;
  views: number;
  clicks: number;
  created_at: string;
}

// ─── Upsert payloads ─────────────────────────────────────────────────────────

export interface AdvertisementUpsert {
  id?: string;
  name: string;
  position_id: string;
  show_desktop: boolean;
  show_mobile: boolean;
  desktop_image_url: string | null;
  mobile_image_url: string | null;
  nav_type: NavType;
  nav_url: string | null;
  nav_filter: Record<string, unknown> | null;
  start_type: AdStartType;
  start_at: string | null;
  end_type: AdEndType;
  end_at: string | null;
  sort_order: number;
  status: AdStatus;
  customer_id: string | null;
}

export interface AdPageUpsert {
  id?: string;
  name: string;
  slug: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface AdPositionUpsert {
  id?: string;
  page_id: string;
  name: string;
  code?: string | null;
  placement_type: PlacementType;
  price: number;
  desktop_width?: number;
  desktop_height?: number;
  mobile_width?: number;
  mobile_height?: number;
  sort_order?: number;
  is_active?: boolean;
  auction_ends_at?: string | null;
  bidder_count?: number;
}
