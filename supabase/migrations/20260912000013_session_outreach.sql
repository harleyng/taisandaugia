-- ─────────────────────────────────────────────────────────────────────────────
-- GÓI TIẾP THỊ PHIÊN (outreach pack): bản nháp từng kênh, thông báo đấu giá theo
-- mẫu khoá, câu chào theo phân khúc, nhật ký sửa và nhật ký gửi.
--
-- NGUYÊN TẮC:
--  • Mẫu thông báo đấu giá sống trong CODE (src/lib/outreach/noticeTemplate.ts),
--    khoá theo phiên bản. DB chỉ lưu `notice_template_version` + giá trị các ô
--    'draft' — câu chữ điều khoản KHÔNG BAO GIỜ nằm ở chỗ ghi được.
--  • Mọi thay đổi trường sinh ra (kênh / ô thông báo / câu chào) và hồ sơ vụ việc
--    đi qua RPC SECURITY DEFINER; RPC ghi dòng trường VÀ dòng nhật ký trong cùng
--    một câu. Ba bảng fields / edits / sends CHỈ có policy SELECT ⇒ client không có
--    đường ghi nào để lách nhật ký.
--  • Sinh lại KHÔNG BAO GIỜ đè trường đã sửa tay (origin='edited') trừ khi người
--    dùng chọn rõ key đó; gợi ý mới chỉ vào generated_value + nhật ký 'suggest'.
--  • "Đã gửi" là nhật ký append-only, chỉ ghi được khi phiên đang công bố và còn
--    trong hạn nhận hồ sơ (outreach_send_window_open — BẢN SAO SQL của
--    canMarkSent() ở src/lib/outreach/sendWindow.ts; sửa một bên phải sửa cả hai).
--  • Ghi nhận liên hệ TỪNG KHÁCH chỉ nhận khách nằm trong org_session_audience và
--    đủ điều kiện gửi — không gửi ngoài danh sách truy vấn.
--
-- QUYỀN: xem = phien-dau-gia.view; sửa gói / đánh dấu kênh đã đăng =
-- phien-dau-gia.update; ghi nhận liên hệ khách = khach-hang.update. Phiên đã huỷ
-- khoá mọi thao tác ghi.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Bảng ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_outreach_packs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID NOT NULL UNIQUE REFERENCES public.auction_sessions(id) ON DELETE CASCADE,
  organization_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  notice_template_version TEXT NOT NULL CHECK (notice_template_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  -- Phần hồ sơ vụ việc tổ chức tự khai (người có tài sản, giấy tờ, nơi xem…) và
  -- phần bổ sung theo lô (khoá = id lô). KHÔNG chép dữ kiện phiên/lô vào đây.
  case_file               JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(case_file) = 'object'),
  generator_label         TEXT,
  input_signature         TEXT,
  generated_at            TIMESTAMPTZ,
  created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_outreach_packs_org ON public.session_outreach_packs (organization_id);

CREATE TABLE IF NOT EXISTS public.session_outreach_fields (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id         UUID NOT NULL REFERENCES public.session_outreach_packs(id) ON DELETE CASCADE,
  -- ĐỒNG BỘ với FIELD_KEY_PATTERN trong src/lib/outreach/fieldKeys.ts (test đọc file này).
  field_key       TEXT NOT NULL CHECK (field_key ~ '^(channel:(listing|zalo|facebook|sms|flyer)|notice:[a-z0-9_]+|pitch:(lot:[0-9a-f-]{36}|multi))$'),
  value           TEXT NOT NULL DEFAULT '' CHECK (char_length(value) <= 20000),
  generated_value TEXT CHECK (generated_value IS NULL OR char_length(generated_value) <= 20000),
  origin          TEXT NOT NULL CHECK (origin IN ('generated', 'edited')),
  updated_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT session_outreach_fields_key_uq UNIQUE (pack_id, field_key)
);

