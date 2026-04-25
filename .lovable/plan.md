
## Mục tiêu

Triển khai trang chi tiết **Báo cáo chuyên sâu: Bất động sản đấu giá** tại route `/report/bds`, kèm bộ lọc cho phép chuyển sang xem báo cáo loại tài sản khác. Các loại chưa có dữ liệu (Ô tô, Tài sản công, Nợ xấu) → tab disabled + badge "Sắp ra mắt".

## Routing & Entry

- **Route mới**: `/report/:slug` → `MarketReportCategory.tsx` (chỉ render nội dung khi `slug === "bds"`; các slug khác hiển thị state "Sắp ra mắt").
- **Entry point**: Cập nhật `SectionCategories.tsx` — nút "Xem chi tiết" của card BĐS → `navigate("/report/bds")`. Các card còn lại giữ behaviour toast "Sắp ra mắt".
- **Auth gate**: tái sử dụng pattern `ProtectedRoute` style (kiểm tra session, nếu chưa login → render lock CTA giống `/report`).

## Cấu trúc trang `/report/bds`

```text
[ReportTopNav]
[← Quay về Báo cáo tổng quan]
[CategoryFilterTabs]                          ← bộ lọc danh mục (4 tab)
[ReportHero] (tùy biến: title + meta số phiên + tổng giá trị)
┌─────────────┬──────────────────────────────┐
│ TOC         │ [5 điểm nổi bật]             │
│ - 5 điểm... │ B1. Giá/m² theo khu vực      │
│ - B1...     │ B2. Chênh lệch theo phân khúc│
│ - B2...     │ B3. Phân phối chênh lệch     │
│ - B3...     │ B4. Hall of Fame             │
│ - B4...     │ B5. Xu hướng giá/m² 12 tháng │
│ - B5...     │ B6. Tỷ lệ thành công         │
│ - B6...     │ [CTA cuối — tải/đăng ký]     │
└─────────────┴──────────────────────────────┘
```

## Components mới

### 1. `src/pages/MarketReportCategory.tsx`
- Đọc `slug` từ `useParams`. Nếu khác `"bds"` → render `<ComingSoonState />` (card lớn với badge "Sắp ra mắt" + nút quay lại).
- Auth gate: dùng cùng pattern `useEffect` + `supabase.auth.getSession()` + `onAuthStateChange` như `MarketReport.tsx`. Chưa login → render `<ReportLockedCTA />`.
- Layout: `[ReportTopNav]` → back link → `[CategoryFilterTabs slug="bds"]` → `<BdsReportContent />`.

### 2. `src/components/report/CategoryFilterTabs.tsx`
- Nhận `currentSlug`. Render 4 tab pill horizontal:
  - BĐS (`bds`) — enabled, active state.
  - Ô tô (`oto`) — disabled + badge `Sắp ra mắt`.
  - Tài sản công (`tai-san-cong`) — disabled + badge.
  - Nợ xấu/NPL (`npl`) — disabled + badge.
- Tab enabled: click → `navigate("/report/" + slug)`.
- Tab disabled: `cursor-not-allowed opacity-60`, không navigate, hover hiện tooltip giải thích.
- Mỗi tab có icon (lucide từ `iconMap` đã có).

### 3. `src/components/report/bds/BdsReportContent.tsx` (orchestrator)
Render lần lượt:
- `<BdsHero />` — title + 562 phiên, 8.420 tỷ VND (lưu ý: data mock chỉ cho BĐS chuyên sâu, độc lập với 18.420 tỷ ở overview).
- `<BdsHighlights />` — 5 điểm nổi bật (card với số ❶❷❸❹❺ giống `ReportHighlights`).
- `<BdsTOC />` — sticky sidebar (similar pattern, 6 anchors B1–B6).
- 6 sections nội dung (xem dưới).
- `<BdsFinalCTA />` — Tải PDF / CSV (Pro) / Lọc DB / Đăng ký email.

### 4. Sections (placed in `src/components/report/bds/`)
Mỗi section dùng wrapper `<ReportSection label="B1" hideDeepDive>` đã có.

