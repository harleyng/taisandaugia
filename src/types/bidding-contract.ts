// Hồ sơ tham gia đấu giá (auction_bidding_contracts) + danh tính VNeID
// (user_verified_identities). Bảng + RPC + RLS:
// supabase/migrations/20260911000005_auction_bidding_contracts.sql.

import type { Tables } from "@/integrations/supabase/types";
import type { SessionPublishStatus } from "@/lib/auctionSessions/phase";
import type { AuctionFormat } from "@/types/asset-posting";

export type ContractStatus = "pending_payment" | "paid" | "cancelled";

/**
 * Toàn bộ trạng thái tiền đặt trước mà DB cho phép (CHECK mở rộng ở
 * 20260913000001). `applied` / `pending_refund` do org_finalize_session sinh ra
 * khi chốt phiên — KHÔNG tổ chức nào đặt tay được.
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
export type IdentitySource = "manual" | "vneid";
export type Gender = "male" | "female";

type ContractRow = Tables<"auction_bidding_contracts">;
type IdentityRow = Tables<"user_verified_identities">;

export type BiddingContract = Omit<
  ContractRow,
  "status" | "deposit_status" | "id_type" | "identity_source" | "gender"
> & {
  status: ContractStatus;
  deposit_status: DepositStatus;
  id_type: IdType;
  identity_source: IdentitySource;
  gender: Gender | null;
};

/**
 * Phiên nhúng kèm hồ sơ — đủ để hiện tên, mã, lịch và trạng thái huỷ.
 * `auction_format` + `finalized_at` để biết có phòng đấu giá trực tuyến không và
 * phiên đã chốt kết quả chưa (cổng của dialog tiền đặt trước + nút trên hồ sơ).
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

export type VerifiedIdentity = Omit<IdentityRow, "gender" | "source"> & {
  gender: Gender | null;
  source: "vneid";
};

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
};

export const ID_TYPE_LABELS: Record<IdType, string> = {
  cccd: "CCCD",
  passport: "Hộ chiếu",
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Nam",
  female: "Nữ",
};
