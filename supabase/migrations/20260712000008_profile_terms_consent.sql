-- Lưu consent điều khoản + opt-in email marketing khi đăng ký tài khoản.
--
--  • notifications_enabled (đã có sẵn) ← checkbox "nhận email quảng cáo" (audience Marketing).
--  • terms_accepted_at + terms_version (mới) ← checkbox "đồng ý Điều khoản & Chính sách bảo mật".
--
-- Dữ liệu được truyền qua options.data của supabase.auth.signUp (giống 'name'),
-- rồi trigger handle_new_user đọc raw_user_meta_data để set ngay khi tạo profile.
-- User đăng ký qua Google OAuth không có metadata → 3 cột giữ giá trị mặc định/null.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_version     text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, email, name, kyc_status,
    notifications_enabled, terms_accepted_at, terms_version
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    'NOT_APPLIED'::kyc_status,
    COALESCE((NEW.raw_user_meta_data->>'notifications_enabled')::boolean, false),
    CASE WHEN (NEW.raw_user_meta_data->>'terms_accepted')::boolean IS TRUE
         THEN now() ELSE NULL END,
    CASE WHEN (NEW.raw_user_meta_data->>'terms_accepted')::boolean IS TRUE
         THEN NEW.raw_user_meta_data->>'terms_version' ELSE NULL END
  );

  -- Assign default USER role (no BROKER role needed)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'USER');

  RETURN NEW;
END;
$function$;
