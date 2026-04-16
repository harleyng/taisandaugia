

## Plan: Redesign trang chi tiết đấu giá

Hai thay đổi chính: (1) tạo component hàng giá ngang đặt lên đầu cột trái, (2) cập nhật layout AuctionDetail theo reference — mô tả collapsible, nút quan tâm full-width, section nguồn.

### 1. Tạo test data đầy đủ

Insert 1 listing vào DB với tất cả custom_attributes: `deposit_amount`, `bid_step`, `document_fee`, `winning_price`, `org_name`, `org_address`, `org_phone`, `org_email`, `auction_location`, `document_sale_start/end`, `asset_viewing_start/end`, `auction_time`, `registration_deadline`, `asset_owner_name`, `asset_owner_address`, `attachments`, `source_urls`, `quantity`, `notes`.

### 2. Tạo `src/components/auction/AuctionPriceRow.tsx`

Card chứa grid 5 ô ngang (responsive 2-3 cột trên mobile):
- **Khởi điểm** (`price`)
- **Đặt trước** (`ca.deposit_amount`)
- **Hồ sơ** (`ca.document_fee`)
- **Bước giá** (`ca.bid_step ?? ca.step_price`)
- **Giá trúng** (`ca.winning_price ?? ca.win_price`) — hiển thị "–" nếu chưa có

Mỗi ô: label `text-xs text-muted-foreground` + value `text-sm font-bold`. Dùng `formatPrice` từ utils. Các ô phân cách bằng border-right (trừ ô cuối).

### 3. Cập nhật `src/pages/AuctionDetail.tsx`

Thay thế cột trái hiện tại bằng thứ tự mới:

1. **AuctionPriceRow** (mới) — hàng giá ngang
2. **Thông tin việc đấu giá** — Card với `Collapsible` (mặc định mở), chứa:
   - Tiêu đề tài sản (listing.title con)
   - Mô tả (description)
   - Metadata inline: Số lượng (`ca.quantity`), Loại BĐS (`property_types.name`), Nơi có tài sản (address), Ghi chú (`ca.notes`)
   - Chủ tài sản (giữ nguyên logic hiện tại)
   - Chevron toggle để đóng/mở
3. **AuctionOrganizerInfo** — giữ nguyên
4. **AuctionScheduleInfo** — giữ nguyên
5. **AuctionAttachments** — giữ nguyên
6. **Nút "Quan tâm tài sản"** — full-width centered, `variant="outline"`, icon Heart
7. **Nguồn** — nếu có `ca.source_urls` (array), hiển thị danh sách link

### Files thay đổi

| File | Hành động |
|------|-----------|
| `src/components/auction/AuctionPriceRow.tsx` | Tạo mới |
| `src/pages/AuctionDetail.tsx` | Refactor layout cột trái |
| Database | Insert 1 listing test data đầy đủ |

