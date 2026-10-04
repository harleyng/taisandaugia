-- Nhật ký hoạt động: ghi ĐĂNG NHẬP / ĐĂNG XUẤT thật (thay cho "Truy cập" do client tự báo).
--
-- 1. Bắt ở server bằng trigger trên auth.sessions — mỗi lần đăng nhập (mật khẩu, OTP,
--    Google…) GoTrue chèn một phiên; đăng xuất xoá phiên đó. Không phụ thuộc client nên
--    không giả được, và vẫn ghi được đăng xuất dù trình duyệt đã mất phiên.
--    - action 'login'  = phiên mới;  'logout' = phiên bị xoá (meta.reason: signout | expired).
--    - Xoá phiên do xoá tài khoản (dây chuyền từ auth.users) KHÔNG ghi.
--    - entity = auth_sessions / id phiên ⇒ ghép được cặp đăng nhập ↔ đăng xuất.
--    - meta: source = 'auth', session_id, ip, user_agent, aal; đăng xuất thêm duration_seconds.
-- 2. Ghi một dòng vào MỖI Trạm người dùng đang là thành viên active, cộng tenant Cá nhân
--    nếu có (KYC chủ tài sản cá nhân đã duyệt hoặc còn hồ sơ cá nhân) — cùng luật với
--    usePersonalTenant. Người dùng không thuộc cổng chủ tài sản: không ghi gì.
-- 3. Trigger NUỐT MỌI LỖI (RAISE WARNING) — lỗi nhật ký không bao giờ được chặn đăng nhập.
-- 4. Client thôi gửi 'login' (owner_audit_track không nhận nữa). 16 dòng 'login' cũ không
--    có meta.source = 'auth' là lượt "Truy cập cổng" — UI hiển thị riêng.
-- 5. Bộ lọc nhóm thêm kind 'sessions' (login + logout); 'views' chỉ còn lượt xem trang.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Thao tác 'logout'
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.owner_audit_log DROP CONSTRAINT owner_audit_log_action_check;
ALTER TABLE public.owner_audit_log ADD CONSTRAINT owner_audit_log_action_check
  CHECK (action IN ('create', 'update', 'delete', 'view', 'login', 'logout', 'export', 'print', 'share', 'download'));

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Trigger trên auth.sessions
-- ═══════════════════════════════════════════════════════════════════════════

