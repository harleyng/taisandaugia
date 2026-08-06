-- Dọn bảng vai trò tổ chức CŨ sau khi đã chuyển hết sang org_roles.
--
-- Chạy RIÊNG sau khi 20260805000020_org_rbac.sql đã được kiểm chứng: mọi
-- membership đã remap role_id, mọi tổ chức đã có bộ vai trò riêng, và các policy
-- listings/organization_memberships đã viết lại theo org_has_permission().
--
-- CỐ Ý KHÔNG dùng CASCADE: nếu lệnh này lỗi nghĩa là còn thứ gì đó tham chiếu
-- organization_roles và ta CẦN biết, thay vì để một policy bị xóa âm thầm.

-- has_org_role() so khớp theo TÊN vai trò qua organization_roles — đã được thay
-- bằng org_has_permission()/org_is_owner().
DROP FUNCTION IF EXISTS public.has_org_role(uuid, uuid, text[]);

DROP TABLE public.organization_roles;
