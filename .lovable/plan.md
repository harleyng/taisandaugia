# Đơn giản hóa luồng "Theo dõi tài sản"

## Mục tiêu
Bỏ chức năng "Quan tâm" rời rạc, gộp thành một hành động duy nhất: **Nhận thông báo khi có cập nhật**. Khi user lưu là tự động bật nhận thông báo cho tài sản đó — không còn popup hỏi và không còn switch bật/tắt thông báo riêng.

---

## Thay đổi UI

### 1) Header (`src/components/Header.tsx`)
- **Bỏ** nút icon Heart riêng cạnh số credit (cả desktop bar và mobile menu).
- **Giữ** mục trong dropdown user và mobile sheet, đổi nhãn:
  - "Tài sản quan tâm" → **"Tài sản đang theo dõi"** (icon Heart vẫn dùng).
  - Link vẫn đi tới `/profile?tab=saved`.

### 2) Card tài sản (`src/components/AuctionCard.tsx`)
- **Bỏ hoàn toàn** nút Heart góc trên-phải ở cả `featured` (homepage) và `default` (trang Listings).
- Vẫn giữ chip hiển thị `saveCount` (icon trái tim đỏ + số) ở phần thống kê — đây chỉ là số liệu, không phải nút.
- Có thể bỏ luôn props `isSaved` / `onToggleSave` nếu không còn ai dùng.

### 3) Trang chi tiết tài sản (`src/pages/AuctionDetail.tsx`)
- Đổi nút "Quan tâm" / "Đã quan tâm" thành nút rõ nghĩa hơn:
  - Khi chưa follow: **"Nhận thông báo khi có cập nhật"** + icon `Bell`.
  - Khi đã follow: **"Đang nhận thông báo"** + icon `BellRing` (hoặc `Bell` filled), bấm lần nữa để dừng theo dõi.
- Vẫn giữ thanh thống kê (lượt xem, số quan tâm).

### 4) Bỏ popup `NotificationPromptDialog`
- Xóa toàn bộ render `<NotificationPromptDialog />` ở các trang: `Listings`, `AuctionDetail`, `CompanyDetail`, `AssetOwnerDetail`, `AuctionSection`, `SavedAssetsTab`.
- Có thể xóa luôn file `src/components/NotificationPromptDialog.tsx`.

### 5) Sidebar /profile (`src/components/profile/ProfileSidebar.tsx`)
- **Bỏ** mục riêng "Tài sản quan tâm" khỏi danh sách NAV.
- Giữ mục **"Thông báo"** (icon Bell) như entry duy nhất cho cả phần theo dõi tài sản.

### 6) Tab Thông báo trong /profile (`NotificationsTab.tsx`) — viết lại
- **Bỏ** Switch "Nhận thông báo tài sản" (vì đã auto theo từng tài sản theo dõi).
- Header card mới: "Tài sản đang theo dõi" + mô tả ngắn "Bạn sẽ nhận thông báo khi có cập nhật về các tài sản này".
- Hiển thị **section dạng row có thể click**:
  - Khi `savedIds.size > 0`: 
    ```text
    [icon Bell]  Đang theo dõi {n} tài sản              [icon ChevronRight]
                Xem danh sách chi tiết
    ```
    Click → mở chi tiết. Cách hiển thị chi tiết: render trực tiếp danh sách bên dưới (collapsible) — đơn giản và tránh thêm route mới.
  - Khi `savedIds.size === 0`: empty state với icon, dòng chữ "Chưa theo dõi tài sản nào", và CTA "Khám phá tài sản" → `/listings`.

### 7) Tab "Tài sản quan tâm" (`SavedAssetsTab.tsx`)
- Vẫn giữ tab `?tab=saved` để link cũ trong dropdown header còn hoạt động (header dropdown vẫn dùng "Tài sản đang theo dõi" → `/profile?tab=saved`).
- Đổi tiêu đề và copy: "Tài sản đang theo dõi" + "Bạn sẽ nhận thông báo khi có cập nhật".
- **Bỏ** Alert "Bật thông báo" và `NotificationPromptDialog`.

---

## Thay đổi logic (`src/hooks/useAssetActions.tsx`)
- **Bỏ** state `showNotificationPrompt` và `dismissNotificationPrompt` cùng các key `localStorage` liên quan.
- Khi `toggleSaveInner(listingId, true)` chạy: gọi `useNotificationSettings.toggleNotifications(true)` để **auto bật** master switch nếu user chưa bật, không hiện popup.
- Toast khi follow: "Đã theo dõi — bạn sẽ nhận thông báo khi có cập nhật".
- Toast khi unfollow: "Đã ngừng theo dõi".
- Gỡ tham số `showNotificationPrompt` / `dismissNotificationPrompt` ở tất cả nơi gọi (`Listings`, `AuctionDetail`, `CompanyDetail`, `AssetOwnerDetail`, `AuctionSection`, `SavedAssetsTab`).

---

## Files được chạm
- `src/components/Header.tsx` — bỏ nút Heart riêng, đổi nhãn dropdown.
- `src/components/AuctionCard.tsx` — bỏ nút Heart trên ảnh.
- `src/pages/AuctionDetail.tsx` — đổi nhãn nút theo dõi, bỏ NotificationPromptDialog.
- `src/pages/Listings.tsx`, `src/pages/CompanyDetail.tsx`, `src/pages/AssetOwnerDetail.tsx`, `src/components/AuctionSection.tsx` — bỏ NotificationPromptDialog.
- `src/components/profile/ProfileSidebar.tsx` — bỏ mục "Tài sản quan tâm" khỏi NAV.
- `src/components/profile/tabs/NotificationsTab.tsx` — viết lại theo mô tả mục 6.
- `src/components/profile/tabs/SavedAssetsTab.tsx` — đổi copy, bỏ banner và prompt.
- `src/hooks/useAssetActions.tsx` — bỏ logic prompt, auto bật `notifications_enabled`.
- Xóa `src/components/NotificationPromptDialog.tsx`.

## Memory
- Cập nhật `mem://features/listings/user-interactions` và `mem://features/listings/management-page` để phản ánh: không còn popup, follow = auto nhận thông báo, label "Tài sản đang theo dõi", header bỏ icon Heart.
