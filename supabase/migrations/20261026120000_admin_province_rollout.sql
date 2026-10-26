-- ─────────────────────────────────────────────────────────────────────────────
-- Khởi tạo tỉnh (công cụ triển khai của sàn) — Phase 9 của
-- docs/owner-auction-planning-plan.md, mục 1 và 2 của khối nhiệm vụ.
--
-- Bán cho TỈNH rồi triển khai xuống mọi xã trong một lần (hình A của A2):
--   • một Trạm `state_agency` mang `admin_unit_code` = mã tỉnh,
--   • mỗi xã / phường / đặc khu được chọn là MỘT chi nhánh mang mã xã,
--   • cán bộ xã được mời với `branch_scope = {chi nhánh của xã đó}`.
--
-- ⚠️ Vì sao chi nhánh PHẢI có `admin_unit_code`: guard `auction_plans_guard`
-- suy đơn vị hành chính của kế hoạch từ chi nhánh, nếu không có thì từ Trạm, và
-- ném "Chưa gán đơn vị hành chính cho đơn vị lập kế hoạch" khi cả hai đều rỗng.
-- Gắn mã cho chi nhánh chính là lý do tồn tại của công cụ này.
--
-- Trạm được tạo qua ĐÚNG đường của sản phẩm: ghi một hồ sơ
-- `asset_owner_org_kyc` rồi chuyển `status = 'approved'` để trigger
-- `create_workspace_on_org_approval` dựng Trạm + vai trò mặc định + thành viên
-- Trưởng đơn vị. KHÔNG tự INSERT vào `asset_owner_workspaces` — làm thế là bỏ
-- qua `owner_ws_seed_owner_member` và Trạm sẽ không có vai trò nào.
--
-- Mọi hàm ở đây là công cụ QUẢN TRỊ: cổng quyền là `admin_has_permission` trên
-- module 'goi-thue-bao' (cùng module với khu "Trạm đăng ký" — nơi danh sách Trạm
-- đang sống), KHÔNG phải quyền trong Trạm.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. MỘT CHI NHÁNH CHO MỘT ĐƠN VỊ HÀNH CHÍNH (nền tảng của tính không trùng)
-- ═════════════════════════════════════════════════════════════════════════════
-- Chạy "Khởi tạo tỉnh" hai lần KHÔNG được sinh chi nhánh trùng. Khoá ở DB chứ
-- không chỉ ở RPC: import Excel chi nhánh (BranchImportDialog) cũng đi qua đây.
-- Chỉ số BỘ PHẬN vì chi nhánh cũ (ngân hàng, AMC, làng nghề) không có mã ĐVHC.
CREATE UNIQUE INDEX IF NOT EXISTS wb_one_per_admin_unit
  ON public.workspace_branches (workspace_id, admin_unit_code)
  WHERE admin_unit_code IS NOT NULL;