CREATE TABLE IF NOT EXISTS public.session_outreach_edits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id         UUID NOT NULL REFERENCES public.session_outreach_packs(id) ON DELETE CASCADE,
  -- 'case_file' cho nhật ký hồ sơ vụ việc, còn lại là field_key.
  field_key       TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('generate', 'regenerate', 'suggest', 'edit', 'reset', 'case_file')),
  old_value       TEXT,
  new_value       TEXT,
  generator_label TEXT,
  actor_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_outreach_edits_pack ON public.session_outreach_edits (pack_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_outreach_edits_field ON public.session_outreach_edits (pack_id, field_key, created_at DESC);

CREATE TABLE IF NOT EXISTS public.session_outreach_sends (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id         UUID NOT NULL REFERENCES public.session_outreach_packs(id) ON DELETE CASCADE,
  -- Đăng một kênh (tin đăng, bài Zalo/Facebook, SMS hàng loạt, tờ rơi, niêm yết thông báo)…
  channel         TEXT CHECK (channel IS NULL OR channel IN ('listing', 'zalo', 'facebook', 'sms', 'flyer', 'notice')),
  -- …HOẶC liên hệ trực tiếp một khách.
  contact_id      UUID REFERENCES public.org_contacts(id) ON DELETE SET NULL,
  contact_method  TEXT CHECK (contact_method IS NULL OR contact_method IN ('sms', 'zalo', 'call', 'email')),
  segment_key     TEXT,
  -- Tên khách lúc gửi — còn lại khi khách bị xoá khỏi danh bạ.
  recipient_label TEXT,
  text_snapshot   TEXT NOT NULL CHECK (char_length(btrim(text_snapshot)) > 0 AND char_length(text_snapshot) <= 20000),
  note            TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  marked_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  marked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT session_outreach_sends_shape CHECK (
    (channel IS NOT NULL AND contact_method IS NULL AND segment_key IS NULL AND recipient_label IS NULL)
    OR (channel IS NULL AND contact_method IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_session_outreach_sends_pack ON public.session_outreach_sends (pack_id, marked_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_outreach_sends_contact ON public.session_outreach_sends (contact_id) WHERE contact_id IS NOT NULL;

DROP TRIGGER IF EXISTS session_outreach_packs_updated_at ON public.session_outreach_packs;
CREATE TRIGGER session_outreach_packs_updated_at
  BEFORE UPDATE ON public.session_outreach_packs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 2. RLS — CHỈ SELECT ────────────────────────────────────────────────────
ALTER TABLE public.session_outreach_packs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_outreach_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_outreach_edits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_outreach_sends  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_outreach_packs_select" ON public.session_outreach_packs;
CREATE POLICY "session_outreach_packs_select" ON public.session_outreach_packs
  FOR SELECT TO authenticated
  USING (public.can_manage_auction_sessions(organization_id, 'view'));

DROP POLICY IF EXISTS "session_outreach_fields_select" ON public.session_outreach_fields;
CREATE POLICY "session_outreach_fields_select" ON public.session_outreach_fields
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.session_outreach_packs p
                  WHERE p.id = pack_id AND public.can_manage_auction_sessions(p.organization_id, 'view')));

DROP POLICY IF EXISTS "session_outreach_edits_select" ON public.session_outreach_edits;
CREATE POLICY "session_outreach_edits_select" ON public.session_outreach_edits
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.session_outreach_packs p
                  WHERE p.id = pack_id AND public.can_manage_auction_sessions(p.organization_id, 'view')));

-- Dòng liên hệ từng khách mang tên khách ⇒ cần thêm quyền xem danh bạ.
DROP POLICY IF EXISTS "session_outreach_sends_select" ON public.session_outreach_sends;
CREATE POLICY "session_outreach_sends_select" ON public.session_outreach_sends
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.session_outreach_packs p
                  WHERE p.id = pack_id
                    AND public.can_manage_auction_sessions(p.organization_id, 'view')
                    AND (contact_method IS NULL OR public.can_manage_org_contacts(p.organization_id, 'view'))));

-- ─── 3. Hàm nội bộ (không cấp cho client) ──────────────────────────────────
-- Trả gói nếu người gọi được SỬA và phiên chưa huỷ; ngược lại RAISE.
CREATE OR REPLACE FUNCTION public.outreach_writable_pack(_pack_id UUID)
RETURNS public.session_outreach_packs
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _p public.session_outreach_packs;
  _status TEXT;
BEGIN
  SELECT * INTO _p FROM public.session_outreach_packs WHERE id = _pack_id;
  IF NOT FOUND OR NOT public.can_manage_auction_sessions(_p.organization_id, 'view') THEN
    RAISE EXCEPTION 'Không tìm thấy gói tiếp thị.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.can_manage_auction_sessions(_p.organization_id, 'update') THEN
    RAISE EXCEPTION 'Vai trò của bạn chưa được sửa gói tiếp thị của phiên này.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT s.status INTO _status FROM public.auction_sessions s WHERE s.id = _p.session_id;
  IF _status = 'cancelled' THEN
    RAISE EXCEPTION 'Phiên đã huỷ — gói tiếp thị không sửa được nữa.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN _p;
END; $$;

