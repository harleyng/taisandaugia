// Mock data for the BĐS deep-dive report page (/report/bds)

export const bdsMeta = {
  title: "Báo cáo chuyên sâu: Bất động sản đấu giá",
  sessionCount: 562,
  totalValue: 8420, // tỷ VND
  periodDays: 90,
};

export const bdsHighlights = [
  "Giá/m² đất ở TP.HCM cao nhất: trung vị 87 tr/m²",
  "Hà Nội tăng nhanh nhất: +14% YoY",
  "Đất nông nghiệp chỉ 2.3 tr/m² — gấp 38× rẻ hơn đất ở cùng khu vực",
  "Lô < 100 m² thường bidding war (chênh +23%), lô > 1.000 m² ít cạnh tranh",
  "22% phiên BĐS không thành — chủ yếu lô lớn (> 5 tỷ)",
];

export const bdsTocSections = [
  { id: "bds-highlights", label: "5 điểm nổi bật" },
  { id: "bds-b1", label: "B1. Giá/m² theo khu vực" },
  { id: "bds-b2", label: "B2. Chênh lệch theo phân khúc" },
  { id: "bds-b3", label: "B3. Phân phối chênh lệch" },
  { id: "bds-b4", label: "B4. Hall of Fame" },
  { id: "bds-b5", label: "B5. Xu hướng giá 12 tháng" },
  { id: "bds-b6", label: "B6. Tỷ lệ thành công" },
];

// B1 — Heatmap giá trung vị tr/m² theo khu vực × loại đất
export const bdsPriceHeatmapColumns = [
  { key: "datO", label: "Đất ở" },
  { key: "datNN", label: "Đất NN" },
  { key: "datTM", label: "Đất TM" },
  { key: "chungCu", label: "Chung cư" },
  { key: "nhaPho", label: "Nhà phố" },
] as const;

export type BdsHeatmapKey = (typeof bdsPriceHeatmapColumns)[number]["key"];

export const bdsPriceHeatmap: Array<{
  region: string;
  prices: Record<BdsHeatmapKey, number>;
}> = [
  { region: "TP.HCM Q.1", prices: { datO: 95, datNN: 12, datTM: 78, chungCu: 68, nhaPho: 110 } },
  { region: "TP.HCM Q.2", prices: { datO: 72, datNN: 8, datTM: 55, chungCu: 48, nhaPho: 82 } },
  { region: "TP.HCM Q.7", prices: { datO: 58, datNN: 6, datTM: 42, chungCu: 45, nhaPho: 65 } },
  { region: "HN Cầu Giấy", prices: { datO: 78, datNN: 9, datTM: 62, chungCu: 52, nhaPho: 92 } },
  { region: "HN Hai Bà Trưng", prices: { datO: 65, datNN: 7, datTM: 48, chungCu: 42, nhaPho: 72 } },
  { region: "Bình Dương", prices: { datO: 22, datNN: 2.3, datTM: 18, chungCu: 15, nhaPho: 28 } },
  { region: "Đồng Nai", prices: { datO: 18, datNN: 1.8, datTM: 14, chungCu: 12, nhaPho: 24 } },
];

// B2 — chênh lệch theo phân khúc
export const bdsDeltaByArea = [
  { label: "< 100 m²", delta: 23.1, n: 147 },
  { label: "100 - 500 m²", delta: 12.4, n: 218 },
  { label: "500 - 2.000 m²", delta: 7.8, n: 124 },
  { label: "> 2.000 m²", delta: 3.2, n: 73 },
];

export const bdsDeltaByType = [
  { label: "Nhà phố", delta: 19.5, n: 89 },
  { label: "Đất ở", delta: 11.8, n: 312 },
  { label: "Chung cư", delta: 9.6, n: 124 },
  { label: "Đất thương mại", delta: 5.1, n: 23 },
  { label: "Đất nông nghiệp", delta: 1.8, n: 14 },
];

// B3 — Phân phối chênh lệch
export const bdsDistribution = [
  { bucket: "-10%", count: 22 },
  { bucket: "0%", count: 46 },
  { bucket: "10%", count: 138 },
  { bucket: "20%", count: 124 },
  { bucket: "30%", count: 86 },
  { bucket: "40%", count: 64 },
  { bucket: "50%", count: 38 },
  { bucket: "60%", count: 22 },
  { bucket: "70%", count: 14 },
  { bucket: "80%+", count: 8 },
];

