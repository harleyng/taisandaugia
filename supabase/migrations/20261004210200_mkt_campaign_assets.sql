-- Hồ sơ online hợp nhất — phần 3: chiến dịch chọn được CẢ tin trên sàn lẫn hồ sơ số hoá; duyệt
-- xong sinh link Hồ sơ online (thay owner_mkt_links); phễu Hiệu quả đọc link Hồ sơ online.
--
--   • owner_mkt_campaigns.posting_ids (hồ sơ đã duyệt, chưa huỷ, thuộc Trạm) bên cạnh listing_ids;
--     tổng 1..20. Hai mảng thay vì một danh sách {kind,id}: dòng cũ không đổi, mọi chỗ đọc
--     listing_ids vẫn chạy; đổi lại thứ tự hiển thị luôn là tin trước, hồ sơ sau.
--   • Dữ kiện hồ sơ (owner_mkt_posting_facts) cùng luật "chỉ dữ kiện đã công bố": chưa có phiên
--     công bố ⇒ không giá / hạn. Dữ kiện có 'asset_id' + 'kind' (giữ 'listing_id' cho snapshot cũ).
--   • owner_mkt_funnel_core GIỮ chữ ký 6 tham số (owner_build_report_payload không đổi);
--     p_listing_id nay là "id tài sản bất kỳ" (tin hoặc hồ sơ). Lượt mở = posting_share_events
--     'view'; lưu: tin = analytics_events save_asset, hồ sơ = posting_share_follows có link_id;
--     đăng ký: auction_bidding_contracts.mkt_link_id (tin qua listing_id, hồ sơ qua asset_posting_id).
--     Kết quả phiên của HỒ SƠ chưa có nguồn chung (owner_outcomes_overview_core theo tin) ⇒ trống.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Cột
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.owner_mkt_campaigns
  ADD COLUMN posting_ids UUID[] NOT NULL DEFAULT '{}',
  ALTER COLUMN listing_ids SET DEFAULT '{}',
  DROP CONSTRAINT owner_mkt_campaigns_listing_ids_check,
  ADD CONSTRAINT owner_mkt_campaigns_assets_check
    CHECK (cardinality(listing_ids) + cardinality(posting_ids) BETWEEN 1 AND 20);

CREATE INDEX owner_mkt_campaigns_posting_ids_idx ON public.owner_mkt_campaigns USING GIN (posting_ids);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Phạm vi & quyền trên tài sản của chiến dịch
-- ═══════════════════════════════════════════════════════════════════════════

