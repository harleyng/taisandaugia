-- Truyền thông của chủ tài sản — Phase M1 (docs/owner-marketing-plan.md).
--
--   1. Module quyền 'truyen-thong' (nhóm Tác nghiệp) vào danh mục Trạm Điều Hành:
--      view / create / update / delete / finalize (= Duyệt) / share (= Gửi / xuất).
--      Seed theo B7: OWNER tự có (vai trò hệ thống); STAFF = view/create/update;
--      VIEWER = view. Vai trò TỰ TẠO không được cấp gì — Trưởng đơn vị tự cấp ở "Vai trò".
--   2. Link theo dõi owner_mkt_links: mỗi link = (tài sản trên sàn, kênh, nhãn), mã
--      ngắn sinh ở SERVER. Cán bộ dán link vào kênh RIÊNG của ngân hàng (Zalo, SMS,
--      app…) — danh sách khách của ngân hàng không bao giờ vào sàn.
--   3. Lượt mở owner_mkt_link_hits: chỉ ghi qua RPC owner_mkt_track_hit (anon gọi
--      được), KHÔNG lưu IP. Thành viên của Trạm mở thử link không tính (như /r/:token).
--
-- "Tài sản" ở đây = tin trên sàn mà Trạm đã nhận (asset_owner_claims auto_claimed /
-- confirmed) — chỉ những tin đó có trang công khai /listings/:id. Hồ sơ số hoá chưa
-- lên sàn đi đường "Hồ sơ online" (/hs/:code, Phase M0).

LOCK TABLE public.owner_ws_roles, public.owner_ws_role_permissions IN SHARE ROW EXCLUSIVE MODE;

-- Ảnh chụp số dòng quyền theo module TRƯỚC khi seed (self-check: chỉ module mới đổi).
CREATE TEMP TABLE _mkt_perm_before AS
  SELECT module, count(*) AS n FROM public.owner_ws_role_permissions GROUP BY module;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Danh mục quyền (bản sao client: src/lib/ownerWorkspace/permissions.ts)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.owner_ws_permission_catalog()
RETURNS TABLE (module TEXT, action TEXT)
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  VALUES
    ('chi-tieu', 'view'), ('chi-tieu', 'create'), ('chi-tieu', 'update'), ('chi-tieu', 'delete'),
    ('tai-san', 'view'), ('tai-san', 'update'),
    ('ket-qua', 'view'), ('ket-qua', 'update'), ('ket-qua', 'delete'),
    ('so-hoa', 'view'), ('so-hoa', 'create'), ('so-hoa', 'update'),
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
              ('so-hoa', 'create'), ('so-hoa', 'update'),
              ('ky-gui', 'create'), ('ky-gui', 'update'),
              ('hop-dong-mua-ban', 'update'),
              ('thu-tien', 'create'), ('thu-tien', 'update'), ('thu-tien', 'delete'),
              ('truyen-thong', 'create'), ('truyen-thong', 'update'),
              ('bao-cao-dinh-ky', 'create'), ('bao-cao-dinh-ky', 'update'), ('bao-cao-dinh-ky', 'delete'))))
$$;

-- Seed cho các Trạm đã có (Trạm mới tự nhận qua owner_ws_seed_default_roles).
INSERT INTO public.owner_ws_role_permissions (role_id, module, action)
SELECT r.id, 'truyen-thong', a.action
  FROM public.owner_ws_roles r
 CROSS JOIN (VALUES ('view'), ('create'), ('update')) AS a(action)
 WHERE r.code = 'STAFF'
ON CONFLICT DO NOTHING;

INSERT INTO public.owner_ws_role_permissions (role_id, module, action)
SELECT r.id, 'truyen-thong', 'view'
  FROM public.owner_ws_roles r
 WHERE r.code = 'VIEWER'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Link theo dõi
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.owner_mkt_links (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Sinh ở trigger; client không ghi được cột này.
  code             TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9]{8}$'),
  workspace_id     UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  -- Suy từ tin đã nhận (chi nhánh của pháp nhân trên claim) — client không chọn được.
  branch_id        UUID REFERENCES public.workspace_branches(id) ON DELETE SET NULL,
  -- Chiến dịch tạo ra link (Phase M2 thêm FK tới owner_mkt_campaigns). NULL = link lẻ.
  campaign_id      UUID,
  listing_id       UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  channel          TEXT NOT NULL
                   CHECK (channel IN ('email', 'zalo', 'facebook', 'sms', 'bank_app', 'press', 'other')),
  label            TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  hit_count        INTEGER NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
  unique_hit_count INTEGER NOT NULL DEFAULT 0 CHECK (unique_hit_count >= 0),
  last_hit_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX owner_mkt_links_workspace_idx ON public.owner_mkt_links (workspace_id, created_at DESC);
