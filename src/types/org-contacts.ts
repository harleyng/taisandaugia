// Danh bạ khách hàng CỦA TỔ CHỨC (org_contacts + nhu cầu + nhóm).
// Bảng + trigger + RLS: supabase/migrations/20260912000010_org_contacts.sql.

import type { Database, Tables } from "@/integrations/supabase/types";

export type OrgContactType = "individual" | "company";
export type OrgContactStatus = "active" | "inactive";
export type OrgContactSource = "manual" | "import";

type ContactRow = Tables<"org_contacts">;
type InterestRow = Tables<"org_contact_interests">;
type GroupRow = Tables<"org_contact_groups">;

export type OrgContactInterest = InterestRow;

export type OrgContact = Omit<ContactRow, "contact_type" | "status" | "source"> & {
  contact_type: OrgContactType;
  status: OrgContactStatus;
  source: OrgContactSource;
};

/** Dòng danh sách: kèm nhu cầu + id nhóm để lọc/hiển thị ở client. */
export interface OrgContactListRow extends OrgContact {
  org_contact_interests: OrgContactInterest[];
  group_ids: string[];
}

export interface OrgContactGroup extends GroupRow {
  member_count: number;
}

/** Trường tổ chức được sửa. code / phone_digits / consent_* / created_by do server quản. */
export type OrgContactFields = Pick<
  ContactRow,
  "full_name" | "company_name" | "phone" | "email" | "zalo" | "province" | "note" | "notifications_enabled"
> & { contact_type: OrgContactType; status: OrgContactStatus };

export type OrgContactInterestFields = Pick<InterestRow, "categories" | "provinces" | "price_min" | "price_max" | "note">;

export interface OrgContactGroupFields {
  name: string;
  description: string | null;
}

/** Một dòng gửi lên RPC org_import_contacts (đã qua bước phân loại ở client). */
export interface OrgContactImportRow {
  row: number;
  full_name: string;
  contact_type: OrgContactType;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  zalo: string | null;
  province: string | null;
  note: string | null;
  notifications_enabled: boolean;
  categories: string[];
  provinces: string[];
  price_min: number | null;
  price_max: number | null;
  groups: string[];
}

export interface OrgContactImportResult {
  inserted: number;
  skipped: { row: number; reason: "duplicate" | "invalid" }[];
}

// ─── Người nhận của một phiên (RPC org_session_audience, 20260912000012) ─────

export type AudienceDimension = "category" | "province" | "price";

/** Một cặp (dòng nhu cầu × lô) đã khớp; dims = các chiều dòng đó CÓ ràng buộc. */
export interface AudienceReason {
  interest_id: string;
  item_id: string;
  lot_no: number;
  dims: AudienceDimension[];
}

type AudienceRpcRow = Database["public"]["Functions"]["org_session_audience"]["Returns"][number];

/** Generator đánh mọi cột TEXT là string — thực tế các cột liên hệ có thể NULL. */
export type AudienceRow = Omit<
  AudienceRpcRow,
  "reasons" | "company_name" | "phone" | "email" | "zalo" | "province" | "status" | "contact_type"
> & {
  reasons: AudienceReason[];
  company_name: string | null;
  phone: string | null;
  email: string | null;
  zalo: string | null;
  province: string | null;
  status: OrgContactStatus;
  contact_type: OrgContactType;
};
