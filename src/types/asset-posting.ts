// Types cho hành trình "Đăng tài sản số hóa → gợi ý & chọn tổ chức đấu giá".
// Mirror bảng asset_postings + asset_service_requests (migration 20260621000001).

export type AssetPostingStatus =
  | "draft"
  | "active"
  | "pending"
  | "matched"
  | "contracted"
  | "cancelled";

export type PricingMode = "self" | "appraisal";
export type AuctionFormat = "truc_tiep" | "truc_tuyen" | "ca_hai";
export type ExpectedTimeline = "urgent" | "normal" | "flexible";

export type ServiceRequestStatus =
  | "sent"
  | "seen"
  | "accepted"
  | "declined"
  | "withdrawn";

export interface AssetPosting {
  id: string;
  user_id: string;
  parent_slug: string;
  child_slug: string;
  title: string;
  description: string | null;
  province: string | null;
  district: string | null;
  ward: string | null;
  address: string | null;
  pricing_mode: PricingMode;
  starting_price: number | null;
  auction_format: AuctionFormat;
  commission_pct: number | null;
  expected_timeline: ExpectedTimeline | null;
  ownership_proof_urls: string[];
  has_dispute: boolean | null;
  has_mortgage: boolean | null;
  is_seized: boolean | null;
  right_to_sell: boolean;
  legal_notes: string | null;
  delta_fields: Record<string, unknown>;
  image_urls: string[];
  doc_urls: string[];
  chosen_org_id: string | null;
  status: AssetPostingStatus;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetServiceRequest {
  id: string;
  asset_posting_id: string;
  auction_org_id: string;
  user_id: string;
  status: ServiceRequestStatus;
  message: string | null;
  match_score: number | null;
  created_at: string;
  updated_at: string;
}

// ─── Nhãn hiển thị (Vietnamese) ──────────────────────────────────────────────

export const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  self: "Tự định giá khởi điểm",
  appraisal: "Nhờ tổ chức định giá",
};

export const AUCTION_FORMAT_LABELS: Record<AuctionFormat, string> = {
  truc_tiep: "Trực tiếp",
  truc_tuyen: "Trực tuyến",
  ca_hai: "Cả hai hình thức",
};

export const EXPECTED_TIMELINE_LABELS: Record<ExpectedTimeline, string> = {
  urgent: "Gấp (trong 1 tháng)",
  normal: "Bình thường (1–3 tháng)",
  flexible: "Linh hoạt (trên 3 tháng)",
};

export const ASSET_POSTING_STATUS_LABELS: Record<AssetPostingStatus, string> = {
  draft: "Nháp",
  active: "Đã số hoá",
  pending: "Chờ xử lý",
  matched: "Đã chọn tổ chức",
  contracted: "Đã ký hợp đồng",
  cancelled: "Đã hủy",
};

export const SERVICE_REQUEST_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  sent: "Đã gửi",
  seen: "Tổ chức đã xem",
  accepted: "Đã tiếp nhận",
  declined: "Đã từ chối",
  withdrawn: "Đã thu hồi",
};