COMMENT ON INDEX public.wb_one_per_admin_unit IS
  'Trong MỘT Trạm, mỗi đơn vị hành chính chỉ một chi nhánh (Phase 9) — nền tảng để "Khởi tạo tỉnh" chạy lại không sinh trùng.';

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. KHỞI TẠO TỈNH
-- ═════════════════════════════════════════════════════════════════════════════
-- `p_workspace_id` khác NULL ⇒ GẮN vào Trạm đang có (tỉnh đã tự onboard); NULL
-- ⇒ tìm theo pháp nhân "UBND <tên tỉnh>" (tên pháp nhân là UNIQUE) rồi tạo mới
-- nếu chưa có. Nhờ vậy lần chạy thứ hai dùng lại đúng Trạm cũ.
CREATE OR REPLACE FUNCTION public.admin_province_rollout(
  p_province_code TEXT,
  p_commune_codes TEXT[],
  p_owner_user_id UUID DEFAULT NULL,
  p_workspace_id  UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid      UUID := auth.uid();
  _prov     public.admin_units%ROWTYPE;
  _owner    UUID;
  _org_name TEXT;
  _entity   UUID;
  _kyc      UUID;
  _ws       UUID := p_workspace_id;
  _created  BOOLEAN := false;
  _bad      TEXT;
  _n_new    INT := 0;
  _n_total  INT;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.admin_has_permission('goi-thue-bao', 'create') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO _prov
    FROM public.admin_units
   WHERE code = p_province_code AND level = 'province' AND is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_province');
  END IF;

  IF p_commune_codes IS NULL OR array_length(p_commune_codes, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_units');
  END IF;

  -- Mọi mã phải là xã CỦA TỈNH NÀY — chọn lẫn xã tỉnh khác là lỗi dữ liệu nặng
  -- (chi nhánh sẽ mang mã ngoài tỉnh và mọi roll-up sau đó lệch).
  SELECT c INTO _bad
    FROM unnest(p_commune_codes) AS c
   WHERE NOT EXISTS (SELECT 1 FROM public.admin_units a
                      WHERE a.code = c AND a.level = 'commune'
                        AND a.parent_code = p_province_code AND a.is_active)
   LIMIT 1;
  IF _bad IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_unit', 'admin_unit_code', _bad);
  END IF;

  _owner := COALESCE(p_owner_user_id, _uid);
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _owner) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'owner_not_found');
  END IF;

  -- "Tỉnh Bắc Ninh" → "UBND tỉnh Bắc Ninh"; "Thành phố Hà Nội" → "UBND thành phố Hà Nội".
  _org_name := 'UBND ' || lower(left(_prov.name, 1)) || substr(_prov.name, 2);

  IF _ws IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.asset_owner_workspaces WHERE id = _ws) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
    END IF;
  ELSE
    SELECT id INTO _entity FROM public.asset_owners WHERE name = _org_name;
    IF _entity IS NOT NULL THEN
      SELECT id INTO _ws
        FROM public.asset_owner_workspaces
       WHERE asset_owner_id = _entity
       ORDER BY created_at
       LIMIT 1;
    END IF;
  END IF;

  IF _ws IS NULL THEN
    IF _entity IS NULL THEN
      INSERT INTO public.asset_owners (name, owner_kind)
      VALUES (_org_name, 'state_agency')
      ON CONFLICT (name) DO NOTHING
      RETURNING id INTO _entity;
      IF _entity IS NULL THEN
        SELECT id INTO _entity FROM public.asset_owners WHERE name = _org_name;
      END IF;
    END IF;

    -- draft → approved: trigger `asset_owner_org_kyc_approve` là AFTER UPDATE OF
    -- status, nên INSERT thẳng 'approved' sẽ KHÔNG dựng Trạm (bẫy đã biết).
    INSERT INTO public.asset_owner_org_kyc
      (created_by, status, org_type, org_name, kyc_scope,
       linked_asset_owner_id, head_office_province, submitted_at)
    VALUES (_owner, 'draft', 'state_agency', _org_name, 'organization',
            _entity, _prov.name, now())
    RETURNING id INTO _kyc;

    UPDATE public.asset_owner_org_kyc
       SET status = 'approved', reviewed_at = now(), reviewed_by = _uid,
           review_notes = 'Khởi tạo tỉnh bởi sàn (Phase 9)'
     WHERE id = _kyc;

    SELECT id INTO _ws FROM public.asset_owner_workspaces WHERE org_kyc_id = _kyc;
    IF _ws IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'workspace_failed');
    END IF;
    _created := true;
  END IF;

  UPDATE public.asset_owner_workspaces
     SET admin_unit_code = p_province_code
   WHERE id = _ws AND admin_unit_code IS DISTINCT FROM p_province_code;

  -- Chi nhánh = xã. `display_name` lấy tên chính thức đầy đủ ("Xã Tân Dĩnh").
  INSERT INTO public.workspace_branches (workspace_id, display_name, admin_unit_code)
  SELECT _ws, a.name, a.code
    FROM public.admin_units a
   WHERE a.code = ANY (p_commune_codes)
  ON CONFLICT (workspace_id, admin_unit_code) WHERE admin_unit_code IS NOT NULL
    DO NOTHING;
  GET DIAGNOSTICS _n_new = ROW_COUNT;

  SELECT count(*) INTO _n_total
    FROM public.workspace_branches
   WHERE workspace_id = _ws AND admin_unit_code IS NOT NULL;

  RETURN jsonb_build_object(
    'ok', true,
    'workspace_id', _ws,
    'workspace_created', _created,
    'workspace_name', (SELECT primary_name FROM public.asset_owner_workspaces WHERE id = _ws),
    'province_code', p_province_code,
    'province_name', _prov.name,
    'requested', array_length(p_commune_codes, 1),
    'branches_created', _n_new,
    'branches_total', _n_total);
