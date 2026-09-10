-- Cấp `yeu-cau-ky-gui`.view cho vai trò Nhân viên (AGENT) đã tồn tại.
--
-- 20260906100001 backfill cho MANAGER và đưa AGENT vào preset của
-- org_seed_default_roles, nhưng KHÔNG backfill AGENT đang có. Hệ quả: tổ chức
-- tạo sau thì Nhân viên thấy mục "Yêu cầu ký gửi", tổ chức tạo trước thì không —
-- cùng một vai trò hệ thống, hai hành vi khác nhau.
--
-- OWNER không cần dòng nào: org_has_permission() cho OWNER toàn quyền theo
-- r.code, và client đi tắt qua fullOrgMatrix().

INSERT INTO public.org_role_permissions (role_id, module, action)
SELECT r.id, 'yeu-cau-ky-gui', 'view'
FROM public.org_roles r
WHERE r.code = 'AGENT'
ON CONFLICT (role_id, module, action) DO NOTHING;
