export const reportMeta = {
  title: "Báo cáo thị trường đấu giá tài sản Việt Nam",
  updatedAt: "30/09/2025",
  sessionCount: 1247,
  periodDays: 90,
};

export const highlights = [
  {
    id: 1,
    text: "Ô tô đấu giá trúng cao hơn 34% so với khởi điểm — cao gấp 5× BĐS",
  },
  {
    id: 2,
    text: "1 trong 4 phiên đấu giá kết thúc không có người trúng",
  },
  {
    id: 3,
    text: "412 phiên sắp diễn ra — Hà Nội dẫn đầu với 89 phiên",
  },
];

export const topProvinces = [
  { name: "Hà Nội", count: 89 },
  { name: "TP.HCM", count: 76 },
  { name: "Bình Dương", count: 54 },
  { name: "Đồng Nai", count: 42 },
  { name: "Đà Nẵng", count: 38 },
];

// Extended province distribution for mock heatmap visualization
export const provinceDistribution = [
  ...topProvinces,
  { name: "Hải Phòng", count: 31 },
  { name: "Cần Thơ", count: 28 },
  { name: "Long An", count: 26 },
  { name: "Bắc Ninh", count: 24 },
  { name: "Quảng Ninh", count: 22 },
  { name: "Khánh Hòa", count: 19 },
  { name: "Nghệ An", count: 17 },
];

export const competitionData = [
  { category: "Ô tô", delta: 34.2 },
  { category: "Tài sản công", delta: 18.5 },
  { category: "Nợ xấu", delta: 13.8 },
  { category: "Tài sản khác", delta: 8.1 },
  { category: "Bất động sản", delta: 6.3 },
];

export const outcomeData = [
  { name: "Thành công", value: 76 },
  { name: "Không thành", value: 24 },
];

export const outcomeMeta = {
  reauctionRate: 70, // % phiên không thành được tổ chức lại trong 60 ngày
  reauctionWindow: 60, // ngày
};

export const priceTrendData = [
  { quarter: "Q1/24", "BĐS chung": 32, "Long An": 18, "Quanh HCMC": 28 },
  { quarter: "Q2/24", "BĐS chung": 33, "Long An": 19, "Quanh HCMC": 29 },
  { quarter: "Q3/24", "BĐS chung": 34, "Long An": 20, "Quanh HCMC": 30 },
  { quarter: "Q4/24", "BĐS chung": 35, "Long An": 21, "Quanh HCMC": 31 },
  { quarter: "Q1/25", "BĐS chung": 36, "Long An": 22, "Quanh HCMC": 32 },
  { quarter: "Q2/25", "BĐS chung": 37, "Long An": 24, "Quanh HCMC": 33 },
  { quarter: "Q3/25", "BĐS chung": 38, "Long An": 26, "Quanh HCMC": 34 },
];

export const deepDiveLinks = [
  { slug: "bds", label: "Bất động sản" },
  { slug: "oto", label: "Ô tô" },
  { slug: "tai-san-cong", label: "Tài sản công" },
  { slug: "npl", label: "Nợ xấu (NPL)" },
];

export const tocSections = [
  { id: "overview", label: "Tổng quan thị trường" },
  { id: "competition", label: "Cạnh tranh & chênh lệch" },
  { id: "outcomes", label: "Kết quả & không thành" },
  { id: "price-trend", label: "Xu hướng giá" },
];
