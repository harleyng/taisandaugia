-- ─────────────────────────────────────────────────────────────────────────────
-- TIẾP THỊ PHIÊN — bản MVP (design "Phien Dau Gia - Cong Cong Ty MVP", pdg-mvp3.js):
-- AI viết MỘT bài chung cho mọi tài sản; mỗi kênh dùng bài chung hoặc có bài riêng.
--
--   • Bài chung + tuỳ chọn viết nằm trên gói (session_outreach_packs.post_*).
--   • Bài riêng của kênh = session_outreach_channels.custom_body + own_content (cột
--     sẵn có từ 20261018120000); tuỳ chọn viết riêng = post_options.
--   • Ghi vẫn CHỈ qua RPC SECURITY DEFINER, kèm nhật ký session_outreach_edits.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.session_outreach_packs
  ADD COLUMN IF NOT EXISTS post_text       TEXT NOT NULL DEFAULT '' CHECK (char_length(post_text) <= 20000),
  ADD COLUMN IF NOT EXISTS post_options    JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(post_options) = 'object'),
  -- Lần AI viết gần nhất; post_edited = người dùng đã sửa tay sau lần đó.
  ADD COLUMN IF NOT EXISTS post_written_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS post_edited     BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.session_outreach_channels
  ADD COLUMN IF NOT EXISTS post_options JSONB CHECK (post_options IS NULL OR jsonb_typeof(post_options) = 'object');

ALTER TABLE public.session_outreach_edits DROP CONSTRAINT IF EXISTS session_outreach_edits_kind_check;
ALTER TABLE public.session_outreach_edits
  ADD CONSTRAINT session_outreach_edits_kind_check CHECK (
    kind IN ('generate', 'regenerate', 'suggest', 'edit', 'reset', 'case_file', 'channel', 'segment', 'greeting', 'post')
  );

-- Lưu bài chung. _generated = true ⇒ bản AI vừa viết (ghi thời điểm + tuỳ chọn);
-- false ⇒ người dùng sửa tay.
CREATE OR REPLACE FUNCTION public.outreach_save_post(
  _pack_id UUID, _text TEXT, _options JSONB DEFAULT NULL, _generated BOOLEAN DEFAULT false
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _p public.session_outreach_packs;
  _t TEXT := COALESCE(_text, '');
BEGIN
  _p := public.outreach_writable_pack(_pack_id);
  IF _options IS NOT NULL AND jsonb_typeof(_options) <> 'object' THEN
    RAISE EXCEPTION 'Tuỳ chọn bài viết không hợp lệ.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT _generated AND _p.post_text = _t THEN RETURN false; END IF;

  UPDATE public.session_outreach_packs
     SET post_text       = _t,
         post_options    = CASE WHEN _generated THEN COALESCE(_options, post_options) ELSE post_options END,
         post_written_at = CASE WHEN _generated THEN now() ELSE post_written_at END,
         post_edited     = NOT _generated
   WHERE id = _pack_id;
  INSERT INTO public.session_outreach_edits (pack_id, field_key, kind, old_value, new_value, generator_label, actor_id)
  VALUES (_pack_id, 'post', 'post', _p.post_text, _t, CASE WHEN _generated THEN 'ai' END, auth.uid());
  RETURN true;
END; $$;

-- Bản trước + khoá post_options.
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
  IF _patch ? 'name'         THEN _n.name         := btrim(COALESCE(_patch->>'name', '')); END IF;
  IF _patch ? 'target'       THEN _n.target       := COALESCE(_patch->>'target', ''); END IF;
  IF _patch ? 'own_content'  THEN _n.own_content  := COALESCE((_patch->>'own_content')::BOOLEAN, false); END IF;
  IF _patch ? 'custom_head'  THEN _n.custom_head  := COALESCE(_patch->>'custom_head', ''); END IF;
  IF _patch ? 'custom_body'  THEN _n.custom_body  := COALESCE(_patch->>'custom_body', ''); END IF;
  IF _patch ? 'custom_cta'   THEN _n.custom_cta   := COALESCE(_patch->>'custom_cta', ''); END IF;
  IF _patch ? 'scheduled_at' THEN _n.scheduled_at := NULLIF(_patch->>'scheduled_at', '')::TIMESTAMPTZ; END IF;
  IF _patch ? 'post_options' THEN
    _n.post_options := CASE WHEN jsonb_typeof(_patch->'post_options') = 'object' THEN _patch->'post_options' END;
  END IF;
  IF _c.kind = 'cong' AND _n.own_content THEN
    RAISE EXCEPTION 'Thông báo đấu giá phải đúng mẫu — không viết riêng được.' USING ERRCODE = 'check_violation';
  END IF;

  IF (_n.name, _n.target, _n.own_content, _n.custom_head, _n.custom_body, _n.custom_cta, _n.scheduled_at, _n.post_options)
     IS NOT DISTINCT FROM
     (_c.name, _c.target, _c.own_content, _c.custom_head, _c.custom_body, _c.custom_cta, _c.scheduled_at, _c.post_options) THEN
    RETURN false;
  END IF;

  UPDATE public.session_outreach_channels
     SET name = _n.name, target = _n.target, own_content = _n.own_content,
         custom_head = _n.custom_head, custom_body = _n.custom_body, custom_cta = _n.custom_cta,
         scheduled_at = _n.scheduled_at, post_options = _n.post_options
   WHERE id = _channel_id;
  INSERT INTO public.session_outreach_edits (pack_id, field_key, kind, old_value, new_value, actor_id)
  VALUES (_c.pack_id, 'channel:' || _channel_id, 'channel', to_jsonb(_c)::TEXT, to_jsonb(_n)::TEXT, auth.uid());
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.outreach_save_post(UUID, TEXT, JSONB, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.outreach_save_post(UUID, TEXT, JSONB, BOOLEAN) TO authenticated;
