
## Mục tiêu

Thêm một block mới trên homepage (`/`) ngay **phía trên** section "Phiên sắp diễn ra" (`<AuctionSection />`), giới thiệu Báo cáo thị trường đấu giá với:
- Tiêu đề + meta (ngày cập nhật, số phiên trong 90 ngày)
- 3 card tổng quan = 3 điểm nổi bật của báo cáo tháng
- CTA "Xem báo cáo đầy đủ" dẫn vào `/report`

## Vị trí chèn

`src/pages/Index.tsx` — chèn `<MarketReportTeaser />` mới giữa khối Hero và `<AuctionSection />` (sau `</section>` của Hero, trước `<AuctionSection />` ở dòng 61).

## Nguồn dữ liệu

Tái sử dụng `src/lib/mockMarketReport.ts` đã có sẵn:
- `reportMeta` → tiêu đề, `updatedAt`, `sessionCount`, `periodDays`
- `highlights` → 3 card (id 1, 2, 3 — đúng 3 điểm nổi bật)

Không tạo thêm mock data, không thay đổi trang `/report`.

## Component mới

Tạo `src/components/MarketReportTeaser.tsx`:

**Layout (desktop ≥ md):**

```text
┌──────────────────────────────────────────────────────────────┐
│  [Badge] BÁO CÁO ĐỊNH KỲ                                     │
│  Báo cáo thị trường đấu giá tài sản Việt Nam                 │
│  📅 Cập nhật 30/09/2025 · ⚖️ 1.247 phiên trong 90 ngày        │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ ❶ Card 1 │  │ ❷ Card 2 │  │ ❸ Card 3 │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
│                                                              │
│                          [ Xem báo cáo đầy đủ → ]            │
└──────────────────────────────────────────────────────────────┘
```

**Mobile:** 3 card stack 1 cột, CTA full-width.

**Style:**
- Dùng `<section className="container px-4 py-8 md:py-12">` theo pattern của các section khác trên homepage
- Wrapper card: `rounded-2xl` với gradient nhẹ `from-primary/5 to-background` + `border-l-4 border-l-accent` (giống tinh thần `ReportHighlights` hiện có để giữ consistency)
- Mỗi card: `rounded-lg bg-muted/50 border border-border/60 hover:border-accent/40 p-4`, có số ❶❷❸ to màu accent (giống hệt `ReportHighlights.tsx`) + text highlight
- Icon: `Sparkles` (header) và `ArrowRight` (CTA), từ `lucide-react`
- CTA: `<Button asChild>` bọc `<Link to="/report">` — primary variant

## Implementation Notes

- File mới duy nhất: `src/components/MarketReportTeaser.tsx`
- Edit duy nhất: `src/pages/Index.tsx` — import + chèn 1 dòng JSX phía trên `<AuctionSection />`
- Không thêm route, không thêm entry point ở Header (theo yêu cầu trước đó về trang report)
- Reuse `highlights`, `reportMeta` từ `@/lib/mockMarketReport`
- Format số: `sessionCount.toLocaleString("vi-VN")`
