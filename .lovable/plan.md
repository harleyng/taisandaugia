

## Cập nhật Block "Lịch sử giá" — Phân tích thị trường đấu giá

Tái thiết kế hoàn toàn `AuctionPriceHistory.tsx` thành một block "Price History & Market Context" theo đúng spec AC1–AC9: gom dữ liệu phiên tương đồng theo loại + khu vực, hỗ trợ 3 timeframe có fallback, hiển thị 3 đường giá P25/median/P75 (fallback min/max), tự sinh insight 2 mode (có/không có predicted price), xử lý outlier IQR, và paywall preview thay vì blur toàn bộ.

### Phạm vi

- **Mới:** `src/components/auction/AuctionPriceHistory.tsx` (rewrite)
- **Mới:** `src/lib/auctionPriceAnalytics.ts` — module pure-function: gom bucket theo tháng, percentile (P25/P50/P75), IQR outlier filter, trend, volatility, position, momentum, generate insight.
- **Mới:** `src/lib/mockAuctionSessions.ts` — hàm `generateMockSessions(seed, propertyType, area12mMonths)` trả về list phiên `{date, price_per_sqm, total_price, area, district, property_type}` deterministic. Sinh ~5–40 phiên trong 12 tháng tùy seed để có thể test mọi edge case (đủ/thiếu/noisy).
- **Cập nhật:** `src/pages/AuctionDetail.tsx` — bỏ wrap `LockedBlur` ngoài (vì block tự xử lý paywall preview theo AC8); truyền thêm `predictedPrice` (lấy từ `custom_attributes.predicted_price_min/max` nếu unlocked) và `isUnlocked`, `isLoggedIn`, callbacks `onLogin`, `onUnlock`.

### Hành vi & UI mới

**Header**
- Tiêu đề: `Lịch sử đấu giá {Loại} tại {Quận/Huyện}`
- Sub-line bắt buộc: `Dữ liệu từ {N} phiên đấu giá trong {Y} tháng` (theo timeframe đang chọn, AC2)
- Toggle 3M / 6M / 12M (default 6M). Mốc nào < 5 phiên thì disable hoặc ẩn; nếu 12M < 5 → ẩn toàn block (AC1, AC2).

**Chart (AC3)**
- Recharts LineChart 3 đường: `low` (P25 hoặc min), `median`, `high` (P75 hoặc max). Quyết định P25/P75 vs min/max **theo từng bucket tháng** dựa trên `count >= 8`.
- Trục X = tháng; Trục Y = `tr/m²` cho BĐS hoặc tổng giá cho loại khác.
- Tooltip: hiển thị min, median, max, P25/P75 (nếu có), số phiên trong tháng.
- Marker:
  - Có predicted price → chỉ chấm tròn predicted (khoảng [min,max] vẽ band mờ).
  - Không có predicted price → chấm tròn starting price (giá khởi điểm hiện tại).

**KPI strip (AC4)** — 3 ô:
- `Median 12M` (kèm min/max khoảng)
- `Trend` (3M & 6M, mũi tên + %)
- `Volatility` (label Thấp/Trung bình/Cao, dùng coefficient of variation 6–12M)

**Insight box (AC5, AC6)** — render conditional:
- **Mode A (no predicted price)**: tiêu đề "Xu hướng giá đấu giá", 2 bullet (trend, volatility), không implication.
- **Mode B (có predicted price)**: tiêu đề "Insight thị trường", 3 bullet (position low/medium/high trong dải 12M, trend, volatility hoặc opportunity), bullet cuối có `→ implication`.
- Volatility ≥ 0.5 → cảnh báo "Thị trường biến động mạnh", không gợi ý "cơ hội" (AC7).

**Edge cases (AC7)**
- < 5 phiên (sau IQR) → ẩn chart, hiển thị state: "Không đủ dữ liệu để phân tích xu hướng".
- < 8 phiên tổng → chỉ hiển thị trend + volatility, không position/opportunity.
- IQR outlier filter: loại điểm ngoài `[Q1 − 1.5·IQR, Q3 + 1.5·IQR]`. Nếu sau loại < 5 → revert về raw + badge "Dữ liệu noisy".

**Paywall (AC8)** — thay thế cơ chế `LockedBlur` ở AuctionDetail:
- Block luôn render. Chart blur nhẹ (`blur-[3px] opacity-80`) để vẫn thấy xu hướng.
- Insight preview luôn hiển thị 1 dòng từ trend (vd "Giá khu vực đang giảm nhẹ trong 3 tháng gần nhất").
- Tease dòng 2 (text mờ): `→ Xem vị trí giá hiện tại & cơ hội tham gia`.
- CTA contextual:
  - Chưa login → `Đăng nhập để xem phân tích giá` (gọi `openAuthDialog`)
  - Đã login, chưa unlock → `Mở khoá để xem vị trí giá & cơ hội` (gọi `openAssetPaywall`)
- KPI strip vẫn show trend + volatility (không nhạy cảm), ẩn position/recommendation.

### Logic chi tiết

```text
sessions = mockSessions(seed, propertyType, district)         // 12M ngầm
clean    = removeIQROutliers(sessions) || sessions+noisyFlag
buckets  = groupByMonth(clean)                                // 12 buckets max
forEach bucket:
  if count >= 8 -> { low: P25, mid: P50, high: P75 }
  else          -> { low: min, mid: median, high: max }

countsByRange = { 3M, 6M, 12M }
availableRanges = ranges.filter(r => countsByRange[r] >= 5)
default = availableRanges.includes(6M) ? 6M : availableRanges[0]

trend_3m, trend_6m  = (last_median - first_median) / first_median
volatility          = stdev(medians_6_12m) / mean(...)
position            = (predicted_mid - min_12m) / (max_12m - min_12m)   // 0..1
```

### File diagram

```text
src/
├─ components/auction/AuctionPriceHistory.tsx   (rewrite)
├─ lib/
│  ├─ auctionPriceAnalytics.ts                  (new — pure funcs)
│  └─ mockAuctionSessions.ts                    (new — deterministic mock)
└─ pages/AuctionDetail.tsx                      (update wiring)
```

### Out of scope

- Không kết nối DB thật cho phiên đấu giá (chưa có bảng `auction_sessions`); dùng mock deterministic theo seed listing để demo đầy đủ các nhánh.
- Không sửa `AuctionPricePrediction`; chỉ đọc `custom_attributes.predicted_price_min/max` để quyết định Mode A vs B.
- Không thay đổi logic credit/paywall của asset (chỉ thay UI lock của block này).

