export const outcomesMeta = {
  title: "Báo cáo chuyên sâu: Kết quả & Nguyên nhân không thành",
  sessionCount: 1247,
  periodDays: 90,
  updatedAt: "30/09/2025",
};

export const outcomesHighlights = [
  "24% phiên đấu giá kết thúc không có người trúng",
  "Nợ xấu là phân khúc khó nhất — 49% phiên không thành",
  "70% phiên thất bại được tổ chức lại trong 60 ngày",
  "Giá khởi điểm lần 2 thường giảm 8% so với lần 1",
  "28% phiên tổ chức lại lần 2 cũng không thành",
];

export const outcomesTocSections = [
  { id: "outcomes-c1", label: "C1. Tỷ lệ thành công toàn thị trường" },
  { id: "outcomes-c2", label: "C2. Theo loại tài sản" },
  { id: "outcomes-c3", label: "C3. Theo khu vực" },
  { id: "outcomes-c4", label: "C4. Theo khoảng giá trị" },
  { id: "outcomes-c5", label: "C5. Phiên đấu giá lại" },
  { id: "outcomes-c6", label: "C6. Hall of Fame" },
  { id: "outcomes-c7", label: "C7. Xu hướng theo thời gian" },
];

// C1
export const marketRateData = [
  { name: "Thành công", value: 76 },
  { name: "Không thành", value: 24 },
];

// C2
export const failureByCategory = [
  { name: "Nợ xấu (NPL)", value: 49 },
  { name: "Tài sản công", value: 35 },
  { name: "Tài sản khác", value: 28 },
  { name: "Bất động sản", value: 22 },
  { name: "Ô tô", value: 18 },
];

// C3
export const failureRegionTop = [
  { rank: 1, name: "Bình Phước", rate: 38, n: 24 },
  { rank: 2, name: "Đắk Lắk", rate: 34, n: 31 },
  { rank: 3, name: "Long An", rate: 31, n: 42 },
  { rank: 4, name: "Bình Dương", rate: 29, n: 54 },
  { rank: 5, name: "Tây Ninh", rate: 27, n: 18 },
];

export const failureRegionBottom = [
  { rank: 1, name: "TP.HCM", rate: 15, n: 76 },
  { rank: 2, name: "Hà Nội", rate: 18, n: 89 },
  { rank: 3, name: "Đà Nẵng", rate: 19, n: 38 },
  { rank: 4, name: "Hải Phòng", rate: 20, n: 27 },
  { rank: 5, name: "Cần Thơ", rate: 21, n: 22 },
];

// C4
export const failureByValue = [
  { name: "< 1 tỷ", value: 18 },
  { name: "1 - 5 tỷ", value: 22 },
  { name: "5 - 10 tỷ", value: 28 },
  { name: "> 10 tỷ", value: 34 },
];

// C5 funnel
export const reauctionFunnel = {
  failed: 100,
  reauctioned: 70,
  avgDays: 38,
  priceDropPct: 8,
  reSuccess: 50,
  reFailed: 20,
};

// C6 hall of fame
export type HallOfFameRow = {
  id: string;
  asset: string;
  type: string;
  location: string;
  rounds: number;
  avgDrop: number; // negative percentage
  startPrice: string;
  status: string;
  note: string;
};

