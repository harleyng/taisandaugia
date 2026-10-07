// Hồ sơ tham gia đấu giá (auction_bidding_contracts) + danh tính đã lưu
// (user_verified_identities). Bảng + RPC + RLS:
// supabase/migrations/20260911000005_auction_bidding_contracts.sql, mở rộng ở
// 20261008100000–100300 (eKYC, người mua tổ chức/uỷ quyền, duyệt hồ sơ, điểm danh).
//
// QUY TẮC: union ở đây PHẢI rộng bằng CHECK của DB. Nới CHECK ở migration thì nới
// union cùng lần — union hẹp hơn = nhãn trống mà typecheck vẫn xanh.

import type { Tables } from "@/integrations/supabase/types";
import type { SessionPublishStatus } from "@/lib/auctionSessions/phase";
import type { CheckinChannel } from "@/lib/biddingContracts/checkinWindow";
import type { KycField, ReadMethod } from "@/lib/ekyc/editedFields";
import type { AuctionFormat } from "@/types/asset-posting";

export type { CheckinChannel, KycField, ReadMethod };

/** 'refunded' = tổ chức từ chối hồ sơ ⇒ hoàn tiền hồ sơ (20261008100200). */
export type ContractStatus = "pending_payment" | "paid" | "cancelled" | "refunded";

/**
 * Toàn bộ trạng thái tiền đặt trước mà DB cho phép (CHECK mở rộng ở
 * 20260913000001). `applied` / `pending_refund` do org_finalize_session sinh ra
 * khi chốt phiên — KHÔNG tổ chức nào đặt tay được. Từ 20261008100200/100300 còn
 * sinh ra khi từ chối hồ sơ (received ⇒ pending_refund), chốt danh sách điểm danh
 * (vắng ⇒ forfeited) và miễn trừ vắng mặt (forfeited ⇒ pending_refund).
 */
export type DepositStatus =
  | "pending"
  | "received"
  | "applied"
  | "pending_refund"
  | "refunded"
  | "forfeited";

/**
 * Đúng 4 giá trị org_set_contract_deposit nhận (20260911000005:662) — nó RAISE
 * với mọi thứ khác. Hẹp hơn DepositStatus một cách CỐ Ý: đừng nới ra cho khớp,
 * vì hai trạng thái chốt phiên chỉ đi qua org_finalize_session /
 * org_confirm_winner_payment / org_mark_deposit_refunded.
 */
export type DepositActionStatus = "pending" | "received" | "refunded" | "forfeited";
export type IdType = "cccd" | "passport";
/** Nguồn danh tính TRÊN HỒ SƠ: 'vneid' chỉ khi khớp bản VNeID đã lưu (server tự quyết). */
export type IdentitySource = "manual" | "vneid";
/** Nguồn danh tính ĐÃ LƯU trên tài khoản (user_verified_identities.source). */
export type SavedIdentitySource = "vneid" | "id_photo";
export type Gender = "male" | "female";

/** Kết quả tổ chức duyệt hồ sơ — TÁCH khỏi status thanh toán. */
export type ReviewStatus = "pending" | "needs_info" | "approved" | "rejected";
/** Quyết định org_review_bidding_contract nhận ('pending' chỉ do người mua nộp lại). */
export type ReviewDecision = Exclude<ReviewStatus, "pending">;
export type ReviewEventKind = "submitted" | "needs_info" | "resubmitted" | "approved" | "rejected";
export type BuyerKind = "individual" | "organization";
/** Người có mặt lúc điểm danh: chính người đăng ký/người ĐDPL hay người được uỷ quyền. */
export type CheckinAttendee = "principal" | "proxy";

type ContractRow = Tables<"auction_bidding_contracts">;
type IdentityRow = Tables<"user_verified_identities">;

export type BiddingContract = Omit<
  ContractRow,
  | "status"
  | "deposit_status"
  | "id_type"
  | "identity_source"
  | "gender"
  | "review_status"
  | "buyer_kind"
  | "id_read_method"
  | "id_edited_fields"
  | "proxy_id_type"
  | "proxy_gender"
  | "proxy_id_read_method"
  | "proxy_id_edited_fields"
  | "checkin_channel"
  | "checkin_attendee"
