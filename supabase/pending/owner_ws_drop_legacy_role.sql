-- Vai trò tuỳ chỉnh của Trạm Điều Hành — BƯỚC C: bỏ cột role di sản.
--
-- CHƯA ÁP. File nằm ở supabase/pending/ để `supabase db push` không tự
-- đẩy. Chỉ áp SAU KHI:
--   1. frontend dùng role_id (commit "Vai trò tuỳ chỉnh Trạm Điều Hành") đã lên
--      production (main → Vercel) — bản cũ còn đọc cột role và gọi overload p_role;
--   2. scripts/seed-owner-demo.py đã dùng role_id (đã sửa cùng commit).
-- Khi áp: đổi tên file sang timestamp mới nhất, chuyển vào supabase/migrations/,
-- chạy thử trong BEGIN … ROLLBACK, rồi áp bằng psql --single-transaction + ghi
-- schema_migrations như bước A/B (20260927170000 / 20260927170100).

LOCK TABLE public.asset_owner_workspaces,
           public.asset_owner_workspace_members,
           public.asset_owner_workspace_invites
  IN ACCESS EXCLUSIVE MODE;

-- ─── Trạm mới: seed vai trò + Trưởng đơn vị, không còn cột role ──────────────
CREATE OR REPLACE FUNCTION public.owner_ws_seed_owner_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.owner_ws_seed_default_roles(NEW.id);
  INSERT INTO public.asset_owner_workspace_members (workspace_id, user_id, role_id, status, joined_at)
  SELECT NEW.id, NEW.owner_user_id, r.id, 'active', now()
    FROM public.owner_ws_roles r
   WHERE r.workspace_id = NEW.id AND r.code = 'OWNER'
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ─── RPC trả dữ liệu không còn tier di sản ───────────────────────────────────
DROP FUNCTION public.owner_ws_list_members(UUID);
CREATE FUNCTION public.owner_ws_list_members(p_workspace_id UUID)
RETURNS TABLE (
  member_id    UUID,
  user_id      UUID,
  full_name    TEXT,
  email        TEXT,
  role_id      UUID,
  role_name    TEXT,
  is_owner     BOOLEAN,
  branch_scope UUID[],
  status       TEXT,
  joined_at    TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.user_id, p.name, p.email,
         r.id, r.name, COALESCE(r.is_system, false),
         m.branch_scope, m.status, m.joined_at
    FROM public.asset_owner_workspace_members m
    JOIN public.profiles p ON p.id = m.user_id
    LEFT JOIN public.owner_ws_roles r ON r.id = m.role_id
   WHERE m.workspace_id = p_workspace_id
     AND m.status = 'active'
     AND public.owner_ws_role(p_workspace_id) IS NOT NULL
   ORDER BY COALESCE(r.is_system, false) DESC,
            r.name,
            m.joined_at NULLS LAST,
            p.email
$$;

REVOKE ALL ON FUNCTION public.owner_ws_list_members(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_ws_list_members(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_ws_invite_preview(p_token TEXT)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object(
              'ok',             true,
              'workspace_name', w.primary_name,
              'role_name',      r.name,
              'invite_email',   i.email,
              'expired',        i.expires_at <= now(),
              'accepted',       i.accepted_at IS NOT NULL,
              'accepted_by_me', i.accepted_at IS NOT NULL
                                AND auth.uid() IS NOT NULL
                                AND i.accepted_by = auth.uid(),
              'revoked',        i.revoked_at IS NOT NULL
                                OR (i.accepted_at IS NULL AND (
                                      i.role_id IS NULL
                                   OR NOT public.owner_ws_user_has(i.workspace_id, i.invited_by, 'thanh-vien', 'create')
                                   OR NOT public.owner_ws_role_within_user(i.role_id, i.invited_by)))
            )
       FROM public.asset_owner_workspace_invites i
       JOIN public.asset_owner_workspaces w ON w.id = i.workspace_id
       LEFT JOIN public.owner_ws_roles r ON r.id = i.role_id
      WHERE i.token = p_token),
    jsonb_build_object('ok', false, 'reason', 'not_found')
  )
$$;

CREATE OR REPLACE FUNCTION public.owner_ws_set_role_permissions(p_role_id UUID, p_permissions JSONB)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid   UUID := auth.uid();
  _role  public.owner_ws_roles%ROWTYPE;
  _perms JSONB;
  _count INT;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO _role FROM public.owner_ws_roles WHERE id = p_role_id;
  IF NOT FOUND OR public.owner_ws_role(_role.workspace_id) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  PERFORM 1 FROM public.asset_owner_workspaces WHERE id = _role.workspace_id FOR UPDATE;
  IF NOT public.owner_ws_has(_role.workspace_id, 'vai-tro', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO _role FROM public.owner_ws_roles WHERE id = p_role_id FOR UPDATE;
  IF _role.is_system THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'system_role');
  END IF;

  IF p_permissions IS NULL OR jsonb_typeof(p_permissions) <> 'array'
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_permissions) e WHERE jsonb_typeof(e) <> 'object') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_permission');
  END IF;

  -- Chuẩn hoá: bỏ trùng + tự thêm 'view' của mọi module có mặt.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('module', q.module, 'action', q.action)), '[]'::jsonb)
    INTO _perms
    FROM (SELECT e ->> 'module' AS module, e ->> 'action' AS action FROM jsonb_array_elements(p_permissions) e
          UNION
          SELECT e ->> 'module', 'view' FROM jsonb_array_elements(p_permissions) e) q;

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(_perms) AS q(module TEXT, action TEXT)
     WHERE NOT EXISTS (SELECT 1 FROM public.owner_ws_permission_catalog() c
                        WHERE c.module = q.module AND c.action = q.action)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_permission');
  END IF;

  IF NOT public.owner_ws_is_owner(_role.workspace_id) THEN
    IF public.owner_ws_my_role_id(_role.workspace_id) = _role.id THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'cannot_edit_own_role');
    END IF;
    IF NOT public.owner_ws_role_within_user(_role.id, _uid)
       OR EXISTS (SELECT 1 FROM jsonb_to_recordset(_perms) AS q(module TEXT, action TEXT)
                   WHERE NOT public.owner_ws_has(_role.workspace_id, q.module, q.action)) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'exceeds_own_permissions');
    END IF;
  END IF;

  DELETE FROM public.owner_ws_role_permissions WHERE role_id = _role.id;
  INSERT INTO public.owner_ws_role_permissions (role_id, module, action)
  SELECT _role.id, q.module, q.action FROM jsonb_to_recordset(_perms) AS q(module TEXT, action TEXT);
  GET DIAGNOSTICS _count = ROW_COUNT;

  UPDATE public.owner_ws_roles SET updated_at = now() WHERE id = _role.id;

  -- Vai trò mất quyền mời ⇒ lời mời chưa dùng do người giữ vai trò này gửi hết hiệu lực.
  IF NOT _perms @> '[{"module": "thanh-vien", "action": "create"}]'::jsonb THEN
    UPDATE public.asset_owner_workspace_invites i
       SET revoked_at = now()
     WHERE i.workspace_id = _role.workspace_id
       AND i.accepted_at IS NULL AND i.revoked_at IS NULL
       AND i.invited_by IN (SELECT m.user_id FROM public.asset_owner_workspace_members m
                             WHERE m.role_id = _role.id AND m.status = 'active');
  END IF;

  RETURN jsonb_build_object('ok', true, 'count', _count);
