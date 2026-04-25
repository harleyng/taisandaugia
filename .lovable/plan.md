# Trang Báo cáo thị trường đấu giá

Dựng trang báo cáo tổng quan tại route `/report` (chưa gắn entry point từ Header/Home). Trang dùng mock data, layout 2 cột với sidebar TOC sticky bên trái và nội dung scroll bên phải.

## Route & cấu trúc file

- Thêm route `/report` vào `src/App.tsx`
- Tạo trang `src/pages/MarketReport.tsx` (orchestrator)
- Tạo thư mục `src/components/report/` chứa các block:
  - `ReportTopNav.tsx` — top nav riêng (Cơ sở dữ liệu | Báo cáo | Đăng ký nhận báo cáo) + user menu tái sử dụng từ Header pattern
  - `ReportTOC.tsx` — sidebar trái sticky, scroll-spy active section
  - `ReportHero.tsx` — title + meta (ngày cập nhật, số phiên, nút Tải PDF tổng)
  - `ReportHighlights.tsx` — card "3 điểm nổi bật"
  - `SectionOverview.tsx` (A) — Tổng quan thị trường + bản đồ VN mock
  - `SectionCompetition.tsx` (B) — Cạnh tranh & chênh lệch giá (bar chart ngang)
  - `SectionOutcomes.tsx` (C) — Kết quả & không thành (donut chart)
  - `SectionPriceTrend.tsx` (D) — Xu hướng giá (line chart)
  - `ReportSubscribeForm.tsx` — form đăng ký nhận báo cáo
- Mock data tách riêng: `src/lib/mockMarketReport.ts`

## Layout

```text
┌──────────────────────────────────────────────────┐
│ Top nav (Cơ sở dữ liệu | Báo cáo | Đăng ký...)  │
├──────────────────────────────────────────────────┤
│ Hero: Title + meta + Tải PDF                     │
├──────────┬───────────────────────────────────────┤
│ TOC      │ Highlights card                       │
│ sticky   │ ─────────────                         │
│ (lg+)    │ Section A — Tổng quan                 │
│          │ Section B — Cạnh tranh                │
│  Đào sâu │ Section C — Kết quả                   │
│  • BĐS   │ Section D — Xu hướng giá              │
│  • Ô tô  │ ─────────────                         │
│  • ...   │ Đăng ký nhận báo cáo                  │
└──────────┴───────────────────────────────────────┘
```

- Desktop (lg+): grid 2 cột `[260px_1fr]`, TOC `sticky top-20`
- Mobile/tablet: TOC ẩn, thay bằng dropdown "Mục lục" sticky ở đầu content

## Sidebar TOC (`ReportTOC`)

Hai nhóm:
1. **Mục lục** (4 section): Tổng quan · Cạnh tranh & chênh lệch · Kết quả & không thành · Xu hướng giá
2. **Đào sâu** (4 deep-dive): BĐS · Ô tô · Tài sản công · Nợ xấu (NPL) — placeholder link `#`
3. **Footer links**: Phương pháp · Đăng ký báo cáo · Tải PDF tổng

Active section highlight bằng `IntersectionObserver` (scroll-spy). Smooth scroll khi click anchor.

## Các section

### Hero
- H1: "Báo cáo thị trường đấu giá tài sản Việt Nam"
- Meta row: `Cập nhật: 30/09/2025 · 1,247 phiên trong 90 ngày qua`
- Button: `Tải PDF tổng` (Download icon, mock click toast)

### Highlights card
Card nổi bật với 3 mục đánh số (❶❷❸), accent color. Layout grid 3 cột (desktop), stack mobile.

### Section template
Mỗi section có cấu trúc:
- Section header với border-top + label (A/B/C/D)
- Heading + subtitle
- Callout "💡 Ý CHÍNH" (background `bg-primary/5` border-l-4 primary)
- Visual (chart/map)
- CTA "Đào sâu [tên section] →" (link button outline)