CREATE INDEX owner_mkt_links_listing_idx ON public.owner_mkt_links (listing_id);
CREATE INDEX owner_mkt_links_campaign_idx ON public.owner_mkt_links (campaign_id) WHERE campaign_id IS NOT NULL;

COMMENT ON TABLE public.owner_mkt_links IS
  'Link theo dõi /l/:code của Trạm Điều Hành (Truyền thông). Mã + chi nhánh + bộ đếm do server ghi; lượt mở chỉ qua owner_mkt_track_hit.';

CREATE TRIGGER owner_mkt_links_updated_at
  BEFORE UPDATE ON public.owner_mkt_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Mã 8 ký tự, bỏ ký tự dễ nhầm khi đọc / gõ lại (0 o 1 i l): 31^8 ≈ 8.5e11 mã.
CREATE FUNCTION public.owner_mkt_new_link_code()
RETURNS TEXT LANGUAGE plpgsql VOLATILE SET search_path = public
AS $$
DECLARE
  _alphabet CONSTANT TEXT := 'abcdefghjkmnpqrstuvwxyz23456789';
  _bytes BYTEA;
  _code  TEXT;
BEGIN
  LOOP
    _bytes := extensions.gen_random_bytes(8);
    _code := '';
    FOR i IN 0..7 LOOP
      _code := _code || substr(_alphabet, 1 + (get_byte(_bytes, i) % 31), 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.owner_mkt_links l WHERE l.code = _code);
  END LOOP;
  RETURN _code;
END;
$$;

CREATE FUNCTION public.owner_mkt_links_prepare()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _asset_owner UUID;
BEGIN
  NEW.label := btrim(NEW.label);
  IF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Kiểm quyền TRƯỚC khi tra claim: người ngoài không dò được tin nào thuộc Trạm nào.
  -- (auth.uid() NULL = migration / service_role.)
  IF auth.uid() IS NOT NULL AND NOT public.owner_ws_has(NEW.workspace_id, 'truyen-thong', 'create') THEN
    RAISE EXCEPTION 'forbidden: không có quyền tạo link truyền thông' USING ERRCODE = '42501';
  END IF;

  SELECT c.asset_owner_id INTO _asset_owner
    FROM public.asset_owner_claims c
   WHERE c.workspace_id = NEW.workspace_id
     AND c.listing_id = NEW.listing_id
     AND c.status IN ('auto_claimed', 'confirmed');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_in_workspace: tài sản không thuộc đơn vị' USING ERRCODE = '23514';
  END IF;

  NEW.branch_id := (SELECT wb.id FROM public.workspace_branches wb
                     WHERE wb.workspace_id = NEW.workspace_id AND wb.asset_owner_id = _asset_owner);
  NEW.code := public.owner_mkt_new_link_code();
  NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  NEW.hit_count := 0;
  NEW.unique_hit_count := 0;
  NEW.last_hit_at := NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER owner_mkt_links_prepare
  BEFORE INSERT OR UPDATE ON public.owner_mkt_links
  FOR EACH ROW EXECUTE FUNCTION public.owner_mkt_links_prepare();

ALTER TABLE public.owner_mkt_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_mkt_links_member_read ON public.owner_mkt_links
  FOR SELECT TO authenticated
  USING (public.owner_ws_can(workspace_id, 'read'));

-- WITH CHECK chạy SAU trigger BEFORE ⇒ branch_id ở đây là chi nhánh đã suy từ claim.
CREATE POLICY owner_mkt_links_insert ON public.owner_mkt_links
  FOR INSERT TO authenticated
  WITH CHECK (public.owner_ws_has_in(workspace_id, 'truyen-thong', 'create', branch_id));

CREATE POLICY owner_mkt_links_update ON public.owner_mkt_links
  FOR UPDATE TO authenticated
  USING (public.owner_ws_has_in(workspace_id, 'truyen-thong', 'update', branch_id))
  WITH CHECK (public.owner_ws_has_in(workspace_id, 'truyen-thong', 'update', branch_id));

