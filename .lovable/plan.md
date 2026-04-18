
## Mục tiêu
Bổ sung block "Dự đoán giá trúng" (locked) trên trang chi tiết tài sản, chỉ hiển thị với tài sản **chưa kết thúc đấu giá**.

## Cách xác định "chưa kết thúc"
Dựa vào `custom_attributes`:
- Có `auction_date` (ngày tổ chức) trong tương lai, HOẶC
- Chưa có `winning_price` / `win_price`

→ Logic: `isUpcoming = !winPrice && (auction_date == null || new Date(auction_date) >= now)`

## Block mới: "Dự đoán giá trúng & Phân tích"
Đặt ngay **dưới AuctionPriceRow** (vị trí đập vào mắt nhất), thay thế/gộp với block "Phân tích & insight nâng cao" hiện tại để tránh trùng lặp.

### Nội dung khi LOCKED (blur + CTA)
1. **Dự đoán giá trúng**: `2.45 tỷ – 2.78 tỷ` (mock, blur)
2. **Độ tin cậy**: thanh progress (vd 78%) + label "Cao"
3. **So với khởi điểm**: `+12% đến +27%`
4. **Các chỉ số nên bổ sung** (đề xuất):
   - **Mức độ cạnh tranh dự kiến**: Thấp / Trung bình / Cao (dựa trên lượt quan tâm + khu vực)
   - **Số phiên tương tự gần đây**: vd "8 phiên cùng khu vực 90 ngày qua"
   - **Tỷ lệ đấu giá thành công khu vực**: vd "65%"
   - **Giá trung bình/m² khu vực**: để so sánh nhanh
   - **Khuyến nghị đặt cọc/tham gia**: Nên / Cân nhắc / Bỏ qua

### CTA
- Button "Mở khóa dự đoán – 59 credit" → `openAssetPaywall(listing.id, listing.title)`
- Reuse logic `isUnlocked` từ `useCredits`

### Khi UNLOCKED
Hiển thị giá trị thật (mock data lấy từ `ca.predicted_price_min/max`, `ca.confidence_score`, ...). Nếu chưa có dữ liệu thì hiện "Đang phân tích".

## Thay đổi code

### 1. Component mới: `src/components/auction/AuctionPricePrediction.tsx`
- Props: `listing`, `isUnlocked`, `onUnlock`
- Layout: Card với 2 phần:
  - **Header**: icon Sparkles + tiêu đề "Dự đoán giá trúng (AI)"
  - **Body**: 
    - Range giá lớn (blur khi locked)
    - 4 chip nhỏ: Độ tin cậy, Cạnh tranh, Phiên tương tự, Tỷ lệ thành công
    - CTA mở khóa
- Dùng `LockedBlur` component đã có sẵn để blur

### 2. Sửa `src/pages/AuctionDetail.tsx`
- Thêm helper `isUpcoming` 
- Render `<AuctionPricePrediction>` ngay sau `AuctionPriceRow` nếu `isUpcoming`
- **Xóa** block "Phân tích & insight nâng cao" cũ (gộp vào block mới để tránh 2 block locked giống nhau)

### 3. Mock data (không cần migration)
Dự đoán tính từ `price` (giá khởi điểm):
- `min = price * 1.12`, `max = price * 1.27` (deterministic theo `listing.id` để mỗi tài sản có range khác nhau ổn định)
- `confidence = 65-90%` (hash từ id)
- `competition`: dựa trên `views_count`

## Đề xuất bổ sung khác (ngoài giá dự đoán)
Tôi gợi ý gộp luôn các chỉ số này vào block để 1 lần unlock cho ra nhiều giá trị, thay vì có nhiều block locked rời rạc:

| Chỉ số | Lý do hữu ích |
|---|---|
| Range giá dự đoán | Giá trị cốt lõi |
| Độ tin cậy AI | Giúp user đánh giá độ chắc chắn |
| Mức cạnh tranh dự kiến | Quyết định có nên tham gia |
| Số phiên tương tự gần đây | Bằng chứng/độ tin cậy |
| Tỷ lệ đấu giá thành công khu vực | Bối cảnh thị trường |
| Khuyến nghị (Nên/Cân nhắc/Bỏ qua) | Gợi ý hành động |

## Files
- **Tạo**: `src/components/auction/AuctionPricePrediction.tsx`
- **Sửa**: `src/pages/AuctionDetail.tsx` (thêm component, xóa block insight cũ)
