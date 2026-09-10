// Types cho hành trình "Đăng tài sản số hóa → gợi ý & chọn tổ chức đấu giá".
// Mirror bảng asset_postings + asset_service_requests (migration 20260621000001).

export type AssetPostingStatus =
  | "draft"
  | "active"
  | "pending"
  | "matched"
  | "contracted"
  | "cancelled";

/** Kết quả xét duyệt của admin — TÁCH khỏi `status` (vòng đời của chủ tài sản). */
export type AssetPostingReviewStatus = "pending" | "approved" | "rejected";

export type PricingMode = "self" | "appraisal";
export type AuctionFormat = "truc_tiep" | "truc_tuyen" | "ca_hai";
export type ExpectedTimeline = "urgent" | "normal" | "flexible";

export type ServiceRequestStatus =
  | "sent"
  | "seen"
  | "quoted"
  | "accepted"
  | "declined"
  | "selected"
  | "not_selected"
  | "withdrawn";

/** Ai khởi tạo yêu cầu: chủ tài sản tự chọn tổ chức, hay sàn gửi hộ. */
export type ServiceRequestOrigin = "owner" | "platform";

/** Vòng đời yêu cầu "nhờ sàn chọn giúp" (bảng asset_broker_requests). */
export type BrokerRequestStatus =
  | "pending"
  | "sourcing"
  | "quoted"
  | "selected"
  | "cancelled";

/**
 * Bản cam kết quyền sở hữu — thay cho giấy tờ đăng ký ở nhóm tài sản không có
 * sổ đỏ / cà-vẹt (xem getProofMode() trong constants/asset-posting-rules.ts).
 * `name` là chữ ký điện tử: họ tên do chủ tài sản tự nhập.
 */
export interface OwnershipDeclaration {
  name: string;
  accepted_at: string;
  version: string;
}

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
  /** null khi nhóm tài sản dùng giấy tờ (proof mode "documents"). */
  ownership_declaration: OwnershipDeclaration | null;
  has_dispute: boolean | null;
  has_mortgage: boolean | null;
  is_seized: boolean | null;
  right_to_sell: boolean;
  legal_notes: string | null;
  delta_fields: Record<string, unknown>;
  image_urls: string[];
  video_urls: string[];
  doc_urls: string[];
  chosen_org_id: string | null;
  status: AssetPostingStatus;
  review_status: AssetPostingReviewStatus;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  /** Ghi chú nội bộ giữa các admin — KHÔNG hiển thị cho chủ tài sản. */
  review_notes: string | null;
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
  origin: ServiceRequestOrigin;
  /** Có giá trị khi dòng này do sàn gửi hộ từ một yêu cầu môi giới. */
  broker_request_id: string | null;
  organization_id: string | null;
  message: string | null;
  match_score: number | null;
  seen_at: string | null;
  responded_by: string | null;
  decline_reason: string | null;
  // Báo giá tổ chức gửi lại — chỉ có khi status = 'quoted' trở đi.
  quote_commission_pct: number | null;
  quote_service_fee: number | null;
  quote_starting_price: number | null;
  quote_lead_time_days: number | null;
  quote_note: string | null;
  quote_doc_path: string | null;
  quoted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Yêu cầu "nhờ sàn chọn giúp" — một hồ sơ chỉ có một yêu cầu đang mở. */
export interface AssetBrokerRequest {
  id: string;
  asset_posting_id: string;
  user_id: string;
  status: BrokerRequestStatus;
  note: string | null;
  /** Ghi chú nội bộ của admin — KHÔNG hiển thị cho chủ tài sản. */
  admin_note: string | null;
  assigned_admin_id: string | null;
  selected_request_id: string | null;
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
  quoted: "Đã nhận báo giá",
  accepted: "Đã tiếp nhận",
  declined: "Tổ chức từ chối",
  selected: "Đã chọn tổ chức này",
  not_selected: "Đã chọn tổ chức khác",
  withdrawn: "Đã thu hồi",
};

export const BROKER_REQUEST_STATUS_LABELS: Record<BrokerRequestStatus, string> = {
  pending: "Chờ sàn tiếp nhận",
  sourcing: "Sàn đang tìm tổ chức",
  quoted: "Đã có báo giá",
  selected: "Đã chọn tổ chức",
  cancelled: "Đã huỷ",
};
