-- Tự động xác thực email khi đăng ký + backfill toàn bộ tài khoản cũ.
--
-- Bối cảnh: dự án chưa cấu hình SMTP riêng (smtp_host = null) nên GoTrue dùng
-- sender mặc định của Supabase — giới hạn cứng 2 email/giờ. Khi "Confirm email"
-- bị bật, mọi tài khoản đăng ký mới đều kẹt ở trạng thái chưa xác thực (và phần
-- lớn còn không nhận được mail vì vượt rate limit) → không đăng nhập lại được.
--
-- Việc TẮT xác thực email cho tài khoản mới nằm ở CẤU HÌNH DỰ ÁN, không phải SQL:
--   Dashboard → Authentication → Sign In / Providers → Email → tắt "Confirm email"
--   (tương đương GoTrue `mailer_autoconfirm = true`; đã bật qua Management API).
-- Cấu hình đó cũng được ghi lại trong supabase/config.toml ([auth.email]) để môi
-- trường local `supabase start` hành xử giống hệt remote.
--
-- Migration này chỉ lo phần DỮ LIỆU: gỡ kẹt những tài khoản đã trót tạo ra trong
-- lúc "Confirm email" còn bật.

UPDATE auth.users
   SET email_confirmed_at  = COALESCE(email_confirmed_at, created_at, now()),
       -- Xoá luôn vé xác thực còn treo để không còn link/OTP nào dùng lại được.
       confirmation_token  = '',
       confirmation_sent_at = NULL
 WHERE email_confirmed_at IS NULL;

-- Lưu ý: auth.users.confirmed_at là cột GENERATED (LEAST(email_confirmed_at,
-- phone_confirmed_at)) — KHÔNG ghi trực tiếp, Postgres sẽ tự cập nhật theo trên.
