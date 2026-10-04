-- Truyền thông của chủ tài sản — Phase M2 (docs/owner-marketing-plan.md):
-- trình soạn chiến dịch, chế độ XUẤT, duyệt hai người (maker–checker).
--
--   1. owner_mkt_campaigns — chiến dịch cho 1..20 tài sản trên sàn mà Trạm đã nhận.
--      • facts_snapshot (giá, đặt trước, hạn, tổ chức…) do SERVER dựng từ phiên / tin
--        (owner_mkt_build_facts) — client KHÔNG BAO GIỜ gửi dữ kiện lên.
--      • drafts = phần mô tả người dùng được sửa, theo kênh (email/zalo/facebook/sms).
--        Khoá lạ (vd. 'facts', 'price') ⇒ RPC từ chối 'drafts_invalid'.
--      • Phase M2 chỉ chạy mode 'export'; 'platform_email' có trong CHECK cho M3 nhưng
--        mọi RPC trả 'mode_not_available'.
--   2. owner_mkt_audit — nhật ký CHỈ GHI THÊM; mọi bước tạo / sửa / gửi duyệt / duyệt /
--      từ chối / đánh dấu đã gửi / xuất tư liệu ghi một dòng TRONG CÙNG RPC.
--   3. Không có policy ghi nào: client chỉ SELECT; mọi thay đổi qua RPC SECURITY
--      DEFINER trả {ok:false, reason} cho lỗi nghiệp vụ.
--   4. Duyệt (truyen-thong:finalize): người duyệt ≠ người soạn / người gửi duyệt, trừ
--      khi Trạm chỉ có 1 thành viên. Duyệt xong tự tạo 1 link theo dõi / tài sản / kênh
--      (owner_mkt_links.campaign_id — FK thêm ở file này).
--   5. Quyết định D4: tài sản chưa có phiên công bố ⇒ dữ kiện giá / hạn bị bỏ khỏi
--      snapshot (announced=false); UI nói rõ lý do.
--
-- Phạm vi chi nhánh: mỗi tài sản suy chi nhánh từ claim (như owner_mkt_links_prepare);
-- người bị giới hạn chi nhánh chỉ thao tác được chiến dịch mà MỌI tài sản nằm trong
-- phạm vi của mình (owner_mkt_can).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Bảng
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.owner_mkt_campaigns (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  -- Chi nhánh chung của các tài sản (NULL = nhiều chi nhánh / không thuộc chi nhánh nào).
  -- Chỉ để lọc danh sách — cổng quyền thật là owner_mkt_can trên TỪNG tài sản.
  branch_id          UUID REFERENCES public.workspace_branches(id) ON DELETE SET NULL,
  name               TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 120),
  notes              TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  -- Tin trên sàn (listings.id) — không FK được trên mảng; RPC kiểm claim của Trạm.
  listing_ids        UUID[] NOT NULL CHECK (cardinality(listing_ids) BETWEEN 1 AND 20),
  mode               TEXT NOT NULL DEFAULT 'export' CHECK (mode IN ('platform_email', 'export')),
  channels           TEXT[] NOT NULL DEFAULT '{}'
                     CHECK (channels <@ ARRAY['email', 'zalo', 'facebook', 'sms']::TEXT[]),
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'pending_approval', 'approved', 'scheduled', 'sending',
                                       'sent', 'ended', 'rejected')),
  facts_snapshot     JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(facts_snapshot) = 'object'),
  drafts             JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(drafts) = 'object'),
  -- Phase M3 (hoãn): chỉ tiêu chí, KHÔNG BAO GIỜ id người dùng.
  audience_spec      JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(audience_spec) = 'object'),
  eligible_count     INTEGER CHECK (eligible_count IS NULL OR eligible_count >= 0),
  recipient_count    INTEGER CHECK (recipient_count IS NULL OR recipient_count >= 0),
  skipped_cap_count  INTEGER CHECK (skipped_cap_count IS NULL OR skipped_cap_count >= 0),
  sent_count         INTEGER NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  opened_count       INTEGER NOT NULL DEFAULT 0 CHECK (opened_count >= 0),
  clicked_count      INTEGER NOT NULL DEFAULT 0 CHECK (clicked_count >= 0),
  schedule_type      TEXT NOT NULL DEFAULT 'immediate' CHECK (schedule_type IN ('immediate', 'scheduled')),
  scheduled_at       TIMESTAMPTZ,
  -- Chế độ xuất: kênh nào đơn vị đã tự gửi, lúc nào ({"zalo": "2026-10-02T…"}).
  sent_channels      JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(sent_channels) = 'object'),
  created_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_at       TIMESTAMPTZ,
  approved_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at        TIMESTAMPTZ,
  rejected_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at        TIMESTAMPTZ,
  rejected_reason    TEXT CHECK (rejected_reason IS NULL OR char_length(rejected_reason) <= 500),
  sent_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX owner_mkt_campaigns_workspace_idx ON public.owner_mkt_campaigns (workspace_id, created_at DESC);
