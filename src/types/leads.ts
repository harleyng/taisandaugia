// Khách hàng tiềm năng (leads) — đầu phễu CRM.
// Chuyển đổi thành customers qua RPC admin_convert_lead (hoặc gián tiếp khi
// chốt thắng một cơ hội đang gắn lead).

export type LeadStatus =
  | "new" | "contacted" | "qualified" | "nurturing" | "converted" | "disqualified";

export type LeadType =
  | "auction_company" | "asset_owner" | "bank" | "investor" | "broker" | "other";

export type LeadSource =
  | "contact_form" | "partnership_form" | "hotline" | "email"
  | "referral" | "event" | "ads" | "tool_marketplace" | "other";

export interface Lead {
  id: string;
  code: string | null;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  company_name: string | null;
  lead_type: LeadType;
  source: LeadSource;
  status: LeadStatus;
  province: string | null;
  note: string | null;
  assigned_to: string | null;
  converted_customer_id: string | null;
  converted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  assignee?: { id: string; name: string | null; email: string } | null;
  converted_customer?: { id: string; name: string; code: string | null } | null;
}

/** Payload ghi lead. Cố ý KHÔNG có converted_customer_id/converted_at —
 *  hai cột đó chỉ do RPC admin_convert_lead đặt (CHECK ràng buộc hai chiều). */
export interface LeadUpsert {
  id?: string;
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  company_name?: string | null;
  lead_type: LeadType;
  source: LeadSource;
  status: LeadStatus;
  province?: string | null;
  note?: string | null;
  assigned_to?: string | null;
}
