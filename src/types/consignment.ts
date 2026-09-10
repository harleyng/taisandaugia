// Ký gửi tài sản: yêu cầu dịch vụ gửi tới tổ chức đấu giá + báo giá trả về.
//
// Tách khỏi types/asset-posting.ts một cách CÓ CHỦ Ý: các kiểu ở đây mô tả bản
// chiếu do RPC `org_service_requests` trả về (đã lọc bớt cột nhạy cảm của chủ
// tài sản), không phải nguyên hàng của bảng.

import type {
  BrokerRequestStatus,
  ServiceRequestOrigin,
  ServiceRequestStatus,
} from "./asset-posting";

// Nguồn sự thật của các union này là types/asset-posting.ts (mirror bảng) —
// re-export để hai file không trôi khỏi nhau.
export type {
  ServiceRequestStatus,
  ServiceRequestOrigin,
  BrokerRequestStatus,
} from "./asset-posting";

/** Một dòng trong hộp thư của tổ chức — trả về từ RPC `org_service_requests`. */
export interface OrgServiceRequest {
  id: string;
  status: ServiceRequestStatus;
  origin: ServiceRequestOrigin;
  message: string | null;
  match_score: number | null;
  created_at: string;
  seen_at: string | null;
  quoted_at: string | null;
  decline_reason: string | null;

  quote_commission_pct: number | null;
  quote_service_fee: number | null;
  quote_starting_price: number | null;
  quote_lead_time_days: number | null;
  quote_note: string | null;
  quote_doc_path: string | null;

  // Bản chiếu hồ sơ tài sản. KHÔNG có danh tính chủ tài sản, số nhà, giấy tờ
  // sở hữu — RPC cố tình không trả về.
  posting_id: string;
  title: string;
  parent_slug: string;
  child_slug: string;
  description: string | null;
  province: string | null;
  district: string | null;
  pricing_mode: string;
  starting_price: number | null;
  auction_format: string;
  commission_pct: number | null;
  expected_timeline: string | null;
  delta_fields: Record<string, unknown> | null;
  image_urls: string[] | null;
  has_dispute: boolean | null;
  has_mortgage: boolean | null;
  is_seized: boolean | null;
  right_to_sell: boolean;
}

/** Báo giá tổ chức gửi lại cho chủ tài sản. */
export interface ServiceQuoteInput {
  commission_pct: number | null;
  service_fee: number | null;
  starting_price: number | null;
  lead_time_days: number | null;
  note?: string;
  doc_path?: string;
}

// ─── Nhãn hiển thị ───────────────────────────────────────────────────────────

/** Nhãn theo góc nhìn TỔ CHỨC (hộp thư /portal). */
export const ORG_REQUEST_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  sent: "Yêu cầu mới",
  seen: "Đã xem",
  quoted: "Đã báo giá",
  accepted: "Đã tiếp nhận",
  declined: "Đã từ chối",
  selected: "Đã trúng",
  not_selected: "Không được chọn",
  withdrawn: "Chủ tài sản đã thu hồi",
};

/** Nhãn theo góc nhìn CHỦ TÀI SẢN (trang hồ sơ tài sản). */
export const OWNER_REQUEST_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  sent: "Đã gửi",
  seen: "Tổ chức đã xem",
  quoted: "Đã nhận báo giá",
  accepted: "Đã tiếp nhận",
  declined: "Tổ chức từ chối",
  selected: "Đã chọn tổ chức này",
  not_selected: "Đã chọn tổ chức khác",
  withdrawn: "Đã thu hồi",
};

export const REQUEST_STATUS_BADGE_CLASS: Record<ServiceRequestStatus, string> = {
  sent: "bg-primary/10 text-primary",
  seen: "bg-muted text-muted-foreground",
  quoted: "bg-accent/20 text-foreground",
  accepted: "bg-success/10 text-success",
  declined: "bg-destructive/10 text-destructive",
  selected: "bg-success/10 text-success",
  not_selected: "bg-muted text-muted-foreground",
  withdrawn: "bg-muted text-muted-foreground",
};

export const BROKER_STATUS_LABELS: Record<BrokerRequestStatus, string> = {
  pending: "Chờ sàn tiếp nhận",
  sourcing: "Sàn đang tìm tổ chức",
  quoted: "Đã có báo giá",
  selected: "Đã chọn tổ chức",
  cancelled: "Đã huỷ",
};

/** Tổ chức còn phải trả lời (hiện ở tab "Cần trả lời"). */
export const OPEN_REQUEST_STATUSES: ServiceRequestStatus[] = ["sent", "seen"];

/** Yêu cầu đã khép — tổ chức không thao tác được nữa. */
export const CLOSED_REQUEST_STATUSES: ServiceRequestStatus[] = [
  "selected",
  "not_selected",
  "withdrawn",
];