CREATE POLICY owner_mkt_links_delete ON public.owner_mkt_links
  FOR DELETE TO authenticated
  USING (public.owner_ws_has_in(workspace_id, 'truyen-thong', 'delete', branch_id));

-- Quyền cột: client chỉ ghi được đúng các ô của form; mã, chi nhánh, bộ đếm là của server.
REVOKE ALL ON public.owner_mkt_links FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.owner_mkt_links TO authenticated;
GRANT INSERT (workspace_id, listing_id, channel, label) ON public.owner_mkt_links TO authenticated;
GRANT UPDATE (label) ON public.owner_mkt_links TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Lượt mở (không IP)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.owner_mkt_link_hits (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  link_id    UUID NOT NULL REFERENCES public.owner_mkt_links(id) ON DELETE CASCADE,
  -- id phiên ẩn danh của trình duyệt (như analytics_events.session_id). NULL = không có.
  session_id TEXT CHECK (session_id IS NULL OR session_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  device     TEXT CHECK (device IS NULL OR device IN ('desktop', 'mobile', 'tablet')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX owner_mkt_link_hits_link_idx ON public.owner_mkt_link_hits (link_id, created_at DESC);
CREATE INDEX owner_mkt_link_hits_session_idx ON public.owner_mkt_link_hits (link_id, session_id)
  WHERE session_id IS NOT NULL;

COMMENT ON TABLE public.owner_mkt_link_hits IS
  'Lượt mở link theo dõi. Chỉ ghi qua owner_mkt_track_hit; không lưu IP; thành viên Trạm mở không tính.';

ALTER TABLE public.owner_mkt_link_hits ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_mkt_link_hits_member_read ON public.owner_mkt_link_hits
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.owner_mkt_links l
                  WHERE l.id = link_id AND public.owner_ws_can(l.workspace_id, 'read')));

REVOKE ALL ON public.owner_mkt_link_hits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.owner_mkt_link_hits TO authenticated;

-- Ghi 1 lượt mở rồi trả về đích chuyển hướng. Công khai (anon gọi được).
--   • Mã sai định dạng / không có ⇒ not_found (không phân biệt).
--   • Thành viên (hoặc trụ sở đã liên kết) mở link ⇒ không tính.
--   • Cùng phiên mở lại cùng link trong 60 giây ⇒ không tính (tải lại trang).
--   • unique_hit_count = số phiên khác nhau; lượt không có id phiên tính là phiên mới.
CREATE FUNCTION public.owner_mkt_track_hit(p_code TEXT, p_session_id TEXT, p_device TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _link    public.owner_mkt_links%ROWTYPE;
  _session TEXT;
  _device  TEXT;
  _seen    BOOLEAN;
BEGIN
  IF p_code IS NULL OR p_code !~ '^[a-z0-9]{8}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO _link FROM public.owner_mkt_links WHERE code = p_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF auth.uid() IS NULL OR NOT public.owner_ws_can(_link.workspace_id, 'read') THEN
    _session := CASE WHEN p_session_id ~ '^[A-Za-z0-9_-]{1,64}$' AND p_session_id <> 's_ephemeral'
                     THEN p_session_id END;
    _device := CASE WHEN p_device IN ('desktop', 'mobile', 'tablet') THEN p_device END;

    IF _session IS NULL OR NOT EXISTS (
         SELECT 1 FROM public.owner_mkt_link_hits h
          WHERE h.link_id = _link.id AND h.session_id = _session
            AND h.created_at > now() - interval '60 seconds') THEN
      _seen := _session IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.owner_mkt_link_hits h WHERE h.link_id = _link.id AND h.session_id = _session);

      INSERT INTO public.owner_mkt_link_hits (link_id, session_id, device)
      VALUES (_link.id, _session, _device);

      UPDATE public.owner_mkt_links
         SET hit_count = hit_count + 1,
             unique_hit_count = unique_hit_count + CASE WHEN _seen THEN 0 ELSE 1 END,
             last_hit_at = now()
       WHERE id = _link.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'link_id', _link.id,
    'listing_id', _link.listing_id,
    'channel', _link.channel,
    'code', _link.code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.owner_mkt_new_link_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_mkt_links_prepare() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_mkt_track_hit(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_mkt_track_hit(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Tự kiểm
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  _bad TEXT;
  c    TEXT;
BEGIN
  -- Danh mục + vai trò mặc định (client: permissions.test.ts).
  IF (SELECT count(*) FROM public.owner_ws_permission_catalog()) <> 47 THEN
    RAISE EXCEPTION 'self-check: catalog phải có 47 quyền';
  END IF;
  IF (SELECT count(*) FROM public.owner_ws_default_role_permissions('STAFF')) <> 31
     OR (SELECT count(*) FROM public.owner_ws_default_role_permissions('VIEWER')) <> 15 THEN
    RAISE EXCEPTION 'self-check: quyền mặc định STAFF=31 / VIEWER=15';
  END IF;

  -- Mọi vai trò STAFF có đủ 3 quyền, VIEWER đúng 1 quyền, vai trò khác không có gì mới.
  SELECT string_agg(r.workspace_id::text || ':' || r.code, ', ') INTO _bad
    FROM public.owner_ws_roles r
   WHERE (SELECT count(*) FROM public.owner_ws_role_permissions p
           WHERE p.role_id = r.id AND p.module = 'truyen-thong')
         <> CASE r.code WHEN 'STAFF' THEN 3 WHEN 'VIEWER' THEN 1 ELSE 0 END;
  IF _bad IS NOT NULL THEN
    RAISE EXCEPTION 'self-check: seed truyen-thong lệch ở %', _bad;
  END IF;

  -- Không ai được thêm / mất quyền ở module khác.
  SELECT string_agg(COALESCE(a.module, b.module), ', ') INTO _bad
    FROM (SELECT module, count(*) AS n FROM public.owner_ws_role_permissions
           WHERE module <> 'truyen-thong' GROUP BY module) a
    FULL JOIN _mkt_perm_before b ON b.module = a.module
   WHERE a.n IS DISTINCT FROM b.n;
  IF _bad IS NOT NULL THEN
    RAISE EXCEPTION 'self-check: quyền module khác bị đổi: %', _bad;
  END IF;

  -- Bảng: anon không đọc; client không ghi mã / chi nhánh / bộ đếm; lượt mở chỉ qua RPC.
  IF has_table_privilege('anon', 'public.owner_mkt_links', 'SELECT')
     OR has_table_privilege('anon', 'public.owner_mkt_link_hits', 'SELECT') THEN
    RAISE EXCEPTION 'self-check: anon đọc được bảng truyền thông';
  END IF;
  FOREACH c IN ARRAY ARRAY['code', 'branch_id', 'campaign_id', 'created_by', 'hit_count', 'unique_hit_count', 'last_hit_at'] LOOP
    IF has_column_privilege('authenticated', 'public.owner_mkt_links', c, 'INSERT')
       OR has_column_privilege('authenticated', 'public.owner_mkt_links', c, 'UPDATE') THEN
      RAISE EXCEPTION 'self-check: authenticated ghi được cột owner_mkt_links.%', c;
    END IF;
  END LOOP;
  IF NOT has_column_privilege('authenticated', 'public.owner_mkt_links', 'label', 'UPDATE') THEN
    RAISE EXCEPTION 'self-check: authenticated phải sửa được nhãn link';
  END IF;
  IF has_table_privilege('authenticated', 'public.owner_mkt_link_hits', 'INSERT')
     OR has_table_privilege('authenticated', 'public.owner_mkt_link_hits', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.owner_mkt_link_hits', 'DELETE') THEN
    RAISE EXCEPTION 'self-check: authenticated ghi thẳng được owner_mkt_link_hits';
  END IF;

  IF NOT has_function_privilege('anon', 'public.owner_mkt_track_hit(text, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'self-check: anon phải gọi được owner_mkt_track_hit';
  END IF;
  IF has_function_privilege('anon', 'public.owner_mkt_new_link_code()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.owner_mkt_new_link_code()', 'EXECUTE') THEN
    RAISE EXCEPTION 'self-check: client gọi được owner_mkt_new_link_code';
  END IF;

  -- Không có cột IP nào lọt vào bảng lượt mở.
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'owner_mkt_link_hits'
                AND column_name ~ '(^|_)ip($|_)') THEN
    RAISE EXCEPTION 'self-check: owner_mkt_link_hits không được lưu IP';
  END IF;
END;
$$;

DROP TABLE _mkt_perm_before;
