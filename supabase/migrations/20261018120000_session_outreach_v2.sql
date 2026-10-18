-- ─────────────────────────────────────────────────────────────────────────────
-- TIẾP THỊ PHIÊN v2 (design "Phien Dau Gia - Cong Cong Ty", pdg-mk*.js):
--   • KÊNH ĐĂNG TIN do tổ chức tự quản (thêm / đổi tên / gỡ / nội dung riêng / hẹn
--     giờ) — thay 5 kênh cứng channel:listing|zalo|facebook|sms|flyer.
--   • NHÓM KHÁCH lưu theo tiêu chí (loại tài sản, khu vực, khả năng tài chính,
--     kênh nhận tin). Nhóm dựng sẵn 'auto' = org_session_audience (luật khớp cũ
--     giữ nguyên).
--   • CÂU CHÀO Email / Zalo / SMS có biến {Tên khách}… lưu trên gói.
--   • Ảnh đại diện bản tin: bucket PUBLIC outreach-media (bài đăng cần URL thật).
--
-- Bản tin chung (tiêu đề, ảnh) nằm trong case_file.headline / cover_url; mô tả /
-- hiện trạng / pháp lý theo lô vẫn ở case_file.lots — không cần cột mới.
--
-- NGUYÊN TẮC GIỮ NGUYÊN từ 20260912000013: bảng chỉ có policy SELECT, mọi ghi đi
-- qua RPC SECURITY DEFINER và ghi nhật ký (session_outreach_edits) trong cùng câu;
-- "đã gửi" chỉ ghi khi outreach_send_window_open; phiên đã huỷ khoá mọi ghi.
-- LUẬT KHỚP nhóm theo tiêu chí CHỈ ở outreach_criteria_contacts — không bản sao TS.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Kênh đăng tin ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_outreach_channels (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id      UUID NOT NULL REFERENCES public.session_outreach_packs(id) ON DELETE CASCADE,
  -- ĐỒNG BỘ với CHANNEL_KINDS trong src/lib/outreach/channels.ts.
  kind         TEXT NOT NULL CHECK (kind IN ('cong', 'san', 'fb', 'zalo', 'mail', 'web', 'news', 'fbg', 'zg', 'sms', 'other')),
  name         TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  target       TEXT NOT NULL DEFAULT '' CHECK (char_length(target) <= 200),
  -- Nội dung riêng: GIỮ lại khi tắt own_content để bật lại không mất bài.
  own_content  BOOLEAN NOT NULL DEFAULT false,
  custom_head  TEXT NOT NULL DEFAULT '' CHECK (char_length(custom_head) <= 300),
  custom_body  TEXT NOT NULL DEFAULT '' CHECK (char_length(custom_body) <= 5000),
  custom_cta   TEXT NOT NULL DEFAULT '' CHECK (char_length(custom_cta) <= 80),
  scheduled_at TIMESTAMPTZ,
  sort_order   INT NOT NULL DEFAULT 0,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Thông báo đấu giá theo mẫu khoá: không viết riêng được.
  CONSTRAINT session_outreach_channels_cong_locked CHECK (kind <> 'cong' OR own_content = false)
);

CREATE INDEX IF NOT EXISTS idx_session_outreach_channels_pack ON public.session_outreach_channels (pack_id, sort_order);
-- Mỗi gói đúng một kênh Cổng thông tin quốc gia.
CREATE UNIQUE INDEX IF NOT EXISTS uq_session_outreach_channels_cong ON public.session_outreach_channels (pack_id) WHERE kind = 'cong';

DROP TRIGGER IF EXISTS session_outreach_channels_updated_at ON public.session_outreach_channels;
CREATE TRIGGER session_outreach_channels_updated_at
  BEFORE UPDATE ON public.session_outreach_channels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 2. Nhóm khách theo tiêu chí ────────────────────────────────────────────