CREATE INDEX owner_mkt_campaigns_listings_idx ON public.owner_mkt_campaigns USING GIN (listing_ids);

COMMENT ON TABLE public.owner_mkt_campaigns IS
  'Chiến dịch truyền thông của Trạm Điều Hành. Chỉ đọc với client; ghi qua RPC owner_mkt_*. facts_snapshot do server dựng.';

CREATE TRIGGER owner_mkt_campaigns_updated_at
  BEFORE UPDATE ON public.owner_mkt_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.owner_mkt_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_mkt_campaigns_member_read ON public.owner_mkt_campaigns
  FOR SELECT TO authenticated
  USING (public.owner_ws_can(workspace_id, 'read'));

REVOKE ALL ON public.owner_mkt_campaigns FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.owner_mkt_campaigns TO authenticated;

-- Link do chiến dịch tạo ra trỏ về chiến dịch; xoá chiến dịch (chỉ nháp chưa từng gửi
-- duyệt — chưa có link) không bao giờ xoá link.
ALTER TABLE public.owner_mkt_links
  ADD CONSTRAINT owner_mkt_links_campaign_fk
  FOREIGN KEY (campaign_id) REFERENCES public.owner_mkt_campaigns(id) ON DELETE SET NULL;

CREATE TABLE public.owner_mkt_audit (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id  UUID NOT NULL REFERENCES public.owner_mkt_campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  action       TEXT NOT NULL
               CHECK (action IN ('create', 'update', 'submit', 'approve', 'reject', 'mark_sent', 'export')),
  actor        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note         TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  detail       JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(detail) = 'object'),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX owner_mkt_audit_campaign_idx ON public.owner_mkt_audit (campaign_id, created_at);

COMMENT ON TABLE public.owner_mkt_audit IS
  'Nhật ký chiến dịch truyền thông — chỉ ghi thêm, chỉ ghi trong RPC owner_mkt_*.';

-- Chỉ ghi thêm: chặn sửa (kể cả service role). Xoá chỉ xảy ra qua CASCADE khi xoá
-- chiến dịch nháp chưa từng gửi duyệt.
CREATE FUNCTION public.owner_mkt_audit_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'owner_mkt_audit là nhật ký chỉ ghi thêm' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER owner_mkt_audit_no_update
  BEFORE UPDATE ON public.owner_mkt_audit
  FOR EACH ROW EXECUTE FUNCTION public.owner_mkt_audit_immutable();

ALTER TABLE public.owner_mkt_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_mkt_audit_member_read ON public.owner_mkt_audit
  FOR SELECT TO authenticated
  USING (public.owner_ws_can(workspace_id, 'read'));

REVOKE ALL ON public.owner_mkt_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.owner_mkt_audit TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Link tạo bởi chiến dịch bỏ qua kiểm quyền 'create'
-- ═══════════════════════════════════════════════════════════════════════════
-- Người duyệt có 'finalize' nhưng có thể không có 'create'. campaign_id KHÔNG nằm trong
-- quyền cột INSERT của authenticated ⇒ campaign_id khác NULL chỉ đến từ RPC duyệt
-- (SECURITY DEFINER, đã tự kiểm quyền). Phần còn lại giữ nguyên bản LIVE của M1.

CREATE OR REPLACE FUNCTION public.owner_mkt_links_prepare()
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
  -- (auth.uid() NULL = migration / service_role; campaign_id = RPC duyệt chiến dịch.)
  IF auth.uid() IS NOT NULL AND NEW.campaign_id IS NULL
     AND NOT public.owner_ws_has(NEW.workspace_id, 'truyen-thong', 'create') THEN
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Helper
-- ═══════════════════════════════════════════════════════════════════════════

