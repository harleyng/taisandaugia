
## Thay đổi KPI cards trong block "Lịch sử đấu giá"

Dựa trên ảnh mẫu, tôi sẽ thay 3 card hiện tại (Khoảng giá hợp lý / Giá trúng dự kiến / Giá khởi điểm) bằng 3 block KPI mới theo style minimal — không viền, không nền, chỉ có icon nhỏ + số lớn + mô tả ngắn bên dưới.

### 3 KPI mới (phù hợp ngữ cảnh đấu giá)

**KPI 1 — Giá trúng phổ biến (tháng gần nhất)**
- Số lớn: `{popular_recent} tr/m²` (lấy từ `last.popular`)
- Mô tả: `Giá trúng phổ biến nhất T{tháng}/{năm}`
- Không icon (giống ảnh)

**KPI 2 — Biến động giá theo khoảng thời gian đang chọn**
- Tính: `((last.popular - first.popular) / first.popular) * 100`
- Số lớn: `{±X,X%}` 
- Icon tròn:
  - Tăng → mũi tên lên, nền xanh lá `bg-emerald-500`
  - Giảm → mũi tên xuống, nền đỏ `bg-rose-500`
- Mô tả: `Giá trúng đã {tăng/giảm} trong {1 năm/2 năm/5 năm} qua T{m1}/{y1} - T{m2}/{y2}`

**KPI 3 — So sánh với đỉnh lịch sử**
- Tính: `((peak.popular - last.popular) / peak.popular) * 100`
- Số lớn: `{X,X%}` (luôn dương, vì so với đỉnh)
- Icon tròn mũi tên xuống nền đỏ `bg-rose-500` (nếu hiện tại < đỉnh) hoặc mũi tên lên xanh (nếu == đỉnh thì hiển thị "Đang ở đỉnh")
- Mô tả: `Giá trúng hiện tại thấp hơn đỉnh {peak.popular} tr/m² vào T{tháng}/{năm}`

### Layout
```text
┌─────────────────────┬─────────────────────┬─────────────────────┐
│ 71,4 tr/m²          │ 🟢↑ 96,2%           │ 🔴↓ 4,5%            │
│ Giá trúng phổ biến  │ Giá trúng đã tăng   │ Giá trúng hiện tại  │
│ nhất T3/26          │ trong 2 năm qua     │ thấp hơn đỉnh 74,8  │
│                     │ T3/24 - T3/26       │ tr/m² vào T10/25    │
└─────────────────────┴─────────────────────┴─────────────────────┘
```
- Grid 3 cột (mobile: 1 cột)
- Cách nhau bằng border dọc nhẹ giữa các cột (như ảnh) — dùng `divide-x divide-border`
- Bao bọc bằng 1 card border bo tròn, padding rộng
- Số lớn: `text-2xl font-bold`, đơn vị `tr/m²` nhỏ hơn, muted
- Icon tròn: `w-6 h-6 rounded-full flex items-center justify-center`, icon trắng bên trong

### Thay đổi khác
- **Bỏ hoàn toàn** insight sentence (Lightbulb card) — vì 3 KPI mới đã tự kể câu chuyện
- **Bỏ hoàn toàn** disclaimer cuối ("Dữ liệu giá được tổng hợp...")
- **Giữ nguyên**: title, time range toggle (1Y/2Y/5Y), biểu đồ đường, dot đỏ giá tin đang xem

### File cần sửa
- `src/components/auction/AuctionPriceHistory.tsx` — thay phần grid 3 cards + xoá insight box + xoá disclaimer block