-- criteria = { categories: text[] (slug), province: text|null (null = toàn quốc),
--              price_min: number|null, price_max: number|null,
--              via: text[] ⊆ {email, zalo, sms} }
CREATE TABLE IF NOT EXISTS public.session_outreach_segments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id    UUID NOT NULL REFERENCES public.session_outreach_packs(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  criteria   JSONB NOT NULL CHECK (jsonb_typeof(criteria) = 'object'),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_outreach_segments_pack ON public.session_outreach_segments (pack_id, created_at);

-- ─── 3. Cột mới trên bảng cũ ────────────────────────────────────────────────
ALTER TABLE public.session_outreach_packs
  ADD COLUMN IF NOT EXISTS greetings JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE public.session_outreach_packs DROP CONSTRAINT IF EXISTS session_outreach_packs_greetings_object;
ALTER TABLE public.session_outreach_packs
  ADD CONSTRAINT session_outreach_packs_greetings_object CHECK (jsonb_typeof(greetings) = 'object');

ALTER TABLE public.session_outreach_sends
  ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.session_outreach_channels(id) ON DELETE SET NULL,
  -- Tên kênh lúc đăng — còn lại khi kênh bị gỡ.
  ADD COLUMN IF NOT EXISTS channel_label TEXT CHECK (channel_label IS NULL OR char_length(channel_label) <= 80);
CREATE INDEX IF NOT EXISTS idx_session_outreach_sends_channel ON public.session_outreach_sends (channel_id) WHERE channel_id IS NOT NULL;

ALTER TABLE public.session_outreach_sends DROP CONSTRAINT IF EXISTS session_outreach_sends_channel_check;
ALTER TABLE public.session_outreach_sends
  ADD CONSTRAINT session_outreach_sends_channel_check CHECK (
    channel IS NULL OR channel IN (
      'listing', 'zalo', 'facebook', 'sms', 'flyer', 'notice',
      'cong', 'san', 'fb', 'mail', 'web', 'news', 'fbg', 'zg', 'other'
    )
  );

ALTER TABLE public.session_outreach_edits DROP CONSTRAINT IF EXISTS session_outreach_edits_kind_check;
ALTER TABLE public.session_outreach_edits
  ADD CONSTRAINT session_outreach_edits_kind_check CHECK (
    kind IN ('generate', 'regenerate', 'suggest', 'edit', 'reset', 'case_file', 'channel', 'segment', 'greeting')
  );

-- ─── 4. RLS — CHỈ SELECT ────────────────────────────────────────────────────
ALTER TABLE public.session_outreach_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_outreach_segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_outreach_channels_select" ON public.session_outreach_channels;
CREATE POLICY "session_outreach_channels_select" ON public.session_outreach_channels
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.session_outreach_packs p
                  WHERE p.id = pack_id AND public.can_manage_auction_sessions(p.organization_id, 'view')));

DROP POLICY IF EXISTS "session_outreach_segments_select" ON public.session_outreach_segments;
CREATE POLICY "session_outreach_segments_select" ON public.session_outreach_segments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.session_outreach_packs p
                  WHERE p.id = pack_id AND public.can_manage_auction_sessions(p.organization_id, 'view')));