-- Tài sản của Trạm + chi nhánh suy từ claim. Tin không (còn) được nhận ⇒ không có dòng.
CREATE FUNCTION public.owner_mkt_listing_scope(p_workspace_id UUID, p_listing_ids UUID[])
RETURNS TABLE (listing_id UUID, branch_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT ON (c.listing_id) c.listing_id, wb.id
    FROM public.asset_owner_claims c
    LEFT JOIN public.workspace_branches wb
      ON wb.workspace_id = c.workspace_id AND wb.asset_owner_id = c.asset_owner_id
   WHERE c.workspace_id = p_workspace_id
     AND c.listing_id = ANY (p_listing_ids)
     AND c.status IN ('auto_claimed', 'confirmed')
   ORDER BY c.listing_id, wb.id
$$;

-- Quyền module + phạm vi chi nhánh của MỌI tài sản (tài sản không thuộc chi nhánh nào
-- ⇒ chỉ người không bị giới hạn — giống owner_ws_branch_ok).
CREATE FUNCTION public.owner_mkt_can(p_workspace_id UUID, p_action TEXT, p_listing_ids UUID[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.owner_ws_has(p_workspace_id, 'truyen-thong', p_action)
     AND NOT EXISTS (
       SELECT 1 FROM public.owner_mkt_listing_scope(p_workspace_id, p_listing_ids) s
        WHERE NOT public.owner_ws_branch_ok(p_workspace_id, s.branch_id))
$$;

CREATE FUNCTION public.owner_mkt_try_ts(p TEXT)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
BEGIN
  RETURN NULLIF(btrim(p), '')::TIMESTAMPTZ;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE FUNCTION public.owner_mkt_try_num(p TEXT)
RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
BEGIN
  RETURN NULLIF(btrim(p), '')::NUMERIC;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- Dữ kiện CÔNG KHAI của một tài sản, đọc từ thông báo đấu giá. Ưu tiên:
--   1. Phiên trên sàn đã công bố (published) chứa tin, chưa kết thúc — phiên sớm nhất.
--   2. Tin đang đăng (ACTIVE) có giờ đấu giá / hạn đăng ký CHƯA QUA trong thông báo gốc.
--   3. Không có ⇒ announced=false: bỏ giá, đặt trước, bước giá, hạn, giờ (quyết định D4).
-- KHÔNG BAO GIỜ đọc mô tả tự do của tin (có thể chứa tên người vay) hay người có tài sản.
CREATE FUNCTION public.owner_mkt_listing_facts(p_listing_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  l      public.listings%ROWTYPE;
  s      RECORD;
  o      RECORD;
  _ca    JSONB;
  _src   TEXT;
  _auct  TIMESTAMPTZ;
  _reg   TIMESTAMPTZ;
  _org   UUID;
BEGIN
  SELECT * INTO l FROM public.listings WHERE id = p_listing_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  _ca := COALESCE(l.custom_attributes, '{}'::JSONB);

  SELECT ss.id, ss.code, ss.starts_at, ss.registration_start_at, ss.registration_end_at,
         ss.viewing_start_at, ss.viewing_end_at, ss.venue, ss.dossier_fee, ss.auction_format,
         ss.auction_org_id, i.lot_no, i.starting_price, i.deposit_amount, i.bid_step
    INTO s
    FROM public.auction_session_items i
    JOIN public.auction_sessions ss ON ss.id = i.session_id
   WHERE i.listing_id = p_listing_id
     AND ss.status = 'published'
     AND now() <= ss.ends_at
   ORDER BY ss.starts_at
   LIMIT 1;

  IF FOUND THEN
    _src := 'session';
    _org := COALESCE(s.auction_org_id, l.auction_org_id);
  ELSE
    _auct := public.owner_mkt_try_ts(_ca ->> 'auction_time');
    _reg := public.owner_mkt_try_ts(_ca ->> 'registration_deadline');
    IF l.status = 'ACTIVE' AND (_auct >= now() OR _reg >= now()) THEN
      _src := 'notice';
    END IF;
    _org := l.auction_org_id;
  END IF;

  SELECT a.name, a.phone, a.address INTO o FROM public.auction_organizations a WHERE a.id = _org;

  RETURN jsonb_build_object(
    'listing_id', l.id,
    'title', l.title,
    'category_slug', l.property_type_slug,
    'province', l.address ->> 'province',
    'district', l.address ->> 'district',
    'area', l.area,
    'image_url', l.image_url,
    'announced', _src IS NOT NULL,
    'source', _src,
    'session_code', CASE WHEN _src = 'session' THEN s.code END,
    'lot_no', CASE WHEN _src = 'session' THEN s.lot_no END,
    'starting_price', CASE _src WHEN 'session' THEN s.starting_price
                                WHEN 'notice' THEN CASE WHEN l.price_unit = 'TOTAL' THEN l.price END END,
    'deposit', CASE _src WHEN 'session' THEN s.deposit_amount
                         WHEN 'notice' THEN public.owner_mkt_try_num(_ca ->> 'deposit_amount') END,
    'bid_step', CASE _src WHEN 'session' THEN s.bid_step
                          WHEN 'notice' THEN public.owner_mkt_try_num(_ca ->> 'bid_step') END,
    'dossier_fee', CASE WHEN _src = 'session' THEN s.dossier_fee END,
    'auction_at', CASE _src WHEN 'session' THEN s.starts_at WHEN 'notice' THEN _auct END,
    'registration_start_at', CASE WHEN _src = 'session' THEN s.registration_start_at END,
    'registration_end_at', CASE _src WHEN 'session' THEN s.registration_end_at WHEN 'notice' THEN _reg END,
    'viewing_start_at', CASE WHEN _src = 'session' THEN s.viewing_start_at END,
    'viewing_end_at', CASE WHEN _src = 'session' THEN s.viewing_end_at END,
    'venue', CASE _src WHEN 'session' THEN s.venue WHEN 'notice' THEN NULLIF(btrim(_ca ->> 'auction_location'), '') END,
    'auction_format', CASE WHEN _src = 'session' THEN s.auction_format END,
    'org_name', o.name,
    'org_phone', o.phone,
    'org_address', o.address
  );
END;
$$;

-- Snapshot cho cả chiến dịch, giữ đúng thứ tự tài sản người dùng chọn.
CREATE FUNCTION public.owner_mkt_build_facts(p_listing_ids UUID[])
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'version', 1,
    'built_at', now(),
    'assets', COALESCE((
      SELECT jsonb_agg(f.facts ORDER BY f.ord)
        FROM (SELECT public.owner_mkt_listing_facts(x.id) AS facts, x.ord
                FROM unnest(p_listing_ids) WITH ORDINALITY AS x(id, ord)) f
       WHERE f.facts IS NOT NULL), '[]'::JSONB))
$$;

-- Bản nháp hợp lệ? NULL = hợp lệ; ngược lại là mã lỗi. p_complete = kiểm đủ để gửi duyệt.
-- Khoá cho phép CỐ ĐỊNH: thêm khoá lạ (vd. dữ kiện giá) ⇒ 'drafts_invalid'.
CREATE FUNCTION public.owner_mkt_drafts_check(p_drafts JSONB, p_channels TEXT[], p_complete BOOLEAN)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
DECLARE
  _ch   TEXT;
  _v    JSONB;
  _k    TEXT;
  _body TEXT;
  _max  INTEGER;
BEGIN
  IF p_drafts IS NULL OR jsonb_typeof(p_drafts) <> 'object' THEN
    RETURN 'drafts_invalid';
  END IF;

  FOR _ch, _v IN SELECT * FROM jsonb_each(p_drafts) LOOP
    IF _ch NOT IN ('email', 'zalo', 'facebook', 'sms') OR jsonb_typeof(_v) <> 'object' THEN
      RETURN 'drafts_invalid';
    END IF;
    FOR _k IN SELECT jsonb_object_keys(_v) LOOP
      IF NOT (_k = 'body' OR (_ch = 'email' AND _k = 'subject')) OR jsonb_typeof(_v -> _k) <> 'string' THEN
        RETURN 'drafts_invalid';
      END IF;
    END LOOP;
    _body := COALESCE(_v ->> 'body', '');
    _max := CASE _ch WHEN 'sms' THEN 80 WHEN 'email' THEN 5000 ELSE 3000 END;
    IF char_length(_body) > _max OR char_length(COALESCE(_v ->> 'subject', '')) > 150 THEN
      RETURN 'drafts_too_long';
    END IF;
    -- SMS không dấu (GSM-7) — khớp isSmsSafe ở src/lib/outreach/sms.ts.
    IF _ch = 'sms' AND _body !~ '^[ -~]*$' THEN
      RETURN 'sms_not_ascii';
    END IF;
  END LOOP;

  IF p_complete THEN
    IF cardinality(p_channels) = 0 THEN
      RETURN 'no_channel';
    END IF;
    FOREACH _ch IN ARRAY p_channels LOOP
      IF btrim(COALESCE(p_drafts -> _ch ->> 'body', '')) = ''
         OR (_ch = 'email' AND btrim(COALESCE(p_drafts -> 'email' ->> 'subject', '')) = '') THEN
        RETURN 'incomplete';
      END IF;
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION public.owner_mkt_log(p_campaign public.owner_mkt_campaigns, p_action TEXT, p_note TEXT, p_detail JSONB)
RETURNS VOID LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.owner_mkt_audit (campaign_id, workspace_id, action, actor, note, detail)
  VALUES (p_campaign.id, p_campaign.workspace_id, p_action, auth.uid(), NULLIF(btrim(p_note), ''),
          COALESCE(p_detail, '{}'::JSONB));
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RPC
-- ═══════════════════════════════════════════════════════════════════════════

-- Dữ kiện hiện tại của các tài sản (trình soạn xem trước khi lưu). Chỉ đọc.
CREATE FUNCTION public.owner_mkt_preview_facts(p_workspace_id UUID, p_listing_ids UUID[])
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.owner_ws_can(p_workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF p_listing_ids IS NULL OR cardinality(p_listing_ids) NOT BETWEEN 1 AND 20 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'listings_invalid');
  END IF;
  IF (SELECT count(*) FROM public.owner_mkt_listing_scope(p_workspace_id, p_listing_ids))
     <> (SELECT count(DISTINCT x) FROM unnest(p_listing_ids) x) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'listing_not_in_workspace');
  END IF;
  RETURN jsonb_build_object('ok', true, 'facts', public.owner_mkt_build_facts(p_listing_ids));
END;
$$;

-- Tạo (p_campaign_id NULL) hoặc sửa nháp. Chiến dịch bị từ chối sửa xong quay về nháp.
CREATE FUNCTION public.owner_mkt_save_draft(
  p_campaign_id UUID,
  p_workspace_id UUID,
  p_name TEXT,
  p_notes TEXT,
  p_listing_ids UUID[],
  p_channels TEXT[],
  p_drafts JSONB
) RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c        public.owner_mkt_campaigns%ROWTYPE;
  _ids      UUID[];
  _channels TEXT[];
  _err      TEXT;
  _branch   UUID;
  _nb       INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_campaign_id IS NOT NULL THEN
    SELECT * INTO _c FROM public.owner_mkt_campaigns WHERE id = p_campaign_id FOR UPDATE;
    IF NOT FOUND OR NOT public.owner_ws_can(_c.workspace_id, 'read') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
    END IF;
    IF _c.mode <> 'export' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'mode_not_available');
    END IF;
    IF _c.status NOT IN ('draft', 'rejected') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
    END IF;
    -- Phải có quyền trên CẢ tài sản cũ lẫn tài sản mới.
    IF NOT public.owner_mkt_can(_c.workspace_id, 'update', _c.listing_ids) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
    END IF;
  ELSIF p_workspace_id IS NULL OR NOT public.owner_ws_can(p_workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 3 AND 120 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'name_invalid');
  END IF;
  IF p_notes IS NOT NULL AND char_length(p_notes) > 1000 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'notes_too_long');
  END IF;

  -- Bỏ trùng, giữ thứ tự chọn.
  SELECT array_agg(x.id ORDER BY x.ord) INTO _ids
    FROM (SELECT DISTINCT ON (id) id, ord FROM unnest(p_listing_ids) WITH ORDINALITY AS u(id, ord)
           WHERE id IS NOT NULL ORDER BY id, ord) x;
  IF _ids IS NULL OR cardinality(_ids) NOT BETWEEN 1 AND 20 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'listings_invalid');
  END IF;

  SELECT COALESCE(array_agg(DISTINCT ch ORDER BY ch), '{}') INTO _channels FROM unnest(p_channels) ch;
  IF NOT (_channels <@ ARRAY['email', 'zalo', 'facebook', 'sms']::TEXT[]) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'channel_invalid');
  END IF;

  _err := public.owner_mkt_drafts_check(p_drafts, _channels, false);
  IF _err IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', _err);
  END IF;

  -- Workspace của chiến dịch là cố định khi sửa.
  p_workspace_id := COALESCE(_c.workspace_id, p_workspace_id);
  IF (SELECT count(*) FROM public.owner_mkt_listing_scope(p_workspace_id, _ids)) <> cardinality(_ids) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'listing_not_in_workspace');
  END IF;
  IF NOT public.owner_mkt_can(p_workspace_id, CASE WHEN _c.id IS NULL THEN 'create' ELSE 'update' END, _ids) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT count(DISTINCT s.branch_id), min(s.branch_id::TEXT)::UUID INTO _nb, _branch
    FROM public.owner_mkt_listing_scope(p_workspace_id, _ids) s;
  IF _nb <> 1 OR EXISTS (SELECT 1 FROM public.owner_mkt_listing_scope(p_workspace_id, _ids) s
                          WHERE s.branch_id IS NULL) THEN
    _branch := NULL;
  END IF;

  IF _c.id IS NULL THEN
    INSERT INTO public.owner_mkt_campaigns
      (workspace_id, branch_id, name, notes, listing_ids, mode, channels, drafts, facts_snapshot, created_by)
    VALUES
      (p_workspace_id, _branch, btrim(p_name), NULLIF(btrim(p_notes), ''), _ids, 'export', _channels, p_drafts,
       public.owner_mkt_build_facts(_ids), auth.uid())
    RETURNING * INTO _c;
    PERFORM public.owner_mkt_log(_c, 'create', NULL, jsonb_build_object('assets', cardinality(_ids)));
  ELSE
    UPDATE public.owner_mkt_campaigns
       SET branch_id = _branch,
           name = btrim(p_name),
           notes = NULLIF(btrim(p_notes), ''),
           listing_ids = _ids,
           channels = _channels,
           drafts = p_drafts,
           facts_snapshot = public.owner_mkt_build_facts(_ids),
           status = 'draft'
     WHERE id = _c.id
    RETURNING * INTO _c;
    PERFORM public.owner_mkt_log(_c, 'update', NULL, jsonb_build_object('assets', cardinality(_ids)));
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', _c.id);
END;
$$;