END;
$$;

COMMENT ON FUNCTION public.admin_province_rollout(TEXT, TEXT[], UUID, UUID) IS
  'Khởi tạo một tỉnh (hình A): Trạm state_agency mang mã tỉnh + một chi nhánh cho mỗi xã được chọn. Chạy lại KHÔNG sinh trùng (chỉ số wb_one_per_admin_unit). Quyền: goi-thue-bao:create.';

REVOKE ALL ON FUNCTION public.admin_province_rollout(TEXT, TEXT[], UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_province_rollout(TEXT, TEXT[], UUID, UUID) TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. MỜI CÁN BỘ XÃ THEO LÔ
-- ═════════════════════════════════════════════════════════════════════════════
-- `p_rows` = [{email, admin_unit_code, role}] — role 'staff' | 'viewer' (CHECK
-- của bảng lời mời chỉ có hai giá trị đó; không mời thẳng vào Trưởng đơn vị,
-- `owner_ws_invites_guard` chặn).
--
-- KHÔNG gửi email: trả token để sàn copy link `/loi-moi-chu-tai-san/{token}` —
-- đúng cơ chế lời mời đang có (`owner_ws_create_invite`).
--
-- ⚠️ `invited_by` là TRƯỞNG ĐƠN VỊ của Trạm, không phải người quản trị sàn:
-- `owner_ws_accept_invite` kiểm `owner_ws_user_has(ws, invited_by, 'thanh-vien',
-- 'create')` lúc NHẬN lời mời, và admin sàn không phải thành viên Trạm nên lời
-- mời do chính admin đứng tên sẽ bị coi là 'revoked' khi cán bộ bấm vào link.
-- Sàn mời THAY đơn vị; không nới quyền nhận lời mời để tránh điều đó.
--
-- Chạy lại: lời mời còn hiệu lực cho cùng (Trạm, email) được DÙNG LẠI, người đã
-- là thành viên bị bỏ qua ⇒ không sinh hàng loạt lời mời rác.
CREATE OR REPLACE FUNCTION public.admin_province_bulk_invite(
  p_workspace_id UUID,
  p_rows JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid    UUID := auth.uid();
  _sender UUID;
  _r      RECORD;
  _email  TEXT;
  _branch UUID;
  _role   UUID;
  _unit   TEXT;
  _id     UUID;
  _token  TEXT;
  _out    JSONB := '[]'::JSONB;
  _n_new  INT := 0;
  _n_old  INT := 0;
  _n_bad  INT := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.admin_has_permission('goi-thue-bao', 'create') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  SELECT owner_user_id INTO _sender
    FROM public.asset_owner_workspaces WHERE id = p_workspace_id;
  IF _sender IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_rows');
  END IF;
  IF jsonb_array_length(p_rows) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_many_rows');
  END IF;

  FOR _r IN
    SELECT q.email, q.admin_unit_code, lower(COALESCE(q.role, 'staff')) AS role
      FROM jsonb_to_recordset(p_rows) AS q(email TEXT, admin_unit_code TEXT, role TEXT)
  LOOP
    _email := lower(btrim(COALESCE(_r.email, '')));
    _branch := NULL;
    _role := NULL;
    _unit := NULL;
    _id := NULL;
    _token := NULL;

    SELECT b.id, COALESCE(b.display_name, a.name)
      INTO _branch, _unit
      FROM public.workspace_branches b
      LEFT JOIN public.admin_units a ON a.code = b.admin_unit_code
     WHERE b.workspace_id = p_workspace_id
       AND b.admin_unit_code = _r.admin_unit_code;

    SELECT r.id INTO _role
      FROM public.owner_ws_roles r
     WHERE r.workspace_id = p_workspace_id
       AND r.code = CASE WHEN _r.role = 'viewer' THEN 'VIEWER' ELSE 'STAFF' END;

    IF _email = '' OR _email <> lower(btrim(_email)) OR position('@' IN _email) < 2 THEN
      _out := _out || jsonb_build_object('email', _r.email, 'admin_unit_code', _r.admin_unit_code,
                                         'status', 'invalid_email');
      _n_bad := _n_bad + 1;
      CONTINUE;
    END IF;
    IF _r.role NOT IN ('staff', 'viewer') THEN
      _out := _out || jsonb_build_object('email', _email, 'admin_unit_code', _r.admin_unit_code,
                                         'status', 'invalid_role');
      _n_bad := _n_bad + 1;
      CONTINUE;
    END IF;
    IF _branch IS NULL THEN
      _out := _out || jsonb_build_object('email', _email, 'admin_unit_code', _r.admin_unit_code,
                                         'status', 'unit_not_in_workspace');
      _n_bad := _n_bad + 1;
      CONTINUE;
    END IF;
    IF _role IS NULL THEN
      _out := _out || jsonb_build_object('email', _email, 'admin_unit_code', _r.admin_unit_code,
                                         'status', 'role_missing');
      _n_bad := _n_bad + 1;
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1
                 FROM public.asset_owner_workspace_members m
                 JOIN public.profiles p ON p.id = m.user_id
                WHERE m.workspace_id = p_workspace_id AND lower(p.email) = _email
                  AND m.status = 'active') THEN
      _out := _out || jsonb_build_object('email', _email, 'admin_unit_code', _r.admin_unit_code,
                                         'unit_name', _unit, 'status', 'already_member');
      _n_old := _n_old + 1;
      CONTINUE;
    END IF;

    SELECT i.id, i.token INTO _id, _token
      FROM public.asset_owner_workspace_invites i
     WHERE i.workspace_id = p_workspace_id AND i.email = _email
       AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
     ORDER BY i.created_at DESC
     LIMIT 1;

    IF _id IS NULL THEN
      INSERT INTO public.asset_owner_workspace_invites
        (workspace_id, email, role, role_id, branch_scope, invited_by)
      VALUES (p_workspace_id, _email, _r.role, _role, ARRAY[_branch], _sender)
      RETURNING id, token INTO _id, _token;
      _n_new := _n_new + 1;
      _out := _out || jsonb_build_object('email', _email, 'admin_unit_code', _r.admin_unit_code,
                                         'unit_name', _unit, 'role', _r.role,
                                         'invite_id', _id, 'token', _token, 'status', 'created');
    ELSE
      -- Lời mời cũ giữ nguyên vai trò / phạm vi đã gửi: đổi ngầm sau lưng người
      -- nhận là việc của trang thành viên, không phải của công cụ triển khai.
      _n_old := _n_old + 1;
      _out := _out || jsonb_build_object('email', _email, 'admin_unit_code', _r.admin_unit_code,
                                         'unit_name', _unit, 'role', _r.role,
                                         'invite_id', _id, 'token', _token, 'status', 'existing');
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'created', _n_new, 'existing', _n_old,
                            'failed', _n_bad, 'rows', _out);