> & {
  status: ContractStatus;
  deposit_status: DepositStatus;
  id_type: IdType;
  identity_source: IdentitySource;
  gender: Gender | null;
  review_status: ReviewStatus;
  buyer_kind: BuyerKind;
  id_read_method: ReadMethod | null;
  id_edited_fields: KycField[];
  proxy_id_type: IdType | null;
  proxy_gender: Gender | null;
  proxy_id_read_method: ReadMethod | null;
  proxy_id_edited_fields: KycField[];
  checkin_channel: CheckinChannel | null;
  checkin_attendee: CheckinAttendee | null;
};

/**
 * Phiên nhúng kèm hồ sơ — đủ để hiện tên, mã, lịch và trạng thái huỷ.
 * `auction_format` + `finalized_at` để biết có phòng đấu giá trực tuyến không và
 * phiên đã chốt kết quả chưa (cổng của dialog tiền đặt trước + nút trên hồ sơ).
 * `venue` + 3 cột điểm danh để hiện phiếu dự phiên và trạng thái dự phiên
 * (attendanceStateOf) mà không cần query phiên riêng.
 */
export interface ContractSessionRef {
  id: string;
  code: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  status: SessionPublishStatus;
  auction_format: AuctionFormat;
  finalized_at: string | null;
  venue: string | null;
  checkin_lead_minutes: number;
  checkin_grace_minutes: number;
  roster_closed_at: string | null;
}

export interface ContractWithSession extends BiddingContract {
  auction_sessions: ContractSessionRef | null;
}

/** auction_session_contract_summary — công khai, không lộ biên hoa hồng. */
export interface ContractSummary {
  paid_count: number;
  held_count: number;
  sale_enabled: boolean;
}

export type VerifiedIdentity = Omit<IdentityRow, "gender" | "source" | "id_type" | "read_method" | "edited_fields"> & {
  gender: Gender | null;
  source: SavedIdentitySource;
  id_type: IdType;
  read_method: ReadMethod | null;
  edited_fields: KycField[];
};

/** Một dòng nhật ký duyệt (auction_contract_review_events — chỉ ghi thêm). */
export type ContractReviewEvent = Omit<Tables<"auction_contract_review_events">, "kind"> & {
  kind: ReviewEventKind;
};

// ─── Payload đăng ký (start_bidding_contract / resubmit_bidding_contract) ─────
// Khớp _bidding_parties_from_payload (20261008100100). Đường dẫn ảnh là đường
// dẫn trong bucket buyer-kyc, PHẢI nằm dưới thư mục {user_id}/ của người gọi.

export interface IdentityPayload {
  full_name: string;
  id_type: IdType;
  id_number: string;
  /** yyyy-mm-dd */
  date_of_birth?: string | null;
  gender?: Gender | null;
  address: string;
  id_front_path?: string | null;
  /** Bắt buộc với CCCD; hộ chiếu không có mặt sau. */
  id_back_path?: string | null;
  read_method?: ReadMethod | null;
  edited_fields?: KycField[];
}

export interface OrganizationPayload {
  name: string;
  /** 10 hoặc 13 chữ số. */
  tax_code: string;
  address: string;
  /** Giấy chứng nhận đăng ký doanh nghiệp. */
  reg_doc_path: string;
}

export interface ProxyPayload extends IdentityPayload {
  phone: string;
  id_front_path: string;
  /** Giấy uỷ quyền. */
  poa_doc_path: string;
}

export interface RegistrationPayload {
  buyer_kind: BuyerKind;
  /** Liên hệ của hồ sơ. */
  phone: string;
  email: string;
  /** Người đăng ký (cá nhân) hoặc người đại diện theo pháp luật (tổ chức). */
  principal: IdentityPayload;
  organization?: OrganizationPayload | null;
  proxy?: ProxyPayload | null;
}

// ─── Điểm danh (20261008100300) ─────────────────────────────────────────────

/** Mã _checkin_block_reason — vì sao chưa điểm danh được (null = được). */
export type CheckinBlockReason =
  | "not_found"
  | "review_rejected"
  | "not_paid"
  | "session_not_published"
  | "format_unsupported"
  | "wrong_channel"
  | "already_checked_in"
  | "absent"
  | "roster_closed"
  | "review_pending"
  | "review_needs_info"
  | "deposit_not_received"
  | "window_not_open"
  | "window_closed";

/** auction_session_checkin_summary — công khai, chỉ số đếm. */
export interface CheckinSummary {
  /** Đã điểm danh + còn chờ điểm danh (đủ điều kiện). */
  eligible: number;
  checked_in: number;
  awaiting: number;
  absent: number;
  excused: number;
  roster_closed_at: string | null;
  channel: CheckinChannel | null;
  opens_at: string;
  closes_at: string;
}

