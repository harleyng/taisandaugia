

## Plan: Đổi UX bộ lọc — Quick filters trên top + Dialog lọc nâng cao

### Tổng quan
Thay layout sidebar filter bên trái bằng:
1. **Quick filter bar** nằm ngang phía trên danh sách (dạng chips/dropdowns): Loại tài sản, Địa điểm, Khoảng giá, Trạng thái
2. **Nút "Lọc"** mở **Dialog lọc nâng cao** chứa tất cả bộ lọc chi tiết (bao gồm cả các filter mới đã plan trước: thời gian công bố, tiền đặt trước, danh mục pháp lý, địa điểm 2 cấp, toggle sáp nhập)
3. **Bỏ sidebar trái** — content chiếm full width
4. Trên mobile: quick filter bar scroll ngang, nút "Lọc" luôn hiển thị

### Layout mới

```text
┌─────────────────────────────────────────────────┐
│ Header                                          │
├─────────────────────────────────────────────────┤
│ Tiêu đề + số kết quả                           │
│                                                 │
│ [🔍 Tìm kiếm...] [Lọc ①] [Loại ▾] [Địa điểm ▾] [Giá ▾] [Trạng thái ▾] │ Sắp xếp ▾ │
│                                                 │
│ ┌────┐ ┌────┐ ┌────┐                           │
│ │Card│ │Card│ │Card│  (full width grid)         │
│ └────┘ └────┘ └────┘                           │
└─────────────────────────────────────────────────┘
```

### Files cần sửa/tạo

**1. Tạo `src/components/AuctionQuickFilters.tsx`** — Quick filter bar
- Thanh ngang gồm:
  - Input tìm kiếm (compact)
  - Nút **"Lọc"** với badge đếm số filter active → mở Dialog
  - Dropdowns nhanh: Loại tài sản, Địa điểm (Tỉnh/TP), Khoảng giá, Trạng thái — mỗi cái dùng Popover + nội dung tương ứng
- Khi chọn filter nhanh, cập nhật state ngay lập tức

**2. Tạo `src/components/AuctionFilterDialog.tsx`** — Dialog lọc nâng cao
- Dialog full (Sheet trên mobile) chứa tất cả bộ lọc:
  - Loại tài sản (tree với children)
  - Trạng thái phiên
  - Địa điểm đấu giá 2 cấp (Tỉnh → Quận) + toggle "Địa chỉ sau sáp nhập"
  - Giá khởi điểm (Min–Max inputs)
  - Tiền đặt trước (Min–Max inputs)
  - Thời gian công bố (Date range)
  - Danh mục pháp lý (Thi hành án, Nợ xấu, Thanh lý, Phá sản, Khác)
- Footer: nút "Áp dụng" + "Xóa bộ lọc"

**3. Cập nhật `AuctionFilters` interface** (`AuctionFilterSidebar.tsx` hoặc tách ra file riêng)
- Mở rộng interface thêm: `district`, `priceMin`, `priceMax`, `depositMin`, `depositMax`, `publishDateFrom`, `publishDateTo`, `legalCategory`, `useMergedAddress`

**4. Sửa `src/pages/Listings.tsx`**
- Bỏ 2-column layout (bỏ sidebar trái)
- Thay `AuctionFilterSidebar` bằng `AuctionQuickFilters` nằm trên grid
- Content grid chiếm full width
- Cập nhật filter logic cho các field mới

**5. Giữ hoặc xóa `AuctionFilterSidebar.tsx`**
- Xóa file cũ (hoặc giữ lại nhưng không import nữa)

### Chi tiết kỹ thuật
- Quick filter dropdowns: dùng shadcn `Popover` — click chip mở popover nhỏ chứa options
- Filter dialog: dùng shadcn `Dialog` (desktop) / `Sheet` (mobile)
- Badge count: đếm số filter đang active, hiển thị trên nút "Lọc"
- Sticky bar: quick filters sticky top khi scroll
- Date picker: shadcn Calendar + Popover
- Number inputs: Input type="number" với placeholder "Từ" / "Đến"

