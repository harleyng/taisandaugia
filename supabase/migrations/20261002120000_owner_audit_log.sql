-- Nhật ký hoạt động của Trạm Điều Hành (/chu-tai-san/nhat-ky).
--
-- 1. owner_audit_log — CHỈ GHI THÊM, giữ VĨNH VIỄN (không FK tới Trạm để xoá Trạm
--    không kéo theo nhật ký). Client không có quyền gì trên bảng: đọc qua RPC
--    owner_audit_list / owner_audit_scope, ghi lượt xem / xuất / in qua owner_audit_track.
-- 2. Thay đổi dữ liệu được bắt bằng MỘT trigger chung owner_audit_row() gắn lên các bảng
--    của cổng chủ tài sản ⇒ RPC SECURITY DEFINER cũng được ghi, không phải sửa RPC nào.
--    Trigger nuốt lỗi (RAISE WARNING) — lỗi nhật ký KHÔNG được chặn thao tác nghiệp vụ.
--    Sửa liên tiếp cùng bản ghi của cùng người trong 10 phút gộp vào một dòng (autosave
--    wizard), trừ khi đổi trạng thái.
-- 3. Bốn tầng xem (luật ở owner_audit_context, không ở client):
--      mine      — thành viên không có nhat-ky:view: chỉ thao tác của chính mình;
--      branch    — có nhat-ky:view nhưng bị giới hạn chi nhánh: dòng thuộc chi nhánh trong phạm vi;
--      workspace — có nhat-ky:view, toàn đơn vị;
--      hq        — Trưởng đơn vị trụ sở xem Trạm chi nhánh đã liên kết (chỉ đọc).
--    Mọi tầng: chỉ thấy dòng của module mình có quyền Xem; nhật ký Thành viên / Vai trò
--    chỉ Trưởng đơn vị thấy; trụ sở không thấy Thành viên / Vai trò / Liên kết.
-- 4. Danh mục quyền thêm module 'nhat-ky' (view, share = Xuất Excel). Vai trò mặc định
--    STAFF / VIEWER KHÔNG có — Trưởng đơn vị tự cấp.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Bảng
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.owner_audit_log (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- NULL = tenant Cá nhân (hồ sơ không thuộc Trạm nào); khi đó subject_user_id là chủ hồ sơ.
  workspace_id     UUID,
  subject_user_id  UUID,
  branch_id        UUID,
  actor            UUID,
  actor_kind       TEXT NOT NULL CHECK (actor_kind IN ('member', 'hq', 'platform', 'partner', 'system')),
  actor_label      TEXT NOT NULL,
  module           TEXT,
  action           TEXT NOT NULL
                   CHECK (action IN ('create', 'update', 'delete', 'view', 'login', 'export', 'print', 'share', 'download')),
  entity_type      TEXT,
  entity_id        TEXT,
  entity_label     TEXT,
  -- {cột: [trước, sau]} — tạo mới: [null, giá trị]; xoá: [giá trị, null].
  changes          JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(changes) = 'object'),
  meta             JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(meta) = 'object'),
  path             TEXT,
  -- lower(unaccent(người làm + đối tượng + đường dẫn)) — tìm không dấu.
  search_text      TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Lần sửa cuối được gộp vào dòng này (= created_at nếu không gộp).
  last_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX owner_audit_log_ws_time_idx ON public.owner_audit_log (workspace_id, created_at DESC, id DESC);
CREATE INDEX owner_audit_log_ws_actor_idx ON public.owner_audit_log (workspace_id, actor, created_at DESC);
CREATE INDEX owner_audit_log_personal_idx ON public.owner_audit_log (subject_user_id, created_at DESC)
  WHERE workspace_id IS NULL;
CREATE INDEX owner_audit_log_personal_actor_idx ON public.owner_audit_log (actor, created_at DESC)
  WHERE workspace_id IS NULL;
CREATE INDEX owner_audit_log_entity_idx ON public.owner_audit_log (entity_type, entity_id, id DESC);

COMMENT ON TABLE public.owner_audit_log IS
  'Nhật ký hoạt động Trạm Điều Hành — chỉ ghi thêm, giữ vĩnh viễn; đọc qua owner_audit_list.';

ALTER TABLE public.owner_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_audit_log FROM anon, authenticated;

-- Chỉ ghi thêm. Ngoại lệ duy nhất: owner_audit_write gộp lần sửa liên tiếp (bật cờ
-- giao dịch owner_audit.merging) — chỉ được đổi changes / meta / nhãn / last_at.
CREATE FUNCTION public.owner_audit_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND current_setting('owner_audit.merging', true) = 'on'
     AND NEW.workspace_id IS NOT DISTINCT FROM OLD.workspace_id
     AND NEW.subject_user_id IS NOT DISTINCT FROM OLD.subject_user_id
     AND NEW.actor IS NOT DISTINCT FROM OLD.actor
     AND NEW.action = OLD.action
     AND NEW.entity_type IS NOT DISTINCT FROM OLD.entity_type
     AND NEW.entity_id IS NOT DISTINCT FROM OLD.entity_id
     AND NEW.created_at = OLD.created_at THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'owner_audit_log là nhật ký chỉ ghi thêm' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER owner_audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.owner_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_immutable();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Danh mục quyền: thêm module nhat-ky (bản LIVE 20261001230000 + 2 dòng)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.owner_ws_permission_catalog()
 RETURNS TABLE(module text, action text)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
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
    ('lien-ket', 'view'), ('lien-ket', 'update'),
    ('nhat-ky', 'view'), ('nhat-ky', 'share')
