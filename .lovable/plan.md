## Redesign block "Dự đoán giá trúng" — No-Demand Version

Cập nhật `AuctionPricePrediction.tsx` theo spec mới: **bỏ hoàn toàn demand/competition/bidder signals**, chỉ phản ánh pattern lịch sử + xu hướng. Layout bám sát ảnh user upload.

### Logic thay đổi

**Bỏ:**
- `Mức cạnh tranh` (dựa trên views) — vi phạm rule no-demand.
- `Tỷ lệ thành công` — misleading.
- `Khuyến nghị` dạng "Nên tham gia / Cân nhắc" — quá mạnh.

**Thêm/Đổi:**
- **Khoảng giá trúng ước tính** (giữ) + range slider visual (2 chấm nối line) + label 2 đầu.
- **So với giá khởi điểm**: hiển thị lớn `+X% đến +Y%` + dòng phụ "(khoảng tăng dự kiến)".
- **Xu hướng giá** (badge xanh): "Tăng/Giảm/Ổn định trong 3 tháng qua" — lấy từ `trend3M` của `auctionPriceAnalytics` đã có. Đặt cạnh khối delta.
- **Độ tin cậy dữ liệu**: % + label (Cao/Trung bình/Thấp), max 80% theo spec. Bỏ Progress bar, dùng số to + chip label như ảnh.
- **Thông tin hỗ trợ**: `N phiên / 90 ngày` (đổi label, đã có sẵn similarSessions).
- **Khoảng thời gian**: `90 ngày gần nhất` + dải ngày `Từ dd/mm/yyyy đến dd/mm/yyyy`.
- **Khuyến nghị (trung tính)**: text wrap trong card vàng nhạt — "Giá ước tính dựa trên dữ liệu đấu giá gần đây với các tài sản tương tự. **Giá thực tế có thể thay đổi tùy theo diễn biến phiên đấu giá** và các yếu tố thị trường khác tại thời điểm đấu giá."
- **Dựa trên dữ liệu** (Explainability — block mới ở dưới cùng): card xanh nhạt, 4 checklist:
  - Các tài sản tương tự về loại và đặc điểm
  - Cùng khu vực (Quận X)
  - Diện tích tương đương (~bucket m²)
  - Dữ liệu đấu giá thành công

### Layout (theo ảnh)

```text
┌─ Header: icon + "Dự đoán giá trúng" [Beta] ────────── (i) ─┐
│         Ước tính dựa trên dữ liệu đấu giá tương tự           │
├──────────────────────────────────────────────────────────────┤
│ ┌──── Giá trúng ước tính (i) ────┬─ So với giá khởi điểm (i)─┐│
│ │  2.85 – 3.20 tỷ                 │  +14% đến +28%            ││
│ │  ●━━━━━━━━━━━━━━●               │  (khoảng tăng dự kiến)    ││
│ │  2.85 tỷ      3.20 tỷ           │  ┃📈 Xu hướng: Tăng 3M┃   ││
│ └─────────────────────────────────┴───────────────────────────┘│
├──────────────────────────────────────────────────────────────┤
│ ┌─ Độ tin cậy dữ liệu ─┬─ Thông tin hỗ trợ ─┬─ Khoảng t.gian┐│
│ │ 🛡 72%               │ 💾 12 phiên         │ 📅 90 ngày    ││
│ │   [Trung bình]       │  trong 90 ngày      │   gần nhất    ││
│ │ Độ tin cậy dựa trên… │ Dữ liệu từ tài sản…│ Từ dd – dd    ││
│ └──────────────────────┴─────────────────────┴───────────────┘│
├──────────────────────────────────────────────────────────────┤
│ 💡 Khuyến nghị (i)                                           │
│    Giá ước tính dựa trên dữ liệu đấu giá gần đây…           │
├──────────────────────────────────────────────────────────────┤
│ 📋 Dựa trên dữ liệu (i)                                      │
│  ✓ Các tài sản tương tự  ✓ Cùng khu vực                     │
│  ✓ Diện tích tương đương ✓ Dữ liệu đấu giá thành công       │
└──────────────────────────────────────────────────────────────┘
```

### Files

- **`src/components/auction/AuctionPricePrediction.tsx`** — rewrite UI + logic theo spec mới.
  - Gỡ `competitionLabel`, `recommendationLabel`, `views_count` usage.
  - Cap `confidence` max = 80.
  - Thêm helpers: `trendBadge(trend3M)` → {label, tone}, `dateRangeLabel(days=90)`.
  - Lấy `district` từ `listing.location_district`/`listing.district`, area bucket từ `pickBucket(listing.area)` (đã có trong `auctionPriceAnalytics.ts`).
  - Range slider: dùng 2 chấm + đường nối bằng div + tailwind (không cần thêm component).
  - Paywall (locked) state: blur các số y như hiện tại; CTA giữ nguyên "Mở khóa dự đoán – 59 credit".

### Wording (neutral, theo spec mục 7)

- Trend tăng → badge: "📈 Xu hướng giá: Tăng trong 3 tháng qua" (xanh emerald)
- Trend giảm → "📉 Xu hướng giá: Giảm trong 3 tháng qua" (đỏ rose)
- Trend ổn định → "→ Xu hướng giá: Ổn định" (xám)
- Khuyến nghị: text trung tính cố định, bold phần "Giá thực tế có thể thay đổi…".

### Out of scope

- Không đổi analytics logic (`auctionPriceAnalytics.ts`).
- Không đổi paywall flow / credit price.
- Không update tài liệu PDF/DOCX.
- Không đụng các block khác trong trang chi tiết.
