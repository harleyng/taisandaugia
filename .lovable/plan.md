

## Plan: Gộp /buy-credits vào /profile dưới dạng tabs sidebar

Biến `/profile` thành layout 2 cột: sidebar trái chứa các tab, vùng nội dung phải hiển thị tab tương ứng. Trang `/buy-credits` cũ được giữ làm redirect để link cũ vẫn chạy.

### Layout mới `ProfilePage`

```text
+------------------------------------------------+
| Header                                         |
+----------------+-------------------------------+
| [Avatar+Name]  |                               |
| Số dư: X credit|   Tab content                 |
|                |                               |
| ▸ Hồ sơ        |                               |
| ▸ Mua credit   |                               |
| ▸ Đổi mật khẩu |                               |
| ▸ Thông báo    |                               |
| ▸ Đăng xuất    |                               |
+----------------+-------------------------------+
```

### Tabs

1. **profile** (mặc định) — Avatar upload + tên hiển thị (tách từ ProfilePage hiện tại)
2. **credits** — Toàn bộ nội dung `BuyCredits` hiện tại (5 gói + dialog VNPay mock)
3. **password** — Đổi mật khẩu
4. **notifications** — Toggle thông báo
5. **logout** — Action button (không phải tab content)

### Cơ chế tab

- Dùng URL query `?tab=credits` (sync với React Router) để các link bên ngoài trỏ thẳng vào tab cụ thể.
- Sidebar items: icon + label + active state highlight (left border + bg muted).
- Mobile: sidebar collapse thành horizontal scrollable tabs trên đầu trang (dùng `Tabs` shadcn hoặc custom flex).

### Files

**Tạo:**
- `src/components/profile/ProfileSidebar.tsx` — sidebar với danh sách tab + avatar header + balance chip
- `src/components/profile/tabs/ProfileInfoTab.tsx` — tách phần avatar/name từ ProfilePage cũ
- `src/components/profile/tabs/CreditsTab.tsx` — toàn bộ UI mua credit (5 gói + VNPay dialog) tách từ BuyCredits.tsx; vẫn dùng cùng `useCredits` + `mockCredits`
- `src/components/profile/tabs/PasswordTab.tsx` — đổi mật khẩu
- `src/components/profile/tabs/NotificationsTab.tsx` — toggle thông báo

**Sửa:**
- `src/pages/ProfilePage.tsx` — thay bằng layout sidebar + render tab theo `?tab=...`. Default = `profile`.
- `src/pages/BuyCredits.tsx` — chuyển thành component redirect: `<Navigate to={`/profile?tab=credits${location.search params}`} replace />` (giữ `return` & `unlock` query params). Đảm bảo các nút "Mua credit" hiện có (Header, AssetPaywallDialog, CompanyPaywallDialog) vẫn hoạt động không cần sửa.
- `src/components/Header.tsx` — đổi điều hướng "Mua credit" sang `/profile?tab=credits` (cả desktop + mobile + chip balance).
- `src/components/paywall/AssetPaywallDialog.tsx` & `CompanyPaywallDialog.tsx` — đổi `navigate('/buy-credits?...')` sang `/profile?tab=credits&...`.
- `src/pages/PaymentResult.tsx` — nút "Mua thêm credit" / "Thử lại" trỏ về `/profile?tab=credits` (giữ logic auto-unlock & return URL).

### Chi tiết UI sidebar

- Card sticky top-24 trên desktop (`lg:col-span-3`), nội dung `lg:col-span-9`.
- Mỗi item: `<button>` full width, `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm`, active = `bg-primary/10 text-primary font-semibold`.
- Header sidebar: avatar nhỏ + tên + email + chip "Số dư: X credit" (link tới tab credits).
- Logout: tách dưới cùng, `variant="outline"` đỏ nhạt.
- Mobile (`<lg`): sidebar thành `Tabs` ngang, scroll-x, sticky top dưới Header.

### Bảo toàn behavior

- Auto-unlock sau thanh toán: vẫn redirect qua `/payment-result` → `unlockAsset/unlockCompany` → `return` URL gốc (không thay đổi).
- Deep link `/buy-credits?return=/auctions/abc&unlock=asset:abc` → redirect tới `/profile?tab=credits&return=...&unlock=...`, CreditsTab đọc cùng params như trước.
- ProtectedRoute đã bao `/profile`, nên CreditsTab luôn yêu cầu đăng nhập (paywall dialog cần xử lý guest: bấm "Mua credit" khi chưa login → openAuthDialog rồi mới redirect — pattern đã có sẵn `useAuthGuardedNavigate`).