$function$;

-- Vai trò mặc định không có Nhật ký (kể cả 'view' của VIEWER) — Trưởng đơn vị tự cấp.
CREATE OR REPLACE FUNCTION public.owner_ws_default_role_permissions(p_code text)
 RETURNS TABLE(module text, action text)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT c.module, c.action
    FROM public.owner_ws_permission_catalog() c
   WHERE c.module <> 'nhat-ky'
     AND ((p_code = 'VIEWER' AND c.action = 'view')
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
              ('bao-cao-dinh-ky', 'create'), ('bao-cao-dinh-ky', 'update'), ('bao-cao-dinh-ky', 'delete')))))
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Hàm phụ: lọc cột, rút gọn giá trị, diff, đổi id → tên
-- ═══════════════════════════════════════════════════════════════════════════

-- Cột không ghi vào diff: khoá / thời điểm hệ thống / bộ đếm lượt xem / bí mật (token).
-- *_by và *_id bị bỏ (người làm đã có ở actor) trừ vài id được đổi ra tên ở owner_audit_enrich.
CREATE FUNCTION public.owner_audit_skip_key(k TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT k = ANY (ARRAY[
           'id', 'created_at', 'updated_at', 'workspace_id', 'role',
           'token', 'share_token', 'scan_token', 'payment_txn_ref', 'content_hash', 'title_key',
           'view_count', 'unique_view_count', 'hit_count', 'unique_hit_count', 'last_viewed_at', 'last_hit_at',
           'cta_dossier_count', 'cta_pdf_count', 'cta_follow_count', 'cta_call_count',
           'opened_count', 'clicked_count', 'sent_count', 'seen_at',
           'confidence_score', 'match_basis', 'total_claimed', 'last_matched_at'])
      OR (k LIKE '%\_by' AND k NOT IN ('respond_by', 'expected_quote_by'))
      OR (k LIKE '%\_id'
          AND k NOT IN ('branch_id', 'role_id', 'auction_org_id', 'chosen_org_id', 'parent_workspace_id'))
$$;

CREATE FUNCTION public.owner_audit_compact(v JSONB)
RETURNS JSONB LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE
    WHEN v IS NULL OR v = 'null'::JSONB THEN NULL
    WHEN jsonb_typeof(v) = 'string' AND length(v #>> '{}') > 300 THEN to_jsonb(left(v #>> '{}', 280) || '…')
    WHEN jsonb_typeof(v) = 'array' AND length(v::TEXT) > 600 THEN to_jsonb(format('[%s mục]', jsonb_array_length(v)))
    WHEN jsonb_typeof(v) = 'object' AND length(v::TEXT) > 600 THEN to_jsonb('[dữ liệu chi tiết]'::TEXT)
    ELSE v
  END
$$;

-- {cột: [trước, sau]} của các cột đổi giá trị. Tạo mới (p_old NULL) / xoá (p_new NULL)
-- cho ra ảnh chụp các cột có giá trị.
CREATE FUNCTION public.owner_audit_diff(p_old JSONB, p_new JSONB)
RETURNS JSONB LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(d.k, jsonb_build_array(public.owner_audit_compact(d.o),
                                                          public.owner_audit_compact(d.n))), '{}'::JSONB)
    FROM (
      SELECT ks.k, p_old -> ks.k AS o, p_new -> ks.k AS n
        FROM (SELECT jsonb_object_keys(COALESCE(p_old, '{}'::JSONB)) AS k
              UNION
              SELECT jsonb_object_keys(COALESCE(p_new, '{}'::JSONB))) ks
    ) d
   WHERE NOT public.owner_audit_skip_key(d.k)
     AND d.o IS DISTINCT FROM d.n
     AND NOT (COALESCE(d.o, 'null'::JSONB) = 'null'::JSONB AND COALESCE(d.n, 'null'::JSONB) = 'null'::JSONB)
$$;

-- Đổi id trong diff ra tên đọc được (chi nhánh, vai trò, tổ chức đấu giá, Trạm cha).
CREATE FUNCTION public.owner_audit_enrich(p_changes JSONB)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _k TEXT;
  _out JSONB := p_changes;
  _pair JSONB;
  _a JSONB;
  _b JSONB;
BEGIN
  FOREACH _k IN ARRAY ARRAY['branch_id', 'role_id', 'auction_org_id', 'chosen_org_id', 'parent_workspace_id', 'branch_scope'] LOOP
    CONTINUE WHEN NOT _out ? _k;
    _pair := _out -> _k;
    IF _k = 'branch_scope' THEN
      SELECT CASE WHEN jsonb_typeof(_pair -> 0) = 'array' THEN
               (SELECT jsonb_agg(COALESCE(b.display_name, '?'))
                  FROM jsonb_array_elements_text(_pair -> 0) e
                  LEFT JOIN public.workspace_branches b ON b.id::TEXT = e) END,
             CASE WHEN jsonb_typeof(_pair -> 1) = 'array' THEN
               (SELECT jsonb_agg(COALESCE(b.display_name, '?'))
                  FROM jsonb_array_elements_text(_pair -> 1) e
                  LEFT JOIN public.workspace_branches b ON b.id::TEXT = e) END
        INTO _a, _b;
    ELSE
      SELECT to_jsonb(x.name) INTO _a FROM public.owner_audit_name_of(_k, _pair ->> 0) x;
      SELECT to_jsonb(x.name) INTO _b FROM public.owner_audit_name_of(_k, _pair ->> 1) x;
    END IF;
    _out := jsonb_set(_out, ARRAY[_k], jsonb_build_array(_a, _b));
  END LOOP;
  RETURN _out;
END;
$$;

CREATE FUNCTION public.owner_audit_name_of(p_key TEXT, p_id TEXT)
RETURNS TABLE(name TEXT) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE p_key
    WHEN 'branch_id' THEN (SELECT b.display_name FROM public.workspace_branches b WHERE b.id::TEXT = p_id)
    WHEN 'role_id' THEN (SELECT r.name FROM public.owner_ws_roles r WHERE r.id::TEXT = p_id)
    WHEN 'parent_workspace_id' THEN (SELECT w.primary_name FROM public.asset_owner_workspaces w WHERE w.id::TEXT = p_id)
    ELSE (SELECT o.name FROM public.auction_organizations o WHERE o.id::TEXT = p_id)
  END
  WHERE p_id IS NOT NULL
$$;

CREATE FUNCTION public.owner_audit_period_label(p_type TEXT, p_start DATE)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE p_type
    WHEN 'month' THEN 'Tháng ' || to_char(p_start, 'MM/YYYY')
    WHEN 'quarter' THEN 'Quý ' || extract(quarter FROM p_start)::INT || '/' || to_char(p_start, 'YYYY')
    WHEN 'year' THEN 'Năm ' || to_char(p_start, 'YYYY')
    ELSE concat_ws(' ', p_type, p_start::TEXT)
  END
$$;

-- Ai đang thao tác, so với Trạm của dòng nhật ký. Tên người ngoài Trạm (quản trị sàn,
-- nhân sự tổ chức đấu giá) KHÔNG lộ ra — chỉ ghi vai.
CREATE FUNCTION public.owner_audit_actor(p_ws UUID, p_uid UUID, p_subject UUID)
RETURNS TABLE(kind TEXT, label TEXT) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _name TEXT;
BEGIN
  IF p_uid IS NULL THEN
    RETURN QUERY SELECT 'system'::TEXT, 'Hệ thống'::TEXT;
    RETURN;
  END IF;
  SELECT COALESCE(NULLIF(btrim(p.name), ''), p.email, 'Người dùng') INTO _name FROM public.profiles p WHERE p.id = p_uid;
  _name := COALESCE(_name, 'Người dùng');

  IF p_ws IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.asset_owner_workspace_members m
        WHERE m.workspace_id = p_ws AND m.user_id = p_uid AND m.status = 'active') THEN
    RETURN QUERY SELECT 'member'::TEXT, _name;
  ELSIF p_ws IS NULL AND p_uid = p_subject THEN
    RETURN QUERY SELECT 'member'::TEXT, _name;
  ELSIF p_ws IS NOT NULL AND EXISTS (
       SELECT 1
         FROM public.asset_owner_workspaces c
         JOIN public.asset_owner_workspace_members m ON m.workspace_id = c.parent_workspace_id
         JOIN public.owner_ws_roles r ON r.id = m.role_id AND r.workspace_id = m.workspace_id
        WHERE c.id = p_ws AND m.user_id = p_uid AND m.status = 'active' AND r.is_system) THEN
    RETURN QUERY SELECT 'hq'::TEXT, _name;
  ELSIF public.has_role(p_uid, 'ADMIN') THEN
    RETURN QUERY SELECT 'platform'::TEXT, 'Quản trị sàn'::TEXT;
  ELSE
    RETURN QUERY SELECT 'partner'::TEXT, 'Đối tác'::TEXT;
  END IF;
