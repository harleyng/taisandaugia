-- Gộp danh mục quyền Trạm Điều Hành sau 2 migration chạy song song cùng ngày:
--   • 20261001100000_posting_share_links  thêm so-hoa:share (Hồ sơ online, Phase M0)
--   • 20261001214152_owner_mkt_links      thêm module truyen-thong (Phase M1)
-- Cả hai đều CREATE OR REPLACE owner_ws_permission_catalog() từ bản cũ, nên bản áp sau
-- (M1) làm rơi so-hoa:share khỏi danh mục: các dòng quyền đã cấp vẫn còn và vẫn có hiệu
-- lực, nhưng lưu một vai trò có so-hoa:share bị từ chối 'invalid_permission' và Trạm mới
-- không được cấp mặc định. File này định nghĩa lại danh mục = HỢP của cả hai.
--
-- Bài học: danh mục là MỘT hàm — mỗi lần thêm quyền phải đọc bản ĐANG CHẠY trên DB
-- (pg_get_functiondef) ngay trước khi áp, không phải bản trong file migration cũ.

CREATE OR REPLACE FUNCTION public.owner_ws_permission_catalog()
RETURNS TABLE (module TEXT, action TEXT)
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  VALUES
    ('chi-tieu', 'view'), ('chi-tieu', 'create'), ('chi-tieu', 'update'), ('chi-tieu', 'delete'),
    ('tai-san', 'view'), ('tai-san', 'update'),
    ('ket-qua', 'view'), ('ket-qua', 'update'), ('ket-qua', 'delete'),
    ('so-hoa', 'view'), ('so-hoa', 'create'), ('so-hoa', 'update'), ('so-hoa', 'share'),
    ('ky-gui', 'view'), ('ky-gui', 'create'), ('ky-gui', 'update'),
    ('hop-dong-mua-ban', 'view'), ('hop-dong-mua-ban', 'update'),
    ('thu-tien', 'view'), ('thu-tien', 'create'), ('thu-tien', 'update'), ('thu-tien', 'delete'),
    ('truyen-thong', 'view'), ('truyen-thong', 'create'), ('truyen-thong', 'update'),
    ('truyen-thong', 'delete'), ('truyen-thong', 'finalize'), ('truyen-thong', 'share'),
    ('phan-tich', 'view'),
    ('dong-tien', 'view'),
    ('bao-cao-dinh-ky', 'view'), ('bao-cao-dinh-ky', 'create'), ('bao-cao-dinh-ky', 'update'),
    ('bao-cao-dinh-ky', 'delete'), ('bao-cao-dinh-ky', 'finalize'), ('bao-cao-dinh-ky', 'share'),
    ('chi-nhanh', 'view'), ('chi-nhanh', 'update'),
    ('thanh-vien', 'view'), ('thanh-vien', 'create'), ('thanh-vien', 'update'), ('thanh-vien', 'delete'),
    ('vai-tro', 'view'), ('vai-tro', 'create'), ('vai-tro', 'update'), ('vai-tro', 'delete'),
    ('lien-ket', 'view'), ('lien-ket', 'update')
$$;

CREATE OR REPLACE FUNCTION public.owner_ws_default_role_permissions(p_code TEXT)
RETURNS TABLE (module TEXT, action TEXT)
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT c.module, c.action
    FROM public.owner_ws_permission_catalog() c
   WHERE (p_code = 'VIEWER' AND c.action = 'view')
      OR (p_code = 'STAFF' AND (
            c.action = 'view'
         OR (c.module, c.action) IN (
              ('tai-san', 'update'),
              ('ket-qua', 'update'), ('ket-qua', 'delete'),
              ('so-hoa', 'create'), ('so-hoa', 'update'), ('so-hoa', 'share'),
              ('ky-gui', 'create'), ('ky-gui', 'update'),
              ('hop-dong-mua-ban', 'update'),
              ('thu-tien', 'create'), ('thu-tien', 'update'), ('thu-tien', 'delete'),
              ('truyen-thong', 'create'), ('truyen-thong', 'update'),
              ('bao-cao-dinh-ky', 'create'), ('bao-cao-dinh-ky', 'update'), ('bao-cao-dinh-ky', 'delete'))))
$$;

DO $$
DECLARE
  _bad TEXT;
BEGIN
  -- Bản sao client (permissions.test.ts): 48 / 32 / 15.
  IF (SELECT count(*) FROM public.owner_ws_permission_catalog()) <> 48
     OR (SELECT count(*) FROM public.owner_ws_default_role_permissions('STAFF')) <> 32
     OR (SELECT count(*) FROM public.owner_ws_default_role_permissions('VIEWER')) <> 15 THEN
    RAISE EXCEPTION 'catalog_merge self-check: catalog / mặc định lệch bản sao client (48 / 32 / 15)';
  END IF;

  -- Không còn dòng quyền "mồ côi" (đã cấp nhưng không có trong danh mục).
  SELECT string_agg(DISTINCT p.module || ':' || p.action, ', ') INTO _bad
    FROM public.owner_ws_role_permissions p
   WHERE NOT EXISTS (SELECT 1 FROM public.owner_ws_permission_catalog() c
                      WHERE c.module = p.module AND c.action = p.action);
  IF _bad IS NOT NULL THEN
    RAISE EXCEPTION 'catalog_merge self-check: quyền đã cấp nằm ngoài danh mục: %', _bad;
  END IF;
END;
$$;
