import type { Database } from "@/integrations/supabase/types";

export type AuctionConsultation = Database["public"]["Tables"]["asset_auction_consultations"]["Row"];
export type AuctionConsultProposal = Database["public"]["Tables"]["asset_auction_consult_proposals"]["Row"];
export type AuctionConsultSuggestion =
  Database["public"]["Functions"]["org_session_auction_consult_suggestions"]["Returns"][number];

/** Mã trạng thái lưu trong DB — nhãn tiếng Việt ở lib/auctionConsult/status.ts. */
export type AuctionConsultStatus =
  | "requested"
  | "quoted"
  | "paid"
  | "in_review"
  | "completed"
  | "superseded"
  | "cancelled";

export type SaleGoal = "fastest" | "max_price" | "balanced";
export type SellerDecision = "pending" | "accepted" | "declined";
/** "Trả giá lên" là phương thức duy nhất engine chạy được; hai loại còn lại chỉ tham khảo. */
export type ConsultBiddingMethod = "ascending" | "descending" | "sealed";
export type ConsultDepositMode = "percent" | "amount";

/** Khoá ghi chú từng tham số trong `field_notes` — khớp danh sách ở _auction_consult_write_proposal. */
export type ProposalNoteKey =
  | "auction_format"
  | "bidding_method"
  | "starting_price"
  | "reserve_price"
  | "bid_step"
  | "lot_duration"
  | "deposit";

/** Phương án đang soạn (admin). Tiền để dạng chuỗi chữ số như ô nhập. */
export interface ProposalDraft {
  auction_format: string;
  bidding_method: string;
  starting_price: string;
  reserve_price: string;
  bid_step: string;
  lot_duration_minutes: string;
  deposit_mode: ConsultDepositMode;
  deposit_value: string;
  rationale: string;
  field_notes: Partial<Record<ProposalNoteKey, string>>;
}

export interface AuctionConsultPackage {
  variant_id: string;
  variant_key: string;
  name: string;
  from_price: number;
}

export interface AuctionConsultPartner {
  supplier_id: string;
  name: string;
}

export interface PayAuctionConsultResult {
  ok: true;
  status: "paid" | "already_paid";
  consultation_id: string;
  code: string;
  posting_id: string;
}
