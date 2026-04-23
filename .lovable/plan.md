

## Sửa block "Lịch sử giá": ẩn KPI, hiển thị Insight đúng spec

### Vấn đề hiện tại
Trong `AuctionPriceHistory.tsx` đang hiển thị **KPI strip** (Median 12M / Trend / Volatility) — nhưng theo BLOCK 2 spec **không có KPI**. Spec chỉ yêu cầu:
- Chart (line)
- Insight box (Mode A: 2 bullet trend + volatility / Mode B: 3 bullet position + trend + opportunity)
- Context line (số phiên + bucket diện tích)

KPI strip là phần được thêm dư, không nằm trong AC nào của BLOCK 2.

### Thay đổi

**File: `src/components/auction/AuctionPriceHistory.tsx`**

1. **Xoá toàn bộ KPI strip** (Median 12M card + Trend card + Volatility card + logic blur/lock của KPI).
2. **Giữ nguyên**:
   - Header + context line (`Dữ liệu từ N phiên ~X–Y m² trong khu vực`)
   - Chart (3 đường: low/median/high) + tooltip giá/m² + tổng giá
   - Marker starting price / predicted price (AC4)
   - **Insight box** — đây mới là phần chính cần show:
     - Mode A (chưa có predicted): title "Xu hướng giá đấu giá" + 2 bullet (trend, volatility), có context bucket
     - Mode B (có predicted): title "Insight thị trường" + 3 bullet (position, trend, opportunity với `→`)
   - Cảnh báo volatility ≥ 0.5
   - Edge case `< 8 phiên` → ẩn position (đã có trong logic)
3. **Paywall (AC9)**: 
   - Khi locked: chart blur nhẹ (vẫn thấy trend) + **1 insight preview duy nhất** (`Giá khu vực đang giảm trong 3 tháng gần nhất`) + 1 dòng tease (`→ Xem vị trí giá & cơ hội tham gia`) + CTA.
   - Không còn KPI để blur/preview.

### Layout sau sửa

```text
┌─ Lịch sử giá ─────────────────────────┐
│ Dữ liệu từ N phiên ~60–80 m² ...      │
│                                        │
│ [Timeframe: 3M | 6M | 12M]            │
│                                        │
│ ┌────────── Line chart ──────────┐    │
│ │  high / median / low           │    │
│ │  + marker predicted/starting   │    │
│ └────────────────────────────────┘    │
│                                        │
│ 💡 Insight thị trường (Mode B)        │
│  • Giá dự đoán ở vùng thấp (60-80m²)  │
│  • Xu hướng ngắn hạn ổn định          │
│  → Có thể là cơ hội tham gia          │
└────────────────────────────────────────┘
```

### Out of scope
- Không đụng analytics logic (`auctionPriceAnalytics.ts`) — chỉ sửa UI component.
- Không đổi tài liệu spec (đã đúng — spec không có KPI, chỉ code thừa).
- Không đụng các block khác (prediction, similar assets...).

