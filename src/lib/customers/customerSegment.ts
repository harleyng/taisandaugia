// Phân khúc khách hàng. Từ vựng dùng CHUNG với leads.lead_type để chuyển đổi
// lead → khách hàng copy 1:1, không phải map qua bảng trung gian.
//
// Đặt ở phía khách hàng và leads import vào — module dưới nguồn không cấp từ
// vựng cho module trên nguồn.

export type CustomerSegment =
  | "auction_company" | "asset_owner" | "bank" | "investor" | "broker" | "other";

export const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  auction_company: "Công ty đấu giá",
  asset_owner: "Chủ tài sản",
  bank: "Ngân hàng",
  investor: "Nhà đầu tư",
  broker: "Môi giới",
  other: "Khác",
};

export const SEGMENT_BADGE_CLASS: Record<CustomerSegment, string> = {
  auction_company: "bg-blue-100 text-blue-700",
  asset_owner: "bg-violet-100 text-violet-700",
  bank: "bg-cyan-100 text-cyan-700",
  investor: "bg-amber-100 text-amber-700",
  broker: "bg-orange-100 text-orange-700",
  other: "bg-gray-100 text-gray-600",
};

export const segmentLabel = (s: string | null | undefined): string =>
  (s && SEGMENT_LABELS[s as CustomerSegment]) || "Khác";

export const SEGMENT_OPTIONS = (Object.keys(SEGMENT_LABELS) as CustomerSegment[]).map((k) => ({
  value: k,
  label: SEGMENT_LABELS[k],
}));
