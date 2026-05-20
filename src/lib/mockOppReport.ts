// Mock data for Phase 1 opportunity report

// ── 63 tỉnh thành grouped by vùng ──
export interface ProvinceGroup {
  label: string;
  provinces: string[];
}

export const PROVINCE_GROUPS: ProvinceGroup[] = [
  {
    label: "Miền Bắc",
    provinces: [
      "Hà Nội", "Hải Phòng", "Quảng Ninh", "Hải Dương", "Hưng Yên",
      "Thái Bình", "Nam Định", "Ninh Bình", "Hà Nam", "Vĩnh Phúc",
      "Bắc Ninh", "Bắc Giang", "Lạng Sơn", "Thái Nguyên", "Cao Bằng",
      "Bắc Kạn", "Tuyên Quang", "Hà Giang", "Lào Cai", "Yên Bái",
      "Phú Thọ", "Điện Biên", "Lai Châu", "Sơn La", "Hoà Bình",
    ],
  },
  {
    label: "Miền Trung",
    provinces: [
      "Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Quảng Bình", "Quảng Trị",
      "Thừa Thiên Huế", "Đà Nẵng", "Quảng Nam", "Quảng Ngãi", "Bình Định",
      "Phú Yên", "Khánh Hòa", "Ninh Thuận", "Bình Thuận",
      "Kon Tum", "Gia Lai", "Đắk Lắk", "Đắk Nông", "Lâm Đồng",
    ],
  },
  {
    label: "Miền Nam",
    provinces: [
      "TP. Hồ Chí Minh", "Bình Dương", "Đồng Nai", "Bà Rịa - Vũng Tàu",
      "Tây Ninh", "Bình Phước", "Long An", "Tiền Giang", "Bến Tre",
      "Trà Vinh", "Vĩnh Long", "Đồng Tháp", "An Giang", "Kiên Giang",
      "Cần Thơ", "Hậu Giang", "Sóc Trăng", "Bạc Liêu", "Cà Mau",
    ],
  },
];

export const ALL_PROVINCES = PROVINCE_GROUPS.flatMap((g) => g.provinces);

// Keep for backward-compat with other parts of the file
export const REGION_OPTIONS = ALL_PROVINCES;

export const ASSET_TYPE_OPTIONS = [
  { id: "bds", label: "Bất động sản" },
  { id: "xe", label: "Xe cộ" },
  { id: "mm", label: "Máy móc" },
  { id: "hh", label: "Hàng hóa" },
  { id: "dd", label: "Đồ dùng" },
  { id: "khac", label: "Khác" },
];

export const TIME_PERIOD_OPTIONS = [
  { id: "week", label: "Tuần này" },
  { id: "next_week", label: "Tuần sau" },
  { id: "30", label: "30 ngày" },
  { id: "60", label: "60 ngày" },
  { id: "90", label: "90 ngày" },
  { id: "month", label: "Tháng này" },
];

export const LEGAL_TYPE_OPTIONS = [
  { id: "tha_ds", label: "Thi hành án dân sự" },
  { id: "tha_hs", label: "Thi hành án hình sự" },
  { id: "npl", label: "Nợ xấu tín dụng" },
  { id: "bao_dam", label: "Xử lý tài sản bảo đảm" },
  { id: "dg_thuong", label: "Đấu giá thường (tự nguyện)" },
  { id: "tl_cong", label: "Thanh lý tài sản công" },
  { id: "pha_san", label: "Phá sản — giải thể" },
  { id: "thue_hq", label: "Thuế — hải quan" },
  { id: "dat_dai", label: "Đất đai — GPMB" },
  { id: "hanh_chinh", label: "Hành chính — vi phạm" },
  { id: "thua_ke", label: "Thừa kế — chia tài sản" },
  { id: "bao_hiem", label: "Kinh doanh bảo hiểm" },
  { id: "vo_chu", label: "Tài sản vô chủ" },
  { id: "tdkt", label: "Tổ chức tín dụng (riêng)" },
  { id: "khac", label: "Khác" },
];

export const PRICE_RANGE_OPTIONS = [
  { id: "all", label: "Tất cả" },
  { id: "lt1", label: "< 1 tỷ" },
  { id: "1-5", label: "1–5 tỷ" },
  { id: "5-20", label: "5–20 tỷ" },
  { id: "20-100", label: "20–100 tỷ" },
  { id: "gt100", label: "> 100 tỷ" },
];

export const DISTRICTS_BY_REGION: Record<string, string[]> = {
  "Hà Nội": ["Cầu Giấy", "Hoàn Kiếm", "Đống Đa", "Hà Đông", "Nam Từ Liêm"],
  "TP. Hồ Chí Minh": ["Quận 1", "Quận 7", "Quận 3", "Bình Thạnh", "Phú Nhuận", "Hóc Môn"],
  "Bình Dương": ["Thủ Dầu Một", "Dĩ An", "Thuận An"],
  "Đồng Nai": ["Biên Hòa", "Long Thành"],
  "Long An": ["Tân An", "Đức Hòa"],
  "Đà Nẵng": ["Hải Châu", "Sơn Trà", "Liên Chiểu"],
};

