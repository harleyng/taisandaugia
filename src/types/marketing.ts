// Types for the admin Email Marketing feature.
// Backing tables (marketing_campaigns, campaign_recipients) + RPCs live in
// supabase/migrations/20260711000001_marketing_campaigns.sql. Until the migration
// is pushed and src/integrations/supabase/types.ts is regenerated, the hooks read
// these tables via a `(supabase as any)` cast (same pattern as useArticles.ts).

export type CampaignChannel = "email";
export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "ended";
export type CampaignScheduleType = "immediate" | "scheduled";
export type RecipientStatus = "pending" | "sent" | "failed" | "opened" | "clicked";

export type AccountType =
  | "buyer"
  | "company_rep"
  | "owner_individual"
  | "owner_org"
  | "admin";

export type KycStatusValue = "NOT_APPLIED" | "PENDING_KYC" | "APPROVED" | "REJECTED";

export interface AudienceCriteria {
  /** null = không lọc theo ngày tạo tài khoản */
  registration: { from: string; to: string } | null;
  accountTypes: AccountType[];
  kycStatuses: KycStatusValue[];
  /** null = không lọc theo số dư credit */
  credit: { min: number | null; max: number | null } | null;
  provinces: string[];
  /** khi có lọc tỉnh/thành, người dùng chưa xác định tỉnh có được tính không */
  includeNullProvince: boolean;
}

export interface AudienceModes {
  criteria: boolean;
  import: boolean;
  specific: boolean;
}

/**
 * Loại đối tượng — chọn 1 trong 3 ở UI tạo/sửa. `modes` (hợp đồng với RPC) được
 * suy ra từ `kind`: all/criteria → modes.criteria; list → modes.specific + import.
 */
export type AudienceKind = "none" | "all" | "criteria" | "list";

export interface AudienceSpec {
  /** Loại đối tượng đã chọn (điều khiển UI, phân biệt "tất cả" vs "tiêu chí rỗng"). */
  kind: AudienceKind;
  modes: AudienceModes;
  criteria: AudienceCriteria;
  /** chọn user cụ thể + import — gộp chung vào "Danh sách cụ thể" */
  userIds: string[];
  /** import danh sách email */
  emails: string[];
}

export interface Campaign {
  id: string;
  channel: CampaignChannel;
  name: string;
  notes: string | null;
  status: CampaignStatus;
  subject: string | null;
  preview_text: string | null;
  content_html: string | null;
  audience_spec: AudienceSpec;
  respect_optin: boolean;
  schedule_type: CampaignScheduleType;
  scheduled_at: string | null;
  eligible_count: number | null;
  recipient_count: number;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  created_by: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  status: RecipientStatus;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  created_at: string;
}

/** Row shape returned by the resolve_campaign_audience RPC. */
export interface ResolvedAudienceRow {
  /** null = email ngoài hệ thống (không có tài khoản). */
  user_id: string | null;
  email: string;
  name: string | null;
  total_count: number;
}