export const hallOfFameRows: HallOfFameRow[] = [
  {
    id: "hof-1",
    asset: "Lô đất 2,400m² nông nghiệp",
    type: "Quyền sử dụng đất",
    location: "Cần Giuộc, Long An",
    rounds: 5,
    avgDrop: -22,
    startPrice: "12,4 tỷ → 9,7 tỷ",
    status: "Đang đấu lại lần 6",
    note: "Vướng quy hoạch sử dụng đất, người mua e ngại pháp lý — giá khởi điểm giảm dần qua mỗi lần.",
  },
  {
    id: "hof-2",
    asset: "Khoản nợ doanh nghiệp XYZ",
    type: "Nợ xấu (NPL)",
    location: "Vietcombank — TP.HCM",
    rounds: 4,
    avgDrop: -35,
    startPrice: "84 tỷ → 54 tỷ",
    status: "Chờ tổ chức lần 5",
    note: "Tài sản đảm bảo phức tạp, định giá sổ sách cao hơn thị trường ~30%.",
  },
  {
    id: "hof-3",
    asset: "Xe Toyota Camry 2018",
    type: "Ô tô",
    location: "Hà Nội",
    rounds: 3,
    avgDrop: -18,
    startPrice: "780 triệu → 640 triệu",
    status: "Đã thành công lần 3",
    note: "Giá khởi điểm ban đầu cao hơn thị trường xe cũ; điều chỉnh dần đến mức hợp lý.",
  },
  {
    id: "hof-4",
    asset: "Nhà phố 75m² Q.7",
    type: "Bất động sản",
    location: "TP.HCM",
    rounds: 3,
    avgDrop: -12,
    startPrice: "11,2 tỷ → 9,9 tỷ",
    status: "Đang đấu lại lần 4",
    note: "Hẻm hẹp, hạn chế dòng người mua tiềm năng.",
  },
  {
    id: "hof-5",
    asset: "Máy móc nhà máy dệt",
    type: "Tài sản khác",
    location: "Bình Dương",
    rounds: 3,
    avgDrop: -25,
    startPrice: "5,8 tỷ → 4,3 tỷ",
    status: "Đang đấu lại lần 4",
    note: "Khấu hao nhanh, ít người mua chuyên ngành tham gia.",
  },
  {
    id: "hof-6",
    asset: "Đất nền dự án Khu Tây",
    type: "Quyền sử dụng đất",
    location: "Đắk Lắk",
    rounds: 3,
    avgDrop: -20,
    startPrice: "2,3 tỷ → 1,8 tỷ",
    status: "Chờ tổ chức lại lần 4",
    note: "Vùng pháp lý mới, thanh khoản thấp.",
  },
  {
    id: "hof-7",
    asset: "Khoản nợ cá nhân ABC",
    type: "Nợ xấu (NPL)",
    location: "BIDV — Hà Nội",
    rounds: 3,
    avgDrop: -28,
    startPrice: "6,2 tỷ → 4,5 tỷ",
    status: "Đang đấu lại lần 4",
    note: "Tài sản đảm bảo là căn hộ chung cư đang tranh chấp.",
  },
  {
    id: "hof-8",
    asset: "Tài sản kê biên (kho hàng)",
    type: "Tài sản công",
    location: "Hải Phòng",
    rounds: 2,
    avgDrop: -15,
    startPrice: "3,9 tỷ → 3,3 tỷ",
    status: "Đã thành công lần 3",
    note: "Vị trí gần cảng — sau khi giảm giá, nhiều bên logistics quan tâm.",
  },
  {
    id: "hof-9",
    asset: "Lô đất công nghiệp 8.000m²",
    type: "Quyền sử dụng đất",
    location: "Bình Phước",
    rounds: 2,
    avgDrop: -16,
    startPrice: "18,5 tỷ → 15,5 tỷ",
    status: "Đang đấu lại lần 3",
    note: "Vùng đang chuyển đổi quy hoạch, người mua chờ thông tin rõ hơn.",
  },
  {
    id: "hof-10",
    asset: "Xe đầu kéo Hyundai",
    type: "Ô tô",
    location: "Long An",
    rounds: 2,
    avgDrop: -14,
    startPrice: "1,3 tỷ → 1,12 tỷ",
    status: "Đã thành công lần 2",
    note: "Khấu hao thực tế cao hơn định giá ban đầu.",
  },
];

// C7 trend
export const failureTrendByQuarter = [
  { quarter: "Q4'24", rate: 28 },
  { quarter: "Q1'25", rate: 25 },
  { quarter: "Q2'25", rate: 22 },
  { quarter: "Q3'25", rate: 19 },
];