END;
$$;

COMMENT ON FUNCTION public.admin_province_bulk_invite(UUID, JSONB) IS
  'Mời cán bộ xã theo lô từ CSV (email, mã xã, vai trò) — branch_scope = chi nhánh của xã đó. Trả token để copy link, KHÔNG gửi email. Quyền: goi-thue-bao:create.';

REVOKE ALL ON FUNCTION public.admin_province_bulk_invite(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_province_bulk_invite(UUID, JSONB) TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. ĐỌC CHO TRANG QUẢN TRỊ
-- ═════════════════════════════════════════════════════════════════════════════
-- Admin KHÔNG đọc được `asset_owner_workspaces` (RLS theo thành viên) ⇒ mọi
-- danh sách đi qua RPC, cùng cách `admin_owner_subscription_list` đang làm.
CREATE OR REPLACE FUNCTION public.admin_province_list()
RETURNS TABLE (
  workspace_id    UUID,
  workspace_name  TEXT,
  admin_unit_code TEXT,
  province_name   TEXT,
  owner_email     TEXT,
  is_demo         BOOLEAN,
  branch_count    INT,
  member_count    INT,
  invite_count    INT,
  plan_count      INT,
  created_at      TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT w.id, w.primary_name, w.admin_unit_code, a.name, p.email, w.is_demo,
         (SELECT count(*)::INT FROM public.workspace_branches b
           WHERE b.workspace_id = w.id AND b.admin_unit_code IS NOT NULL),
         (SELECT count(*)::INT FROM public.asset_owner_workspace_members m
           WHERE m.workspace_id = w.id AND m.status = 'active'),
         (SELECT count(*)::INT FROM public.asset_owner_workspace_invites i
           WHERE i.workspace_id = w.id AND i.accepted_at IS NULL
             AND i.revoked_at IS NULL AND i.expires_at > now()),
         (SELECT count(*)::INT FROM public.auction_plans pl WHERE pl.workspace_id = w.id),
         w.created_at
    FROM public.asset_owner_workspaces w
    JOIN public.admin_units a ON a.code = w.admin_unit_code AND a.level = 'province'
    LEFT JOIN public.profiles p ON p.id = w.owner_user_id
   WHERE public.admin_has_permission('goi-thue-bao', 'view')
   ORDER BY w.created_at DESC
$$;

COMMENT ON FUNCTION public.admin_province_list() IS
  'Các Trạm đã gắn mã TỈNH (đã khởi tạo) + số chi nhánh / thành viên / lời mời / kế hoạch. Quyền: goi-thue-bao:view.';

REVOKE ALL ON FUNCTION public.admin_province_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_province_list() TO authenticated;

-- Chi nhánh + lời mời đang chờ của MỘT tỉnh (bảng chi tiết trong trang).
CREATE OR REPLACE FUNCTION public.admin_province_units(p_workspace_id UUID)
RETURNS TABLE (
  branch_id       UUID,
  display_name    TEXT,
  admin_unit_code TEXT,
  unit_name       TEXT,
  unit_type       TEXT,
  is_active       BOOLEAN,
  member_count    INT,
  invite_count    INT,
  plan_count      INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.id, b.display_name, b.admin_unit_code, a.name, a.unit_type, b.is_active,
         (SELECT count(*)::INT FROM public.asset_owner_workspace_members m
           WHERE m.workspace_id = p_workspace_id AND m.status = 'active'
             AND m.branch_scope @> ARRAY[b.id]),
         (SELECT count(*)::INT FROM public.asset_owner_workspace_invites i
           WHERE i.workspace_id = p_workspace_id AND i.accepted_at IS NULL
             AND i.revoked_at IS NULL AND i.expires_at > now()
             AND i.branch_scope @> ARRAY[b.id]),
         (SELECT count(*)::INT FROM public.auction_plans pl WHERE pl.branch_id = b.id)
    FROM public.workspace_branches b
    LEFT JOIN public.admin_units a ON a.code = b.admin_unit_code
   WHERE b.workspace_id = p_workspace_id
     AND b.admin_unit_code IS NOT NULL
     AND public.admin_has_permission('goi-thue-bao', 'view')
   ORDER BY b.admin_unit_code
$$;

REVOKE ALL ON FUNCTION public.admin_province_units(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_province_units(UUID) TO authenticated;

-- Lời mời đang chờ của một tỉnh — để sàn copy lại link đã phát.
CREATE OR REPLACE FUNCTION public.admin_province_invites(p_workspace_id UUID)
RETURNS TABLE (
  invite_id       UUID,
  email           TEXT,
  admin_unit_code TEXT,
  unit_name       TEXT,
  role            TEXT,
  token           TEXT,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, i.email, b.admin_unit_code, COALESCE(b.display_name, a.name), i.role,
         i.token, i.expires_at, i.created_at
    FROM public.asset_owner_workspace_invites i
    LEFT JOIN public.workspace_branches b
      ON b.workspace_id = i.workspace_id AND b.id = i.branch_scope[1]
    LEFT JOIN public.admin_units a ON a.code = b.admin_unit_code
   WHERE i.workspace_id = p_workspace_id
     AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
     AND public.admin_has_permission('goi-thue-bao', 'view')
   ORDER BY i.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.admin_province_invites(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_province_invites(UUID) TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. TỰ KIỂM
-- ═════════════════════════════════════════════════════════════════════════════
DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname = 'public' AND indexname = 'wb_one_per_admin_unit') THEN
    RAISE EXCEPTION 'P9: thiếu chỉ số một-chi-nhánh-một-ĐVHC.';
  END IF;
  IF has_function_privilege('anon', 'public.admin_province_rollout(text,text[],uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_province_bulk_invite(uuid,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_province_list()', 'EXECUTE') THEN
    RAISE EXCEPTION 'P9: anon không được gọi công cụ triển khai.';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.admin_province_rollout(text,text[],uuid,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.admin_province_bulk_invite(uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'P9: admin (authenticated) phải gọi được công cụ triển khai.';
  END IF;
END;
$check$;
