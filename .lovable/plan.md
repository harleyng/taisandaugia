## Tổng quan

Xây dựng tính năng "Theo dõi nhu cầu" (Follow Demand) — dịch vụ trả phí giúp user nhận thông báo khi có tài sản mới phù hợp với nhu cầu (intent) đã khai báo trong hồ sơ. Sử dụng credit balance hiện có để trừ phí gói, demand match dựa trên `agent_info.intent` (asset_categories, regions, budget_range).

## Phạm vi triển khai (giai đoạn 1)

Tập trung vào **Trigger A, B, D** + paywall + state subscribed/expired. Trigger C/E/F để giai đoạn sau.

---

## 1. Data layer

### `src/lib/demandSubscription.ts` (mới)
- Định nghĩa gói:
  ```
  weekly  : 7 ngày  / 99 credit
  monthly : 30 ngày / 299 credit
  yearly  : 365 ngày / 1990 credit
  ```
- Lưu state vào `localStorage` (theo pattern `mockCredits.ts`):
  - `{ tier: 'weekly'|'monthly'|'yearly', startedAt, expiresAt }`
- Hàm:
  - `getDemandSubscription()` → `{ status: 'NOT_SUBSCRIBED'|'ACTIVE'|'EXPIRED', tier, expiresAt }`
  - `subscribeDemand(tier)` → trừ credit qua `mockCredits.addCredits(-cost)` (hoặc tạo `unlock_demand` transaction type), set state, emit event
  - `subscribe(cb)` / `getState()` cho `useSyncExternalStore`
- Mở rộng `mockCredits.ts`: thêm `TransactionType = 'subscribe_demand'` để log giao dịch.

### `src/hooks/useDemandSubscription.tsx` (mới)
- Hook trả về `{ status, tier, expiresAt, subscribe(tier), DEMAND_TIERS }`.
- Reactive với localStorage qua `useSyncExternalStore`.

### `src/lib/demandMatch.ts` (mới)
- Hàm `matchListingToIntent(listing, intent)` → boolean, dựa trên:
  - `asset_categories` ⊃ `listing.property_type_slug` (hoặc parent category)
  - `regions` ⊃ `listing.address.province`
  - `budget_range` chứa `listing.price`
- Hàm `countMatches(listings, intent)` → number.
- Hàm `hasIntent(intent)` → boolean (≥ 1 trường được điền).

---

## 2. UI components mới

### `src/components/demand/DemandPaywallDialog.tsx`
Modal chọn gói:
- Title: "Theo dõi nhu cầu — Không bỏ lỡ tài sản phù hợp"
- 3 thẻ gói (tuần / tháng / năm) với giá credit, badge "Phổ biến" cho monthly, "Tiết kiệm" cho yearly
- Hiển thị số dư credit, cảnh báo nếu không đủ + CTA "Mua thêm credit" (→ `/profile?tab=credits`)
- Nút "Đăng ký" → `subscribeDemand(tier)` → toast thành công + đóng modal
- Value props: "Không cần tìm lại mỗi ngày", "Tự động thông báo khi có tài sản mới phù hợp", "Hủy bất cứ lúc nào"

### `src/components/demand/DemandUpsellBanner.tsx`
Banner hiển thị trong `/listings` (row 2, dưới quick filters) khi:
- User authed + có intent + status = NOT_SUBSCRIBED + matchCount > 0
- Title: "Bạn có thể bỏ lỡ tài sản phù hợp mà không hề biết"
- Sub: "Hệ thống tự động theo dõi và thông báo khi có tài sản đúng nhu cầu của bạn"
- Optional: "Có {matchCount} tài sản phù hợp với nhu cầu hiện tại"
- CTA: "Theo dõi nhu cầu này" → mở `DemandPaywallDialog`
- Nút X dismiss (sessionStorage)

### `src/components/demand/DemandEmptyMatch.tsx`
Hiển thị khi user đã apply intent filter nhưng không có asset match:
- Icon + title: "Hiện chưa có tài sản phù hợp với nhu cầu của bạn"
- Sub: "Nhưng các tài sản mới vẫn được đăng mỗi ngày"
- CTA mạnh: "Theo dõi để không bỏ lỡ" → paywall
- Nếu đã subscribed: chuyển sang reassurance "Chúng tôi sẽ thông báo ngay khi có tài sản mới"

