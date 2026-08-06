-- Tách "Hồ sơ nhân sự" thành mục cấp cao riêng ⇒ cần mã quyền riêng `nhan-su`.
--
-- Trước đây màn này dùng chung mã `nl-dau-gia-vien` với mục Đấu giá viên. Khi đã
-- là menu độc lập thì phải cấp phát độc lập được.
--
-- BẢO TOÀN HÀNH VI là ràng buộc chính: ai đang xem được màn nhân sự thì sau
-- migration vẫn phải xem được, nếu không họ đột ngột mất mục menu.
--   • (nl-dau-gia-vien, view)   → (nhan-su, view)
--   • (nl-dau-gia-vien, view)   → (nhan-su, export)  ← nút "Xuất hồ sơ" trước đây
--     chỉ cần quyền XEM là bấm được, nên không cấp export = làm mất tính năng.
--     Lưu ý: xuất hồ sơ CÓ TRỪ CREDIT — muốn siết lại thì bỏ tick ở màn Vai trò.
--   • (nl-dau-gia-vien, update) → (nhan-su, update)
-- KHÔNG map create/delete: thêm/xóa người vẫn thuộc màn Đấu giá viên.

INSERT INTO public.org_role_permissions (role_id, module, action)
SELECT p.role_id, 'nhan-su', v.action
FROM public.org_role_permissions p
JOIN (VALUES
  ('view',   'view'),
  ('view',   'export'),
  ('update', 'update')
) AS v(src_action, action) ON v.src_action = p.action
WHERE p.module = 'nl-dau-gia-vien'
ON CONFLICT (role_id, module, action) DO NOTHING;

-- Tổ chức tạo MỚI cũng phải có preset tương ứng.
CREATE OR REPLACE FUNCTION public.org_seed_default_roles(_org_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _owner_role_id UUID;
BEGIN
  INSERT INTO public.org_roles (organization_id, name, code, description, is_system)
  VALUES (_org_id, 'Chủ sở hữu', 'OWNER', 'Toàn quyền trong tổ chức. Không thể xóa.', true)
  ON CONFLICT (organization_id, code) DO UPDATE SET updated_at = now()
  RETURNING id INTO _owner_role_id;

  INSERT INTO public.org_roles (organization_id, name, code, description, is_system) VALUES
    (_org_id, 'Quản lý',   'MANAGER', 'Quản lý hồ sơ năng lực, hồ sơ dự tuyển và thành viên.', false),
    (_org_id, 'Nhân viên', 'AGENT',   'Xem hồ sơ và lập hồ sơ dự tuyển.', false)
  ON CONFLICT (organization_id, code) DO NOTHING;

  INSERT INTO public.org_role_permissions (role_id, module, action)
  SELECT r.id, v.module, v.action
  FROM public.org_roles r
  JOIN (VALUES
    ('MANAGER','tong-quan','view'),
    ('MANAGER','nl-thong-tin-chung','view'),   ('MANAGER','nl-thong-tin-chung','update'),
    ('MANAGER','nl-dau-gia-vien','view'),      ('MANAGER','nl-dau-gia-vien','create'),
    ('MANAGER','nl-dau-gia-vien','update'),    ('MANAGER','nl-dau-gia-vien','delete'),
    ('MANAGER','nhan-su','view'),              ('MANAGER','nhan-su','update'),
    ('MANAGER','nhan-su','export'),
    ('MANAGER','nl-co-so-vat-chat','view'),    ('MANAGER','nl-co-so-vat-chat','create'),
    ('MANAGER','nl-co-so-vat-chat','update'),  ('MANAGER','nl-co-so-vat-chat','delete'),
    ('MANAGER','nl-lich-su-dau-gia','view'),   ('MANAGER','nl-lich-su-dau-gia','create'),
    ('MANAGER','nl-lich-su-dau-gia','update'), ('MANAGER','nl-lich-su-dau-gia','delete'),
    ('MANAGER','nl-lich-su-dau-gia','export'),
    ('MANAGER','nl-tai-chinh','view'),         ('MANAGER','nl-tai-chinh','update'),
    ('MANAGER','ho-so-du-tuyen','view'),       ('MANAGER','ho-so-du-tuyen','create'),
    ('MANAGER','ho-so-du-tuyen','update'),     ('MANAGER','ho-so-du-tuyen','delete'),
    ('MANAGER','ho-so-du-tuyen','export'),
    ('MANAGER','tin-dang','view'),             ('MANAGER','tin-dang','create'),
    ('MANAGER','tin-dang','update'),           ('MANAGER','tin-dang','delete'),
    ('MANAGER','thanh-vien','view'),           ('MANAGER','thanh-vien','create'),
    ('MANAGER','credit','view'),
    ('AGENT','tong-quan','view'),
    ('AGENT','nl-thong-tin-chung','view'),     ('AGENT','nl-dau-gia-vien','view'),
    ('AGENT','nhan-su','view'),                ('AGENT','nhan-su','export'),
    ('AGENT','nl-co-so-vat-chat','view'),      ('AGENT','nl-lich-su-dau-gia','view'),
    ('AGENT','nl-tai-chinh','view'),
    ('AGENT','ho-so-du-tuyen','view'),         ('AGENT','ho-so-du-tuyen','create'),
    ('AGENT','tin-dang','view'),               ('AGENT','tin-dang','create')
  ) AS v(code, module, action) ON v.code = r.code
  WHERE r.organization_id = _org_id
  ON CONFLICT (role_id, module, action) DO NOTHING;

  RETURN _owner_role_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.org_seed_default_roles(UUID) TO authenticated;