-- ─── 5. Kênh mặc định ───────────────────────────────────────────────────────
-- Nội bộ: 5 kênh của design (Cổng, Trang tổ chức, Facebook, Zalo OA, Email).
CREATE OR REPLACE FUNCTION public.outreach_seed_channels(_pack_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.session_outreach_channels (pack_id, kind, name, target, sort_order)
  SELECT _pack_id, d.kind, d.name, d.target, d.ord
    FROM (VALUES
      ('cong', 'Cổng thông tin quốc gia', 'Thông báo công khai bắt buộc', 0),
      ('san',  'Trang tổ chức',           'Trên sàn đấu giá',             1),
      ('fb',   'Facebook',                'Fanpage tổ chức',              2),
      ('zalo', 'Zalo OA',                 'Người quan tâm OA',            3),
      ('mail', 'Email',                   'Khách đồng ý nhận tin',        4)
    ) AS d(kind, name, target, ord)
   WHERE NOT EXISTS (SELECT 1 FROM public.session_outreach_channels c WHERE c.pack_id = _pack_id);
$$;
REVOKE ALL ON FUNCTION public.outreach_seed_channels(UUID) FROM PUBLIC, anon, authenticated;

SELECT public.outreach_seed_channels(p.id) FROM public.session_outreach_packs p;

-- Gói mới ⇒ kênh mặc định (bản cũ của outreach_ensure_pack + một dòng seed).
CREATE OR REPLACE FUNCTION public.outreach_ensure_pack(_session_id UUID, _template_version TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _org UUID;
  _status TEXT;
  _pid UUID;
BEGIN
  SELECT s.organization_id, s.status INTO _org, _status FROM public.auction_sessions s WHERE s.id = _session_id;
  IF _org IS NULL OR NOT public.can_manage_auction_sessions(_org, 'view') THEN
    RAISE EXCEPTION 'Không tìm thấy phiên, hoặc bạn không có quyền xem phiên này.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT p.id INTO _pid FROM public.session_outreach_packs p WHERE p.session_id = _session_id;
  IF _pid IS NOT NULL THEN RETURN _pid; END IF;

  IF _status = 'cancelled' OR NOT public.can_manage_auction_sessions(_org, 'update') THEN RETURN NULL; END IF;

  INSERT INTO public.session_outreach_packs (session_id, organization_id, notice_template_version, created_by)
  VALUES (_session_id, _org, _template_version, auth.uid())
  ON CONFLICT (session_id) DO NOTHING
  RETURNING id INTO _pid;

  IF _pid IS NULL THEN
    SELECT p.id INTO _pid FROM public.session_outreach_packs p WHERE p.session_id = _session_id;
  ELSE
    PERFORM public.outreach_seed_channels(_pid);
  END IF;
  RETURN _pid;
END; $$;

-- ─── 6. RPC kênh ────────────────────────────────────────────────────────────
-- Kênh còn sửa được ⇒ trả kênh; gói ghi được (outreach_writable_pack RAISE nếu không).
CREATE OR REPLACE FUNCTION public.outreach_writable_channel(_channel_id UUID)
RETURNS public.session_outreach_channels
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c public.session_outreach_channels;
BEGIN
  SELECT * INTO _c FROM public.session_outreach_channels WHERE id = _channel_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy kênh.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM public.outreach_writable_pack(_c.pack_id);
  RETURN _c;
END; $$;
REVOKE ALL ON FUNCTION public.outreach_writable_channel(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.outreach_add_channel(_pack_id UUID, _kind TEXT, _name TEXT, _target TEXT DEFAULT '')
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _id UUID;
BEGIN
  PERFORM public.outreach_writable_pack(_pack_id);
  IF _kind = 'cong' THEN
    RAISE EXCEPTION 'Kênh Cổng thông tin quốc gia có sẵn ở mọi phiên.' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.session_outreach_channels (pack_id, kind, name, target, sort_order, created_by)
  VALUES (_pack_id, _kind, btrim(COALESCE(_name, '')), btrim(COALESCE(_target, '')),
          COALESCE((SELECT max(sort_order) + 1 FROM public.session_outreach_channels WHERE pack_id = _pack_id), 0),
          auth.uid())
  RETURNING id INTO _id;
  INSERT INTO public.session_outreach_edits (pack_id, field_key, kind, old_value, new_value, actor_id)
  VALUES (_pack_id, 'channel:' || _id, 'channel', NULL, btrim(_name), auth.uid());
  RETURN _id;
END; $$;

-- _patch: các khoá name / target / own_content / custom_head / custom_body /
-- custom_cta / scheduled_at (null = đăng thủ công). Khoá vắng mặt giữ nguyên.
CREATE OR REPLACE FUNCTION public.outreach_update_channel(_channel_id UUID, _patch JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c public.session_outreach_channels;
  _n public.session_outreach_channels;
BEGIN
  _c := public.outreach_writable_channel(_channel_id);
  IF _patch IS NULL OR jsonb_typeof(_patch) <> 'object' THEN
    RAISE EXCEPTION 'Dữ liệu kênh không hợp lệ.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  _n := _c;
  IF _patch ? 'name'        THEN _n.name        := btrim(COALESCE(_patch->>'name', '')); END IF;
  IF _patch ? 'target'      THEN _n.target      := COALESCE(_patch->>'target', ''); END IF;
  IF _patch ? 'own_content' THEN _n.own_content := COALESCE((_patch->>'own_content')::BOOLEAN, false); END IF;
  IF _patch ? 'custom_head' THEN _n.custom_head := COALESCE(_patch->>'custom_head', ''); END IF;
  IF _patch ? 'custom_body' THEN _n.custom_body := COALESCE(_patch->>'custom_body', ''); END IF;
  IF _patch ? 'custom_cta'  THEN _n.custom_cta  := COALESCE(_patch->>'custom_cta', ''); END IF;
  IF _patch ? 'scheduled_at' THEN _n.scheduled_at := NULLIF(_patch->>'scheduled_at', '')::TIMESTAMPTZ; END IF;
  IF _c.kind = 'cong' AND _n.own_content THEN
    RAISE EXCEPTION 'Thông báo đấu giá phải đúng mẫu — không viết riêng được.' USING ERRCODE = 'check_violation';
  END IF;

  IF (_n.name, _n.target, _n.own_content, _n.custom_head, _n.custom_body, _n.custom_cta, _n.scheduled_at)
     IS NOT DISTINCT FROM
     (_c.name, _c.target, _c.own_content, _c.custom_head, _c.custom_body, _c.custom_cta, _c.scheduled_at) THEN
    RETURN false;
  END IF;

  UPDATE public.session_outreach_channels
     SET name = _n.name, target = _n.target, own_content = _n.own_content,
         custom_head = _n.custom_head, custom_body = _n.custom_body, custom_cta = _n.custom_cta,
         scheduled_at = _n.scheduled_at
   WHERE id = _channel_id;
  INSERT INTO public.session_outreach_edits (pack_id, field_key, kind, old_value, new_value, actor_id)
  VALUES (_c.pack_id, 'channel:' || _channel_id, 'channel', to_jsonb(_c)::TEXT, to_jsonb(_n)::TEXT, auth.uid());
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.outreach_remove_channel(_channel_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c public.session_outreach_channels;
BEGIN
  _c := public.outreach_writable_channel(_channel_id);
  IF _c.kind = 'cong' THEN
    RAISE EXCEPTION 'Kênh bắt buộc — không gỡ được.' USING ERRCODE = 'check_violation';
  END IF;
  -- Dòng "đã đăng" giữ lại (channel_id ⇒ NULL, còn channel_label).
  DELETE FROM public.session_outreach_channels WHERE id = _channel_id;
  INSERT INTO public.session_outreach_edits (pack_id, field_key, kind, old_value, new_value, actor_id)
  VALUES (_c.pack_id, 'channel:' || _channel_id, 'channel', to_jsonb(_c)::TEXT, NULL, auth.uid());
END; $$;

-- "Sao chép & đăng": ghi nhận đã đăng một kênh (append-only).
CREATE OR REPLACE FUNCTION public.outreach_post_channel(_channel_id UUID, _text TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c public.session_outreach_channels;
  _p public.session_outreach_packs;
  _id UUID;
BEGIN
  _c := public.outreach_writable_channel(_channel_id);
  SELECT * INTO _p FROM public.session_outreach_packs WHERE id = _c.pack_id;
  IF NOT public.outreach_send_window_open(_p.session_id) THEN
    RAISE EXCEPTION 'Chỉ đánh dấu đã đăng khi phiên đang công bố và còn trong thời hạn nhận hồ sơ.'
      USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.session_outreach_sends (pack_id, channel, channel_id, channel_label, text_snapshot, marked_by)
  VALUES (_c.pack_id, _c.kind, _c.id, _c.name, COALESCE(NULLIF(btrim(COALESCE(_text, '')), ''), _c.name), auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END; $$;

-- ─── 7. Câu chào ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.outreach_save_greeting(_pack_id UUID, _via TEXT, _subject TEXT, _body TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _p public.session_outreach_packs;
  _old JSONB;
  _new JSONB;
BEGIN
  _p := public.outreach_writable_pack(_pack_id);
  IF _via NOT IN ('email', 'zalo', 'sms') THEN
    RAISE EXCEPTION 'Kênh câu chào không hợp lệ.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF char_length(COALESCE(_body, '')) > 5000 OR char_length(COALESCE(_subject, '')) > 300 THEN
    RAISE EXCEPTION 'Câu chào quá dài.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  _old := _p.greetings -> _via;
  _new := jsonb_build_object('subject', COALESCE(_subject, ''), 'body', COALESCE(_body, ''));
  IF _old = _new THEN RETURN false; END IF;
  UPDATE public.session_outreach_packs SET greetings = greetings || jsonb_build_object(_via, _new) WHERE id = _pack_id;
  INSERT INTO public.session_outreach_edits (pack_id, field_key, kind, old_value, new_value, actor_id)
  VALUES (_pack_id, 'greeting:' || _via, 'greeting', _old::TEXT, _new::TEXT, auth.uid());
  RETURN true;
END; $$;

-- ─── 8. Nhóm khách ──────────────────────────────────────────────────────────
-- NGUỒN DUY NHẤT của luật khớp nhóm theo tiêu chí (nội bộ, không cấp client):
--   đủ điều kiện gửi : status 'active' VÀ notifications_enabled VÀ có ÍT NHẤT một
--                      địa chỉ của kênh nhận tin đã chọn (email / zalo / phone).
--   nhu cầu          : nếu có lọc loại / khu vực / tài chính ⇒ có MỘT dòng nhu
--                      cầu thoả MỌI chiều đã lọc; chiều để trống ở dòng nhu cầu =
--                      không giới hạn (cùng ngữ nghĩa org_session_audience).
--     loại          : categories rỗng HOẶC giao nhau, kể cả quan hệ cha–con hai chiều
--     khu vực       : province_keys rỗng HOẶC chứa normalize_province(lọc)
--     tài chính     : khoảng giá nhu cầu GIAO khoảng đã chọn (đầu mở = vô hạn)
--   Khách chưa khai nhu cầu chỉ khớp khi lọc CHỈ có khu vực và tỉnh của khách trùng.
CREATE OR REPLACE FUNCTION public.outreach_criteria_contacts(_org UUID, _criteria JSONB)
RETURNS TABLE (contact_id UUID)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  _cats TEXT[] := COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(_criteria->'categories', '[]'::JSONB))), '{}');
  _via  TEXT[] := COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(_criteria->'via', '[]'::JSONB))), '{}');
  _prov TEXT   := public.normalize_province(NULLIF(btrim(COALESCE(_criteria->>'province', '')), ''));
  _pmin NUMERIC := NULLIF(_criteria->>'price_min', '')::NUMERIC;
  _pmax NUMERIC := NULLIF(_criteria->>'price_max', '')::NUMERIC;
  _need BOOLEAN;
BEGIN
  _need := cardinality(_cats) > 0 OR _prov IS NOT NULL OR _pmin IS NOT NULL OR _pmax IS NOT NULL;
  RETURN QUERY
  SELECT c.id
    FROM public.org_contacts c
   WHERE c.organization_id = _org
     AND c.status = 'active'
     AND c.notifications_enabled
     AND (   ('email' = ANY (_via) AND NULLIF(btrim(COALESCE(c.email, '')), '') IS NOT NULL)
          OR ('zalo'  = ANY (_via) AND NULLIF(btrim(COALESCE(c.zalo,  '')), '') IS NOT NULL)
          OR ('sms'   = ANY (_via) AND NULLIF(btrim(COALESCE(c.phone, '')), '') IS NOT NULL))
     AND (
       NOT _need
       OR EXISTS (
         SELECT 1 FROM public.org_contact_interests ci
          WHERE ci.contact_id = c.id
            AND (cardinality(_cats) = 0
                 OR cardinality(ci.categories) = 0
                 OR ci.categories && _cats
                 OR EXISTS (SELECT 1 FROM unnest(ci.categories) x WHERE public.asset_parent_slug(x) = ANY (_cats))
                 OR EXISTS (SELECT 1 FROM unnest(_cats) y WHERE public.asset_parent_slug(y) = ANY (ci.categories)))
            AND (_prov IS NULL OR cardinality(ci.province_keys) = 0 OR _prov = ANY (ci.province_keys))
            AND (_pmin IS NULL OR ci.price_max IS NULL OR ci.price_max >= _pmin)
            AND (_pmax IS NULL OR ci.price_min IS NULL OR ci.price_min <= _pmax))
       OR (cardinality(_cats) = 0 AND _pmin IS NULL AND _pmax IS NULL AND _prov IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.org_contact_interests ci WHERE ci.contact_id = c.id)
           AND public.normalize_province(c.province) = _prov)
     );
END; $$;
REVOKE ALL ON FUNCTION public.outreach_criteria_contacts(UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- Gói xem được VÀ xem được danh bạ ⇒ trả gói; ngược lại RAISE.
CREATE OR REPLACE FUNCTION public.outreach_contacts_pack(_pack_id UUID)
RETURNS public.session_outreach_packs
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _p public.session_outreach_packs;
BEGIN
  SELECT * INTO _p FROM public.session_outreach_packs WHERE id = _pack_id;
  IF NOT FOUND OR NOT public.can_manage_auction_sessions(_p.organization_id, 'view') THEN
    RAISE EXCEPTION 'Không tìm thấy gói tiếp thị.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.can_manage_org_contacts(_p.organization_id, 'view') THEN
    RAISE EXCEPTION 'Vai trò của bạn chưa được xem danh bạ khách hàng.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN _p;
END; $$;
REVOKE ALL ON FUNCTION public.outreach_contacts_pack(UUID) FROM PUBLIC, anon, authenticated;

-- Số khách ước tính cho trang "Thêm nhóm khách".
CREATE OR REPLACE FUNCTION public.outreach_segment_estimate(_pack_id UUID, _criteria JSONB)
RETURNS INT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _p public.session_outreach_packs;
BEGIN
  _p := public.outreach_contacts_pack(_pack_id);
  RETURN (SELECT count(*)::INT FROM public.outreach_criteria_contacts(_p.organization_id, _criteria));
END; $$;

CREATE OR REPLACE FUNCTION public.outreach_add_segment(_pack_id UUID, _name TEXT, _criteria JSONB)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _p public.session_outreach_packs;
  _id UUID;
BEGIN
  _p := public.outreach_writable_pack(_pack_id);
  PERFORM public.outreach_contacts_pack(_pack_id);
  IF _criteria IS NULL OR jsonb_typeof(_criteria) <> 'object'
     OR jsonb_typeof(COALESCE(_criteria->'via', 'null'::JSONB)) <> 'array'
     OR jsonb_array_length(_criteria->'via') = 0 THEN
    RAISE EXCEPTION 'Chọn ít nhất một kênh nhận tin.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  INSERT INTO public.session_outreach_segments (pack_id, name, criteria, created_by)
  VALUES (_pack_id, btrim(COALESCE(_name, '')), _criteria, auth.uid())
  RETURNING id INTO _id;
  INSERT INTO public.session_outreach_edits (pack_id, field_key, kind, old_value, new_value, actor_id)
  VALUES (_pack_id, 'segment:' || _id, 'segment', NULL, jsonb_build_object('name', btrim(_name), 'criteria', _criteria)::TEXT, auth.uid());
  RETURN _id;
END; $$;

-- Thành viên một nhóm: _segment = 'auto' (org_session_audience, khách đủ điều kiện)
-- hoặc id nhóm. contacted_* = lần liên hệ GẦN NHẤT trong gói này (mọi nhóm).
CREATE OR REPLACE FUNCTION public.outreach_segment_members(_pack_id UUID, _segment TEXT)
RETURNS TABLE (
  contact_id     UUID,
  code           TEXT,
  full_name      TEXT,
  phone          TEXT,
  email          TEXT,
  zalo           TEXT,
  contacted_at   TIMESTAMPTZ,
  contacted_via  TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  _p public.session_outreach_packs;
  _ids UUID[];
  _criteria JSONB;
BEGIN
  _p := public.outreach_contacts_pack(_pack_id);
  IF _segment = 'auto' THEN
    SELECT COALESCE(array_agg(a.contact_id), '{}') INTO _ids
      FROM public.org_session_audience(_p.session_id) a WHERE a.eligible;
  ELSE
    SELECT s.criteria INTO _criteria FROM public.session_outreach_segments s
     WHERE s.id = NULLIF(_segment, '')::UUID AND s.pack_id = _pack_id;
    IF _criteria IS NULL THEN
      RAISE EXCEPTION 'Không tìm thấy nhóm khách.' USING ERRCODE = 'no_data_found';
    END IF;
    SELECT COALESCE(array_agg(x.contact_id), '{}') INTO _ids
      FROM public.outreach_criteria_contacts(_p.organization_id, _criteria) x;
  END IF;

  RETURN QUERY
  SELECT c.id, c.code, c.full_name, c.phone, c.email, c.zalo, last.marked_at, last.contact_method
    FROM public.org_contacts c
    LEFT JOIN LATERAL (
      SELECT s.marked_at, s.contact_method FROM public.session_outreach_sends s
       WHERE s.pack_id = _pack_id AND s.contact_id = c.id
       ORDER BY s.marked_at DESC LIMIT 1
    ) last ON true
   WHERE c.id = ANY (_ids)
   ORDER BY (last.marked_at IS NULL) DESC, lower(c.full_name), c.code;
END; $$;

-- ─── 9. Ghi nhận liên hệ: nhận cả khách của nhóm theo tiêu chí ──────────────
-- segment_key 'seg:<uuid>' ⇒ khách phải nằm trong nhóm đó của gói; còn lại (lot:/
-- multi/auto) ⇒ phải đủ điều kiện trong org_session_audience như bản cũ.
CREATE OR REPLACE FUNCTION public.outreach_mark_sent(
  _pack_id UUID, _channel TEXT, _text TEXT, _contacts JSONB DEFAULT NULL, _note TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _p public.session_outreach_packs;
  _c JSONB;
  _cid UUID;
  _seg TEXT;
  _contact public.org_contacts;
  _eligible UUID[];
  _seg_members UUID[];
  _seg_loaded TEXT;
  _criteria JSONB;
  _n INT := 0;
  _uid UUID := auth.uid();
BEGIN
  SELECT * INTO _p FROM public.session_outreach_packs WHERE id = _pack_id;
  IF NOT FOUND OR NOT public.can_manage_auction_sessions(_p.organization_id, 'view') THEN
    RAISE EXCEPTION 'Không tìm thấy gói tiếp thị.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.outreach_send_window_open(_p.session_id) THEN
    RAISE EXCEPTION 'Chỉ đánh dấu đã gửi khi phiên đang công bố và còn trong thời hạn nhận hồ sơ.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF _contacts IS NULL THEN
    IF NOT public.can_manage_auction_sessions(_p.organization_id, 'update') THEN
      RAISE EXCEPTION 'Vai trò của bạn chưa được đánh dấu đăng tin cho phiên này.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    INSERT INTO public.session_outreach_sends (pack_id, channel, text_snapshot, note, marked_by)
    VALUES (_pack_id, _channel, COALESCE(_text, ''), NULLIF(btrim(COALESCE(_note, '')), ''), _uid);
    RETURN 1;
  END IF;

  IF NOT public.can_manage_org_contacts(_p.organization_id, 'update') THEN
    RAISE EXCEPTION 'Vai trò của bạn chưa được ghi nhận liên hệ khách hàng.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF jsonb_typeof(_contacts) <> 'array' OR jsonb_array_length(_contacts) = 0 THEN
    RAISE EXCEPTION 'Chưa chọn khách nào.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF jsonb_array_length(_contacts) > 500 THEN
    RAISE EXCEPTION 'Mỗi lần ghi nhận tối đa 500 khách.' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOR _c IN SELECT value FROM jsonb_array_elements(_contacts) LOOP
    _cid := NULLIF(_c->>'contact_id', '')::UUID;
    _seg := NULLIF(_c->>'segment_key', '');
    SELECT * INTO _contact FROM public.org_contacts
     WHERE id = _cid AND organization_id = _p.organization_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Khách hàng không thuộc tổ chức.' USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF _seg LIKE 'seg:%' THEN
      IF _seg_loaded IS DISTINCT FROM _seg THEN
        SELECT s.criteria INTO _criteria FROM public.session_outreach_segments s
         WHERE s.id = substr(_seg, 5)::UUID AND s.pack_id = _pack_id;
        IF _criteria IS NULL THEN
          RAISE EXCEPTION 'Không tìm thấy nhóm khách.' USING ERRCODE = 'no_data_found';
        END IF;
        SELECT COALESCE(array_agg(x.contact_id), '{}') INTO _seg_members
          FROM public.outreach_criteria_contacts(_p.organization_id, _criteria) x;
        _seg_loaded := _seg;
      END IF;
      IF NOT (_cid = ANY (_seg_members)) THEN
        RAISE EXCEPTION 'Khách "%" không (còn) thuộc nhóm khách đã chọn.', _contact.full_name
          USING ERRCODE = 'check_violation';
      END IF;
    ELSE
      IF _eligible IS NULL THEN
        SELECT COALESCE(array_agg(a.contact_id), '{}'::UUID[]) INTO _eligible
          FROM public.org_session_audience(_p.session_id) a
         WHERE a.eligible;
      END IF;
      IF NOT (_cid = ANY (_eligible)) THEN
        RAISE EXCEPTION 'Khách "%" không (còn) nằm trong danh sách người nhận đủ điều kiện của phiên.', _contact.full_name
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    INSERT INTO public.session_outreach_sends
      (pack_id, contact_id, contact_method, segment_key, recipient_label, text_snapshot, note, marked_by)
    VALUES
      (_pack_id, _cid, _c->>'method', _seg, _contact.full_name,
       COALESCE(_c->>'text', ''), NULLIF(btrim(COALESCE(_note, '')), ''), _uid);
    _n := _n + 1;
  END LOOP;

  RETURN _n;
END; $$;

-- ─── 10. Ảnh đại diện bản tin ───────────────────────────────────────────────
-- PUBLIC vì ảnh đi kèm bài đăng / email. Đường dẫn {organization_id}/{session_id}/…
-- (personnel_folder_org: tách segment đầu thành UUID an toàn).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('outreach-media', 'outreach-media', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "outreach_media_public_read" ON storage.objects;
CREATE POLICY "outreach_media_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'outreach-media');

DROP POLICY IF EXISTS "outreach_media_org_write" ON storage.objects;
CREATE POLICY "outreach_media_org_write" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'outreach-media'
    AND public.personnel_folder_org(name) IS NOT NULL
    AND public.can_manage_auction_sessions(public.personnel_folder_org(name), 'update')
  )
  WITH CHECK (
    bucket_id = 'outreach-media'
    AND public.personnel_folder_org(name) IS NOT NULL
    AND public.can_manage_auction_sessions(public.personnel_folder_org(name), 'update')
  );

-- ─── 11. Quyền ──────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.outreach_add_channel(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.outreach_update_channel(UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.outreach_remove_channel(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.outreach_post_channel(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.outreach_save_greeting(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.outreach_segment_estimate(UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.outreach_add_segment(UUID, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.outreach_segment_members(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.outreach_mark_sent(UUID, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.outreach_ensure_pack(UUID, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.outreach_add_channel(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_update_channel(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_remove_channel(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_post_channel(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_save_greeting(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_segment_estimate(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_add_segment(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_segment_members(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_mark_sent(UUID, TEXT, TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_ensure_pack(UUID, TEXT) TO authenticated;