### `src/components/demand/DemandStatusBadge.tsx`
Badge nhỏ:
- ACTIVE: "Đang theo dõi nhu cầu · còn {n} ngày" (màu primary)
- EXPIRED: "Đã hết hạn — Gia hạn" → mở paywall

---

## 3. Tích hợp vào pages

### `src/pages/Listings.tsx`
- Lấy `intent` từ `useOnboardingTasks()`, `subscription` từ `useDemandSubscription()`.
- Tính `intentMatchCount` qua `countMatches(filteredListings, intent)`.
- Render dưới sticky filters (Trigger B):
  - NOT_SUBSCRIBED + intent có ≥ 1 match → `<DemandUpsellBanner />`
  - ACTIVE → `<DemandStatusBadge />` inline với header
- Khi `filteredListings.length === 0` và user có intent → render `<DemandEmptyMatch />` thay cho empty state hiện tại (Trigger D).

### `src/components/profile/sections/ProfileIntentSection.tsx`
- Sau khi save intent thành công (sau `RewardClaimDialog` close), nếu match > 0:
  - Hiển thị toast/inline: "Hiện có {X} tài sản phù hợp với nhu cầu của bạn" + button "Xem ngay" → `/listings` (Trigger A).

### `src/components/profile/tabs/NotificationsTab.tsx`
- Thêm card "Theo dõi nhu cầu":
  - NOT_SUBSCRIBED + có intent: card upsell với CTA mở paywall
  - ACTIVE: card hiển thị tier, ngày hết hạn, button "Gia hạn"
  - EXPIRED: card cảnh báo + "Gia hạn ngay"
  - Không có intent: prompt "Khai báo nhu cầu trước" → link `/profile?tab=info#intent`

---

## 4. Acceptance criteria

- [ ] User chưa subscribe + có intent + vào `/listings` thấy banner upsell (Trigger B)
- [ ] Click "Theo dõi nhu cầu này" → mở modal 3 gói, trừ credit thành công, banner biến mất, badge "Đang theo dõi" xuất hiện
- [ ] Credit không đủ → modal hiển thị CTA "Mua credit"
- [ ] User có intent nhưng `/listings` không match → hiển thị empty state mạnh với CTA paywall (Trigger D)
- [ ] Sau khi subscribe → empty state chuyển reassurance, banner ẩn
- [ ] Sau khi save intent ở profile + có match → toast "Có X tài sản phù hợp" với link xem (Trigger A)
- [ ] Tab Thông báo có card quản lý subscription (xem hạn / gia hạn)
- [ ] Khi `expiresAt < now()` → status = EXPIRED, hiển thị lại upsell

---

## 5. Lưu ý kỹ thuật

- **Mock subscription** lưu localStorage giống `mockCredits` — không tạo bảng DB ở giai đoạn này. Dễ swap sang Supabase sau.
- **Match logic** chỉ chạy client-side trên kết quả `useAuctionListings()` đã có, không thêm DB query.
- **Notification thật sự** (gửi email/push khi có asset mới) **không nằm trong scope giai đoạn 1** — chỉ UI flow đăng ký. Sẽ làm sau khi có edge function + cron.
- **Trigger C (scroll), E (miss detection), F (detail page)** không triển khai ở giai đoạn này.
- Reuse pattern paywall hiện có (`AssetPaywallDialog`, `OwnerPaywallDialog`) cho UI tương đồng.
- Dùng design tokens hiện có (primary, muted, card) — không hard-code màu.

## 6. Files thay đổi

**Mới:**
- `src/lib/demandSubscription.ts`
- `src/lib/demandMatch.ts`
- `src/hooks/useDemandSubscription.tsx`
- `src/components/demand/DemandPaywallDialog.tsx`
- `src/components/demand/DemandUpsellBanner.tsx`
- `src/components/demand/DemandEmptyMatch.tsx`
- `src/components/demand/DemandStatusBadge.tsx`

**Sửa:**
- `src/lib/mockCredits.ts` (thêm transaction type)
- `src/pages/Listings.tsx` (banner + empty state + badge)
- `src/components/profile/sections/ProfileIntentSection.tsx` (Trigger A toast)
- `src/components/profile/tabs/NotificationsTab.tsx` (card subscription)