-- Gửi duyệt: dựng lại dữ kiện tại thời điểm gửi — người duyệt thấy đúng thứ sẽ xuất.
CREATE FUNCTION public.owner_mkt_submit(p_campaign_id UUID)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c   public.owner_mkt_campaigns%ROWTYPE;
  _err TEXT;
BEGIN
  SELECT * INTO _c FROM public.owner_mkt_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.owner_ws_can(_c.workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT (public.owner_mkt_can(_c.workspace_id, 'update', _c.listing_ids)
          OR (_c.created_by = auth.uid() AND public.owner_mkt_can(_c.workspace_id, 'create', _c.listing_ids))) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF _c.mode <> 'export' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'mode_not_available');
  END IF;
  IF _c.status <> 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;
  IF (SELECT count(*) FROM public.owner_mkt_listing_scope(_c.workspace_id, _c.listing_ids))
     <> cardinality(_c.listing_ids) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'listing_not_in_workspace');
  END IF;
  _err := public.owner_mkt_drafts_check(_c.drafts, _c.channels, true);
  IF _err IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', _err);
  END IF;

  UPDATE public.owner_mkt_campaigns
     SET status = 'pending_approval',
         facts_snapshot = public.owner_mkt_build_facts(listing_ids),
         submitted_by = auth.uid(),
         submitted_at = now(),
         rejected_by = NULL,
         rejected_at = NULL,
         rejected_reason = NULL
   WHERE id = _c.id
  RETURNING * INTO _c;
  PERFORM public.owner_mkt_log(_c, 'submit', NULL, '{}'::JSONB);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Người duyệt / từ chối: có 'finalize' trên mọi tài sản, khác người soạn và người gửi
