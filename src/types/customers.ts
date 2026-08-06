// Khách hàng (customers) — cuối phễu CRM, nơi lead "hạ cánh" sau chuyển đổi.
//
// Tách khỏi types/advertising.ts (nơi Customer từng ở nhờ vì quảng cáo là module
// đầu tiên dùng tới) — nay khách hàng có prospect, tài khoản sàn, nguồn lead nên
// đủ nặng để đứng riêng. advertising.ts re-export lại để 5 file cũ không phải sửa.

import type { CustomerSegment } from "@/lib/customers/customerSegment";
import type { LeadSource } from "@/types/leads";

export type CustomerType = "individual" | "company";
export type CustomerStatus = "active" | "inactive";

export interface Customer {
  id: string;
  code: string | null;
  name: string;
  customer_type: CustomerType;
  /** Phân khúc — cùng từ vựng với leads.lead_type, copy 1:1 khi chuyển đổi. */
  segment: CustomerSegment;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  tax_code: string | null;
  address: string | null;
  note: string | null;
  status: CustomerStatus;
  /** Tài khoản trên sàn (auth.users). Cầu nối DUY NHẤT tới email marketing —
   *  campaign_recipients.user_id. NULL nghĩa là chưa gắn tài khoản nào. */
  user_id: string | null;
  /** Lead nguồn khi khách được chuyển đổi. NULL với khách nhập tay. */
  source_lead_id: string | null;
  /** Pháp nhân nguồn trên sàn, sao từ lead lúc chuyển đổi — mở được tab Lịch sử
   *  đấu giá / Chi nhánh mà không phụ thuộc lead còn tồn tại. */
  prospect_kind: "asset_owner" | "auction_org" | null;
  prospect_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  source_lead?: { id: string; code: string | null; name: string; source: LeadSource } | null;
}

/** Các cột người dùng nhập được. Cố ý KHÔNG có code/source_lead_id/prospect_* —
 *  chúng do sequence và RPC admin_convert_lead đặt. */
export interface CustomerFields {
  name: string;
  customer_type: CustomerType;
  /** Tuỳ chọn khi ghi: cột DB là `segment TEXT NOT NULL DEFAULT 'other'`
   *  (migration 20260719000006) nên bỏ trống vẫn hợp lệ. */
  segment?: CustomerSegment;
  status: CustomerStatus;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  tax_code?: string | null;
  address?: string | null;
  note?: string | null;
  user_id?: string | null;
}

/** Tạo mới cần đủ field; cập nhật thì vá từng phần (menu đổi trạng thái chỉ gửi
 *  { id, status }). Cùng khuôn với LeadUpsert. */
export type CustomerUpsert =
  | ({ id?: undefined } & CustomerFields)
  | ({ id: string } & Partial<CustomerFields>);