END;
$$;

-- Gộp diff: giữ "trước" của lần đầu, "sau" của lần cuối; cột quay về giá trị cũ thì bỏ.
CREATE FUNCTION public.owner_audit_merge_changes(p_prev JSONB, p_next JSONB)
RETURNS JSONB LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(k, v), '{}'::JSONB)
    FROM (
      SELECT k,
             CASE WHEN p_prev ? k AND p_next ? k THEN jsonb_build_array(p_prev -> k -> 0, p_next -> k -> 1)
                  WHEN p_next ? k THEN p_next -> k
                  ELSE p_prev -> k END AS v
        FROM (SELECT jsonb_object_keys(p_prev) AS k UNION SELECT jsonb_object_keys(p_next)) ks
    ) m
   WHERE (v -> 0) IS DISTINCT FROM (v -> 1)
$$;

-- Ghi MỘT dòng (mọi đường ghi đều qua đây).
CREATE FUNCTION public.owner_audit_write(
  p_ws UUID, p_subject UUID, p_branch UUID, p_module TEXT, p_action TEXT,
  p_entity_type TEXT, p_entity_id TEXT, p_label TEXT, p_changes JSONB, p_meta JSONB, p_path TEXT)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _kind TEXT;
  _actor_label TEXT;
  _prev public.owner_audit_log%ROWTYPE;
  _search TEXT;