-- duyệt — trừ khi Trạm chỉ có đúng 1 thành viên đang hoạt động.
CREATE FUNCTION public.owner_mkt_checker_reason(p_c public.owner_mkt_campaigns)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.owner_mkt_can(p_c.workspace_id, 'finalize', p_c.listing_ids) THEN 'forbidden'
    WHEN p_c.mode <> 'export' THEN 'mode_not_available'
    WHEN p_c.status <> 'pending_approval' THEN 'invalid_status'
    WHEN auth.uid() IN (p_c.created_by, p_c.submitted_by)
         AND (SELECT count(*) FROM public.asset_owner_workspace_members m
               WHERE m.workspace_id = p_c.workspace_id AND m.status = 'active') > 1 THEN 'self_approval'
  END
$$;

CREATE FUNCTION public.owner_mkt_approve(p_campaign_id UUID, p_note TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c      public.owner_mkt_campaigns%ROWTYPE;
  _reason TEXT;
  _links  INTEGER;
BEGIN
  SELECT * INTO _c FROM public.owner_mkt_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.owner_ws_can(_c.workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  _reason := public.owner_mkt_checker_reason(_c);
  IF _reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', _reason);
  END IF;
  IF p_note IS NOT NULL AND char_length(p_note) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'note_too_long');
  END IF;
  IF (SELECT count(*) FROM public.owner_mkt_listing_scope(_c.workspace_id, _c.listing_ids))
     <> cardinality(_c.listing_ids) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'listing_not_in_workspace');
  END IF;

  -- Một link theo dõi cho mỗi tài sản × kênh (mã + chi nhánh do trigger sinh).
  INSERT INTO public.owner_mkt_links (workspace_id, listing_id, channel, label, campaign_id)
  SELECT _c.workspace_id, x.id, ch,
         left(_c.name, 60) || ' · ' ||
           CASE ch WHEN 'email' THEN 'Email' WHEN 'zalo' THEN 'Zalo' WHEN 'facebook' THEN 'Facebook' ELSE 'SMS' END,
         _c.id
    FROM unnest(_c.listing_ids) AS x(id)
   CROSS JOIN unnest(_c.channels) AS ch;
  GET DIAGNOSTICS _links = ROW_COUNT;

  UPDATE public.owner_mkt_campaigns
     SET status = 'approved', approved_by = auth.uid(), approved_at = now()
   WHERE id = _c.id
  RETURNING * INTO _c;
  PERFORM public.owner_mkt_log(_c, 'approve', p_note, jsonb_build_object('links', _links));
  RETURN jsonb_build_object('ok', true, 'links', _links);
