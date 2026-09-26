import type { Database } from "@/integrations/supabase/types";

export type AuthenticationOrder = Database["public"]["Tables"]["asset_authentication_orders"]["Row"];
export type AuthenticationPolicy = Database["public"]["Tables"]["authentication_policy"]["Row"];

/** Mã trạng thái lưu trong DB — nhãn tiếng Việt ở lib/authentication/status.ts. */
export type AuthenticationStatus =
  | "requested"
  | "quoted"
  | "paid"
  | "item_pending"
  | "in_review"
  | "completed"
  | "superseded"
  | "cancelled";

/** Phương thức = gói (variant_key 'gd_' + method). */
export type AuthenticationMethod = "from_photos" | "ship_item" | "on_site";

export type AuthenticationVerdict = "authentic" | "inconclusive" | "suspected_fake";

/** Lý do bắt buộc giám định (BR-GD-03) — trùng mã với _authentication_required_reasons. */
export type AuthenticationRequiredReason = "lot_flag" | "seller_restricted" | "policy";

export interface AuthenticationPackage {
  variant_id: string;
  variant_key: string;
  name: string;
  from_price: number;
  sort_order: number;
}

export interface AuthenticationPartner {
  supplier_id: string;
  name: string;
}

/** Chứng thư đã công khai của một lô trong phiên — RPC public_session_lot_authentications. */
export interface LotAuthentication {
  item_id: string;
  method: string;
  verification_level: number;
  certificate_path: string;
  certificate_no: string | null;
  partner_name: string;
  issued_at: string;
}

export interface PayAuthenticationResult {
  ok: true;
  status: "paid" | "already_paid";
  order_id: string;
  code: string;
  posting_id: string;
  method: AuthenticationMethod;
}

/** RPC posting_authentication_state. */
export interface PostingAuthenticationState {
  reasons: AuthenticationRequiredReason[];
  verdict: AuthenticationVerdict | null;
  level: number;
}
