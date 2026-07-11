-- Seed dữ liệu mẫu: bật notifications_enabled (cho phép nhận email marketing) cho
-- một phần user, để preview/gửi chiến dịch có audience thực và thấy rõ tác dụng của
-- bộ lọc opt-in (số "thực nhận" < số "khớp tiêu chí").
--
-- KHÔNG đổi schema, KHÔNG đổi default (cột vẫn NOT NULL DEFAULT false → opt-in thật
-- cho user mới). Đây chỉ là dữ liệu mẫu.
--
-- Chọn ~1/3 user, rải đều theo hash id (không thiên theo ngày tạo / loại tài khoản),
-- và idempotent: md5-order ổn định nên chạy lại luôn chọn đúng tập cũ (no-op).
-- Muốn nhiều/ít hơn: chỉnh mẫu số dưới đây (vd / 2 cho một nửa).

UPDATE public.profiles
SET notifications_enabled = true
WHERE id IN (
  SELECT id
  FROM public.profiles
  ORDER BY md5(id::text)
  LIMIT GREATEST(1, (SELECT count(*) FROM public.profiles) / 3)
);