// --- Chart data ---

export const areaHeatmapData = [
  { label: "Q.1", level: 4 as const }, { label: "CG", level: 3 as const },
  { label: "Q.7", level: 2 as const }, { label: "BT", level: 1 as const },
  { label: "HĐ", level: 3 as const }, { label: "PN", level: 2 as const },
  { label: "NTL", level: 1 as const }, { label: "BD", level: 2 as const },
  { label: "ĐN", level: 1 as const }, { label: "LA", level: 3 as const },
  { label: "ĐN", level: 1 as const }, { label: "HM", level: 0 as const },
  { label: "DN", level: 1 as const }, { label: "ST", level: 0 as const },
];

export const priceHistogramData = [
  { range: "1–3\ntỷ", count: 21, value: 42, peak: true },
  { range: "3–5\ntỷ", count: 14, value: 56, peak: false },
  { range: "5–10\ntỷ", count: 7, value: 52, peak: false },
  { range: "10–15\ntỷ", count: 3, value: 37, peak: false },
  { range: "15–20\ntỷ", count: 2, value: 34, peak: false },
];

export const assetTypeDonut = [
  { label: "Bất động sản", color: "hsl(var(--primary))", count: 25, pct: 53 },
  { label: "Ô tô", color: "#c89a3e", count: 11, pct: 23 },
  { label: "Tài sản công", color: "#9c3326", count: 7, pct: 15 },
  { label: "Máy móc", color: "#2a4d6e", count: 4, pct: 9 },
];

export const legalTypeDonut = [
  { label: "Thi hành án", color: "hsl(var(--primary))", count: 20, pct: 42 },
  { label: "Đấu giá thường", color: "#c89a3e", count: 13, pct: 28 },
  { label: "Nợ xấu", color: "#9c3326", count: 9, pct: 19 },
  { label: "Thanh lý", color: "#5a3d7a", count: 5, pct: 11 },
];

export const top5Owners = [
  { name: "Vietcombank", count: 9 },
  { name: "Agribank", count: 7 },
  { name: "Cục THADS TP.HCM", count: 5 },
  { name: "BIDV", count: 4 },
  { name: "UBND TP. Hà Nội", count: 3 },
];

export const top5Auctioneers = [
  { name: "Cty ĐG Minh Pháp", count: 8 },
  { name: "Cty ĐG Hồng Đức", count: 6 },
  { name: "Cty ĐG Bắc Trung Nam", count: 5 },
  { name: "TT DV ĐG TS Hà Nội", count: 4 },
  { name: "Cty ĐG Sài Gòn", count: 3 },
];

export const weeklySchedule = [
  { week: "Tuần 1", days: [{ level: 1, count: 3 }, { level: 2, count: 5 }, { level: 0, count: 0 }, { level: 1, count: 2 }] },
  { week: "Tuần 2", days: [{ level: 2, count: 4 }, { level: 2, count: 6 }, { level: 1, count: 3 }, { level: 1, count: 2 }] },
  { week: "Tuần 3", days: [{ level: 3, count: 7 }, { level: 4, count: 11 }, { level: 0, count: 0 }, { level: 0, count: 0 }] },
  { week: "Tuần 4+", days: [{ level: 1, count: 2 }, { level: 2, count: 4 }, { level: 1, count: 3 }, { level: 0, count: 0 }] },
];

export const bdsPricePerSqm = [
  { area: "Q.1, TP.HCM", price: 95, pct: 100 },
  { area: "Cầu Giấy, HN", price: 78, pct: 82 },
  { area: "Q.7, TP.HCM", price: 58, pct: 61 },
  { area: "Hà Đông, HN", price: 34, pct: 36 },
  { area: "Hóc Môn, HCM", price: 23, pct: 24 },
];

export const bdsAreaHistogram = [
  { range: "<100\nm²", count: 7, peak: false },
  { range: "100–200\nm²", count: 12, peak: true },
  { range: "200–500\nm²", count: 4, peak: false },
  { range: "500–1k\nm²", count: 2, peak: false },
  { range: ">1k\nm²", count: 0, peak: false },
];

export const bdsScatterData = [
  { x: 5, y: 78, status: "below" as const },
  { x: 14, y: 60, status: "below" as const },
  { x: 22, y: 55, status: "avg" as const },
  { x: 30, y: 38, status: "above" as const },
  { x: 38, y: 30, status: "above" as const },
  { x: 46, y: 75, status: "below" as const },
  { x: 54, y: 52, status: "avg" as const },
  { x: 62, y: 35, status: "above" as const },
  { x: 70, y: 22, status: "above" as const },
  { x: 78, y: 14, status: "above" as const },
  { x: 86, y: 80, status: "below" as const },
  { x: 94, y: 20, status: "above" as const },
];

