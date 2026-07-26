-- RPC đọc showcase an toàn cho trang MKP.
--
-- Bảng auction_tool_showcases KHÔNG có public_read: `url` (showcase cần mật khẩu)
-- và `access_password` là bí mật, mà RLS lọc theo DÒNG không giấu được CỘT. Hai
-- RPC SECURITY DEFINER này là cửa công khai duy nhất:
--   list_tool_showcases  — liệt kê showcase; chỉ trả `url` cho showcase public,
--                          showcase password trả url=NULL + is_locked=true.
--   unlock_tool_showcase — đổi mật khẩu đúng lấy `url`.
-- KHÔNG hàm nào trả `access_password`.

CREATE OR REPLACE FUNCTION public.list_tool_showcases(_provider_id UUID)
RETURNS TABLE (
  id            UUID,
  title         TEXT,
  kind          TEXT,
  thumbnail_url TEXT,
  description   TEXT,
  visibility    TEXT,
  sort_order    INTEGER,
  url           TEXT,      -- chỉ có giá trị khi visibility='public'
  is_locked     BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.title, s.kind, s.thumbnail_url, s.description, s.visibility, s.sort_order,
    CASE WHEN s.visibility = 'public' THEN s.url ELSE NULL END AS url,
    (s.visibility = 'password')                                AS is_locked
  FROM public.auction_tool_showcases s
  JOIN public.auction_tool_providers p ON p.id = s.provider_id
  WHERE s.provider_id = _provider_id
    AND s.is_active = true
    AND p.status = 'active'
  ORDER BY s.sort_order, s.created_at;
$$;

GRANT EXECUTE ON FUNCTION public.list_tool_showcases(UUID) TO anon, authenticated;

-- Trả url khi mật khẩu đúng, RAISE khi sai. Mật khẩu chia sẻ (không phải bí mật
-- theo người dùng) nên so sánh `=` là đủ, không cần hằng-thời-gian.
CREATE OR REPLACE FUNCTION public.unlock_tool_showcase(_id UUID, _password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url        TEXT;
  v_visibility TEXT;
  v_password   TEXT;
BEGIN
  SELECT s.url, s.visibility, s.access_password
    INTO v_url, v_visibility, v_password
  FROM public.auction_tool_showcases s
  JOIN public.auction_tool_providers p ON p.id = s.provider_id
  WHERE s.id = _id AND s.is_active = true AND p.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy showcase' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_visibility = 'public' THEN
    RETURN v_url;
  END IF;

  IF v_password IS DISTINCT FROM _password THEN
    RAISE EXCEPTION 'Mật khẩu không đúng' USING ERRCODE = 'invalid_password';
  END IF;

  RETURN v_url;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_tool_showcase(UUID, TEXT) TO anon, authenticated;
