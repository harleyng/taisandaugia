

## Plan: Bảng tổ chức đấu giá riêng + CTA trên trang detail

### 1. Tạo bảng `auction_organizations`

Bảng riêng cho tổ chức đấu giá (không dùng bảng `organizations` hiện tại vốn dành cho broker):

```sql
CREATE TABLE public.auction_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  address text,
  phone text,
  email text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE auction_organizations ENABLE ROW LEVEL SECURITY;

-- Ai cũng xem được
CREATE POLICY "Public can view auction organizations"
  ON auction_organizations FOR SELECT TO public USING (true);

-- Thêm cột reference vào listings
ALTER TABLE listings ADD COLUMN auction_org_id uuid REFERENCES auction_organizations(id);
```

### 2. Migrate dữ liệu từ `custom_attributes`

Chạy migration INSERT từ distinct `org_name` trong `custom_attributes` → bảng mới, rồi UPDATE `listings.auction_org_id` tương ứng.

### 3. Tạo route `/auction-org/:id` (protected)

Trong `App.tsx` thêm route protected, tạo page `CompanyDetail.tsx`:
- Header: avatar + tên công ty + địa chỉ + SĐT/email
- 3 stat cards: Tổng tài sản, Đấu giá thành công, Tỷ lệ thành công
- Quick search: tìm theo tên, lọc trạng thái
- Grid `AuctionCard`

### 4. CTA thu hút trên trang detail

Trong `AuctionOrganizerInfo.tsx`, thêm một CTA button nổi bật:
- Gradient background, icon `ArrowRight`
- Text: "Xem tất cả tài sản của [tên công ty] →"
- Link đến `/auction-org/:id`
- Yêu cầu đăng nhập (dùng `useAuthDialog` nếu chưa login)

### 5. Link trên AuctionCard footer

Tên công ty ở footer card cũng clickable → `/auction-org/:id`.

### Files thay đổi

| File | Hành động |
|------|-----------|
| Migration SQL | Tạo bảng + migrate data |
| `src/pages/CompanyDetail.tsx` | Tạo mới |
| `src/components/auction/AuctionOrganizerInfo.tsx` | Thêm CTA link |
| `src/components/AuctionCard.tsx` | Link org name, thêm prop `orgId` |
| `src/components/AuctionSection.tsx` | Truyền `orgId` |
| `src/pages/Listings.tsx` | Truyền `orgId` |
| `src/App.tsx` | Thêm route |
| `src/hooks/useAuctionListings.tsx` | Select `auction_org_id` |

