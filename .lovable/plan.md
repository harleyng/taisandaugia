
## Mục tiêu

1. **Bỏ block "🔍 Đào sâu"** khỏi sidebar TOC (`ReportTOC`).
2. **Thêm 1 section mới ở dưới cùng** trang `/report` (sau "Xu hướng giá", trước form đăng ký): **"Danh mục phổ biến"**, gồm:
   - Chart chính: **"Danh mục có giá trị đấu giá lớn nhất"** — bar chart so sánh 4 nhóm tài sản (BĐS, Nợ xấu, Tài sản công, Ô tô) theo tổng giá trị đấu giá (tỷ VND) + % share.
   - 4 card đào sâu danh mục với link "Xem chi tiết" (mock).
3. **Giữ nguyên** chart bubble cloud "Phân bố theo tỉnh" ở Section A — Tổng quan.

## Thay đổi chi tiết

### 1. `src/lib/mockMarketReport.ts`
- Mở rộng `deepDiveLinks` thành object đầy đủ:
  - BĐS: 512 phiên, 18.420 tỷ, 62.4%, +6.3% delta
  - Nợ xấu (NPL): 154 phiên, 4.960 tỷ, 16.8%, +13.8%
  - Tài sản công: 198 phiên, 4.310 tỷ, 14.6%, +18.5%
  - Ô tô: 286 phiên, 1.840 tỷ, 6.2%, +34.2%
  - Mỗi item có: `slug`, `label`, `iconName` (Building2/Car/Landmark/Banknote), `desc`.
- Thêm `categoryByValue` array (đã sắp xếp desc theo tổng giá trị) phục vụ chart.
- Thêm `{ id: "categories", label: "Danh mục phổ biến" }` vào `tocSections`.

### 2. `src/components/report/ReportTOC.tsx`
- **Xóa** toàn bộ block "🔍 Đào sâu" (dòng 74-92).
- TOC mới sẽ tự có entry "Danh mục phổ biến" qua `tocSections`.

### 3. `src/components/report/SectionCategories.tsx` (MỚI)
- Wrap bằng `<ReportSection id="categories" label="E" title="Danh mục phổ biến">`.
- `keyInsight`: "Bất động sản dẫn dắt thị trường với 18.420 tỷ VND (62% tổng giá trị), nhưng Ô tô có mức chênh lệch lớn nhất (+34.2%)."
- Layout 2 phần trong cùng 1 `<Card>`:
  - **Phần trên — Bar chart "Danh mục có giá trị đấu giá lớn nhất"**:
    - Tiêu đề nhỏ + hint
    - 4 hàng horizontal bar (pure Tailwind, không cần recharts):
      - Cột trái: tên danh mục
      - Bar chính: width tỉ lệ với value/maxValue, màu primary với opacity giảm dần theo rank
      - Cột phải: `18.420 tỷ` + badge `62.4%`
  - **Divider**
  - **Phần dưới — 4 card đào sâu**:
    - Grid `sm:grid-cols-2 lg:grid-cols-4`
    - Mỗi card: icon (lucide map qua switch) + tên + 2 KPI inline (`sessionCount` phiên · `avgDelta`% delta) + `desc` + nút outline "Xem chi tiết →" (toast "Báo cáo chuyên sâu sắp ra mắt").
- Set `hideDeepDive` để không render nút "Đào sâu Danh mục phổ biến" mặc định.

### 4. `src/components/report/ReportSection.tsx`
- Thêm prop optional `hideDeepDive?: boolean`. Nếu `true` thì bỏ nút "Đào sâu …" cuối section.

### 5. `src/pages/MarketReport.tsx`
- Import `SectionCategories`. Render sau `<SectionPriceTrend />` và trước `<ReportSubscribeForm />` (vẫn nằm trong block đã login).

## Implementation Notes

- Format số: `value.toLocaleString("vi-VN") + " tỷ"`.
- Icon map: simple object `{ Building2, Car, Landmark, Banknote }` import sẵn, lookup theo `iconName`.
- Bar chart pattern: tái sử dụng style tương tự `SectionCompetition` (horizontal bars Tailwind).
- Toast khi click card: `useToast` đã có sẵn.
