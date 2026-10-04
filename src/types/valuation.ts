import type { Database } from "@/integrations/supabase/types";

export type ValuationOrder = Database["public"]["Tables"]["asset_valuation_orders"]["Row"];

/** Mã trạng thái lưu trong DB — nhãn tiếng Việt ở lib/valuation/status.ts. */
export type ValuationStatus =
  | "requested"
  | "quoted"
  | "paid"
  | "in_review"
  | "completed"
  | "superseded"
  | "cancelled";

/** Mục đích thẩm định giá người bán chọn khi gửi yêu cầu. */
export type ValuationPurpose = "auction" | "mortgage" | "transfer" | "other";

/** Phương pháp thẩm định giá đơn vị đối tác ghi trên chứng thư. */
export type ValuationMethod = "comparison" | "cost" | "income" | "mixed";

export interface ValuationPackage {
  variant_id: string;
  variant_key: string;
  name: string;
  from_price: number;
}

export interface ValuationPartner {
  supplier_id: string;
  name: string;
}

export interface PayValuationResult {
  ok: true;
  status: "paid" | "already_paid";
  order_id: string;
  code: string;
  posting_id: string;
}
