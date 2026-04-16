

## Plan: Trang chi tiết chủ tài sản (Asset Owner Detail)

Tương tự trang Company Detail, tạo trang `/asset-owner/:id` hiển thị thông tin chủ tài sản và danh sách tài sản của họ.

### 1. Tạo bảng `asset_owners`

```sql
CREATE TABLE public.asset_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE asset_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view asset owners" ON asset_owners FOR SELECT TO public USING (true);

-- FK trên listings
ALTER TABLE listings ADD COLUMN asset_owner_id uuid REFERENCES asset_owners(id);
```

Migrate dữ liệu từ `custom_attributes` (`asset_owner_name`, `asset_owner_address`) vào bảng mới và cập nhật `asset_owner_id`.

### 2. Tạo route `/asset-owner/:id` (protected)

Thêm route trong `App.tsx`, tạo page `src/pages/AssetOwnerDetail.tsx`:
- Header: avatar + tên chủ tài sản + địa chỉ
- 3 stat cards: Tổng tài sản, Đấu giá thành công, Tỷ lệ thành công
- Search + filter trạng thái
- Grid `AuctionCard`

### 3. CTA trên trang AuctionDetail

Trong phần asset owner (dòng 170-179 của `AuctionDetail.tsx`), thêm CTA nổi bật: **"Khám phá tài sản từ chủ sở hữu này"** — link đến `/asset-owner/:id`, yêu cầu đăng nhập.

### 4. Files thay đổi

| File | Hành động |
|------|-----------|
| Migration SQL | Tạo bảng + migrate data |
| `src/pages/AssetOwnerDetail.tsx` | Tạo mới |
| `src/App.tsx` | Thêm route protected |
| `src/pages/AuctionDetail.tsx` | Thêm CTA link đến asset owner page |
| `src/hooks/useAuctionListings.tsx` | Thêm `asset_owner_id` vào interface |