BEGIN
  SELECT a.kind, a.label INTO _kind, _actor_label FROM public.owner_audit_actor(p_ws, _uid, p_subject) a;
  _search := lower(extensions.unaccent(concat_ws(' ', _actor_label, p_label, p_path)));

  -- Gộp lần sửa liên tiếp (autosave): cùng người, cùng bản ghi, dòng mới nhất của bản
  -- ghi, trong 10 phút kể từ lần cuối và 60 phút kể từ lần đầu, không đổi trạng thái.
  IF p_action = 'update' AND _uid IS NOT NULL AND p_entity_id IS NOT NULL
     AND NOT (p_changes ? 'status' OR p_changes ? 'review_status') THEN
    SELECT * INTO _prev
      FROM public.owner_audit_log l
     WHERE l.entity_type = p_entity_type AND l.entity_id = p_entity_id
     ORDER BY l.id DESC
     LIMIT 1;
    IF FOUND AND _prev.action = 'update' AND _prev.actor = _uid
       AND _prev.workspace_id IS NOT DISTINCT FROM p_ws
       AND _prev.last_at > now() - INTERVAL '10 minutes'
       AND _prev.created_at > now() - INTERVAL '60 minutes'
       AND NOT (_prev.changes ? 'status' OR _prev.changes ? 'review_status') THEN
      PERFORM set_config('owner_audit.merging', 'on', true);
      UPDATE public.owner_audit_log
         SET changes = public.owner_audit_merge_changes(_prev.changes, COALESCE(p_changes, '{}'::JSONB)),
             meta = meta || jsonb_build_object('edits', COALESCE((meta ->> 'edits')::INT, 1) + 1),
             entity_label = COALESCE(p_label, entity_label),
             branch_id = COALESCE(p_branch, branch_id),
             search_text = _search,
             last_at = now()
       WHERE id = _prev.id;
      PERFORM set_config('owner_audit.merging', 'off', true);
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.owner_audit_log (
    workspace_id, subject_user_id, branch_id, actor, actor_kind, actor_label, module, action,
    entity_type, entity_id, entity_label, changes, meta, path, search_text)
  VALUES (
    p_ws, CASE WHEN p_ws IS NULL THEN p_subject END, p_branch, _uid, _kind, _actor_label, p_module, p_action,
    p_entity_type, p_entity_id, left(p_label, 300), COALESCE(p_changes, '{}'::JSONB), COALESCE(p_meta, '{}'::JSONB),
    left(p_path, 300), _search);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Trigger bắt thay đổi
-- ═══════════════════════════════════════════════════════════════════════════

-- Quyền của vai trò bị owner_ws_set_role_permissions xoá hết rồi chèn lại ⇒ không ghi
-- từng dòng. Trigger mức câu lệnh nhớ bộ quyền "trước" (biến giao dịch), và dòng nhật ký
-- được ghi khi RPC chạm owner_ws_roles.updated_at — kèm quyền thêm / gỡ.
CREATE FUNCTION public.owner_audit_perm_before_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _stash JSONB := COALESCE(NULLIF(current_setting('owner_audit.perm_before', true), ''), '{}')::JSONB;
  _rec RECORD;
BEGIN
  FOR _rec IN
    SELECT o.role_id, jsonb_agg(o.module || ':' || o.action ORDER BY o.module, o.action) AS perms
      FROM old_rows o GROUP BY o.role_id
  LOOP
    IF NOT _stash ? _rec.role_id::TEXT THEN
      _stash := _stash || jsonb_build_object(_rec.role_id::TEXT, _rec.perms);
    END IF;
  END LOOP;
  PERFORM set_config('owner_audit.perm_before', _stash::TEXT, true);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'owner_audit_perm_before_delete: %', SQLERRM;
  RETURN NULL;
END;
$$;

-- Vai trò chưa có quyền nào (không có dòng để xoá): "trước" = hiện tại trừ dòng vừa chèn.
CREATE FUNCTION public.owner_audit_perm_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _stash JSONB := COALESCE(NULLIF(current_setting('owner_audit.perm_before', true), ''), '{}')::JSONB;
  _rec RECORD;
BEGIN
  FOR _rec IN
    SELECT n.role_id,
           COALESCE((SELECT jsonb_agg(p.module || ':' || p.action ORDER BY p.module, p.action)
                       FROM public.owner_ws_role_permissions p
                      WHERE p.role_id = n.role_id
                        AND NOT EXISTS (SELECT 1 FROM new_rows x
                                         WHERE x.role_id = p.role_id AND x.module = p.module AND x.action = p.action)),
                    '[]'::JSONB) AS perms
      FROM (SELECT DISTINCT role_id FROM new_rows) n
  LOOP
    IF NOT _stash ? _rec.role_id::TEXT THEN
      _stash := _stash || jsonb_build_object(_rec.role_id::TEXT, _rec.perms);
    END IF;
  END LOOP;
  PERFORM set_config('owner_audit.perm_before', _stash::TEXT, true);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'owner_audit_perm_before_insert: %', SQLERRM;
  RETURN NULL;
END;
$$;