END;
$$;

CREATE FUNCTION public.owner_mkt_reject(p_campaign_id UUID, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c      public.owner_mkt_campaigns%ROWTYPE;
  _reason TEXT;
BEGIN
  SELECT * INTO _c FROM public.owner_mkt_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.owner_ws_can(_c.workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  _reason := public.owner_mkt_checker_reason(_c);
  IF _reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', _reason);
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 3 AND 500 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;

  UPDATE public.owner_mkt_campaigns
     SET status = 'rejected', rejected_by = auth.uid(), rejected_at = now(), rejected_reason = btrim(p_reason)
   WHERE id = _c.id
  RETURNING * INTO _c;
  PERFORM public.owner_mkt_log(_c, 'reject', p_reason, '{}'::JSONB);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Chế độ xuất: đơn vị tự gửi qua kênh riêng rồi đánh dấu. Lần đánh dấu đầu ⇒ 'sent'.
-- Không kiểm cửa sổ đăng ký: link + xuất được phép mọi lúc (B2.3); trang /l/:code tự
-- hiện trạng thái phiên.
CREATE FUNCTION public.owner_mkt_mark_sent(p_campaign_id UUID, p_channel TEXT, p_note TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c public.owner_mkt_campaigns%ROWTYPE;
BEGIN
  SELECT * INTO _c FROM public.owner_mkt_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.owner_ws_can(_c.workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_mkt_can(_c.workspace_id, 'share', _c.listing_ids) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF _c.mode <> 'export' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'mode_not_available');
  END IF;
  IF _c.status NOT IN ('approved', 'sent') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;
  IF p_channel IS NULL OR NOT (p_channel = ANY (_c.channels)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'channel_invalid');
  END IF;
  IF _c.sent_channels ? p_channel THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_marked');
  END IF;
  IF p_note IS NOT NULL AND char_length(p_note) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'note_too_long');
  END IF;

  UPDATE public.owner_mkt_campaigns
     SET sent_channels = sent_channels || jsonb_build_object(p_channel, now()),
         status = 'sent',
         sent_at = COALESCE(sent_at, now())
   WHERE id = _c.id
  RETURNING * INTO _c;
  PERFORM public.owner_mkt_log(_c, 'mark_sent', p_note, jsonb_build_object('channel', p_channel));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Ghi nhật ký khi tải bộ tư liệu / in tờ rơi (B2.7 — xuất cũng phải có dấu vết).
CREATE FUNCTION public.owner_mkt_log_export(p_campaign_id UUID, p_kind TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c public.owner_mkt_campaigns%ROWTYPE;
BEGIN
  SELECT * INTO _c FROM public.owner_mkt_campaigns WHERE id = p_campaign_id;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.owner_ws_can(_c.workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_mkt_can(_c.workspace_id, 'share', _c.listing_ids) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF _c.status NOT IN ('approved', 'sent') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('kit', 'flyer') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'kind_invalid');
  END IF;
  PERFORM public.owner_mkt_log(_c, 'export', NULL, jsonb_build_object('kind', p_kind));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Xoá: chỉ nháp CHƯA TỪNG gửi duyệt (nhật ký của chiến dịch đã qua duyệt phải còn).
CREATE FUNCTION public.owner_mkt_delete(p_campaign_id UUID)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c public.owner_mkt_campaigns%ROWTYPE;
BEGIN
  SELECT * INTO _c FROM public.owner_mkt_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.owner_ws_can(_c.workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_mkt_can(_c.workspace_id, 'delete', _c.listing_ids) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF _c.status <> 'draft' OR _c.submitted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;
  DELETE FROM public.owner_mkt_campaigns WHERE id = _c.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─── Quyền thực thi ─────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.owner_mkt_audit_immutable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_mkt_listing_scope(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_mkt_can(UUID, TEXT, UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_mkt_try_ts(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_mkt_try_num(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_mkt_listing_facts(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_mkt_build_facts(UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_mkt_drafts_check(JSONB, TEXT[], BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_mkt_log(public.owner_mkt_campaigns, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_mkt_checker_reason(public.owner_mkt_campaigns) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.owner_mkt_preview_facts(UUID, UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_mkt_save_draft(UUID, UUID, TEXT, TEXT, UUID[], TEXT[], JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_mkt_submit(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_mkt_approve(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_mkt_reject(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_mkt_mark_sent(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_mkt_log_export(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_mkt_delete(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_mkt_preview_facts(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_mkt_save_draft(UUID, UUID, TEXT, TEXT, UUID[], TEXT[], JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_mkt_submit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_mkt_approve(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_mkt_reject(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_mkt_mark_sent(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_mkt_log_export(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_mkt_delete(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Tự kiểm
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t TEXT;
  f TEXT;
BEGIN
  -- Client chỉ đọc; mọi ghi qua RPC.
  FOREACH t IN ARRAY ARRAY['public.owner_mkt_campaigns', 'public.owner_mkt_audit'] LOOP
    IF has_table_privilege('anon', t, 'SELECT') THEN
      RAISE EXCEPTION 'self-check: anon đọc được %', t;
    END IF;
    IF has_table_privilege('authenticated', t, 'INSERT')
       OR has_table_privilege('authenticated', t, 'UPDATE')
       OR has_table_privilege('authenticated', t, 'DELETE') THEN
      RAISE EXCEPTION 'self-check: authenticated ghi thẳng được %', t;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public' AND tablename IN ('owner_mkt_campaigns', 'owner_mkt_audit')
                AND cmd <> 'SELECT') THEN
    RAISE EXCEPTION 'self-check: không được có policy ghi trên bảng chiến dịch';
  END IF;

  -- Helper nội bộ không lộ ra PostgREST.
  FOREACH f IN ARRAY ARRAY[
    'public.owner_mkt_listing_facts(uuid)', 'public.owner_mkt_build_facts(uuid[])',
    'public.owner_mkt_can(uuid, text, uuid[])', 'public.owner_mkt_listing_scope(uuid, uuid[])',
    'public.owner_mkt_drafts_check(jsonb, text[], boolean)'] LOOP
    IF has_function_privilege('authenticated', f, 'EXECUTE') OR has_function_privilege('anon', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'self-check: client gọi được %', f;
    END IF;
  END LOOP;
  IF has_function_privilege('anon', 'public.owner_mkt_save_draft(uuid, uuid, text, text, uuid[], text[], jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'self-check: anon gọi được owner_mkt_save_draft';
  END IF;

  -- Luật bản nháp.
  IF public.owner_mkt_drafts_check('{"zalo": {"body": "x"}, "email": {"subject": "s", "body": "b"}}', ARRAY['zalo', 'email'], true) IS NOT NULL
     OR public.owner_mkt_drafts_check('{"facts": {"starting_price": 1}}', '{}', false) IS DISTINCT FROM 'drafts_invalid'
     OR public.owner_mkt_drafts_check('{"zalo": {"body": "x", "price": "1"}}', '{}', false) IS DISTINCT FROM 'drafts_invalid'
     OR public.owner_mkt_drafts_check('{"sms": {"body": "Nhà đẹp"}}', '{}', false) IS DISTINCT FROM 'sms_not_ascii'
     OR public.owner_mkt_drafts_check('{"zalo": {"body": ""}}', ARRAY['zalo'], true) IS DISTINCT FROM 'incomplete'
     OR public.owner_mkt_drafts_check('{}', '{}', true) IS DISTINCT FROM 'no_channel' THEN
    RAISE EXCEPTION 'self-check: owner_mkt_drafts_check sai luật';
  END IF;

  -- Snapshot không bao giờ mang mô tả tự do / người có tài sản của tin.
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(public.owner_mkt_listing_facts((SELECT id FROM public.listings LIMIT 1))) k
              WHERE k IN ('description', 'asset_owner_name', 'asset_owner_address', 'user_id', 'custom_attributes')) THEN
    RAISE EXCEPTION 'self-check: owner_mkt_listing_facts lộ trường riêng tư';
  END IF;
END;
$$;