// B4 — Hall of fame
export const bdsTopBidWars = [
  { date: "12/09", location: "Q.1, TP.HCM", type: "Nhà phố", area: "95 m²", start: 8.5, win: 18.2, delta: 114 },
  { date: "03/09", location: "Cầu Giấy, HN", type: "Nhà phố", area: "80 m²", start: 6.2, win: 12.8, delta: 106 },
  { date: "21/08", location: "Q.3, TP.HCM", type: "Đất ở", area: "120 m²", start: 12.0, win: 24.0, delta: 100 },
  { date: "17/08", location: "Đống Đa, HN", type: "Nhà phố", area: "60 m²", start: 5.5, win: 10.4, delta: 89 },
  { date: "05/08", location: "Q.7, TP.HCM", type: "Đất ở", area: "150 m²", start: 9.8, win: 17.6, delta: 80 },
];

export const bdsTopDeals = [
  { date: "15/09", location: "Q.1, TP.HCM", type: "Đất ở", area: "120 m²", start: 12.0, win: 11.5, delta: -4.2 },
  { date: "08/09", location: "Đồng Nai", type: "Đất NN", area: "2.400 m²", start: 4.5, win: 4.5, delta: 0 },
  { date: "29/08", location: "Long An", type: "Đất ở", area: "300 m²", start: 6.2, win: 6.0, delta: -3.2 },
  { date: "20/08", location: "Bình Dương", type: "Đất TM", area: "800 m²", start: 8.0, win: 7.9, delta: -1.3 },
  { date: "10/08", location: "Đồng Nai", type: "Đất NN", area: "5.000 m²", start: 9.5, win: 9.4, delta: -1.1 },
];

// B5 — Xu hướng giá/m² 12 tháng (5 tỉnh)
export const bdsPriceTrend12m = [
  { month: "T10/24", "TP.HCM": 82, "Hà Nội": 71, "Bình Dương": 21, "Đồng Nai": 17, "Long An": 14 },
  { month: "T11/24", "TP.HCM": 83, "Hà Nội": 72, "Bình Dương": 21, "Đồng Nai": 17, "Long An": 14 },
  { month: "T12/24", "TP.HCM": 84, "Hà Nội": 73, "Bình Dương": 22, "Đồng Nai": 17, "Long An": 15 },
  { month: "T1/25", "TP.HCM": 84, "Hà Nội": 75, "Bình Dương": 22, "Đồng Nai": 18, "Long An": 15 },
  { month: "T2/25", "TP.HCM": 85, "Hà Nội": 76, "Bình Dương": 22, "Đồng Nai": 18, "Long An": 15 },
  { month: "T3/25", "TP.HCM": 85, "Hà Nội": 77, "Bình Dương": 23, "Đồng Nai": 18, "Long An": 16 },
  { month: "T4/25", "TP.HCM": 86, "Hà Nội": 78, "Bình Dương": 23, "Đồng Nai": 18, "Long An": 16 },
  { month: "T5/25", "TP.HCM": 86, "Hà Nội": 79, "Bình Dương": 23, "Đồng Nai": 19, "Long An": 16 },
  { month: "T6/25", "TP.HCM": 86, "Hà Nội": 80, "Bình Dương": 24, "Đồng Nai": 19, "Long An": 17 },
  { month: "T7/25", "TP.HCM": 87, "Hà Nội": 81, "Bình Dương": 24, "Đồng Nai": 19, "Long An": 17 },
  { month: "T8/25", "TP.HCM": 87, "Hà Nội": 82, "Bình Dương": 24, "Đồng Nai": 20, "Long An": 17 },
  { month: "T9/25", "TP.HCM": 87, "Hà Nội": 83, "Bình Dương": 25, "Đồng Nai": 20, "Long An": 18 },
];

export const bdsTrendCities = ["TP.HCM", "Hà Nội", "Bình Dương", "Đồng Nai", "Long An"] as const;

// B6 — Tỷ lệ thành công & tổ chức lại
export const bdsOutcomes = {
  successRate: 78,
  failureRate: 22,
  reauctionedRate: 64, // % phiên không thành đã được tổ chức lại trong 60 ngày
  reauctionWindowDays: 60,
};

export const bdsOutcomeFunnel = [
  { stage: "Tổng phiên BĐS", count: 562 },
  { stage: "Đấu giá thành công", count: 438 },
  { stage: "Không thành", count: 124 },
  { stage: "Đã tổ chức lại trong 60 ngày", count: 79 },
];
