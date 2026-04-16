

## Plan: Hiển thị số lượt quan tâm trên card và trang detail

### Cách tiếp cận

Tạo một database function đếm số lượt save cho mỗi listing (tránh query N+1), rồi hiển thị trên 3 nơi: card homepage, card listings, và trang detail.

### 1. Tạo database function `get_listing_save_counts`

```sql
CREATE OR REPLACE FUNCTION public.get_listing_save_counts(listing_ids uuid[])
RETURNS TABLE(listing_id uuid, save_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT ua.listing_id, COUNT(*) as save_count
  FROM user_asset_actions ua
  WHERE ua.listing_id = ANY(listing_ids) AND ua.is_saved = true
  GROUP BY ua.listing_id
$$;
```

### 2. Hook: `useListingSaveCounts`

Tạo `src/hooks/useListingSaveCounts.tsx` — nhận array listing IDs, gọi RPC `get_listing_save_counts`, trả về `Map<string, number>`. Cache kết quả, refetch khi savedIds thay đổi.

### 3. Cập nhật `AuctionCard`

- Thêm prop `saveCount?: number`
- Hiển thị icon Heart + số lượt (ví dụ `❤ 6`) ở góc dưới card, bên cạnh orgName hoặc ở footer card
- Chỉ hiện khi `saveCount > 0`

### 4. Cập nhật trang Homepage (`AuctionSection`, `FeaturedProjects`)

- Gọi `useListingSaveCounts` với danh sách listing IDs
- Truyền `saveCount` xuống `AuctionCard`

### 5. Cập nhật trang Listings

- Gọi `useListingSaveCounts` trong `Listings.tsx`
- Truyền `saveCount` xuống mỗi `AuctionCard`

### 6. Cập nhật trang Detail (`AuctionDetail.tsx`)

- Query đếm save count cho listing hiện tại: `SELECT COUNT(*) FROM user_asset_actions WHERE listing_id = id AND is_saved = true`
- Hiển thị "X người quan tâm" ở phần `AuctionQuickInfo` sidebar, dưới status badge

### Files thay đổi

| File | Hành động |
|------|-----------|
| Database | Tạo function `get_listing_save_counts` |
| `src/hooks/useListingSaveCounts.tsx` | Tạo mới |
| `src/components/AuctionCard.tsx` | Thêm prop + hiển thị save count |
| `src/components/AuctionSection.tsx` | Gọi hook, truyền count |
| `src/components/FeaturedProjects.tsx` | Gọi hook, truyền count |
| `src/pages/Listings.tsx` | Gọi hook, truyền count |
| `src/pages/AuctionDetail.tsx` | Query + hiển thị count |
| `src/components/auction/AuctionQuickInfo.tsx` | Nhận + hiển thị count |

