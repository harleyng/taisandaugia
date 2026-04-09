

## Plan: Gộp "Nhận thông tin" vào "Quan tâm" + Popup thông báo + Trang Profile

### Tóm tắt
1. Bỏ tính năng "Nhận thông tin" (follow) riêng biệt — chỉ giữ lại "Quan tâm" (save)
2. Lần đầu bấm Quan tâm → hiện popup mời bật thông báo
3. Trang Tài sản quan tâm: banner CTA bật thông báo nếu chưa bật
4. Trang Profile mới: tên, avatar, đổi mật khẩu, đăng xuất, setting thông báo

---

### 1. Database Migration

Thêm cột `notifications_enabled` vào bảng `profiles`:

```sql
ALTER TABLE public.profiles ADD COLUMN notifications_enabled boolean NOT NULL DEFAULT false;
```

Không cần xóa cột `is_following` khỏi `user_asset_actions` (giữ backward compatibility), chỉ bỏ sử dụng trong code.

### 2. Sửa `useAssetActions` hook

- Xóa toàn bộ logic `followingIds`, `toggleFollow`, `toggleFollowInner`
- Chỉ export `savedIds`, `toggleSave`, `session`
- Thêm state `isFirstSave` — sau khi save thành công lần đầu trong session, trigger callback `onFirstSave`
- Return thêm `isFirstSave` flag

### 3. Tạo `useNotificationSettings` hook

- Fetch `notifications_enabled` từ `profiles`
- Hàm `toggleNotifications(val)` để update
- Dùng ở popup, banner, và trang profile

### 4. Tạo component `NotificationPromptDialog`

- Dialog hiện sau lần đầu bấm Quan tâm
- Nội dung: "Bạn muốn nhận thông báo khi có cập nhật về tài sản quan tâm?"
- 2 nút: "Bật thông báo" (primary) và "Để sau"
- Lưu vào localStorage `notification_prompt_shown` để không hiện lại

### 5. Sửa trang Saved Assets (`BrokerSavedAssets.tsx`)

- Xóa tabs filter (all/saved/following/both) — chỉ hiện danh sách quan tâm
- Xóa badge "Nhận TT" trên card
- Thêm banner CTA ở đầu trang nếu `notifications_enabled === false`:
  - Bên trái: illustration (Bell icon lớn) + title + description
  - Bên phải: Button "Bật thông báo"
  - Click → update `notifications_enabled = true`

### 6. Tạo trang Profile mới (`/profile`)

- Route mới `/profile` trong `App.tsx` (protected, marketplace layout)
- Trang `ProfilePage.tsx` wrap với Header/Footer
- Nội dung:
  - **Avatar**: hiện initials hoặc ảnh, nút "Thay ảnh" (upload lên storage bucket `listing-images`)
  - **Tên**: editable field, save vào `profiles.name`
  - **Đổi mật khẩu**: form old password + new password, dùng `supabase.auth.updateUser`
  - **Thông báo**: switch bật/tắt `notifications_enabled`
  - **Đăng xuất**: button

### 7. Cập nhật Header

- Dropdown menu thêm mục "Hồ sơ cá nhân" → navigate `/profile`
- Mobile menu thêm link Profile
- Xóa mọi reference đến follow/bell trong dropdown

### 8. Cleanup các file liên quan

- `AuctionDetail.tsx`: xóa nút "Nhận thông tin", chỉ giữ "Quan tâm"
- `AuctionCard.tsx`: xóa props/logic follow
- `Index.tsx` / `Listings.tsx`: xóa truyền `toggleFollow`

### Files sẽ sửa/tạo

| File | Action |
|---|---|
| Migration | Thêm `notifications_enabled` vào profiles |
| `src/hooks/useAssetActions.tsx` | Xóa follow logic |
| `src/hooks/useNotificationSettings.tsx` | **Tạo mới** |
| `src/components/NotificationPromptDialog.tsx` | **Tạo mới** |
| `src/pages/ProfilePage.tsx` | **Tạo mới** |
| `src/pages/portal/BrokerSavedAssets.tsx` | Xóa tabs/follow, thêm banner |
| `src/pages/AuctionDetail.tsx` | Xóa nút follow |
| `src/components/AuctionCard.tsx` | Cleanup follow props |
| `src/components/Header.tsx` | Thêm Profile link, xóa bell icon |
| `src/App.tsx` | Thêm route `/profile` |
| `src/pages/Index.tsx` | Cleanup follow |
| `src/pages/Listings.tsx` | Cleanup follow |