- **`BdsSectionPriceMap.tsx` (B1)** — Heatmap pure-Tailwind: bảng `[Khu vực × 5 loại đất]`, mỗi ô background gradient theo giá (hsl primary với opacity = price/maxPrice). Insight bullet ở dưới. Nút "Xem đầy đủ 63 tỉnh →" (toast).
- **`BdsSectionDelta.tsx` (B2)** — 2 sub-card horizontal bar charts (theo diện tích, theo loại đất/nhà). Style copy `SectionCompetition` pattern.
- **`BdsSectionDistribution.tsx` (B3)** — Histogram bằng pure-Tailwind divs: 10 cột phân phối delta từ -10% → 80%+. 3 bullet KPI (median, ≥50%, ≤0%).
- **`BdsSectionHallOfFame.tsx` (B4)** — 2 bảng (`Table` shadcn): top 5 chênh cao, top 5 deal hiếm. Cột: ngày, vị trí, loại, DT, khởi điểm, trúng, chênh.
- **`BdsSectionPriceTrend.tsx` (B5)** — recharts `LineChart` 12 tháng × 5 tỉnh.
- **`BdsSectionOutcomes.tsx` (B6)** — `BarChart` recharts (thành công/không thành/đấu giá lại) + funnel mini bằng divs.

### 5. `src/lib/mockBdsReport.ts` (mock data mới)
Tất cả arrays/constants riêng cho trang BĐS:
- `bdsMeta` (title, sessionCount: 562, totalValue: 8420)
- `bdsHighlights` (5 items)
- `bdsPriceHeatmap` — array `{region, prices: { datO, datNN, datTM, chungCu, nhaPho }}` (~7 hàng).
- `bdsDeltaByArea`, `bdsDeltaByType` (mỗi item: label, delta, n).
- `bdsDistribution` — 10 buckets `{bucket, count}`.
- `bdsTopBidWars`, `bdsTopDeals` (5 rows mỗi cái).
- `bdsPriceTrend12m` — 12 tháng × 5 tỉnh.
- `bdsOutcomes` (success/fail/reauctioned %).
- `bdsTocSections` (B1–B6).

## Implementation Notes

- **Disabled state for tabs**: dùng `<button disabled>` + class `disabled:opacity-60 disabled:cursor-not-allowed`, render `<Badge variant="secondary">Sắp ra mắt</Badge>` bên trong.
- **Reuse**: `ReportTopNav`, `ReportSection` (với `hideDeepDive`), `ReportLockedCTA`, `ReportSubscribeForm` (có thể dùng lại trong final CTA hoặc viết inline).
- **Chart library**: tiếp tục dùng `recharts` cho line chart B5 và bar B6; còn lại pure Tailwind để nhẹ.
- **Back link**: `<Link to="/report">` với icon `ArrowLeft`, đặt 2 chỗ (đầu trang + cuối trang).
- **Auth/scroll-spy**: copy logic từ `ReportTOC` — `IntersectionObserver` cho B1–B6.
- **SEO**: set `document.title` = "Báo cáo chuyên sâu: BĐS đấu giá".

## File changes summary

- **Mới**: 
  - `src/pages/MarketReportCategory.tsx`
  - `src/lib/mockBdsReport.ts`
  - `src/components/report/CategoryFilterTabs.tsx`
  - `src/components/report/bds/BdsReportContent.tsx`
  - `src/components/report/bds/BdsHero.tsx`
  - `src/components/report/bds/BdsHighlights.tsx`
  - `src/components/report/bds/BdsTOC.tsx`
  - `src/components/report/bds/BdsSectionPriceMap.tsx`
  - `src/components/report/bds/BdsSectionDelta.tsx`
  - `src/components/report/bds/BdsSectionDistribution.tsx`
  - `src/components/report/bds/BdsSectionHallOfFame.tsx`
  - `src/components/report/bds/BdsSectionPriceTrend.tsx`
  - `src/components/report/bds/BdsSectionOutcomes.tsx`
  - `src/components/report/bds/BdsFinalCTA.tsx`
- **Sửa**:
  - `src/App.tsx` — thêm route `/report/:slug`.
  - `src/components/report/SectionCategories.tsx` — nút "Xem chi tiết" của BĐS dùng `navigate`, các card khác giữ toast.
