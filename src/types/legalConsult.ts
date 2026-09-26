import type { Database } from "@/integrations/supabase/types";

export type LegalConsultation = Database["public"]["Tables"]["asset_legal_consultations"]["Row"];
export type LegalConsultationItem = Database["public"]["Tables"]["asset_legal_consultation_items"]["Row"];

/** Mã trạng thái lưu trong DB — nhãn tiếng Việt ở lib/legalConsult/status.ts. */
export type LegalConsultStatus =
  | "requested"
  | "quoted"
  | "paid"
  | "in_review"
  | "completed"
  | "superseded"
  | "cancelled";

/** Kết luận từng mục checklist: Đủ / Thiếu / Cần làm rõ. */
export type ChecklistItemStatus = "sufficient" | "missing" | "needs_clarification";

/** Một mục checklist đang soạn (admin) — cũng là shape gửi lên RPC `_items`. */
export interface ChecklistDraftItem {
  template_key: string | null;
  label: string;
  status: ChecklistItemStatus | null;
  expert_note: string;
  required_action: string;
  doc_paths: string[];
}

export interface LegalConsultPackage {
  variant_id: string;
  variant_key: string;
  name: string;
  from_price: number;
}

export interface LegalConsultPartner {
  supplier_id: string;
  name: string;
}

export interface PayLegalConsultResult {
  ok: true;
  status: "paid" | "already_paid";
  consultation_id: string;
  code: string;
  posting_id: string;
}
