

## Mục tiêu
Áp paywall lên trang chi tiết **Chủ tài sản** giống trang **Công ty đấu giá**, với tier giá theo dõi **bằng nửa** giá tier công ty.

## So sánh giá (theo dõi)

| Tier | Công ty (hiện tại) | Chủ tài sản (mới) |
|---|---|---|
| 7 ngày | 99 credit | **49 credit** |
| 30 ngày | 299 credit | **149 credit** |
| 1 năm | 1990 credit | **995 credit** |

Lý do giảm giá: chủ tài sản thường có ít listing hơn công ty → giá trị thấp hơn → hợp lý ở mức ½.

## Block locked trên trang chủ tài sản

Header chủ tài sản (tên + địa chỉ) **vẫn hiển thị công khai**. Khi chưa unlock, ẩn:
- Stats (tổng tài sản, đấu giá thành công, tỷ lệ)
- Search/filter
- Danh sách listings

Thay bằng card CTA giống `CompanyDetail`:
- Icon Lock + tiêu đề "Hồ sơ chủ tài sản"
- Mô tả "Theo dõi danh sách tài sản và lịch sử đấu giá của chủ tài sản này"
- Nút "Xem các gói theo dõi" → mở `OwnerPaywallDialog` mới

## Thay đổi code

### 1. `src/lib/mockCredits.ts`
- Thêm type `OwnerTierKey = "7d" | "30d" | "1y"` + `OWNER_TIERS` (giá ½ company)
- Thêm `ownerUnlocks: Record<string, OwnerUnlock>` vào `MockState`
- Thêm `getOwnerAccess(ownerId)` + `unlockOwner(ownerId, tier, label)` (mirror company logic)
- Thêm transaction type `"unlock_owner"`

### 2. `src/hooks/useCredits.tsx`
- Export `ownerAccess`, `unlockOwner`, `OWNER_TIERS`, `OwnerTierKey`

### 3. `src/components/paywall/OwnerPaywallDialog.tsx` (mới)
- Clone `CompanyPaywallDialog`, đổi label "Hồ sơ chủ tài sản" + dùng `OWNER_TIERS` + `unlock=owner:{id}:{tier}` cho buy-credit redirect

### 4. `src/contexts/PaywallContext.tsx`
- Thêm `openOwnerPaywall(ownerId, label?)` + render `<OwnerPaywallDialog>`

### 5. `src/pages/AssetOwnerDetail.tsx`
- Thêm `useCredits().ownerAccess(id)` + `usePaywall().openOwnerPaywall`
- Bọc stats + search + grid trong `if (isOwnerUnlocked)`, else render card CTA locked
- Header chủ tài sản giữ public

### 6. `src/pages/BuyCredits.tsx` / `CreditsTab` redirect handler
- Hỗ trợ param `unlock=owner:{id}:{tier}` → auto unlock sau khi nạp credit (giống company)

## Lưu ý
- Mock data chỉ lưu localStorage, không cần migration DB.
- Các tier hiển thị "Phổ biến" cho `30d` (giống company).

