## Mục tiêu

Triển khai trang báo cáo chuyên sâu cho section "Kết quả & Không thành" (C1–C7), tương tự kiến trúc trang BĐS đã có.

## Routing

- Route mới: `/report/deep/outcomes` → trang `MarketReportOutcomes.tsx`.
- Pattern `/report/deep/:topic` để mở rộng sau (Cạnh tranh, Xu hướng giá…).
- Trên `MarketReport` (trang tổng), nút "Đào sâu Kết quả & không thành" trong `SectionOutcomes` sẽ navigate sang route mới (thay vì popup "Sắp ra mắt"). Cách làm: thêm prop `deepDiveHref?: string` vào `ReportSection`; nếu có thì render `<Link>` thay vì mở dialog. Các section khác giữ nguyên hành vi popup.

## Cấu trúc trang `/report/deep/outcomes`

Layout đồng bộ với trang BĐS:
- `ReportTopNav`
- Nút "← Quay về Báo cáo tổng quan" (trên + cuối trang)
- Hero: tiêu đề "Báo cáo chuyên sâu: Kết quả & Nguyên nhân không thành", meta "1,247 phiên · 90 ngày qua · Cập nhật 30/09/2025", actions phụ "Tải PDF / Lưu" (toast "Sắp ra mắt").
- 5 Highlights (component mới, theo mẫu `BdsHighlights`).
- Grid `[240px_1fr]` với sticky TOC (C1–C7) + danh sách sections.
- CTA cuối: tải PDF / CSV (Pro), form đăng ký email, link "Đào sâu section khác" (Cạnh tranh, Xu hướng giá → mở popup "Sắp ra mắt" với pattern hiện tại).
- Auth gating: dùng `ReportLockedCTA` như trang BĐS.

## 7 sub-sections

| ID | Tiêu đề | Visual chính |
|---|---|---|
| C1 | Tỷ lệ thành công toàn thị trường | Donut 76/24 + ghi chú bối cảnh (so với 95–98% market thường) |
| C2 | Theo loại tài sản | Bar chart ngang tỷ lệ KHÔNG THÀNH (NPL 49 / TSC 35 / Khác 28 / BĐS 22 / Ô tô 18) |
| C3 | Theo khu vực | Top-5 cao nhất + Top-5 thấp nhất (table); placeholder "Bản đồ VN heatmap (sắp ra mắt)" |
| C4 | Theo khoảng giá trị | Bar chart ngang (<1tỷ 18 / 1–5 22 / 5–10 28 / >10 34) |
| C5 | Phiên đấu giá lại — pattern | Funnel 4-bước thuần Tailwind (100 → 70 → -8% → 50/20); button "Xem tài sản đang đấu lại" → toast |
| C6 | Hall of Fame — tài sản đấu nhiều lần | Bảng 10 dòng (tài sản, loại, số lần, mức giảm TB); click row mở `Sheet` drawer hiển thị chi tiết mock |
| C7 | Xu hướng theo thời gian | Line chart `recharts` 4 quý (Q4'24 → Q3'25, 28→22→20→19) |

Mỗi section dùng wrapper `ReportSection` (label C1–C7, có Insight box) và `hideDeepDive`.

## Files

**Mới:**
- `src/pages/MarketReportOutcomes.tsx` — page shell + auth gate.
- `src/components/report/outcomes/OutcomesHero.tsx`
- `src/components/report/outcomes/OutcomesHighlights.tsx`
- `src/components/report/outcomes/OutcomesTOC.tsx`
- `src/components/report/outcomes/OutcomesContent.tsx` — orchestrator giống `BdsReportContent`.
- `src/components/report/outcomes/OutcomesSectionMarketRate.tsx` (C1)
- `src/components/report/outcomes/OutcomesSectionByCategory.tsx` (C2)
- `src/components/report/outcomes/OutcomesSectionByRegion.tsx` (C3)
- `src/components/report/outcomes/OutcomesSectionByValue.tsx` (C4)
- `src/components/report/outcomes/OutcomesSectionReauction.tsx` (C5, funnel)
- `src/components/report/outcomes/OutcomesSectionHallOfFame.tsx` (C6, table + drawer)
- `src/components/report/outcomes/OutcomesSectionTrend.tsx` (C7, line chart)
- `src/components/report/outcomes/OutcomesFinalCTA.tsx`
- `src/lib/mockOutcomesReport.ts` — toàn bộ data cho C1–C7.

**Sửa:**
- `src/App.tsx` — thêm route `/report/deep/outcomes`.
- `src/components/report/ReportSection.tsx` — thêm prop `deepDiveHref?: string`; nếu có dùng `<Link>` từ `react-router-dom` thay nút mở dialog (giữ nguyên dialog cho các section khác).
- `src/components/report/SectionOutcomes.tsx` — pass `deepDiveHref="/report/deep/outcomes"`.

## Ghi chú kỹ thuật

- Charts: dùng `recharts` (đã có) cho donut C1 & line C7; C2/C4 dùng bar bằng div + Tailwind (đồng bộ style với `BdsSectionDistribution`).
- Drawer C6: dùng `Sheet` từ `@/components/ui/sheet` (đã có trong project shadcn).
- Toàn bộ màu lấy từ design tokens (`hsl(var(--primary))`, `--muted`, …); không hardcode hex.
- Không cần thay đổi DB/edge function — toàn bộ là mock client-side.
