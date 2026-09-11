// Hồ sơ tham gia đấu giá (auction_bidding_contracts) + danh tính VNeID
// (user_verified_identities). Bảng + RPC + RLS:
// supabase/migrations/20260911000005_auction_bidding_contracts.sql.

import type { Tables } from "@/integrations/supabase/types";
import type { SessionPublishStatus } from "@/lib/auctionSessions/phase";

export type ContractStatus = "pending_payment" | "paid" | "cancelled";
export type DepositStatus = "pending" | "received" | "refunded" | "forfeited";
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

/** Phiên nhúng kèm hồ sơ — đủ để hiện tên, mã, lịch và trạng thái huỷ. */
export interface ContractSessionRef {
  id: string;
  code: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  status: SessionPublishStatus;
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

export const DEPOSIT_STATUS_LABELS: Record<DepositStatus, string> = {
  pending: "Chưa nhận",
  received: "Đã nhận",
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