-- Hồ sơ đưa được vào chiến dịch: thuộc Trạm, đã duyệt, chưa huỷ (cùng luật tạo link Hồ sơ online).
CREATE OR REPLACE FUNCTION public.owner_mkt_posting_scope(p_workspace_id UUID, p_posting_ids UUID[])
RETURNS TABLE (posting_id UUID, branch_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.branch_id
    FROM public.asset_postings p
   WHERE p.workspace_id = p_workspace_id
     AND p.id = ANY (p_posting_ids)
     AND p.review_status = 'approved'
     AND p.status <> 'cancelled'
$$;

CREATE OR REPLACE FUNCTION public.owner_mkt_can_assets(
  p_workspace_id UUID, p_action TEXT, p_listing_ids UUID[], p_posting_ids UUID[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.owner_ws_has(p_workspace_id, 'truyen-thong', p_action)
     AND NOT EXISTS (
       SELECT 1 FROM (
         SELECT s.branch_id FROM public.owner_mkt_listing_scope(p_workspace_id, p_listing_ids) s
         UNION ALL
         SELECT s.branch_id FROM public.owner_mkt_posting_scope(p_workspace_id, p_posting_ids) s) a
        WHERE NOT public.owner_ws_branch_ok(p_workspace_id, a.branch_id))
$$;

-- NULL = mọi tài sản còn hợp lệ; ngược lại là mã lỗi cho client.
CREATE OR REPLACE FUNCTION public.owner_mkt_assets_reason(p_workspace_id UUID, p_listing_ids UUID[], p_posting_ids UUID[])
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN (SELECT count(*) FROM public.owner_mkt_listing_scope(p_workspace_id, p_listing_ids))
         <> (SELECT count(DISTINCT x) FROM unnest(p_listing_ids) x) THEN 'listing_not_in_workspace'
    WHEN (SELECT count(*) FROM public.owner_mkt_posting_scope(p_workspace_id, p_posting_ids))
         <> (SELECT count(DISTINCT x) FROM unnest(p_posting_ids) x) THEN 'posting_not_available'
  END
$$;

-- Bỏ trùng + NULL, giữ thứ tự chọn.
CREATE OR REPLACE FUNCTION public.owner_mkt_uniq(p_ids UUID[])
RETURNS UUID[]
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT COALESCE(array_agg(x.id ORDER BY x.ord), '{}')
    FROM (SELECT DISTINCT ON (id) id, ord FROM unnest(p_ids) WITH ORDINALITY AS u(id, ord)
           WHERE id IS NOT NULL ORDER BY id, ord) x
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Dữ kiện
-- ═══════════════════════════════════════════════════════════════════════════

-- Bản LIVE của owner_mkt_listing_facts + 'asset_id' / 'kind'.
CREATE OR REPLACE FUNCTION public.owner_mkt_listing_facts(p_listing_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
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
    'asset_id', l.id,
    'kind', 'listing',
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

-- Hồ sơ số hoá: giá / hạn CHỈ khi hồ sơ là lô của một phiên đã công bố còn hạn.
CREATE OR REPLACE FUNCTION public.owner_mkt_posting_facts(p_posting_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p     public.asset_postings%ROWTYPE;
  s     RECORD;
  o     RECORD;
  _src  TEXT;
  _df   JSONB;
BEGIN
  SELECT * INTO p FROM public.asset_postings WHERE id = p_posting_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  _df := COALESCE(p.delta_fields, '{}'::JSONB);

  SELECT ss.id, ss.code, ss.starts_at, ss.registration_start_at, ss.registration_end_at,
         ss.viewing_start_at, ss.viewing_end_at, ss.venue, ss.dossier_fee, ss.auction_format,
         ss.auction_org_id, i.lot_no, i.starting_price, i.deposit_amount, i.bid_step
    INTO s
    FROM public.auction_session_items i
    JOIN public.auction_sessions ss ON ss.id = i.session_id
   WHERE i.asset_posting_id = p_posting_id
     AND ss.status = 'published'
     AND now() <= ss.ends_at
   ORDER BY ss.starts_at
   LIMIT 1;
  IF FOUND THEN
    _src := 'session';
    SELECT a.name, a.phone, a.address INTO o FROM public.auction_organizations a WHERE a.id = s.auction_org_id;
  END IF;

  RETURN jsonb_build_object(
    'asset_id', p.id,
    'kind', 'posting',
    'listing_id', NULL,
    'posting_code', p.code,
    'title', p.title,
    'category_slug', p.child_slug,
    'province', p.province,
    'district', p.district,
    'area', COALESCE(public.owner_mkt_try_num(_df ->> 'area'), public.owner_mkt_try_num(_df ->> 'land_area'),
                     public.owner_mkt_try_num(_df ->> 'floor_area')),
    'image_url', p.image_urls[1],
    'announced', _src IS NOT NULL,
    'source', _src,
    'session_code', s.code,
    'lot_no', s.lot_no,
    'starting_price', s.starting_price,
    'deposit', s.deposit_amount,
    'bid_step', s.bid_step,
    'dossier_fee', s.dossier_fee,
    'auction_at', s.starts_at,
    'registration_start_at', s.registration_start_at,
    'registration_end_at', s.registration_end_at,
    'viewing_start_at', s.viewing_start_at,
    'viewing_end_at', s.viewing_end_at,
    'venue', s.venue,
    'auction_format', s.auction_format,
    'org_name', o.name,
    'org_phone', o.phone,
    'org_address', o.address
  );
END;
$$;

DROP FUNCTION public.owner_mkt_build_facts(UUID[]);
CREATE OR REPLACE FUNCTION public.owner_mkt_build_facts(p_listing_ids UUID[], p_posting_ids UUID[])
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'version', 2,
    'built_at', now(),
    'assets', COALESCE((
      SELECT jsonb_agg(f.facts ORDER BY f.grp, f.ord)
        FROM (SELECT public.owner_mkt_listing_facts(x.id) AS facts, 1 AS grp, x.ord
                FROM unnest(p_listing_ids) WITH ORDINALITY AS x(id, ord)
              UNION ALL
              SELECT public.owner_mkt_posting_facts(x.id), 2, x.ord
                FROM unnest(p_posting_ids) WITH ORDINALITY AS x(id, ord)) f
       WHERE f.facts IS NOT NULL), '[]'::JSONB))
$$;

DROP FUNCTION public.owner_mkt_preview_facts(UUID, UUID[]);
CREATE OR REPLACE FUNCTION public.owner_mkt_preview_facts(p_workspace_id UUID, p_listing_ids UUID[], p_posting_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _lids UUID[] := public.owner_mkt_uniq(COALESCE(p_listing_ids, '{}'));
  _pids UUID[] := public.owner_mkt_uniq(COALESCE(p_posting_ids, '{}'));
  _err  TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.owner_ws_can(p_workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF cardinality(_lids) + cardinality(_pids) NOT BETWEEN 1 AND 20 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'listings_invalid');
  END IF;
  _err := public.owner_mkt_assets_reason(p_workspace_id, _lids, _pids);
  IF _err IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', _err);
  END IF;
  RETURN jsonb_build_object('ok', true, 'facts', public.owner_mkt_build_facts(_lids, _pids));
END;
$$;
GRANT EXECUTE ON FUNCTION public.owner_mkt_preview_facts(UUID, UUID[], UUID[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.owner_mkt_preview_facts(UUID, UUID[], UUID[]) FROM anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Vòng đời chiến dịch
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION public.owner_mkt_save_draft(UUID, UUID, TEXT, TEXT, UUID[], TEXT[], JSONB);
CREATE OR REPLACE FUNCTION public.owner_mkt_save_draft(
  p_campaign_id UUID, p_workspace_id UUID, p_name TEXT, p_notes TEXT, p_listing_ids UUID[],
  p_posting_ids UUID[], p_channels TEXT[], p_drafts JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c        public.owner_mkt_campaigns%ROWTYPE;
  _lids     UUID[] := public.owner_mkt_uniq(COALESCE(p_listing_ids, '{}'));
  _pids     UUID[] := public.owner_mkt_uniq(COALESCE(p_posting_ids, '{}'));
  _channels TEXT[];
  _err      TEXT;
  _branch   UUID;
  _nb       INTEGER;
  _null_br  BOOLEAN;
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
    IF NOT public.owner_mkt_can_assets(_c.workspace_id, 'update', _c.listing_ids, _c.posting_ids) THEN
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
  IF cardinality(_lids) + cardinality(_pids) NOT BETWEEN 1 AND 20 THEN
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
  _err := public.owner_mkt_assets_reason(p_workspace_id, _lids, _pids);
  IF _err IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', _err);
  END IF;
  IF NOT public.owner_mkt_can_assets(p_workspace_id, CASE WHEN _c.id IS NULL THEN 'create' ELSE 'update' END,
                                     _lids, _pids) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- Chi nhánh chung (chỉ để lọc danh sách): mọi tài sản cùng một chi nhánh, không cái nào trống.
  SELECT count(DISTINCT a.branch_id), min(a.branch_id::TEXT)::UUID, bool_or(a.branch_id IS NULL)
    INTO _nb, _branch, _null_br
    FROM (SELECT s.branch_id FROM public.owner_mkt_listing_scope(p_workspace_id, _lids) s
          UNION ALL
          SELECT s.branch_id FROM public.owner_mkt_posting_scope(p_workspace_id, _pids) s) a;
  IF _nb <> 1 OR _null_br THEN
    _branch := NULL;
  END IF;

  IF _c.id IS NULL THEN
    INSERT INTO public.owner_mkt_campaigns
      (workspace_id, branch_id, name, notes, listing_ids, posting_ids, mode, channels, drafts, facts_snapshot, created_by)
    VALUES
      (p_workspace_id, _branch, btrim(p_name), NULLIF(btrim(p_notes), ''), _lids, _pids, 'export', _channels, p_drafts,
       public.owner_mkt_build_facts(_lids, _pids), auth.uid())
    RETURNING * INTO _c;
    PERFORM public.owner_mkt_log(_c, 'create', NULL,
                                 jsonb_build_object('assets', cardinality(_lids) + cardinality(_pids)));
  ELSE
    UPDATE public.owner_mkt_campaigns
       SET branch_id = _branch,
           name = btrim(p_name),
           notes = NULLIF(btrim(p_notes), ''),
           listing_ids = _lids,
           posting_ids = _pids,
           channels = _channels,
           drafts = p_drafts,
           facts_snapshot = public.owner_mkt_build_facts(_lids, _pids),
           status = 'draft'
     WHERE id = _c.id
    RETURNING * INTO _c;
    PERFORM public.owner_mkt_log(_c, 'update', NULL,
                                 jsonb_build_object('assets', cardinality(_lids) + cardinality(_pids)));
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', _c.id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.owner_mkt_save_draft(UUID, UUID, TEXT, TEXT, UUID[], UUID[], TEXT[], JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.owner_mkt_save_draft(UUID, UUID, TEXT, TEXT, UUID[], UUID[], TEXT[], JSONB) FROM anon;

CREATE OR REPLACE FUNCTION public.owner_mkt_submit(p_campaign_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c   public.owner_mkt_campaigns%ROWTYPE;
  _err TEXT;
BEGIN
  SELECT * INTO _c FROM public.owner_mkt_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.owner_ws_can(_c.workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT (public.owner_mkt_can_assets(_c.workspace_id, 'update', _c.listing_ids, _c.posting_ids)
          OR (_c.created_by = auth.uid()
              AND public.owner_mkt_can_assets(_c.workspace_id, 'create', _c.listing_ids, _c.posting_ids))) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF _c.mode <> 'export' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'mode_not_available');
  END IF;
  IF _c.status <> 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;
  _err := public.owner_mkt_assets_reason(_c.workspace_id, _c.listing_ids, _c.posting_ids);
  IF _err IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', _err);
  END IF;
  _err := public.owner_mkt_drafts_check(_c.drafts, _c.channels, true);
  IF _err IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', _err);
  END IF;

  UPDATE public.owner_mkt_campaigns
     SET status = 'pending_approval',
         facts_snapshot = public.owner_mkt_build_facts(listing_ids, posting_ids),
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

CREATE OR REPLACE FUNCTION public.owner_mkt_checker_reason(p_c public.owner_mkt_campaigns)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.owner_mkt_can_assets(p_c.workspace_id, 'finalize', p_c.listing_ids, p_c.posting_ids) THEN 'forbidden'
    WHEN p_c.mode <> 'export' THEN 'mode_not_available'
    WHEN p_c.status <> 'pending_approval' THEN 'invalid_status'
    WHEN auth.uid() IN (p_c.created_by, p_c.submitted_by)
         AND (SELECT count(*) FROM public.asset_owner_workspace_members m
               WHERE m.workspace_id = p_c.workspace_id AND m.status = 'active') > 1 THEN 'self_approval'
  END
$$;

-- Duyệt ⇒ một link Hồ sơ online cho mỗi tài sản × kênh. Người gửi = người soạn (nếu còn trong Trạm);
-- link chiến dịch mặc định ẩn liên hệ người gửi và ẩn giá hồ sơ chưa có phiên (sửa từng link sau).
CREATE OR REPLACE FUNCTION public.owner_mkt_approve(p_campaign_id UUID, p_note TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c      public.owner_mkt_campaigns%ROWTYPE;
  _reason TEXT;
  _links  INTEGER := 0;
  _sender UUID;
  _a      RECORD;
  _ch     TEXT;
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
  _reason := public.owner_mkt_assets_reason(_c.workspace_id, _c.listing_ids, _c.posting_ids);
  IF _reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', _reason);
  END IF;

  SELECT m.user_id INTO _sender
    FROM public.asset_owner_workspace_members m
   WHERE m.workspace_id = _c.workspace_id AND m.user_id = _c.created_by AND m.status = 'active';

  FOR _a IN
    SELECT s.listing_id, NULL::UUID AS posting_id, s.branch_id
      FROM public.owner_mkt_listing_scope(_c.workspace_id, _c.listing_ids) s
    UNION ALL
    SELECT NULL::UUID, s.posting_id, s.branch_id
      FROM public.owner_mkt_posting_scope(_c.workspace_id, _c.posting_ids) s
  LOOP
    FOREACH _ch IN ARRAY _c.channels LOOP
      PERFORM public.share_link_insert(
        _a.posting_id, _a.listing_id, _c.workspace_id, _a.branch_id, _ch,
        left(_c.name, 60) || ' · ' ||
          CASE _ch WHEN 'email' THEN 'Email' WHEN 'zalo' THEN 'Zalo' WHEN 'facebook' THEN 'Facebook' ELSE 'SMS' END,
        _sender, false, false, false, NULL, _c.id, auth.uid());
      _links := _links + 1;
    END LOOP;
  END LOOP;

  UPDATE public.owner_mkt_campaigns
     SET status = 'approved', approved_by = auth.uid(), approved_at = now()
   WHERE id = _c.id
  RETURNING * INTO _c;
  PERFORM public.owner_mkt_log(_c, 'approve', p_note, jsonb_build_object('links', _links));
  RETURN jsonb_build_object('ok', true, 'links', _links);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_mkt_mark_sent(p_campaign_id UUID, p_channel TEXT, p_note TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c public.owner_mkt_campaigns%ROWTYPE;
BEGIN
  SELECT * INTO _c FROM public.owner_mkt_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.owner_ws_can(_c.workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_mkt_can_assets(_c.workspace_id, 'share', _c.listing_ids, _c.posting_ids) THEN
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

CREATE OR REPLACE FUNCTION public.owner_mkt_delete(p_campaign_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c public.owner_mkt_campaigns%ROWTYPE;
BEGIN
  SELECT * INTO _c FROM public.owner_mkt_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.owner_ws_can(_c.workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_mkt_can_assets(_c.workspace_id, 'delete', _c.listing_ids, _c.posting_ids) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF _c.status <> 'draft' OR _c.submitted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;
  DELETE FROM public.owner_mkt_campaigns WHERE id = _c.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_mkt_log_export(p_campaign_id UUID, p_kind TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c public.owner_mkt_campaigns%ROWTYPE;
BEGIN
  SELECT * INTO _c FROM public.owner_mkt_campaigns WHERE id = p_campaign_id;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.owner_ws_can(_c.workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_mkt_can_assets(_c.workspace_id, 'share', _c.listing_ids, _c.posting_ids) THEN
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Phễu — bản LIVE của owner_mkt_funnel_core, nguồn link = posting_share_links
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.owner_mkt_funnel_core(p_workspace_id uuid, p_from date, p_to date, p_listing_id uuid, p_branch_id uuid, p_viewer_scope boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_from TIMESTAMPTZ := p_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_to   TIMESTAMPTZ := (p_to + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_out  JSONB;
BEGIN
  WITH
  br AS (
    SELECT wb.id, wb.asset_owner_id,
           COALESCE(NULLIF(btrim(wb.display_name), ''), ao.name, 'Chi nhánh chưa đặt tên') AS name
      FROM public.workspace_branches wb
      LEFT JOIN public.asset_owners ao ON ao.id = wb.asset_owner_id
     WHERE wb.workspace_id = p_workspace_id
  ),
  -- Tài sản = tin Trạm đã nhận (chi nhánh suy từ claim) HOẶC hồ sơ số hoá của Trạm (chi nhánh
  -- của hồ sơ). aid = id tin / id hồ sơ; p_listing_id lọc theo id tài sản bất kỳ.
  claimed AS (
    SELECT DISTINCT ON (c.listing_id) c.listing_id AS aid, 'listing'::text AS kind,
           br.id AS bid, br.name AS branch_name
      FROM public.asset_owner_claims c
      LEFT JOIN br ON br.asset_owner_id = c.asset_owner_id
     WHERE c.workspace_id = p_workspace_id
       AND c.status IN ('auto_claimed', 'confirmed')
       AND c.listing_id IS NOT NULL
       AND (p_listing_id IS NULL OR c.listing_id = p_listing_id)
     ORDER BY c.listing_id, c.created_at
  ),
  posts AS (
    SELECT p.id AS aid, 'posting'::text AS kind, br.id AS bid, br.name AS branch_name
      FROM public.asset_postings p
      LEFT JOIN br ON br.id = p.branch_id
     WHERE p.workspace_id = p_workspace_id
       AND (p_listing_id IS NULL OR p.id = p_listing_id)
  ),
  scoped AS (
    SELECT a.*
      FROM (SELECT * FROM claimed UNION ALL SELECT * FROM posts) a
     WHERE (p_branch_id IS NULL OR a.bid = p_branch_id)
       AND (NOT p_viewer_scope OR public.owner_ws_has_in(p_workspace_id, 'truyen-thong', 'view', a.bid))
  ),
  lk AS MATERIALIZED (
    SELECT k.id, s.aid, s.kind, k.channel,
           CASE WHEN k.campaign_id IS NULL THEN 'own_links' ELSE 'self_serve' END AS source
      FROM public.posting_share_links k
      JOIN scoped s ON s.aid = COALESCE(k.listing_id, k.posting_id)
     WHERE k.workspace_id = p_workspace_id
       AND k.created_at < v_to
  ),
  ord AS MATERIALIZED (
    SELECT o.id, o.listing_id AS aid, o.variant_key, o.marketing_campaign_id, o.advertisement_id,
           o.paid_at, o.completed_at
      FROM public.owner_mkt_orders o
      JOIN scoped s ON s.aid = o.listing_id AND s.kind = 'listing'
     WHERE o.workspace_id = p_workspace_id
       AND o.status IN ('paid', 'in_progress', 'completed')
       AND o.paid_at < v_to
  ),
  mk AS MATERIALIZED (
    SELECT s.aid, s.kind, s.bid, s.branch_name, COALESCE(l.title, p.title) AS title,
           CASE WHEN s.kind = 'posting' THEN p.code ELSE upper(left(s.aid::text, 8)) END AS code
      FROM scoped s
      LEFT JOIN public.listings l ON s.kind = 'listing' AND l.id = s.aid
      LEFT JOIN public.asset_postings p ON s.kind = 'posting' AND p.id = s.aid
     WHERE EXISTS (SELECT 1 FROM lk WHERE lk.aid = s.aid)
        OR EXISTS (SELECT 1 FROM ord WHERE ord.aid = s.aid)
  ),
  -- Thành viên đang hoạt động: tự lưu / theo dõi tài sản của mình không tính.
  members AS (
    SELECT m.user_id FROM public.asset_owner_workspace_members m
     WHERE m.workspace_id = p_workspace_id AND m.status = 'active'
  ),

  -- ─── Kênh riêng của đơn vị (link Hồ sơ online) ───────────────────────────
  link_hits AS (
    SELECT e.link_id,
           count(*)::int AS hits,
           count(DISTINCT e.visitor_id)::int AS visitors
      FROM public.posting_share_events e
      JOIN lk ON lk.id = e.link_id
     WHERE e.event = 'view'
       AND e.created_at >= v_from AND e.created_at < v_to
     GROUP BY e.link_id
  ),
  -- Lưu nhờ link: tin = sự kiện save_asset đã được guard xác nhận; hồ sơ = theo dõi qua link.
  link_saves AS (
    SELECT x.link_id, count(DISTINCT x.user_id)::int AS saves
      FROM (
        SELECT e.mkt_link_id AS link_id, e.user_id
          FROM public.analytics_events e
          JOIN lk ON lk.id = e.mkt_link_id AND lk.kind = 'listing'
         WHERE e.feature_key = 'save_asset'
           AND e.created_at >= v_from AND e.created_at < v_to
        UNION ALL
        SELECT f.link_id, f.user_id
          FROM public.posting_share_follows f
          JOIN lk ON lk.id = f.link_id AND lk.kind = 'posting'
         WHERE f.created_at >= v_from AND f.created_at < v_to
           AND f.user_id NOT IN (SELECT user_id FROM members)) x
     GROUP BY x.link_id
  ),
  link_regs AS (
    SELECT b.mkt_link_id AS link_id, count(*)::int AS regs
      FROM public.auction_bidding_contracts b
      JOIN lk ON lk.id = b.mkt_link_id
     WHERE b.status = 'paid'
       AND b.paid_at >= v_from AND b.paid_at < v_to
     GROUP BY b.mkt_link_id
  ),
  per_link AS (
    SELECT lk.id, lk.aid, lk.channel, lk.source,
           COALESCE(h.hits, 0)     AS hits,
           COALESCE(h.visitors, 0) AS visitors,
           COALESCE(s.saves, 0)    AS saves,
           COALESCE(r.regs, 0)     AS regs
      FROM lk
      LEFT JOIN link_hits h  ON h.link_id = lk.id
      LEFT JOIN link_saves s ON s.link_id = lk.id
      LEFT JOIN link_regs r  ON r.link_id = lk.id
  ),

  -- ─── Gói sàn làm (Giao việc cho sàn) — bộ đếm chiến dịch email / banner ───
  -- Đơn còn sống trong kỳ: trả trước cuối kỳ, chưa hoàn tất trước đầu kỳ. Email tính theo ngày gửi;
  -- banner tính khi lịch hiển thị chạm kỳ (bộ đếm banner là cộng dồn cả đời banner).
  per_order AS (
    SELECT o.id, o.aid, o.variant_key,
           (COALESCE(c.sent_count, 0) + COALESCE(a.view_count, 0))::int     AS sent,
           COALESCE(c.opened_count, 0)::int                                 AS opened,
           (COALESCE(c.clicked_count, 0) + COALESCE(a.click_count, 0))::int AS clicks
      FROM ord o
      LEFT JOIN public.marketing_campaigns c
             ON c.id = o.marketing_campaign_id
            AND c.sent_at >= v_from AND c.sent_at < v_to
      LEFT JOIN public.advertisements a
             ON a.id = o.advertisement_id
            AND COALESCE(a.start_at, a.created_at) < v_to
            AND (a.end_at IS NULL OR a.end_at >= v_from)
     WHERE o.completed_at IS NULL OR o.completed_at >= v_from
  ),

  -- ─── Không xác định nguồn ────────────────────────────────────────────────
  all_saves AS (
    SELECT a.listing_id AS aid, count(*)::int AS n
      FROM public.user_asset_actions a
      JOIN mk ON mk.aid = a.listing_id AND mk.kind = 'listing'
     WHERE a.is_saved AND a.created_at >= v_from AND a.created_at < v_to
     GROUP BY a.listing_id
    UNION ALL
    SELECT f.posting_id, count(*)::int
      FROM public.posting_share_follows f
      JOIN mk ON mk.aid = f.posting_id AND mk.kind = 'posting'
     WHERE f.created_at >= v_from AND f.created_at < v_to
       AND f.user_id NOT IN (SELECT user_id FROM members)
     GROUP BY f.posting_id
  ),
  -- Hồ sơ đã thanh toán trong kỳ của các phiên có tài sản đang truyền thông.
  sess_regs AS (
    SELECT DISTINCT mk.aid, b.id, b.mkt_link_id
      FROM public.auction_session_items i
      JOIN mk ON (mk.kind = 'listing' AND mk.aid = i.listing_id)
              OR (mk.kind = 'posting' AND mk.aid = i.asset_posting_id)
      JOIN public.auction_bidding_contracts b ON b.session_id = i.session_id
     WHERE b.status = 'paid' AND b.paid_at >= v_from AND b.paid_at < v_to
  ),

  -- ─── Kết quả phiên của tài sản đang truyền thông ─────────────────────────
  res AS (
    SELECT o.listing_id AS aid, o.resolved_outcome, o.resolved_price, o.resolved_date,
           o.starting_price, o.best_kind,
           CASE
             WHEN o.best_kind = 'platform' THEN (
               SELECT count(DISTINCT b.id)::int
                 FROM public.auction_session_items i
                 JOIN public.auction_lot_states ls ON ls.lot_id = i.id AND ls.status = 'closed'
                 JOIN public.auction_bidding_contracts b
                   ON b.session_id = i.session_id AND b.status = 'paid' AND b.bidder_no IS NOT NULL
                WHERE i.listing_id = o.listing_id
                  AND (COALESCE(ls.closed_at, ls.updated_at) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = o.resolved_date)
             ELSE (SELECT oo.participants FROM public.owner_asset_outcomes oo WHERE oo.id = o.own_outcome_id)
           END AS participants
      FROM public.owner_outcomes_overview_core(p_workspace_id) o
      JOIN mk ON mk.aid = o.listing_id AND mk.kind = 'listing'
     WHERE o.resolved_date BETWEEN p_from AND p_to
  ),

  -- ─── Theo tài sản ────────────────────────────────────────────────────────
  asset_rows AS (
    SELECT mk.aid, mk.kind, mk.code, mk.title, mk.branch_name,
           (SELECT count(*) FROM lk WHERE lk.aid = mk.aid)::int                        AS links,
           (SELECT count(*) FROM per_order po WHERE po.aid = mk.aid)::int              AS orders,
           COALESCE((SELECT sum(po.sent) FROM per_order po WHERE po.aid = mk.aid), 0)::int   AS sent,
           COALESCE((SELECT sum(po.opened) FROM per_order po WHERE po.aid = mk.aid), 0)::int AS opened,
           COALESCE((SELECT sum(pl.hits) FROM per_link pl WHERE pl.aid = mk.aid), 0)::int
             + COALESCE((SELECT sum(po.clicks) FROM per_order po WHERE po.aid = mk.aid), 0)::int AS clicks,
           COALESCE((SELECT sum(pl.visitors) FROM per_link pl WHERE pl.aid = mk.aid), 0)::int
             + COALESCE((SELECT sum(po.clicks) FROM per_order po WHERE po.aid = mk.aid), 0)::int AS visitors,
           COALESCE((SELECT sum(pl.saves) FROM per_link pl WHERE pl.aid = mk.aid), 0)::int     AS saves,
           COALESCE((SELECT n FROM all_saves x WHERE x.aid = mk.aid), 0)                       AS saves_all,
           COALESCE((SELECT sum(pl.regs) FROM per_link pl WHERE pl.aid = mk.aid), 0)::int      AS regs,
           (SELECT count(*) FROM sess_regs sr WHERE sr.aid = mk.aid)::int                      AS regs_all,
           r.resolved_outcome, r.resolved_price, r.resolved_date, r.starting_price, r.participants
      FROM mk
      LEFT JOIN res r ON r.aid = mk.aid
  ),

  -- ─── Theo kênh / theo nguồn ──────────────────────────────────────────────
  channel_rows AS (
    SELECT 'link'::text AS kind, pl.channel AS key,
           count(*)::int AS items, 0 AS sent, 0 AS opened,
           sum(pl.hits)::int AS clicks, sum(pl.visitors)::int AS visitors,
           sum(pl.saves)::int AS saves, sum(pl.regs)::int AS regs
      FROM per_link pl
     GROUP BY pl.channel
    UNION ALL
    SELECT 'platform'::text, po.variant_key,
           count(*)::int, sum(po.sent)::int, sum(po.opened)::int,
           sum(po.clicks)::int, sum(po.clicks)::int, 0, 0
      FROM per_order po
     GROUP BY po.variant_key
  ),
  source_rows AS (
    SELECT pl.source AS key, count(*)::int AS items, 0 AS sent, 0 AS opened,
           sum(pl.hits)::int AS clicks, sum(pl.visitors)::int AS visitors,
           sum(pl.saves)::int AS saves, sum(pl.regs)::int AS regs
      FROM per_link pl
     GROUP BY pl.source
    UNION ALL
    SELECT 'platform', count(*)::int, COALESCE(sum(po.sent), 0)::int, COALESCE(sum(po.opened), 0)::int,
           COALESCE(sum(po.clicks), 0)::int, COALESCE(sum(po.clicks), 0)::int, 0, 0
      FROM per_order po
    HAVING count(*) > 0
  ),
  unknown AS (
    SELECT COALESCE(sum(greatest(0, a.saves_all - a.saves)), 0)::int AS saves,
           (SELECT count(DISTINCT sr.id) FROM sess_regs sr
             WHERE sr.mkt_link_id IS NULL OR NOT EXISTS (SELECT 1 FROM lk WHERE lk.id = sr.mkt_link_id))::int AS regs
      FROM asset_rows a
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'attribution_days', 30,
    'totals', (
      SELECT jsonb_build_object(
               'assets',        count(*),
               'links',         COALESCE(sum(a.links), 0),
               'orders',        COALESCE(sum(a.orders), 0),
               'sent',          COALESCE(sum(a.sent), 0),
               'opened',        COALESCE(sum(a.opened), 0),
               'clicks',        COALESCE(sum(a.clicks), 0),
               'visitors',      COALESCE(sum(a.visitors), 0),
               'saves',         COALESCE(sum(a.saves), 0),
               'registrations', COALESCE(sum(a.regs), 0),
               'participants',  COALESCE(sum(a.participants) FILTER (WHERE a.resolved_outcome IS NOT NULL), 0),
               'outcomes',      count(*) FILTER (WHERE a.resolved_outcome IS NOT NULL),
               'sold',          count(*) FILTER (WHERE a.resolved_outcome = 'sold'),
               'sold_value',    COALESCE(sum(a.resolved_price) FILTER (WHERE a.resolved_outcome = 'sold'), 0),
               -- Tỷ lệ giá trúng / giá khởi điểm chỉ trên tài sản có đủ cả hai giá.
               'priced_sold_value',     COALESCE(sum(a.resolved_price) FILTER (
                                          WHERE a.resolved_outcome = 'sold' AND a.resolved_price > 0 AND a.starting_price > 0), 0),
               'priced_starting_value', COALESCE(sum(a.starting_price) FILTER (
                                          WHERE a.resolved_outcome = 'sold' AND a.resolved_price > 0 AND a.starting_price > 0), 0))
        FROM asset_rows a
    ),
    'unattributed', (SELECT jsonb_build_object('saves', u.saves, 'registrations', u.regs) FROM unknown u),
    'by_channel', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'kind', c.kind, 'key', c.key, 'items', c.items, 'sent', c.sent, 'opened', c.opened,
               'clicks', c.clicks, 'visitors', c.visitors, 'saves', c.saves, 'registrations', c.regs
             ) ORDER BY c.kind, c.regs DESC, c.clicks DESC, c.key), '[]'::jsonb)
        FROM channel_rows c
    ),
    'by_source', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'key', s.key, 'items', s.items, 'sent', s.sent, 'opened', s.opened,
               'clicks', s.clicks, 'visitors', s.visitors, 'saves', s.saves, 'registrations', s.regs
             ) ORDER BY array_position(ARRAY['self_serve', 'platform', 'own_links'], s.key)), '[]'::jsonb)
        FROM source_rows s
    ),
    'by_asset', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'asset_id',                   a.aid,
               'kind',                       a.kind,
               'listing_id',                 CASE WHEN a.kind = 'listing' THEN a.aid END,
               'posting_id',                 CASE WHEN a.kind = 'posting' THEN a.aid END,
               'asset_code',                 a.code,
               'title',                      a.title,
               'branch_name',                a.branch_name,
               'links',                      a.links,
               'orders',                     a.orders,
               'sent',                       a.sent,
               'opened',                     a.opened,
               'clicks',                     a.clicks,
               'visitors',                   a.visitors,
               'saves',                      a.saves,
               'saves_unattributed',         greatest(0, a.saves_all - a.saves),
               'registrations',              a.regs,
               'registrations_unattributed', greatest(0, a.regs_all - a.regs),
               'participants',               a.participants,
               'outcome',                    a.resolved_outcome,
               'outcome_date',               a.resolved_date,
               'price',                      a.resolved_price,
               'starting_price',             a.starting_price
             ) ORDER BY a.regs DESC, a.clicks DESC, a.title), '[]'::jsonb)
        FROM asset_rows a
    )
  )
  INTO v_out;

  RETURN v_out;
END;
$function$;
