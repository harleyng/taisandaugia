# Email templates (Auth)

> ⚠️ **HIỆN CHƯA DÙNG.** Luồng tạo tài khoản / đặt lại mật khẩu đã chuyển sang
> **không gửi email** (admin tạo user → copy link đặt mật khẩu; đặt lại mật khẩu →
> admin nhập trực tiếp trong popup). Xem `admin-user-actions` + `UserActions.tsx`.
> Sửa email template trên Supabase còn **yêu cầu bật custom SMTP**. Giữ 2 file này để
> dùng lại nếu sau này bật SMTP và muốn gửi email branded.

Template HTML branded cho email xác thực của Supabase Auth. Đây là project **hosted**
(`dvdpfjprncvkhfwcvqmp`) nên template phải được dán qua Dashboard — không push bằng CLI.

## Cách áp dụng

1. Vào **Supabase Dashboard → Authentication → Emails → Templates**.
2. Với mỗi template dưới đây: mở, dán toàn bộ nội dung file HTML vào ô **Message body**, đặt lại **Subject**, rồi **Save**.

| File | Template trong Dashboard | Subject gợi ý |
|------|--------------------------|---------------|
| [`invite.html`](./invite.html) | **Invite user** | `Lời mời kích hoạt tài khoản — Tài Sản Đấu Giá` |
| [`recovery.html`](./recovery.html) | **Reset password** | `Đặt lại mật khẩu — Tài Sản Đấu Giá` |

## Cấu hình đi kèm (bắt buộc để không còn "trang trống")

Link trong email redirect về `…/tao-mat-khau` (xem `useAdminUsers.ts`). Phải whitelist URL này,
nếu không Supabase từ chối redirect và người dùng rơi vào trang trống:

**Dashboard → Authentication → URL Configuration → Redirect URLs**, thêm:

```
http://localhost:8080/tao-mat-khau
https://<domain-production>/tao-mat-khau
```

(Có thể dùng wildcard `https://<domain-production>/**`.)

## Biến template khả dụng

`{{ .ConfirmationURL }}` · `{{ .SiteURL }}` · `{{ .Email }}` · `{{ .Data.name }}` (metadata khi mời).

## SMTP

Email mặc định của Supabase bị giới hạn số lượng và dễ vào spam. Để dùng thật với số lượng lớn,
cấu hình **Custom SMTP** ở Dashboard → Authentication → Emails → SMTP Settings.