-- BẢN SAO SQL của canMarkSent() (src/lib/outreach/sendWindow.ts) = phiên đã công
-- bố VÀ sessionPhaseOf() đang là 'registration_open'.
CREATE OR REPLACE FUNCTION public.outreach_send_window_open(_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auction_sessions s
     WHERE s.id = _session_id
       AND s.status = 'published'
       AND now() < s.starts_at
       AND now() <= s.ends_at
       AND (s.registration_end_at IS NULL OR now() <= s.registration_end_at)
  )
$$;

REVOKE ALL ON FUNCTION public.outreach_writable_pack(UUID)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.outreach_send_window_open(UUID) FROM PUBLIC, anon, authenticated;

-- ─── 4. RPC ─────────────────────────────────────────────────────────────────
-- Lấy (hoặc tạo) gói của phiên. Người chỉ có quyền xem mà gói chưa có ⇒ NULL.
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
  END IF;
  RETURN _pid;
END; $$;

-- Áp một lượt sinh. _fields = { field_key: value }. Trả số trường có giá trị HIỂN
-- THỊ thay đổi.
CREATE OR REPLACE FUNCTION public.outreach_apply_generation(
  _pack_id UUID, _fields JSONB, _generator_label TEXT, _input_signature TEXT, _overwrite_keys TEXT[] DEFAULT '{}'
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _key TEXT;
  _val TEXT;
  _f public.session_outreach_fields;
  _changed INT := 0;
  _uid UUID := auth.uid();
BEGIN
  PERFORM public.outreach_writable_pack(_pack_id);
  IF _fields IS NULL OR jsonb_typeof(_fields) <> 'object' THEN
    RAISE EXCEPTION 'Dữ liệu bản nháp không hợp lệ.' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOR _key, _val IN SELECT key, value FROM jsonb_each_text(_fields) LOOP
    _val := COALESCE(_val, '');
    SELECT * INTO _f FROM public.session_outreach_fields
     WHERE pack_id = _pack_id AND field_key = _key FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.session_outreach_fields (pack_id, field_key, value, generated_value, origin, updated_by)
      VALUES (_pack_id, _key, _val, _val, 'generated', _uid);
      INSERT INTO public.session_outreach_edits (pack_id, field_key, kind, old_value, new_value, generator_label, actor_id)
      VALUES (_pack_id, _key, 'generate', NULL, _val, _generator_label, _uid);
      _changed := _changed + 1;

    ELSIF _f.origin = 'generated' OR _key = ANY (COALESCE(_overwrite_keys, '{}'::TEXT[])) THEN
      IF _f.value IS DISTINCT FROM _val OR _f.origin <> 'generated' THEN
        UPDATE public.session_outreach_fields
           SET value = _val, generated_value = _val, origin = 'generated', updated_by = _uid, updated_at = now()
         WHERE id = _f.id;
        INSERT INTO public.session_outreach_edits (pack_id, field_key, kind, old_value, new_value, generator_label, actor_id)
        VALUES (_pack_id, _key, 'regenerate', _f.value, _val, _generator_label, _uid);
        _changed := _changed + 1;
      END IF;

    ELSIF _f.generated_value IS DISTINCT FROM _val THEN
      -- Trường đã sửa tay: giữ nguyên giá trị hiển thị, chỉ lưu gợi ý mới.
      UPDATE public.session_outreach_fields SET generated_value = _val WHERE id = _f.id;
      INSERT INTO public.session_outreach_edits (pack_id, field_key, kind, old_value, new_value, generator_label, actor_id)
      VALUES (_pack_id, _key, 'suggest', _f.generated_value, _val, _generator_label, _uid);
    END IF;
  END LOOP;

  UPDATE public.session_outreach_packs
     SET generator_label = _generator_label, input_signature = _input_signature, generated_at = now()
   WHERE id = _pack_id;
  RETURN _changed;
END; $$;

CREATE OR REPLACE FUNCTION public.outreach_edit_field(_pack_id UUID, _key TEXT, _value TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _f public.session_outreach_fields;
  _val TEXT := COALESCE(_value, '');
  _uid UUID := auth.uid();
BEGIN
  PERFORM public.outreach_writable_pack(_pack_id);
  SELECT * INTO _f FROM public.session_outreach_fields
   WHERE pack_id = _pack_id AND field_key = _key FOR UPDATE;

  IF NOT FOUND THEN
    IF _val = '' THEN RETURN false; END IF;
    INSERT INTO public.session_outreach_fields (pack_id, field_key, value, generated_value, origin, updated_by)
    VALUES (_pack_id, _key, _val, NULL, 'edited', _uid);
    INSERT INTO public.session_outreach_edits (pack_id, field_key, kind, old_value, new_value, actor_id)
    VALUES (_pack_id, _key, 'edit', NULL, _val, _uid);
    RETURN true;
  END IF;

  IF _f.value = _val THEN RETURN false; END IF;

  UPDATE public.session_outreach_fields
     SET value = _val,
         origin = CASE WHEN _f.generated_value IS NOT NULL AND _val = _f.generated_value THEN 'generated' ELSE 'edited' END,
         updated_by = _uid,
         updated_at = now()
   WHERE id = _f.id;
  INSERT INTO public.session_outreach_edits (pack_id, field_key, kind, old_value, new_value, actor_id)
  VALUES (_pack_id, _key, 'edit', _f.value, _val, _uid);
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.outreach_reset_field(_pack_id UUID, _key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _f public.session_outreach_fields;
  _uid UUID := auth.uid();
BEGIN
  PERFORM public.outreach_writable_pack(_pack_id);
  SELECT * INTO _f FROM public.session_outreach_fields
   WHERE pack_id = _pack_id AND field_key = _key FOR UPDATE;
  IF NOT FOUND OR _f.generated_value IS NULL THEN
    RAISE EXCEPTION 'Trường này chưa có bản do trình soạn tạo để khôi phục.' USING ERRCODE = 'check_violation';
  END IF;
  IF _f.value = _f.generated_value AND _f.origin = 'generated' THEN RETURN false; END IF;

  UPDATE public.session_outreach_fields
     SET value = _f.generated_value, origin = 'generated', updated_by = _uid, updated_at = now()
   WHERE id = _f.id;
  INSERT INTO public.session_outreach_edits (pack_id, field_key, kind, old_value, new_value, actor_id)
  VALUES (_pack_id, _key, 'reset', _f.value, _f.generated_value, _uid);
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.outreach_save_case_file(_pack_id UUID, _case_file JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _p public.session_outreach_packs;
BEGIN
  _p := public.outreach_writable_pack(_pack_id);
  IF _case_file IS NULL OR jsonb_typeof(_case_file) <> 'object' THEN
    RAISE EXCEPTION 'Hồ sơ vụ việc không hợp lệ.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF octet_length(_case_file::TEXT) > 200000 THEN
    RAISE EXCEPTION 'Hồ sơ vụ việc quá dài.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF _p.case_file = _case_file THEN RETURN false; END IF;

  UPDATE public.session_outreach_packs SET case_file = _case_file WHERE id = _pack_id;
  INSERT INTO public.session_outreach_edits (pack_id, field_key, kind, old_value, new_value, actor_id)
  VALUES (_pack_id, 'case_file', 'case_file', _p.case_file::TEXT, _case_file::TEXT, auth.uid());
  RETURN true;
END; $$;

-- Đánh dấu đã gửi.
--   _contacts IS NULL  ⇒ đăng một kênh (_channel bắt buộc), cần phien-dau-gia.update.
--   _contacts = [{contact_id, method, segment_key, text}] ⇒ liên hệ từng khách, cần
--   khach-hang.update; mỗi khách PHẢI đang đủ điều kiện trong org_session_audience.
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
  _contact public.org_contacts;
  _eligible UUID[];
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

  SELECT COALESCE(array_agg(a.contact_id), '{}'::UUID[]) INTO _eligible
    FROM public.org_session_audience(_p.session_id) a
   WHERE a.eligible;

  FOR _c IN SELECT value FROM jsonb_array_elements(_contacts) LOOP
    _cid := NULLIF(_c->>'contact_id', '')::UUID;
    SELECT * INTO _contact FROM public.org_contacts
     WHERE id = _cid AND organization_id = _p.organization_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Khách hàng không thuộc tổ chức.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NOT (_cid = ANY (_eligible)) THEN
      RAISE EXCEPTION 'Khách "%" không (còn) nằm trong danh sách người nhận đủ điều kiện của phiên.', _contact.full_name
        USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO public.session_outreach_sends
      (pack_id, contact_id, contact_method, segment_key, recipient_label, text_snapshot, note, marked_by)
    VALUES
      (_pack_id, _cid, _c->>'method', NULLIF(_c->>'segment_key', ''), _contact.full_name,
       COALESCE(_c->>'text', ''), NULLIF(btrim(COALESCE(_note, '')), ''), _uid);
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END; $$;

REVOKE ALL ON FUNCTION public.outreach_ensure_pack(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.outreach_apply_generation(UUID, JSONB, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.outreach_edit_field(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.outreach_reset_field(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.outreach_save_case_file(UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.outreach_mark_sent(UUID, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.outreach_ensure_pack(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_apply_generation(UUID, JSONB, TEXT, TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_edit_field(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_reset_field(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_save_case_file(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_mark_sent(UUID, TEXT, TEXT, JSONB, TEXT) TO authenticated;