CREATE FUNCTION public.owner_audit_take_perm_change(p_role_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _stash JSONB := COALESCE(NULLIF(current_setting('owner_audit.perm_before', true), ''), '{}')::JSONB;
  _before JSONB;
  _after JSONB;
  _added JSONB;
  _removed JSONB;
  _out JSONB := '{}'::JSONB;
BEGIN
  IF NOT _stash ? p_role_id::TEXT THEN
    RETURN _out;
  END IF;
  _before := _stash -> p_role_id::TEXT;
  PERFORM set_config('owner_audit.perm_before', (_stash - p_role_id::TEXT)::TEXT, true);
  SELECT COALESCE(jsonb_agg(p.module || ':' || p.action ORDER BY p.module, p.action), '[]'::JSONB)
    INTO _after FROM public.owner_ws_role_permissions p WHERE p.role_id = p_role_id;
  SELECT jsonb_agg(x ORDER BY x) INTO _added FROM jsonb_array_elements_text(_after) x WHERE NOT _before ? x;
  SELECT jsonb_agg(x ORDER BY x) INTO _removed FROM jsonb_array_elements_text(_before) x WHERE NOT _after ? x;
  IF _added IS NOT NULL THEN
    _out := _out || jsonb_build_object('permissions_added', jsonb_build_array(NULL, _added));
  END IF;
  IF _removed IS NOT NULL THEN
    _out := _out || jsonb_build_object('permissions_removed', jsonb_build_array(_removed, NULL));
  END IF;
  RETURN _out;
END;
$$;

-- Sàn khớp tài sản về đơn vị (run_workspace_match) chèn hàng loạt claim ⇒ một dòng /
-- (Trạm, chi nhánh) cho mỗi lần chạy thay vì một dòng / tài sản.
CREATE FUNCTION public.owner_audit_claims_inserted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _rec RECORD;
BEGIN
  FOR _rec IN
    SELECT n.workspace_id, b.id AS branch_id, count(*) AS n
      FROM new_rows n
      LEFT JOIN LATERAL (SELECT wb.id FROM public.workspace_branches wb
                          WHERE wb.workspace_id = n.workspace_id AND wb.asset_owner_id = n.asset_owner_id
                          LIMIT 1) b ON true
     GROUP BY n.workspace_id, b.id
  LOOP
    PERFORM public.owner_audit_write(
      _rec.workspace_id, NULL, _rec.branch_id, 'tai-san', 'create', 'asset_owner_claims', NULL,
      format('%s tài sản khớp về đơn vị', _rec.n),
      jsonb_build_object('count', jsonb_build_array(NULL, _rec.n)), jsonb_build_object('count', _rec.n), NULL);
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'owner_audit_claims_inserted: %', SQLERRM;
  RETURN NULL;
END;
$$;

-- Trigger dòng chung. TG_ARGV[0] = module ('' = không thuộc module nào, vd. Gói dịch vụ).
CREATE FUNCTION public.owner_audit_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _module  TEXT := NULLIF(TG_ARGV[0], '');
  _new     JSONB;
  _old     JSONB;
  _r       JSONB;
  _action  TEXT := CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END;
  _changes JSONB;
  _ws      UUID;
  _subject UUID;
  _branch  UUID;
  _label   TEXT;
  _eid     TEXT;
  _meta    JSONB := '{}'::JSONB;
  _pid     UUID;
  _name    TEXT;
  _name2   TEXT;
BEGIN
  IF TG_OP <> 'DELETE' THEN _new := to_jsonb(NEW); END IF;
  IF TG_OP <> 'INSERT' THEN _old := to_jsonb(OLD); END IF;
  _r := COALESCE(_new, _old);
  _eid := _r ->> 'id';

  _changes := public.owner_audit_diff(_old, _new);
  IF TG_TABLE_NAME = 'owner_ws_roles' AND TG_OP = 'UPDATE' THEN
    _changes := _changes || public.owner_audit_take_perm_change((_r ->> 'id')::UUID);
  END IF;
  IF TG_OP = 'UPDATE' AND _changes = '{}'::JSONB THEN
    RETURN NULL;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'asset_postings' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _subject := (_r ->> 'user_id')::UUID;
      _branch := (_r ->> 'branch_id')::UUID;
      _label := concat_ws(' · ', _r ->> 'code', _r ->> 'title');
      _meta := jsonb_build_object('posting_id', _eid);

    WHEN 'asset_posting_dossier_items', 'posting_share_links', 'craft_village_publications', 'asset_3d_scans',
         'asset_vr_tour_orders', 'asset_authentication_orders', 'asset_legal_consultations',
         'asset_auction_consultations', 'service_contracts', 'asset_service_requests',
         'asset_broker_requests', 'consignment_contracts' THEN
      _pid := COALESCE(_r ->> 'asset_posting_id', _r ->> 'posting_id')::UUID;
      SELECT p.workspace_id, p.user_id, p.branch_id, concat_ws(' · ', p.code, p.title)
        INTO _ws, _subject, _branch, _label
        FROM public.asset_postings p WHERE p.id = _pid;
      -- Hồ sơ cha đã bị xoá (xoá dây chuyền): dòng xoá hồ sơ đã đủ.
      IF NOT FOUND THEN RETURN NULL; END IF;
      IF _r ->> 'code' IS NOT NULL THEN
        _label := concat_ws(' · ', _r ->> 'code', _label);
      END IF;
      IF TG_TABLE_NAME = 'asset_service_requests' THEN
        SELECT o.name INTO _name FROM public.auction_organizations o WHERE o.id = (_r ->> 'auction_org_id')::UUID;
        IF _name IS NOT NULL THEN _label := _label || ' — ' || _name; END IF;
      END IF;
      IF TG_TABLE_NAME = 'craft_village_publications' THEN _eid := _pid::TEXT; END IF;
      _meta := jsonb_build_object('posting_id', _pid);

    WHEN 'auction_sale_contracts' THEN
      SELECT p.workspace_id, p.user_id, p.branch_id, concat_ws(' · ', p.code, p.title), p.id
        INTO _ws, _subject, _branch, _label, _pid
        FROM public.consignment_contracts c
        JOIN public.asset_postings p ON p.id = c.asset_posting_id
       WHERE c.id = (_r ->> 'consignment_contract_id')::UUID;
      IF NOT FOUND THEN RETURN NULL; END IF;
      _label := concat_ws(' · ', _r ->> 'code', _label);
      _meta := jsonb_build_object('posting_id', _pid);

    WHEN 'asset_owner_claims' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      SELECT b.id INTO _branch FROM public.workspace_branches b
       WHERE b.workspace_id = _ws AND b.asset_owner_id = (_r ->> 'asset_owner_id')::UUID LIMIT 1;
      SELECT l.title INTO _label FROM public.listings l WHERE l.id = (_r ->> 'listing_id')::UUID;
      _label := COALESCE(_label, _r ->> 'matched_name');
      _meta := jsonb_build_object('listing_id', _r ->> 'listing_id');

    WHEN 'owner_asset_outcomes' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _branch := (_r ->> 'branch_id')::UUID;
      _label := _r ->> 'asset_title';
      _meta := jsonb_strip_nulls(jsonb_build_object('posting_id', _r ->> 'asset_posting_id', 'listing_id', _r ->> 'listing_id'));

    WHEN 'owner_cash_events' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      SELECT o.branch_id, o.asset_title INTO _branch, _label
        FROM public.owner_asset_outcomes o WHERE o.id = (_r ->> 'outcome_id')::UUID;
      IF NOT FOUND AND TG_OP = 'DELETE' THEN RETURN NULL; END IF;
      _meta := jsonb_build_object('outcome_id', _r ->> 'outcome_id');

    WHEN 'owner_mkt_campaigns' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _branch := (_r ->> 'branch_id')::UUID;
      _label := _r ->> 'name';

    WHEN 'owner_mkt_links' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _branch := (_r ->> 'branch_id')::UUID;
      _label := COALESCE(NULLIF(_r ->> 'label', ''), _r ->> 'code');

    WHEN 'owner_report_snapshots' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _branch := (_r ->> 'branch_id')::UUID;
      _label := public.owner_audit_period_label(_r ->> 'period_type', (_r ->> 'period_start')::DATE);

    WHEN 'owner_workspace_targets' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _branch := (_r ->> 'branch_id')::UUID;
      _label := COALESCE(NULLIF(_r ->> 'name', ''),
                         public.owner_audit_period_label(_r ->> 'period_type', (_r ->> 'period_start')::DATE));

    WHEN 'owner_workspace_target_criteria' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      SELECT t.branch_id, COALESCE(NULLIF(t.name, ''), public.owner_audit_period_label(t.period_type, t.period_start))
        INTO _branch, _label
        FROM public.owner_workspace_targets t WHERE t.id = (_r ->> 'target_id')::UUID;
      IF NOT FOUND THEN RETURN NULL; END IF;
      _meta := jsonb_build_object('target_id', _r ->> 'target_id');

    WHEN 'workspace_branches' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _branch := (_r ->> 'id')::UUID;
      _label := _r ->> 'display_name';

    WHEN 'asset_owner_workspaces' THEN
      _ws := (_r ->> 'id')::UUID;
      _label := _r ->> 'primary_name';
      IF _changes ? 'parent_workspace_id' OR _changes ? 'parent_linked_at' THEN
        _module := 'lien-ket';
      END IF;

    WHEN 'asset_owner_workspace_members' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      SELECT COALESCE(NULLIF(btrim(p.name), ''), p.email) INTO _label
        FROM public.profiles p WHERE p.id = (_r ->> 'user_id')::UUID;

    WHEN 'asset_owner_workspace_invites' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _label := _r ->> 'email';

    WHEN 'owner_ws_roles' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _label := _r ->> 'name';

    WHEN 'owner_subscriptions' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _label := concat_ws(' · ', _r ->> 'code', _r ->> 'plan_name');

    WHEN 'owner_workspace_link_requests' THEN
      -- Ghi vào CẢ HAI Trạm.
      SELECT w.primary_name INTO _name FROM public.asset_owner_workspaces w WHERE w.id = (_r ->> 'parent_workspace_id')::UUID;
      SELECT w.primary_name INTO _name2 FROM public.asset_owner_workspaces w WHERE w.id = (_r ->> 'child_workspace_id')::UUID;
      _label := concat_ws(' ↔ ', _name, _name2);
      _changes := public.owner_audit_enrich(_changes);
      PERFORM public.owner_audit_write((_r ->> 'parent_workspace_id')::UUID, NULL, NULL, 'lien-ket', _action,
                                       TG_TABLE_NAME, _eid, _label, _changes, '{}'::JSONB, NULL);
      PERFORM public.owner_audit_write((_r ->> 'child_workspace_id')::UUID, NULL, NULL, 'lien-ket', _action,
                                       TG_TABLE_NAME, _eid, _label, _changes, '{}'::JSONB, NULL);
      RETURN NULL;

    ELSE
      RETURN NULL;
  END CASE;

  IF _ws IS NULL AND _subject IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM public.owner_audit_write(_ws, _subject, _branch, _module, _action, TG_TABLE_NAME, _eid, _label,
                                   public.owner_audit_enrich(_changes), _meta, NULL);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'owner_audit_row(%): %', TG_TABLE_NAME, SQLERRM;
  RETURN NULL;
END;
$$;

-- Gắn trigger. Module theo danh mục quyền (permissions.ts).
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.asset_postings
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('so-hoa');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.asset_posting_dossier_items
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('so-hoa');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.posting_share_links
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('so-hoa');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.craft_village_publications
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('so-hoa');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.asset_3d_scans
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('so-hoa');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.asset_vr_tour_orders
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('so-hoa');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.asset_authentication_orders
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('so-hoa');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.asset_legal_consultations
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('so-hoa');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.asset_auction_consultations
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('so-hoa');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.service_contracts
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('so-hoa');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.asset_service_requests
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('ky-gui');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.asset_broker_requests
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('ky-gui');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.consignment_contracts
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('ky-gui');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.auction_sale_contracts
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('hop-dong-mua-ban');
CREATE TRIGGER owner_audit AFTER UPDATE OR DELETE ON public.asset_owner_claims
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('tai-san');
CREATE TRIGGER owner_audit_bulk AFTER INSERT ON public.asset_owner_claims
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.owner_audit_claims_inserted();
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.owner_asset_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('ket-qua');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.owner_cash_events
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('thu-tien');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.owner_mkt_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('truyen-thong');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.owner_mkt_links
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('truyen-thong');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.owner_report_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('bao-cao-dinh-ky');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.owner_workspace_targets
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('chi-tieu');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.owner_workspace_target_criteria
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('chi-tieu');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.workspace_branches
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('chi-nhanh');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.asset_owner_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('chi-nhanh');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.asset_owner_workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('thanh-vien');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.asset_owner_workspace_invites
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('thanh-vien');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.owner_ws_roles
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('vai-tro');
CREATE TRIGGER owner_audit_perm_delete AFTER DELETE ON public.owner_ws_role_permissions
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.owner_audit_perm_before_delete();
CREATE TRIGGER owner_audit_perm_insert AFTER INSERT ON public.owner_ws_role_permissions
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.owner_audit_perm_before_insert();
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.owner_workspace_link_requests
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('lien-ket');
CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.owner_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('');

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Tầng xem + RPC đọc
-- ═══════════════════════════════════════════════════════════════════════════

-- Ngữ cảnh xem của người gọi trên một Trạm (NULL = tenant Cá nhân). Không trả dòng = không được xem.
CREATE FUNCTION public.owner_audit_context(p_workspace_id UUID)
RETURNS TABLE(level TEXT, is_owner BOOLEAN, can_export BOOLEAN, scope UUID[], modules TEXT[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _scope UUID[];
  _sys BOOLEAN;
  _role UUID;
  _view BOOLEAN;
  _share BOOLEAN;
  _modules TEXT[];
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;
  IF p_workspace_id IS NULL THEN
    RETURN QUERY SELECT 'personal'::TEXT, true, true, NULL::UUID[], NULL::TEXT[];
    RETURN;
  END IF;

  SELECT m.branch_scope, r.is_system, r.id INTO _scope, _sys, _role
    FROM public.asset_owner_workspace_members m
    JOIN public.owner_ws_roles r ON r.id = m.role_id AND r.workspace_id = m.workspace_id
   WHERE m.workspace_id = p_workspace_id AND m.user_id = _uid AND m.status = 'active';

  IF FOUND THEN
    IF _sys THEN
      _view := true;
      _share := true;
      SELECT array_agg(DISTINCT c.module) INTO _modules FROM public.owner_ws_permission_catalog() c;
    ELSE
      _view := EXISTS (SELECT 1 FROM public.owner_ws_role_permissions p
                        WHERE p.role_id = _role AND p.module = 'nhat-ky' AND p.action = 'view');
      _share := _view AND EXISTS (SELECT 1 FROM public.owner_ws_role_permissions p
                                   WHERE p.role_id = _role AND p.module = 'nhat-ky' AND p.action = 'share');
      SELECT COALESCE(array_agg(p.module), '{}') INTO _modules
        FROM public.owner_ws_role_permissions p WHERE p.role_id = _role AND p.action = 'view';
    END IF;
    RETURN QUERY SELECT
      CASE WHEN NOT _view THEN 'mine' WHEN NOT _sys AND _scope IS NOT NULL THEN 'branch' ELSE 'workspace' END,
      _sys, _share, CASE WHEN _sys THEN NULL ELSE _scope END, _modules;
    RETURN;
  END IF;

  -- Trưởng đơn vị trụ sở xem Trạm chi nhánh đã liên kết.
  IF EXISTS (
    SELECT 1
      FROM public.asset_owner_workspaces c
      JOIN public.asset_owner_workspace_members m ON m.workspace_id = c.parent_workspace_id
      JOIN public.owner_ws_roles r ON r.id = m.role_id AND r.workspace_id = m.workspace_id
     WHERE c.id = p_workspace_id AND m.user_id = _uid AND m.status = 'active' AND r.is_system) THEN
    RETURN QUERY SELECT 'hq'::TEXT, false, false, NULL::UUID[],
      ARRAY(SELECT DISTINCT c.module FROM public.owner_ws_permission_catalog() c
             WHERE c.module NOT IN ('thanh-vien', 'vai-tro', 'lien-ket'));
  END IF;
END;
$$;

-- Các dòng người gọi được xem + bộ lọc. Hàm nội bộ (INVOKER, không cấp cho client):
-- chỉ owner_audit_list / owner_audit_scope gọi, sau khi đã tính ngữ cảnh.
-- p_filters: q, kind (changes|views|events), modules[], actions[], actor, actor_kind,
--            branch, from, to (timestamptz), entity_type, entity_id.
CREATE FUNCTION public.owner_audit_rows(
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
          OR (p_filters ->> 'kind' = 'views' AND l.action IN ('view', 'login'))
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

-- Một trang nhật ký. total đếm tới 10,001 (total_capped = true nếu vượt 10,000).
CREATE FUNCTION public.owner_audit_list(
  p_workspace_id UUID, p_filters JSONB DEFAULT '{}'::JSONB, p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _ctx RECORD;
  _filters JSONB := COALESCE(p_filters, '{}'::JSONB);
  _limit INT := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 5000);
  _offset INT := GREATEST(COALESCE(p_offset, 0), 0);
  _total INT;
  _rows JSONB;
BEGIN
  SELECT * INTO _ctx FROM public.owner_audit_context(p_workspace_id);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF jsonb_typeof(_filters) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_filters');
  END IF;

  SELECT count(*) INTO _total
    FROM (SELECT 1 FROM public.owner_audit_rows(p_workspace_id, _uid, _ctx.level, _ctx.is_owner, _ctx.scope,
                                                _ctx.modules, _filters) LIMIT 10001) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'created_at', r.created_at,
           'last_at', r.last_at,
           'actor', CASE WHEN r.actor_kind IN ('member', 'hq') THEN r.actor END,
           'actor_kind', r.actor_kind,
           'actor_label', r.actor_label,
           'module', r.module,
           'action', r.action,
           'entity_type', r.entity_type,
           'entity_id', r.entity_id,
           'entity_label', r.entity_label,
           'branch_id', r.branch_id,
           'branch_name', (SELECT b.display_name FROM public.workspace_branches b WHERE b.id = r.branch_id),
           'changes', r.changes,
           'meta', r.meta,
           'path', r.path) ORDER BY r.created_at DESC, r.id DESC), '[]'::JSONB)
    INTO _rows
    FROM (SELECT * FROM public.owner_audit_rows(p_workspace_id, _uid, _ctx.level, _ctx.is_owner, _ctx.scope,
                                                _ctx.modules, _filters)
           ORDER BY created_at DESC, id DESC
           LIMIT _limit OFFSET _offset) r;

  RETURN jsonb_build_object('ok', true, 'level', _ctx.level, 'total', LEAST(_total, 10000),
                            'total_capped', _total > 10000, 'rows', _rows);
END;
$$;

-- Ngữ cảnh cho thanh lọc: tầng xem, quyền xuất, chi nhánh và người thao tác chọn được.
CREATE FUNCTION public.owner_audit_scope(p_workspace_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _ctx RECORD;
  _branches JSONB := '[]'::JSONB;
  _actors JSONB := '[]'::JSONB;
BEGIN
  SELECT * INTO _ctx FROM public.owner_audit_context(p_workspace_id);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF _ctx.level IN ('workspace', 'branch', 'hq') THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.display_name) ORDER BY b.display_name), '[]'::JSONB)
      INTO _branches
      FROM public.workspace_branches b
     WHERE b.workspace_id = p_workspace_id
       AND (_ctx.level <> 'branch' OR b.id = ANY (_ctx.scope));

    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', a.actor, 'label', a.actor_label) ORDER BY a.actor_label), '[]'::JSONB)
      INTO _actors
      FROM (SELECT DISTINCT ON (l.actor) l.actor, l.actor_label
              FROM public.owner_audit_rows(p_workspace_id, _uid, _ctx.level, _ctx.is_owner, _ctx.scope,
                                           _ctx.modules, '{}'::JSONB) l
             WHERE l.actor_kind IN ('member', 'hq') AND l.actor IS NOT NULL
             ORDER BY l.actor, l.created_at DESC
             LIMIT 300) a;
  END IF;

  RETURN jsonb_build_object('ok', true, 'level', _ctx.level, 'is_owner', _ctx.is_owner,
                            'can_export', _ctx.can_export, 'modules', to_jsonb(_ctx.modules),
                            'branches', _branches, 'actors', _actors);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Ghi lượt xem / truy cập / xuất / in / chia sẻ / tải từ client
