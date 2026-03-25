export const LISTING_STATUSES = {
  DRAFT: "Nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  ACTIVE: "Đang hiển thị",
  REJECTED: "Bị từ chối",
  SOLD: "Đã bán",
  RENTED: "Đã cho thuê",
} as const;

export const PRICE_UNITS = {
  TOTAL: "Tổng giá",
  PER_SQM: "VND/m²",
  PER_MONTH: "VND/tháng",
} as const;

export const PURPOSES = {
  FOR_SALE: "Bán",
  FOR_RENT: "Cho thuê",
} as const;

export const DIRECTIONS = [
  "Đông",
  "Tây",
  "Nam",
  "Bắc",
  "Đông Bắc",
  "Tây Bắc",
  "Đông Nam",
  "Tây Nam",
] as const;

export const LEGAL_STATUSES = [
  "Sổ hồng",
  "Sổ đỏ",
  "HĐMB",
  "Đang chờ sổ",
] as const;

export const INTERIOR_STATUSES = [
  "Full nội thất",
  "Nội thất cơ bản",
  "Không nội thất",
] as const;

export const LAND_TYPES = [
  "Đất thổ cư",
  "Đất nông nghiệp",
  "Đất thương mại dịch vụ",
] as const;