/** Một hồ sơ trong kết quả org_checkin_lookup (đủ để so ảnh tại cửa). */
export interface CheckinLookupMatch {
  id: string;
  code: string;
  session_id: string;
  buyer_kind: BuyerKind;
  org_name: string | null;
  org_tax_code: string | null;
  full_name: string;
  id_type: IdType;
  id_number: string;
  date_of_birth: string | null;
  phone: string;
  id_front_path: string | null;
  id_back_path: string | null;
  id_edited_fields: KycField[];
  has_proxy: boolean;
  proxy_full_name: string | null;
  proxy_id_type: IdType | null;
  proxy_id_number: string | null;
  proxy_date_of_birth: string | null;
  proxy_id_front_path: string | null;
  proxy_id_back_path: string | null;
  proxy_id_edited_fields: KycField[];
  poa_doc_path: string | null;
  review_status: ReviewStatus;
  deposit_status: DepositStatus;
  bidder_no: number | null;
  checked_in_at: string | null;
  checkin_channel: CheckinChannel | null;
  checkin_attendee: CheckinAttendee | null;
  absent_at: string | null;
  absence_excused_at: string | null;
  block_reason: CheckinBlockReason | null;
}

export interface CheckinLookupResult {
  /** true = tra bằng mã QR trên phiếu. */
  by_token: boolean;
  matches: CheckinLookupMatch[];
}

/** org_check_in / self_check_in khi ok. `already` = đã điểm danh từ trước (giữ số). */
export interface CheckInResult {
  already: boolean;
  bidder_no: number;
  attendee: CheckinAttendee;
  checked_in_at: string;
}

/** request_checkin_otp khi ok. */
export interface CheckinOtpResult {
  expires_at: string;
  /** SĐT đã che, vd. 090****001. */
  sent_to: string;
  /** ⚠️ MÔ PHỎNG — mất khi gửi SMS thật. */
  demo_code?: string;
}

// ─── Nhãn ─────────────────────────────────────────────────────────────────

/** Trùng chữ với DEPOSIT_EVENT_LABELS để sổ tiền đặt trước và cờ đọc giống nhau. */
export const DEPOSIT_STATUS_LABELS: Record<DepositStatus, string> = {
  pending: "Chưa nhận",
  received: "Đã nhận",
  applied: "Chuyển vào tiền mua tài sản",
  pending_refund: "Chờ hoàn trả",
  refunded: "Đã hoàn trả",
  forfeited: "Không hoàn trả",
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  pending_payment: "Chờ thanh toán",
  paid: "Đã thanh toán",
  cancelled: "Đã huỷ",
  refunded: "Đã hoàn tiền hồ sơ",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Chờ duyệt",
  needs_info: "Cần bổ sung",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

export const REVIEW_EVENT_LABELS: Record<ReviewEventKind, string> = {
  submitted: "Nộp hồ sơ",
  needs_info: "Yêu cầu bổ sung",
  resubmitted: "Nộp lại hồ sơ",
  approved: "Duyệt hồ sơ",
  rejected: "Từ chối hồ sơ",
};

export const BUYER_KIND_LABELS: Record<BuyerKind, string> = {
  individual: "Cá nhân",
  organization: "Tổ chức",
};

export const CHECKIN_ATTENDEE_LABELS: Record<CheckinAttendee, string> = {
  principal: "Người đăng ký",
  proxy: "Người được uỷ quyền",
};

export const READ_METHOD_LABELS: Record<ReadMethod, string> = {
  qr: "Đọc mã QR",
  ocr: "Đọc chữ trên ảnh",
  typed: "Tự nhập",
};

export const KYC_FIELD_LABELS: Record<KycField, string> = {
  full_name: "Họ tên",
  id_number: "Số giấy tờ",
  date_of_birth: "Ngày sinh",
  gender: "Giới tính",
  address: "Địa chỉ",
  id_issued_on: "Ngày cấp",
};

export const SAVED_IDENTITY_SOURCE_LABELS: Record<SavedIdentitySource, string> = {
  vneid: "VNeID",
  id_photo: "Ảnh giấy tờ",
};

export const ID_TYPE_LABELS: Record<IdType, string> = {
  cccd: "CCCD",
  passport: "Hộ chiếu",
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Nam",
  female: "Nữ",
};