-- ═══════════════════════════════════════════════════════════════════════════

-- Đối tượng do server tra (nhãn + Trạm + chi nhánh) — client chỉ gửi loại + id.
-- Lượt xem cùng đường dẫn trong 10 phút và lượt truy cập trong 30 phút không ghi lại.
CREATE FUNCTION public.owner_audit_track(
  p_workspace_id UUID, p_action TEXT, p_module TEXT DEFAULT NULL, p_path TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL, p_entity_id TEXT DEFAULT NULL, p_meta JSONB DEFAULT '{}'::JSONB)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
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
  IF p_action IS NULL OR p_action NOT IN ('view', 'login', 'export', 'print', 'share', 'download') THEN
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

  IF p_action IN ('view', 'login') AND EXISTS (
       SELECT 1 FROM public.owner_audit_log l
        WHERE l.actor = _uid
          AND l.workspace_id IS NOT DISTINCT FROM _ws
          AND l.action = p_action
          AND (p_action = 'login' OR l.path IS NOT DISTINCT FROM _path)
          AND l.created_at > now() - CASE WHEN p_action = 'login' THEN INTERVAL '30 minutes' ELSE INTERVAL '10 minutes' END) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;

  PERFORM public.owner_audit_write(_ws, CASE WHEN _ws IS NULL THEN _uid END, _branch, _module, p_action,
                                   _etype, _eid, _label, '{}'::JSONB, _meta, _path);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Hàm nội bộ: không gọi được từ client.
REVOKE ALL ON FUNCTION public.owner_audit_write(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_audit_actor(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_audit_enrich(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_audit_name_of(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_audit_take_perm_change(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_audit_context(UUID) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.owner_audit_list(UUID, JSONB, INT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_audit_scope(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_audit_track(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_audit_list(UUID, JSONB, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_audit_scope(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_audit_track(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