CREATE FUNCTION public.owner_audit_auth_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid    UUID;
  _sid    UUID;
  _action TEXT;
  _meta   JSONB;
  _prev   TEXT;
  _ws     UUID;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      _uid := NEW.user_id;
      _sid := NEW.id;
      _action := 'login';
      _meta := jsonb_build_object('ip', host(NEW.ip), 'user_agent', left(NEW.user_agent, 300), 'aal', NEW.aal::TEXT);
    ELSE
      _uid := OLD.user_id;
      _sid := OLD.id;
      _action := 'logout';
      -- Tài khoản đang bị xoá (phiên bị xoá dây chuyền): không phải đăng xuất.
      IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _uid) THEN
        RETURN NULL;
      END IF;
      _meta := jsonb_build_object(
        'ip', host(OLD.ip), 'user_agent', left(OLD.user_agent, 300), 'aal', OLD.aal::TEXT,
        'duration_seconds', GREATEST(0, extract(epoch FROM now() - OLD.created_at))::BIGINT,
        'reason', CASE WHEN OLD.not_after IS NOT NULL AND OLD.not_after <= now() THEN 'expired' ELSE 'signout' END);
    END IF;
    _meta := jsonb_strip_nulls(_meta || jsonb_build_object('source', 'auth', 'session_id', _sid));

    -- owner_audit_write lấy người làm từ auth.uid(); GoTrue không đặt claim ⇒ đặt tạm rồi trả lại.
    _prev := current_setting('request.jwt.claim.sub', true);
    PERFORM set_config('request.jwt.claim.sub', _uid::TEXT, true);

    FOR _ws IN
      SELECT DISTINCT m.workspace_id FROM public.asset_owner_workspace_members m
       WHERE m.user_id = _uid AND m.status = 'active'
    LOOP
      PERFORM public.owner_audit_write(_ws, NULL, NULL, NULL, _action, 'auth_sessions', _sid::TEXT,
                                       NULL, '{}'::JSONB, _meta, NULL);
    END LOOP;

    IF EXISTS (SELECT 1 FROM public.asset_owner_kyc k WHERE k.user_id = _uid AND k.status = 'approved')
       OR EXISTS (SELECT 1 FROM public.asset_postings p WHERE p.user_id = _uid AND p.workspace_id IS NULL) THEN
      PERFORM public.owner_audit_write(NULL, _uid, NULL, NULL, _action, 'auth_sessions', _sid::TEXT,
                                       NULL, '{}'::JSONB, _meta, NULL);
    END IF;

    PERFORM set_config('request.jwt.claim.sub', COALESCE(_prev, ''), true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'owner_audit_auth_session (%): %', TG_OP, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_audit_auth_session() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER owner_audit_auth_session
  AFTER INSERT OR DELETE ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_auth_session();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Bộ lọc nhóm: 'sessions' tách khỏi 'views' (bản LIVE 20261002120000, chỉ đổi dòng kind)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.owner_audit_rows(
  p_workspace_id UUID, p_uid UUID, p_level TEXT, p_is_owner BOOLEAN, p_scope UUID[], p_modules TEXT[], p_filters JSONB)
RETURNS SETOF public.owner_audit_log LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT l.*
    FROM public.owner_audit_log l
   WHERE (CASE
            WHEN p_level = 'personal' THEN
              l.workspace_id IS NULL AND (l.actor = p_uid OR l.subject_user_id = p_uid)
            ELSE
              l.workspace_id = p_workspace_id
              AND ((l.actor = p_uid AND p_level <> 'hq')
                OR (p_level IN ('workspace', 'branch', 'hq')
                    AND (l.module IS NULL OR l.module = ANY (p_modules))
                    AND (p_is_owner OR l.module IS NULL OR l.module NOT IN ('thanh-vien', 'vai-tro'))
                    AND (p_level <> 'branch' OR l.branch_id = ANY (p_scope))))
          END)
     AND (NULLIF(btrim(p_filters ->> 'q'), '') IS NULL
          OR l.search_text LIKE '%' || lower(extensions.unaccent(btrim(p_filters ->> 'q'))) || '%')
     AND (p_filters ->> 'kind' IS NULL OR p_filters ->> 'kind' = 'all'
          OR (p_filters ->> 'kind' = 'changes' AND l.action IN ('create', 'update', 'delete'))
          OR (p_filters ->> 'kind' = 'views' AND l.action = 'view')
          OR (p_filters ->> 'kind' = 'sessions' AND l.action IN ('login', 'logout'))
          OR (p_filters ->> 'kind' = 'events' AND l.action IN ('export', 'print', 'share', 'download')))
     AND (jsonb_typeof(p_filters -> 'modules') IS DISTINCT FROM 'array'
          OR jsonb_array_length(p_filters -> 'modules') = 0
          OR (CASE WHEN (p_filters -> 'modules') ? '_none' THEN l.module IS NULL ELSE false END)
          OR l.module IN (SELECT jsonb_array_elements_text(p_filters -> 'modules')))
     AND (jsonb_typeof(p_filters -> 'actions') IS DISTINCT FROM 'array'
          OR jsonb_array_length(p_filters -> 'actions') = 0
          OR l.action IN (SELECT jsonb_array_elements_text(p_filters -> 'actions')))
     AND (p_filters ->> 'actor' IS NULL OR l.actor = (p_filters ->> 'actor')::UUID)
     AND (p_filters ->> 'actor_kind' IS NULL OR l.actor_kind = p_filters ->> 'actor_kind')
     AND (p_filters ->> 'branch' IS NULL OR l.branch_id = (p_filters ->> 'branch')::UUID)
     AND (p_filters ->> 'from' IS NULL OR l.created_at >= (p_filters ->> 'from')::TIMESTAMPTZ)
     AND (p_filters ->> 'to' IS NULL OR l.created_at < (p_filters ->> 'to')::TIMESTAMPTZ)
     AND (p_filters ->> 'entity_type' IS NULL OR l.entity_type = p_filters ->> 'entity_type')
     AND (p_filters ->> 'entity_id' IS NULL OR l.entity_id = p_filters ->> 'entity_id')
$$;

REVOKE ALL ON FUNCTION public.owner_audit_rows(UUID, UUID, TEXT, BOOLEAN, UUID[], TEXT[], JSONB) FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. owner_audit_track thôi nhận 'login' từ client (bản LIVE 20261002120000)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.owner_audit_track(p_workspace_id uuid, p_action text, p_module text DEFAULT NULL::text, p_path text DEFAULT NULL::text, p_entity_type text DEFAULT NULL::text, p_entity_id text DEFAULT NULL::text, p_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _ws UUID := p_workspace_id;
  _ews UUID;
  _owner UUID;
  _branch UUID;
  _label TEXT;
  _found BOOLEAN := false;
  _path TEXT := left(NULLIF(btrim(p_path), ''), 300);
  _meta JSONB := CASE WHEN jsonb_typeof(p_meta) = 'object' AND length(p_meta::TEXT) <= 2000 THEN p_meta ELSE '{}'::JSONB END;
  _module TEXT := p_module;
  _etype TEXT := p_entity_type;
  _eid TEXT := left(p_entity_id, 100);
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('view', 'export', 'print', 'share', 'download') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_action');
  END IF;
  IF _module IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.owner_ws_permission_catalog() c WHERE c.module = _module) THEN
    _module := NULL;
  END IF;

  IF _etype IS NOT NULL AND _eid ~* '^[0-9a-f-]{36}$' THEN
    CASE _etype
      WHEN 'asset_postings' THEN
        SELECT p.workspace_id, p.user_id, p.branch_id, concat_ws(' · ', p.code, p.title)
          INTO _ews, _owner, _branch, _label FROM public.asset_postings p WHERE p.id = _eid::UUID;
        _found := FOUND;
      WHEN 'consignment_contracts', 'service_contracts' THEN
        EXECUTE format(
          'SELECT p.workspace_id, p.user_id, p.branch_id, concat_ws('' · '', x.code, p.code, p.title)
             FROM public.%I x JOIN public.asset_postings p ON p.id = x.asset_posting_id WHERE x.id = $1', _etype)
          INTO _ews, _owner, _branch, _label USING _eid::UUID;
        _found := _ews IS NOT NULL OR _owner IS NOT NULL;
      WHEN 'auction_sale_contracts' THEN
        SELECT p.workspace_id, p.user_id, p.branch_id, concat_ws(' · ', s.code, p.code, p.title)
          INTO _ews, _owner, _branch, _label
          FROM public.auction_sale_contracts s
          JOIN public.consignment_contracts c ON c.id = s.consignment_contract_id
          JOIN public.asset_postings p ON p.id = c.asset_posting_id
         WHERE s.id = _eid::UUID;
        _found := FOUND;
      WHEN 'owner_report_snapshots' THEN
        SELECT s.workspace_id, s.branch_id, public.owner_audit_period_label(s.period_type, s.period_start)
          INTO _ews, _branch, _label FROM public.owner_report_snapshots s WHERE s.id = _eid::UUID;
        _found := FOUND;
      WHEN 'owner_workspace_targets' THEN
        SELECT t.workspace_id, t.branch_id,
               COALESCE(NULLIF(t.name, ''), public.owner_audit_period_label(t.period_type, t.period_start))
          INTO _ews, _branch, _label FROM public.owner_workspace_targets t WHERE t.id = _eid::UUID;
        _found := FOUND;
      WHEN 'owner_ws_roles' THEN
        SELECT r.workspace_id, r.name INTO _ews, _label FROM public.owner_ws_roles r WHERE r.id = _eid::UUID;
        _found := FOUND;
      ELSE
        _found := false;
    END CASE;
  END IF;

  IF _found THEN
    -- Bản ghi thuộc Trạm khác Trạm đang chọn (mở từ link): ghi vào Trạm của bản ghi nếu đọc được.
    IF _ews IS DISTINCT FROM _ws AND (_ews IS NULL OR public.owner_ws_can(_ews, 'read')) THEN
      _ws := _ews;
    END IF;
    IF _ws IS NULL AND _owner IS DISTINCT FROM _uid THEN
      _found := false;
    END IF;
  END IF;
  IF NOT _found THEN
    _etype := NULL;
    _eid := NULL;
    _label := NULL;
    _branch := NULL;
  END IF;

  IF _ws IS NOT NULL AND NOT public.owner_ws_can(_ws, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_action = 'view' AND EXISTS (
       SELECT 1 FROM public.owner_audit_log l
        WHERE l.actor = _uid
          AND l.workspace_id IS NOT DISTINCT FROM _ws
          AND l.action = 'view'
          AND l.path IS NOT DISTINCT FROM _path
          AND l.created_at > now() - INTERVAL '10 minutes') THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;

  PERFORM public.owner_audit_write(_ws, CASE WHEN _ws IS NULL THEN _uid END, _branch, _module, p_action,
                                   _etype, _eid, _label, '{}'::JSONB, _meta, _path);
  RETURN jsonb_build_object('ok', true);
END;
$function$;

