export interface AuctionFilters {
  searchQuery: string;
  category: string;
  province: string;
  district: string;
  sessionStatus: string;
  priceMin: string;
  priceMax: string;
  depositMin: string;
  depositMax: string;
  publishDateFrom: Date | undefined;
  publishDateTo: Date | undefined;
  legalCategory: string;
  useMergedAddress: boolean;
}

export const defaultAuctionFilters: AuctionFilters = {
  searchQuery: "",
  category: "",
  province: "",
  district: "",
  sessionStatus: "",
  priceMin: "",
  priceMax: "",
  depositMin: "",
  depositMax: "",
  publishDateFrom: undefined,
  publishDateTo: undefined,
  legalCategory: "",
  useMergedAddress: false,
};

export const PRICE_RANGES = [
  { label: "Dưới 1 tỷ", min: "0", max: "1000000000" },
  { label: "1 – 5 tỷ", min: "1000000000", max: "5000000000" },
  { label: "5 – 10 tỷ", min: "5000000000", max: "10000000000" },
  { label: "Trên 10 tỷ", min: "10000000000", max: "" },
];

export const STATUS_OPTIONS = [
  { value: "registration_open", label: "Mở đăng ký" },
  { value: "upcoming", label: "Sắp diễn ra" },
  { value: "ongoing", label: "Đang diễn ra" },
  { value: "ended", label: "Đã kết thúc" },
];

export const LEGAL_CATEGORIES = [
  { value: "thi-hanh-an", label: "Thi hành án" },
  { value: "no-xau", label: "Nợ xấu (VAMC)" },
  { value: "thanh-ly", label: "Thanh lý tài sản" },
  { value: "pha-san", label: "Phá sản" },
  { value: "khac", label: "Khác" },
];

export function countActiveFilters(filters: AuctionFilters): number {
  let count = 0;
  if (filters.category) count++;
  if (filters.province) count++;
  if (filters.district) count++;
  if (filters.sessionStatus) count++;
  if (filters.priceMin || filters.priceMax) count++;
  if (filters.depositMin || filters.depositMax) count++;
  if (filters.publishDateFrom || filters.publishDateTo) count++;
  if (filters.legalCategory) count++;
  return count;
}