// --- Session rows ---

export interface SessionRow {
  id: string;
  title: string;
  loc: string;
  area: string;
  type: string;
  typeId: "bds" | "oto" | "tsc" | "mm";
  legal: string;
  legalId: "tha" | "npl" | "thuong" | "tl";
  price: string;
  owner: string;
  auctioneer: string;
  date: string;
  daysLeft: number;
}

export const mockSessions: SessionRow[] = [
  { id: "1", title: "QSD Đất lô A12, P. Bến Nghé", loc: "Quận 1, TP.HCM", area: "120 m²", type: "BĐS", typeId: "bds", legal: "Thi hành án", legalId: "tha", price: "11.5 tỷ", owner: "Cục THADS TP.HCM", auctioneer: "Cty ĐG Minh Pháp", date: "22/05/2026", daysLeft: 5 },
  { id: "2", title: "Khoản nợ #2026-088 (BĐS đảm bảo)", loc: "Cầu Giấy, Hà Nội", area: "86 m²", type: "BĐS", typeId: "bds", legal: "Nợ xấu", legalId: "npl", price: "8.2 tỷ", owner: "Vietcombank", auctioneer: "Cty ĐG Hồng Đức", date: "24/05/2026", daysLeft: 7 },
  { id: "3", title: "Xe ô tô Toyota Camry 2018", loc: "Hà Nội", area: "—", type: "Ô tô", typeId: "oto", legal: "Thanh lý", legalId: "tl", price: "820 tr", owner: "UBND TP. Hà Nội", auctioneer: "TT DV ĐG TS Hà Nội", date: "25/05/2026", daysLeft: 8 },
  { id: "4", title: "QSD Đất nền, KĐT Phú Mỹ Hưng", loc: "Quận 7, TP.HCM", area: "200 m²", type: "BĐS", typeId: "bds", legal: "Đấu giá thường", legalId: "thuong", price: "11.4 tỷ", owner: "Tổng cty IDC", auctioneer: "Cty ĐG Sài Gòn", date: "29/05/2026", daysLeft: 12 },
  { id: "5", title: "Lô máy móc thiết bị (5 mục)", loc: "Bình Dương", area: "—", type: "Máy móc", typeId: "mm", legal: "Thi hành án", legalId: "tha", price: "2.1 tỷ", owner: "Cục THADS Bình Dương", auctioneer: "Cty ĐG Bắc Trung Nam", date: "02/06/2026", daysLeft: 16 },
  { id: "6", title: "Căn hộ chung cư CT3, Mỹ Đình", loc: "Nam Từ Liêm, Hà Nội", area: "95 m²", type: "BĐS", typeId: "bds", legal: "Nợ xấu", legalId: "npl", price: "3.8 tỷ", owner: "Agribank", auctioneer: "TT DV ĐG TS Hà Nội", date: "05/06/2026", daysLeft: 19 },
  { id: "7", title: "Xe tải Thaco Auman 2020", loc: "Đồng Nai", area: "—", type: "Ô tô", typeId: "oto", legal: "Thi hành án", legalId: "tha", price: "1.35 tỷ", owner: "Cục THADS Đồng Nai", auctioneer: "Cty ĐG Bắc Trung Nam", date: "07/06/2026", daysLeft: 21 },
  { id: "8", title: "Trụ sở văn phòng P. Điện Biên Phủ", loc: "Đống Đa, Hà Nội", area: "340 m²", type: "Tài sản công", typeId: "tsc", legal: "Thanh lý", legalId: "tl", price: "62 tỷ", owner: "Bộ Tài chính", auctioneer: "Cty ĐG Minh Pháp", date: "10/06/2026", daysLeft: 24 },
  { id: "9", title: "QSD Đất thổ cư P. Thạnh Mỹ Lợi", loc: "Quận 2, TP.HCM", area: "185 m²", type: "BĐS", typeId: "bds", legal: "Thi hành án", legalId: "tha", price: "9.7 tỷ", owner: "Cục THADS TP.HCM", auctioneer: "Cty ĐG Hồng Đức", date: "12/06/2026", daysLeft: 26 },
  { id: "10", title: "Dây chuyền sản xuất nhựa", loc: "Bình Dương", area: "—", type: "Máy móc", typeId: "mm", legal: "Nợ xấu", legalId: "npl", price: "4.5 tỷ", owner: "BIDV", auctioneer: "Cty ĐG Sài Gòn", date: "15/06/2026", daysLeft: 29 },
];