### Section A — Tổng quan thị trường
- Visual: SVG bản đồ VN đơn giản (placeholder shape) hoặc list-based heatmap. Dùng list các tỉnh với dot size theo mật độ phiên.
- Top 5 tỉnh hiển thị dạng chip: Hà Nội 89 · TP.HCM 76 · BD 54 · Đồng Nai 42 · Đà Nẵng 38
- Note: "→ Click tỉnh để filter cơ sở dữ liệu" (mock, không nav)

### Section B — Cạnh tranh & chênh lệch giá
- Bar chart ngang, 5 loại tài sản x % chênh lệch
- Dùng `recharts` `BarChart` (đã có `src/components/ui/chart.tsx`) hoặc div-based bars (đơn giản hơn, đủ dùng)
- Recommend div-based: mỗi row `flex` với label + bar `width: %` + value

### Section C — Kết quả & không thành
- Donut chart 76% / 24% — dùng `recharts` `PieChart` với `innerRadius`
- Legend: Thành công · Không thành · Tỷ lệ tổ chức lại 60 ngày: 70%

### Section D — Xu hướng giá
- Line chart `recharts` `LineChart`, X = quý (8 quý gần nhất), Y = giá/m², 2-3 series (BĐS, Long An, HCMC vùng quanh)

### Đăng ký nhận báo cáo
- Card với input email + button "Đăng ký"
- Submit: toast "Đã đăng ký" (mock, không lưu DB)

## Mock data (`mockMarketReport.ts`)

```ts
export const reportMeta = { updatedAt: "30/09/2025", sessionCount: 1247, periodDays: 90 };
export const highlights = [{ id: 1, text: "Ô tô đấu giá trúng cao hơn 34% so với khởi điểm — cao gấp 5× BĐS" }, ...];
export const topProvinces = [{ name: "Hà Nội", count: 89 }, ...];
export const competitionData = [{ category: "Ô tô", delta: 34.2 }, { category: "Tài sản công", delta: 18.5 }, ...];
export const outcomeData = [{ name: "Thành công", value: 76 }, { name: "Không thành", value: 24 }];
export const priceTrendData = [{ quarter: "Q1/24", "BĐS chung": 32, "Long An": 18, "Quanh HCMC": 28 }, ...];
export const deepDiveLinks = [{ slug: "bds", label: "BĐS" }, { slug: "oto", label: "Ô tô" }, ...];
```

## Dependencies & charts

- `recharts` đã có sẵn (qua `src/components/ui/chart.tsx`)
- Icons: `lucide-react` (Download, MapPin, TrendingUp, BarChart3, PieChart, Mail, ArrowRight)
- Không cần thêm package

## Responsive

- `lg` (≥1024px): grid 2 cột TOC + content
- `md`–`lg`: ẩn TOC sidebar, hiện sticky select "Mục lục" ở đầu content
- `sm`: stack hoàn toàn, charts full-width

## Out of scope (xác nhận)

- Không thêm entry point từ Header/Home (theo yêu cầu "chưa cần entry point")
- Không tạo các trang deep-dive con (BĐS/Ô tô/...) — chỉ link `#` placeholder
- Không lưu email subscribe vào DB — chỉ toast feedback
- Không tạo PDF thật — nút "Tải PDF tổng" toast feedback

## File changes

- New: `src/pages/MarketReport.tsx`
- New: `src/components/report/ReportTopNav.tsx`
- New: `src/components/report/ReportTOC.tsx`
- New: `src/components/report/ReportHero.tsx`
- New: `src/components/report/ReportHighlights.tsx`
- New: `src/components/report/SectionOverview.tsx`
- New: `src/components/report/SectionCompetition.tsx`
- New: `src/components/report/SectionOutcomes.tsx`
- New: `src/components/report/SectionPriceTrend.tsx`
- New: `src/components/report/ReportSubscribeForm.tsx`
- New: `src/lib/mockMarketReport.ts`
- Edit: `src/App.tsx` — thêm route `/report`
