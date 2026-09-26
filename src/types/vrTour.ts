import type { Database } from "@/integrations/supabase/types";

export type VrTourOrder = Database["public"]["Tables"]["asset_vr_tour_orders"]["Row"];

/** Mã trạng thái lưu trong DB — nhãn tiếng Việt ở lib/vrTour/status.ts. */
export type VrTourStatus =
  | "requested"
  | "quoted"
  | "paid"
  | "scheduled"
  | "delivered"
  | "attached"
  | "superseded"
  | "cancelled";

/** Gói VR tour đọc qua RPC public_vr_tour_packages (giá "từ", giá thật theo báo giá). */
export interface VrTourPackage {
  variant_id: string;
  variant_key: string;
  name: string;
  from_price: number;
  sort_order: number;
}

/** Đối tác đang có hợp đồng hiệu lực phủ dịch vụ VR tour. */
export interface VrTourPartner {
  supplier_id: string;
  name: string;
}

/** Tour đã công khai của một lô trong phiên — RPC public_session_lot_vr_tours. */
export interface LotVrTour {
  item_id: string;
  vr_url: string;
}

export interface PayVrTourResult {
  ok: true;
  status: "paid" | "already_paid";
  order_id: string;
  code: string;
  posting_id: string;
  posting_status: string | null;
}
