## Plan: Hệ thống Credit + Khoá nội dung + Trang mua Credit (mock)

Kết hợp toàn bộ: lock UI/paywall (đã đề xuất ở plan trước) + trang mua credit với 4 gói. KHÔNG tích hợp thanh toán thật — dùng mock + dev helper để chạy thông flow end-to-end. Sau này swap mock sang VNPay/Stripe chỉ cần đổi 1 hook.

---

### 1. Lớp state credit (mock, persist localStorage)

- `src/lib/mockCredits.ts`: balance, asset unlocks, company unlocks (kèm `expires_at`), purchase history. Emit event để các hook re-render.
- `src/hooks/useCredits.tsx`: `balance`, `assetUnlocked(id)`, `companyAccess(orgId)` → `{tier, expiresAt, isUnlocked}`, `unlockAsset(id)`, `unlockCompany(orgId, tier)`, `addCredits(amount, packageKey)`.
- Hằng số: `ASSET_COST = 59`. Tiers công ty: `7d=99`, `30d=299`, `1y=1990` credit.
- Gói mua: Starter `69k→69`, Popular `179k→190` (highlight), Value `299k→330`, Pro `499k→600`.

### 2. Trang mua credit + kết quả

- `src/pages/BuyCredits.tsx` (`/buy-credits`):
  - Header: "Mua credit" + "Số dư hiện tại: X credit"
  - 4 card gói dùng 4 ảnh minh hoạ (xu tăng dần) 
  - Card Popular có badge "Phổ biến" + viền nổi bật
  - CTA "Mua ngay" → mock: minh hoạ luồng thanh toand bằng VNPay -> click thanh toán -> loading → cộng credit → điều hướng `/payment-result?status=success&package=...&return=...`
  - Hỗ trợ `?return=/auctions/abc&unlock=asset:abc` để auto-unlock + redirect sau khi mua
- `src/pages/PaymentResult.tsx` (`/payment-result`):
  - Success: "Thanh toán thành công" + "+X credit đã được cộng". Nếu có `unlock` param → tự động `unlockAsset/unlockCompany` rồi CTA "Tiếp tục" về `return` URL
  - Failed: "Thanh toán thất bại" + "Thử lại"
- 4 ảnh minh hoạ generate sẵn vào `src/assets/credits/` (coin pile tăng dần, có badge "Ảnh minh hoạ")

### 3. Paywall components (dùng chung)

- `src/components/paywall/LockedBlur.tsx`: wrap children, blur + chặn click, overlay icon khoá + teaser + CTA
- `src/components/paywall/AssetPaywallDialog.tsx`: balance, "Mở khoá tài sản – 59 credit", note tương lai. Đủ → "Dùng credit để mở"; thiếu → "Mua credit" → `/buy-credits?return=...&unlock=asset:id`
- `src/components/paywall/CompanyPaywallDialog.tsx`: 3 tier card (7d/30d/1y) với mô tả giá trị, logic credit tương tự
- `src/contexts/PaywallContext.tsx`: `openAssetPaywall(id)`, `openCompanyPaywall(orgId)` global

### 4. Áp dụng khoá

`**AuctionDetail.tsx**` (free: tiêu đề, giá, địa chỉ, mô tả, ảnh, save):

- Khoá `AuctionScheduleInfo`, `AuctionAttachments`, contact line trong `AuctionOrganizerInfo`
- Thêm card placeholder "Phân tích & insight" (chỉ hiện khi locked) với note "Dữ liệu sẽ được cập nhật và phân tích sâu hơn..."

`**CompanyDetail.tsx**` (free: tên, org_type badge, địa chỉ):

- Khoá stats grid, search/filter, listings