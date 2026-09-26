// Nhãn của mục tiêu bán, phương thức trả giá và từng tham số trong phương án tư vấn.

import type { ConsultBiddingMethod, ProposalNoteKey, SaleGoal } from "@/types/auctionConsult";

export const SALE_GOAL_OPTIONS: { value: SaleGoal; label: string; desc: string }[] = [
  { value: "fastest", label: "Bán nhanh", desc: "Ưu tiên chốt được trong thời gian ngắn" },
  { value: "max_price", label: "Giá cao nhất", desc: "Chấp nhận chờ lâu hơn để tối đa giá bán" },
  { value: "balanced", label: "Cân bằng", desc: "Giá hợp lý trong thời gian hợp lý" },
];

export const SALE_GOAL_LABELS: Record<SaleGoal, string> = Object.fromEntries(
  SALE_GOAL_OPTIONS.map((o) => [o.value, o.label]),
) as Record<SaleGoal, string>;

export const BIDDING_METHOD_LABELS: Record<ConsultBiddingMethod, string> = {
  ascending: "Trả giá lên",
  descending: "Đặt giá xuống",
  sealed: "Bỏ phiếu kín",
};

/** Phương thức engine đấu giá trực tuyến chạy được hôm nay — còn lại chỉ để tham khảo. */
export const ENGINE_SUPPORTED_METHODS: ConsultBiddingMethod[] = ["ascending"];

export const PROPOSAL_NOTE_LABELS: Record<ProposalNoteKey, string> = {
  auction_format: "Hình thức",
  bidding_method: "Phương thức trả giá",
  starting_price: "Giá khởi điểm",
  reserve_price: "Giá bảo lưu",
  bid_step: "Bước giá",
  lot_duration: "Thời lượng lô",
  deposit: "Tiền đặt trước",
};

export const PROPOSAL_NOTE_KEYS = Object.keys(PROPOSAL_NOTE_LABELS) as ProposalNoteKey[];

export const saleGoalLabel = (s: string) => SALE_GOAL_LABELS[s as SaleGoal] ?? s;
export const biddingMethodLabel = (s: string | null | undefined) =>
  s ? (BIDDING_METHOD_LABELS[s as ConsultBiddingMethod] ?? s) : "—";
export const isEngineSupportedMethod = (s: string | null | undefined) =>
  ENGINE_SUPPORTED_METHODS.includes(s as ConsultBiddingMethod);