END;
$$;

-- ─── Bỏ overload cũ nhận role dạng text ──────────────────────────────────────
DROP FUNCTION public.owner_ws_create_invite(UUID, TEXT, TEXT, UUID[]);
DROP FUNCTION public.owner_ws_update_member(UUID, TEXT, UUID[]);

-- ─── Bỏ trigger đồng bộ + cột role ───────────────────────────────────────────
DROP TRIGGER asset_owner_workspace_members_a_sync_role ON public.asset_owner_workspace_members;
DROP TRIGGER asset_owner_workspace_invites_a_sync_role ON public.asset_owner_workspace_invites;
DROP FUNCTION public.owner_ws_sync_role_columns();

ALTER TABLE public.asset_owner_workspace_members
  DROP CONSTRAINT aowm_owner_unscoped,           -- thay bằng owner_ws_members_guard (OWNER ⇒ không phạm vi)
  DROP CONSTRAINT asset_owner_workspace_members_role_check,
  DROP COLUMN role;
ALTER TABLE public.asset_owner_workspace_invites
  DROP CONSTRAINT asset_owner_workspace_invites_role_check,
  DROP COLUMN role;

DROP FUNCTION public.owner_ws_role_tier(UUID);

-- Vai trò giờ là cột bắt buộc của mọi dòng còn hiệu lực (CHECK từ bước A giữ nguyên).

-- ─── Self-check ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  _bad TEXT;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO _bad
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.prosrc ~ 'asset_owner_workspace_(members|invites)'
     AND p.prosrc ~ '(\m(m|o|i|_m|_inv|_existing|NEW|OLD)\.role\M|owner_ws_role_tier)';
  IF _bad IS NOT NULL THEN
    RAISE EXCEPTION 'self-check: còn hàm đọc cột role / tier: %', _bad;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public'
                AND table_name IN ('asset_owner_workspace_members', 'asset_owner_workspace_invites')
                AND column_name = 'role') THEN
    RAISE EXCEPTION 'self-check: cột role vẫn còn';
  END IF;
END;
$$;
