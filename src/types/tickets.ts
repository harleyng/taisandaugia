// Ticket — hàng đợi DUY NHẤT cho mọi yêu cầu vào. Thay thế hẳn hộp thư
// "Liên hệ & Hợp tác": form công khai sinh ticket qua trigger cầu nối.

import type { CrmRelation, CrmRelated } from "@/lib/crm/relation";

export type TicketStatus = "new" | "open" | "pending" | "resolved" | "closed";
export type TicketSource = "contact_form" | "partnership" | "phone" | "email" | "manual";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface Ticket extends CrmRelated {
  id: string;
  code: string | null;
  subject: string;
  body: string | null;
  source: TicketSource;
  status: TicketStatus;
  priority: TicketPriority;
  requester_name: string | null;
  requester_phone: string | null;
  requester_email: string | null;
  /** Trường riêng theo nguồn — vd org_name/province của đăng ký hợp tác. */
  meta: Record<string, unknown>;
  contact_submission_id: string | null;
  partnership_registration_id: string | null;
  assignee_id: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  first_response_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  assignee?: { id: string; name: string | null; email: string } | null;
}

/** Payload ghi ticket. `resolved_at` do trigger tickets_sync_resolved dẫn xuất. */
export interface TicketUpsert extends Partial<CrmRelation> {
  id?: string;
  subject: string;
  body?: string | null;
  source: TicketSource;
  status: TicketStatus;
  priority: TicketPriority;
  requester_name?: string | null;
  requester_phone?: string | null;
  requester_email?: string | null;
  assignee_id?: string | null;
  resolution_note?: string | null;
}
