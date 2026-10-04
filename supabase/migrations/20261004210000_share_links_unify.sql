-- Hồ sơ online HỢP NHẤT — mọi link chia sẻ của chủ tài sản là một link "Hồ sơ online" /hs/:code
-- (quyết định 04/10, thay hai hệ link: owner_mkt_links /l/:code và posting_share_links /hs/:code).
--
--   1. posting_share_links trỏ tới MỘT trong hai: hồ sơ số hoá (posting_id) HOẶC tin trên sàn
--      Trạm đã nhận (listing_id). Thêm kênh (channel), chiến dịch (campaign_id), chi nhánh
--      (branch_id — hồ sơ: chi nhánh của hồ sơ; tin: suy từ claim như owner_mkt_links cũ) và
--      legacy_code (mã 8 ký tự của link /l/ cũ, migration sau).
--   2. Quyền MỘT chỗ: share_link_can(posting, workspace, branch, 'view'|'manage').
--        hồ sơ: so-hoa:view|share HOẶC truyen-thong:view|create (trong phạm vi chi nhánh);
--        tin:   truyen-thong:view|create (trong phạm vi chi nhánh).
--      STAFF đang có cả hai, VIEWER không có quyền ghi nào ⇒ không vai trò mặc định nào đổi quyền.
--   3. Trang công khai cho TIN: payload cùng DANH SÁCH TRẮNG (thêm 'kind', 'listing_path'),
--      KHÔNG mô tả tự do (có thể chứa tên người vay — cùng lý do owner_mkt_listing_facts không đọc).
--      "Theo dõi" trên tin = Lưu tài sản (user_asset_actions + sự kiện save_asset gắn link).
--   4. get_shared_posting trả 'ref' (= id link) NGOÀI payload khi lượt mở là của người ngoài
--      ⇒ trang ghi cookie mkt_link_id (ghi nhận lưu / đăng ký 30 ngày như /l/ cũ).
--   5. RPC chung: create_/update_/revoke_share_link, share_link_senders, owner_share_links,
--      owner_share_link_detail, owner_share_link_series, owner_mkt_campaign_series. RPC cũ
--      (create_/update_/revoke_posting_share_link) thành lớp bọc mỏng — phiên khác không gãy.
--   6. Nhật ký: link trỏ TIN ghi module 'truyen-thong' (trước đây trigger thoát sớm vì không có hồ sơ).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Cột, ràng buộc, chỉ mục
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.posting_share_links
  ALTER COLUMN posting_id DROP NOT NULL,
  ADD COLUMN listing_id  UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  ADD COLUMN branch_id   UUID REFERENCES public.workspace_branches(id) ON DELETE SET NULL,
  ADD COLUMN channel     TEXT NOT NULL DEFAULT 'other'
    CHECK (channel IN ('email', 'zalo', 'facebook', 'sms', 'bank_app', 'press', 'other')),
  ADD COLUMN campaign_id UUID REFERENCES public.owner_mkt_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN legacy_code TEXT UNIQUE CHECK (legacy_code IS NULL OR legacy_code ~ '^[a-z0-9]{8}$'),
  ADD CONSTRAINT psl_one_target CHECK ((posting_id IS NULL) <> (listing_id IS NULL)),
  ADD CONSTRAINT psl_listing_needs_workspace CHECK (listing_id IS NULL OR workspace_id IS NOT NULL);

CREATE INDEX idx_posting_share_links_listing ON public.posting_share_links (listing_id, created_at DESC)
  WHERE listing_id IS NOT NULL;
CREATE INDEX idx_posting_share_links_campaign ON public.posting_share_links (campaign_id)
  WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_posting_share_links_ws_created ON public.posting_share_links (workspace_id, created_at DESC);
CREATE INDEX idx_posting_share_events_link_time ON public.posting_share_events (link_id, created_at);

-- code / legacy_code KHÔNG cấp SELECT (mã là mật khẩu của link — chỉ đọc qua RPC).
GRANT SELECT (listing_id, branch_id, channel, campaign_id) ON public.posting_share_links TO authenticated;

-- Chi nhánh của link hồ sơ = chi nhánh hồ sơ (để lọc / phạm vi giống link tin).
ALTER TABLE public.posting_share_links DISABLE TRIGGER owner_audit;
UPDATE public.posting_share_links l
   SET branch_id = p.branch_id
  FROM public.asset_postings p
 WHERE p.id = l.posting_id AND l.branch_id IS DISTINCT FROM p.branch_id;
ALTER TABLE public.posting_share_links ENABLE TRIGGER owner_audit;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Quyền
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.share_link_can(p_posting_id UUID, p_workspace_id UUID, p_branch_id UUID, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN p_action NOT IN ('view', 'manage') THEN false
    WHEN p_posting_id IS NOT NULL
         AND public.owner_posting_can(p_posting_id, 'so-hoa', CASE p_action WHEN 'view' THEN 'view' ELSE 'share' END)
      THEN true
    WHEN p_workspace_id IS NULL THEN false
    ELSE public.owner_ws_has_in(p_workspace_id, 'truyen-thong',
                                CASE p_action WHEN 'view' THEN 'view' ELSE 'create' END, p_branch_id)
  END
$$;

-- Thành viên Trạm (hoặc chủ hồ sơ cá nhân) mở link của chính mình ⇒ không đếm.
CREATE OR REPLACE FUNCTION public.posting_share_is_member(l public.posting_share_links)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND CASE
    WHEN l.posting_id IS NOT NULL THEN public.owner_posting_can(l.posting_id, 'read')
    ELSE public.owner_ws_can(l.workspace_id, 'read')
  END
$$;

DROP POLICY posting_share_links_member_read ON public.posting_share_links;
CREATE POLICY posting_share_links_member_read ON public.posting_share_links
  FOR SELECT TO authenticated
  USING (public.share_link_can(posting_id, workspace_id, branch_id, 'view'));

DROP POLICY posting_share_events_member_read ON public.posting_share_events;
CREATE POLICY posting_share_events_member_read ON public.posting_share_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posting_share_links l
                  WHERE l.id = posting_share_events.link_id
                    AND public.share_link_can(l.posting_id, l.workspace_id, l.branch_id, 'view')));

-- Người gửi: thành viên đang hoạt động của Trạm; hồ sơ cá nhân: chính chủ hồ sơ.
CREATE OR REPLACE FUNCTION public.share_link_sender_ok(p_workspace_id UUID, p_owner_user UUID, p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user IS NULL THEN false
    WHEN p_workspace_id IS NULL THEN p_user = p_owner_user
    ELSE EXISTS (SELECT 1 FROM public.asset_owner_workspace_members m
                  WHERE m.workspace_id = p_workspace_id AND m.user_id = p_user AND m.status = 'active')
  END
$$;

CREATE OR REPLACE FUNCTION public.share_link_validate(
  p_workspace_id UUID, p_owner_user UUID, p_label TEXT, p_sender_user_id UUID,
  p_show_sender_contact BOOLEAN, p_days INTEGER)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  pr public.profiles%ROWTYPE;
BEGIN
  IF char_length(btrim(COALESCE(p_label, ''))) NOT BETWEEN 1 AND 80 THEN RETURN 'invalid_label'; END IF;
  IF p_days IS NOT NULL AND p_days NOT BETWEEN 1 AND 365 THEN RETURN 'invalid_expiry'; END IF;
  IF p_sender_user_id IS NULL THEN
    RETURN CASE WHEN COALESCE(p_show_sender_contact, false) THEN 'sender_required' END;
  END IF;
  IF NOT public.share_link_sender_ok(p_workspace_id, p_owner_user, p_sender_user_id) THEN
    RETURN 'invalid_sender';
  END IF;
  SELECT * INTO pr FROM public.profiles WHERE id = p_sender_user_id;
  IF COALESCE(p_show_sender_contact, false)
     AND NULLIF(btrim(pr.name), '') IS NULL AND public.profile_contact_phone(pr.agent_info) IS NULL THEN
    RETURN 'sender_no_contact';
  END IF;
  RETURN NULL;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. JSON một link (màn của chủ tài sản)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.posting_share_link_json(l public.posting_share_links, p_with_code BOOLEAN)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id',                  l.id,
    'code',                CASE WHEN p_with_code THEN l.code END,
    'label',               l.label,
    'sender_user_id',      l.sender_user_id,
    'sender_name',         COALESCE(NULLIF(btrim(s.name), ''), l.sender_name),
    'sender_phone',        COALESCE(public.profile_contact_phone(s.agent_info), l.sender_phone),
    'show_price',          l.show_price,
    'show_exact_address',  l.show_exact_address,
    'show_sender_contact', l.show_sender_contact,
    'expires_at',          l.expires_at,
    'revoked_at',          l.revoked_at,
    'view_count',          l.view_count,
    'unique_view_count',   l.unique_view_count,
    'cta_dossier_count',   l.cta_dossier_count,
    'cta_pdf_count',       l.cta_pdf_count,
    'cta_follow_count',    l.cta_follow_count,
    'cta_call_count',      l.cta_call_count,
    'last_viewed_at',      l.last_viewed_at,
    'created_by_name',     (SELECT COALESCE(NULLIF(btrim(pr.name), ''), pr.email)
                              FROM public.profiles pr WHERE pr.id = l.created_by),
    'created_at',          l.created_at,
    'posting_id',          l.posting_id,
    'listing_id',          l.listing_id,
    'workspace_id',        l.workspace_id,
    'branch_id',           l.branch_id,
    'branch_name',         (SELECT COALESCE(NULLIF(btrim(wb.display_name), ''), ao.name)
                              FROM public.workspace_branches wb
                              LEFT JOIN public.asset_owners ao ON ao.id = wb.asset_owner_id
                             WHERE wb.id = l.branch_id),
    'channel',             l.channel,
    'campaign_id',         l.campaign_id,
    'campaign_name',       (SELECT c.name FROM public.owner_mkt_campaigns c WHERE c.id = l.campaign_id),
    'target_kind',         CASE WHEN l.posting_id IS NOT NULL THEN 'posting' ELSE 'listing' END,
    'target_title',        COALESCE(p.title, li.title),
    'target_code',         CASE WHEN l.posting_id IS NOT NULL THEN p.code ELSE upper(left(l.listing_id::TEXT, 8)) END,
    'target_image',        COALESCE(p.image_urls[1], li.image_url),
    'is_legacy',           l.legacy_code IS NOT NULL)
    FROM (SELECT 1) one
    LEFT JOIN public.profiles s ON s.id = l.sender_user_id
    LEFT JOIN public.asset_postings p ON p.id = l.posting_id
    LEFT JOIN public.listings li ON li.id = l.listing_id
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Trang công khai
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.posting_share_public_keys()
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT ARRAY['title', 'category', 'location', 'description', 'specs', 'legal', 'image_urls',
               'video_urls', 'model_3d', 'vr_url', 'authenticated', 'starting_price', 'session',
               'owner_name', 'sender', 'expires_at', 'kind', 'listing_path']
$$;

-- Tin còn thuộc Trạm (claim còn hiệu lực) mới mở được.
CREATE OR REPLACE FUNCTION public.posting_share_listing_live(l public.posting_share_links)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT l.listing_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.asset_owner_claims c
     WHERE c.workspace_id = l.workspace_id AND c.listing_id = l.listing_id
       AND c.status IN ('auto_claimed', 'confirmed'))
$$;

CREATE OR REPLACE FUNCTION public.posting_share_listing_session(p_listing_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
           'path',                  '/sessions/' || s.id,
           'code',                  s.code,
           'title',                 s.title,
           'lot_no',                i.lot_no,
           'organization_name',     ao.name,
           'organization_logo_url', ao.logo_url,
           'starts_at',             s.starts_at,
           'ends_at',               s.ends_at,
           'registration_start_at', s.registration_start_at,
           'registration_end_at',   s.registration_end_at,
           'dossier_fee',           s.dossier_fee,
           'deposit_amount',        i.deposit_amount,
           'starting_price',        i.starting_price)
    FROM public.auction_session_items i
    JOIN public.auction_sessions s ON s.id = i.session_id AND s.status = 'published'
    LEFT JOIN public.auction_organizations ao ON ao.id = s.auction_org_id
   WHERE i.listing_id = p_listing_id
   ORDER BY (s.ends_at > now()) DESC, s.starts_at DESC
   LIMIT 1
$$;

-- Người gửi hiện trên trang (chỉ khi link bật) — dùng chung hai loại đích.
CREATE OR REPLACE FUNCTION public.posting_share_sender_json(l public.posting_share_links)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN l.show_sender_contact THEN jsonb_build_object(
           'name',  COALESCE(NULLIF(btrim(s.name), ''), l.sender_name),
           'phone', COALESCE(public.profile_contact_phone(s.agent_info), l.sender_phone)) END
    FROM (SELECT 1) one
    LEFT JOIN public.profiles s ON s.id = l.sender_user_id
$$;

-- Bản LIVE của posting_share_payload (20261001100000) + 'kind' / 'listing_path'.
CREATE OR REPLACE FUNCTION public.posting_share_payload(l public.posting_share_links, p public.asset_postings)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session JSONB := public.posting_share_session(p.id);
  v_model   JSONB;
  v_vr      TEXT;
  v_owner   TEXT;
BEGIN
  -- Chỉ nội dung admin đã duyệt công khai (published_at) — cùng luật trang phiên.
  SELECT jsonb_build_object('url', m.model_url, 'poster_url', m.poster_url, 'format', m.format)
    INTO v_model
    FROM public.asset_3d_scans m
   WHERE m.asset_posting_id = p.id AND m.status = 'ready' AND m.published_at IS NOT NULL
   ORDER BY m.ready_at DESC NULLS LAST
   LIMIT 1;

  SELECT o.vr_url INTO v_vr
    FROM public.asset_vr_tour_orders o
   WHERE o.asset_posting_id = p.id AND o.status = 'attached' AND o.published_at IS NOT NULL
   ORDER BY o.attached_at DESC NULLS LAST
   LIMIT 1;

  -- Tên đơn vị (ngân hàng / AMC). Hồ sơ cá nhân: không hiện tên người.
  IF p.workspace_id IS NOT NULL THEN
    SELECT w.primary_name INTO v_owner FROM public.asset_owner_workspaces w WHERE w.id = p.workspace_id;
  END IF;

  RETURN jsonb_build_object(
    'kind',        'posting',
    'listing_path', NULL,
    'title',       p.title,
    'category',    jsonb_build_object('parent', p.parent_slug, 'child', p.child_slug),
    'location',    jsonb_build_object(
                     'province', p.province,
                     'district', p.district,
                     'ward',     CASE WHEN l.show_exact_address THEN p.ward END,
                     'address',  CASE WHEN l.show_exact_address THEN p.address END),
    'description', p.description,
    'specs',       COALESCE(p.delta_fields, '{}'::jsonb),
    'legal',       jsonb_build_object(
                     'has_dispute',   p.has_dispute,
                     'has_mortgage',  p.has_mortgage,
                     'is_seized',     p.is_seized,
                     'right_to_sell', p.right_to_sell),
    'image_urls',  COALESCE(to_jsonb(p.image_urls), '[]'::jsonb),
    'video_urls',  COALESCE(to_jsonb(p.video_urls), '[]'::jsonb),
    'model_3d',    v_model,
    'vr_url',      v_vr,
    'authenticated', EXISTS (
                     SELECT 1 FROM public.asset_authentication_orders a
                      WHERE a.asset_posting_id = p.id AND a.status = 'completed'
                        AND a.verdict = 'authentic' AND a.published_at IS NOT NULL),
    -- D1: giá chỉ hiện khi link cho phép HOẶC đã có phiên công bố (giá đã công khai ở đó).
    'starting_price', CASE WHEN l.show_price OR v_session IS NOT NULL
                           THEN COALESCE((v_session ->> 'starting_price')::numeric, p.starting_price) END,
    'session',     v_session,
    'owner_name',  v_owner,
    'sender',      public.posting_share_sender_json(l),
    'expires_at',  l.expires_at
  );
END;
$$;

-- Tin trên sàn: chỉ những gì trang tin công khai đã có. Không mô tả tự do, không pháp lý tự khai.
CREATE OR REPLACE FUNCTION public.posting_share_listing_payload(l public.posting_share_links, li public.listings)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session JSONB := public.posting_share_listing_session(li.id);
  v_owner   TEXT;
BEGIN
  SELECT w.primary_name INTO v_owner FROM public.asset_owner_workspaces w WHERE w.id = l.workspace_id;

  RETURN jsonb_build_object(
    'kind',        'listing',
    'listing_path', '/listings/' || li.id,
    'title',       li.title,
    -- Nhóm cha suy ở client (parentOf) — SQL không có cây danh mục.
    'category',    jsonb_build_object('parent', NULL, 'child', li.property_type_slug),
    'location',    jsonb_build_object(
                     'province', li.address ->> 'province',
                     'district', li.address ->> 'district',
                     'ward',     CASE WHEN l.show_exact_address THEN li.address ->> 'ward' END,
                     'address',  CASE WHEN l.show_exact_address THEN li.address ->> 'street' END),
    'description', NULL,
    'specs',       CASE WHEN li.area > 0 THEN jsonb_build_object('area', li.area) ELSE '{}'::jsonb END,
    'legal',       jsonb_build_object('has_dispute', NULL, 'has_mortgage', NULL, 'is_seized', NULL,
                                      'right_to_sell', NULL),
    'image_urls',  CASE WHEN NULLIF(btrim(li.image_url), '') IS NOT NULL
                        THEN jsonb_build_array(li.image_url) ELSE '[]'::jsonb END,
    'video_urls',  '[]'::jsonb,
    'model_3d',    NULL,
    'vr_url',      NULL,
    'authenticated', false,
    -- Giá tin đã công khai trên sàn ⇒ luôn hiện (giá phiên nếu có, không thì giá tổng của tin).
    'starting_price', COALESCE((v_session ->> 'starting_price')::numeric,
                               CASE WHEN li.price_unit::TEXT = 'TOTAL' AND li.price > 0 THEN li.price END),
    'session',     v_session,
    'owner_name',  v_owner,
    'sender',      public.posting_share_sender_json(l),
    'expires_at',  l.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_shared_posting(p_code TEXT, p_visitor_id TEXT, p_device TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  l         public.posting_share_links%ROWTYPE;
  p         public.asset_postings%ROWTYPE;
  li        public.listings%ROWTYPE;
  v_payload JSONB;
  v_count   BOOLEAN;
BEGIN
  IF p_code IS NULL OR p_code !~ '^[A-Za-z0-9_-]{12}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO l FROM public.posting_share_links WHERE code = p_code;
  -- Thu hồi và mã sai không phân biệt được — cùng một thông báo.
  IF NOT FOUND OR l.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF l.expires_at IS NOT NULL AND l.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired', 'expired_at', l.expires_at);
  END IF;

  IF l.posting_id IS NOT NULL THEN
    SELECT * INTO p FROM public.asset_postings WHERE id = l.posting_id;
    IF NOT FOUND OR NOT public.posting_share_posting_live(p) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'unavailable');
    END IF;
    v_payload := public.posting_share_payload(l, p);
  ELSE
    SELECT * INTO li FROM public.listings WHERE id = l.listing_id;
    IF NOT FOUND OR NOT public.posting_share_listing_live(l) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'unavailable');
    END IF;
    v_payload := public.posting_share_listing_payload(l, li);
  END IF;

  -- Chỉ đếm người NGOÀI đơn vị; bot xem trước link (crawler) và visitor_id lạ không đếm.
  v_count := p_visitor_id IS NOT NULL
         AND p_visitor_id ~ '^[A-Za-z0-9_-]{8,64}$'
         AND NOT public.posting_share_is_member(l);

  -- Tải lại trang liên tục trong 1 phút chỉ tính 1 lượt.
  IF v_count AND NOT EXISTS (
       SELECT 1 FROM public.posting_share_events e
        WHERE e.link_id = l.id AND e.visitor_id = p_visitor_id AND e.event = 'view'
          AND e.created_at > now() - interval '1 minute') THEN
    UPDATE public.posting_share_links
       SET view_count        = view_count + 1,
           unique_view_count = unique_view_count + CASE WHEN EXISTS (
                                 SELECT 1 FROM public.posting_share_events e
                                  WHERE e.link_id = l.id AND e.visitor_id = p_visitor_id AND e.event = 'view')
                               THEN 0 ELSE 1 END,
           last_viewed_at    = now()
     WHERE id = l.id;
    INSERT INTO public.posting_share_events (link_id, event, visitor_id, device)
    VALUES (l.id, 'view', p_visitor_id, public.posting_share_device(p_device));
  END IF;

  -- 'ref' nằm NGOÀI payload danh sách trắng: chỉ để trang ghi cookie ghi nhận nguồn.
  RETURN jsonb_build_object('ok', true, 'posting', v_payload, 'ref', CASE WHEN v_count THEN l.id END);
END;
$$;

CREATE OR REPLACE FUNCTION public.track_posting_share_event(p_code TEXT, p_visitor_id TEXT, p_event TEXT, p_device TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  l public.posting_share_links%ROWTYPE;
BEGIN
  IF p_code IS NULL OR p_code !~ '^[A-Za-z0-9_-]{12}$'
     OR p_visitor_id IS NULL OR p_visitor_id !~ '^[A-Za-z0-9_-]{8,64}$'
     OR p_event NOT IN ('cta_dossier', 'cta_pdf', 'cta_follow', 'cta_call') THEN
    RETURN jsonb_build_object('ok', true, 'counted', false);
  END IF;

  SELECT * INTO l FROM public.posting_share_links
   WHERE code = p_code AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND OR public.posting_share_is_member(l) THEN
    RETURN jsonb_build_object('ok', true, 'counted', false);
  END IF;
  IF EXISTS (SELECT 1 FROM public.posting_share_events e
              WHERE e.link_id = l.id AND e.visitor_id = p_visitor_id AND e.event = p_event
                AND e.created_at > now() - interval '1 minute') THEN
    RETURN jsonb_build_object('ok', true, 'counted', false);
  END IF;

  INSERT INTO public.posting_share_events (link_id, event, visitor_id, device)
  VALUES (l.id, p_event, p_visitor_id, public.posting_share_device(p_device));

  UPDATE public.posting_share_links
     SET cta_dossier_count = cta_dossier_count + CASE WHEN p_event = 'cta_dossier' THEN 1 ELSE 0 END,
         cta_pdf_count     = cta_pdf_count     + CASE WHEN p_event = 'cta_pdf'     THEN 1 ELSE 0 END,
         cta_call_count    = cta_call_count    + CASE WHEN p_event = 'cta_call'    THEN 1 ELSE 0 END
   WHERE id = l.id AND p_event <> 'cta_follow';

  RETURN jsonb_build_object('ok', true, 'counted', true);
END;
$$;

-- Hồ sơ: theo dõi (thông báo khi mở phiên). Tin: LƯU tài sản như trên sàn + sự kiện save_asset
-- gắn link (trigger analytics_events_mkt_guard tự kiểm, thành viên Trạm bị bỏ link).
CREATE OR REPLACE FUNCTION public.follow_shared_posting(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  l      public.posting_share_links%ROWTYPE;
  p      public.asset_postings%ROWTYPE;
  v_new  BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF p_code IS NULL OR p_code !~ '^[A-Za-z0-9_-]{12}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO l FROM public.posting_share_links WHERE code = p_code;
  IF NOT FOUND OR l.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF l.expires_at IS NOT NULL AND l.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  IF l.listing_id IS NOT NULL THEN
    IF NOT public.posting_share_listing_live(l) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'unavailable');
    END IF;
    INSERT INTO public.user_asset_actions (user_id, listing_id, is_saved)
    VALUES (auth.uid(), l.listing_id, true)
    ON CONFLICT (user_id, listing_id) DO UPDATE SET is_saved = true
     WHERE NOT public.user_asset_actions.is_saved;
    v_new := FOUND;
    IF v_new THEN
      INSERT INTO public.analytics_events (session_id, user_id, event_type, feature_key, path, listing_id, mkt_link_id)
      VALUES ('hs_' || l.code, auth.uid(), 'feature', 'save_asset', '/hs/' || l.code, l.listing_id, l.id);
    END IF;
  ELSE
    SELECT * INTO p FROM public.asset_postings WHERE id = l.posting_id;
    IF NOT FOUND OR NOT public.posting_share_posting_live(p) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'unavailable');
    END IF;
    INSERT INTO public.posting_share_follows (posting_id, user_id, link_id)
    VALUES (p.id, auth.uid(), l.id)
    ON CONFLICT (posting_id, user_id) DO NOTHING;
    v_new := FOUND;
  END IF;

  IF v_new AND NOT public.posting_share_is_member(l) THEN
    UPDATE public.posting_share_links SET cta_follow_count = cta_follow_count + 1 WHERE id = l.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'already', NOT v_new);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_shared_posting_dossier_trust(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  l       public.posting_share_links%ROWTYPE;
  v_trust jsonb;
BEGIN
  IF p_code IS NULL OR p_code !~ '^[A-Za-z0-9_-]{12}$' THEN
    RETURN NULL;
  END IF;
  SELECT * INTO l FROM public.posting_share_links WHERE code = p_code;
  IF NOT FOUND OR l.revoked_at IS NOT NULL OR l.posting_id IS NULL
     OR (l.expires_at IS NOT NULL AND l.expires_at <= now()) THEN
    RETURN NULL;
  END IF;

  v_trust := public.get_public_dossier_trust(l.posting_id);
  IF v_trust IS NOT NULL AND NOT l.show_price THEN
    v_trust := v_trust - 'appraised_value';
  END IF;
  RETURN v_trust;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Ghi link (chủ tài sản)
-- ═══════════════════════════════════════════════════════════════════════════

-- NỘI BỘ — sinh mã + ghi dòng. Không cấp cho client (gọi từ create_share_link / owner_mkt_approve).
CREATE OR REPLACE FUNCTION public.share_link_insert(
  p_posting_id UUID, p_listing_id UUID, p_workspace_id UUID, p_branch_id UUID, p_channel TEXT,
  p_label TEXT, p_sender_user_id UUID, p_show_price BOOLEAN, p_show_exact_address BOOLEAN,
  p_show_sender_contact BOOLEAN, p_expires_at TIMESTAMPTZ, p_campaign_id UUID, p_created_by UUID)
RETURNS public.posting_share_links
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  pr      public.profiles%ROWTYPE;
  v_link  public.posting_share_links%ROWTYPE;
  v_tries INT := 0;
BEGIN
  SELECT * INTO pr FROM public.profiles WHERE id = p_sender_user_id;
  LOOP
    v_tries := v_tries + 1;
    BEGIN
      INSERT INTO public.posting_share_links (
        posting_id, listing_id, workspace_id, branch_id, channel, campaign_id, code, label,
        sender_user_id, sender_name, sender_phone, show_price, show_exact_address, show_sender_contact,
        expires_at, created_by)
      VALUES (
        p_posting_id, p_listing_id, p_workspace_id, p_branch_id, p_channel, p_campaign_id,
        public.posting_share_new_code(), btrim(p_label),
        pr.id, left(NULLIF(btrim(pr.name), ''), 80), public.profile_contact_phone(pr.agent_info),
        COALESCE(p_show_price, false), COALESCE(p_show_exact_address, false),
        COALESCE(p_show_sender_contact, false), p_expires_at, p_created_by)
      RETURNING * INTO v_link;
      RETURN v_link;
    EXCEPTION WHEN unique_violation THEN
      IF v_tries >= 5 THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.share_link_insert(UUID, UUID, UUID, UUID, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN,
  BOOLEAN, TIMESTAMPTZ, UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.share_link_channel_ok(p TEXT)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT p IN ('email', 'zalo', 'facebook', 'sms', 'bank_app', 'press', 'other')
$$;

-- Tạo link cho hồ sơ (p_posting_id) HOẶC tin Trạm đã nhận (p_workspace_id + p_listing_id).
CREATE OR REPLACE FUNCTION public.create_share_link(
  p_workspace_id UUID, p_posting_id UUID, p_listing_id UUID, p_channel TEXT, p_label TEXT,
  p_show_price BOOLEAN, p_show_exact_address BOOLEAN, p_show_sender_contact BOOLEAN,
  p_expires_in_days INTEGER, p_sender_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p        public.asset_postings%ROWTYPE;
  v_ws     UUID;
  v_branch UUID;
  v_owner  UUID;
  v_active INT;
  v_err    TEXT;
  v_link   public.posting_share_links%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF (p_posting_id IS NULL) = (p_listing_id IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'target_invalid');
  END IF;
  IF p_channel IS NULL OR NOT public.share_link_channel_ok(p_channel) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'channel_invalid');
  END IF;

  IF p_posting_id IS NOT NULL THEN
    SELECT * INTO p FROM public.asset_postings WHERE id = p_posting_id FOR SHARE;
    IF NOT FOUND OR NOT public.owner_posting_can(p.id, 'read') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
    END IF;
    IF NOT public.share_link_can(p.id, p.workspace_id, p.branch_id, 'manage') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
    END IF;
    IF p.status = 'cancelled' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'posting_closed');
    END IF;
    IF p.review_status IS DISTINCT FROM 'approved' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_approved');
    END IF;
    v_ws := p.workspace_id;
    v_branch := p.branch_id;
    v_owner := p.user_id;
    SELECT count(*) INTO v_active FROM public.posting_share_links
     WHERE posting_id = p.id AND revoked_at IS NULL;
  ELSE
    IF p_workspace_id IS NULL OR NOT public.owner_ws_can(p_workspace_id, 'read') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
    END IF;
    -- Quyền trước, tra claim sau: người ngoài không dò được tin nào thuộc Trạm nào.
    IF NOT public.owner_ws_has(p_workspace_id, 'truyen-thong', 'create') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
    END IF;
    SELECT s.branch_id INTO v_branch
      FROM public.owner_mkt_listing_scope(p_workspace_id, ARRAY[p_listing_id]) s;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'listing_not_in_workspace');
    END IF;
    IF NOT public.owner_ws_branch_ok(p_workspace_id, v_branch) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
    END IF;
    v_ws := p_workspace_id;
    SELECT count(*) INTO v_active FROM public.posting_share_links
     WHERE listing_id = p_listing_id AND workspace_id = v_ws AND revoked_at IS NULL;
  END IF;

  v_err := public.share_link_validate(v_ws, v_owner, p_label, p_sender_user_id, p_show_sender_contact,
                                      p_expires_in_days);
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_err);
  END IF;
  -- Chặn rải link vô hạn trên một tài sản (link đã thu hồi không tính).
  IF v_active >= 100 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_many_links');
  END IF;

  v_link := public.share_link_insert(
    p_posting_id, p_listing_id, v_ws, v_branch, p_channel, p_label, p_sender_user_id,
    p_show_price, p_show_exact_address, p_show_sender_contact,
    CASE WHEN p_expires_in_days IS NOT NULL THEN now() + make_interval(days => p_expires_in_days) END,
    NULL, auth.uid());

  RETURN jsonb_build_object('ok', true, 'link', public.posting_share_link_json(v_link, true));
END;
$$;

-- p_channel NULL = giữ nguyên kênh.
CREATE OR REPLACE FUNCTION public.update_share_link(
  p_link_id UUID, p_channel TEXT, p_label TEXT, p_show_price BOOLEAN, p_show_exact_address BOOLEAN,
  p_show_sender_contact BOOLEAN, p_change_expiry BOOLEAN, p_expires_in_days INTEGER, p_sender_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  l       public.posting_share_links%ROWTYPE;
  pr      public.profiles%ROWTYPE;
  v_owner UUID;
  v_err   TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO l FROM public.posting_share_links WHERE id = p_link_id FOR UPDATE;
  IF NOT FOUND OR NOT public.share_link_can(l.posting_id, l.workspace_id, l.branch_id, 'view') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.share_link_can(l.posting_id, l.workspace_id, l.branch_id, 'manage') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF l.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'revoked');
  END IF;
  IF p_channel IS NOT NULL AND NOT public.share_link_channel_ok(p_channel) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'channel_invalid');
  END IF;

  SELECT ap.user_id INTO v_owner FROM public.asset_postings ap WHERE ap.id = l.posting_id;
  v_err := public.share_link_validate(l.workspace_id, v_owner, p_label, p_sender_user_id, p_show_sender_contact,
                                      CASE WHEN p_change_expiry THEN p_expires_in_days END);
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_err);
  END IF;
  SELECT * INTO pr FROM public.profiles WHERE id = p_sender_user_id;

  UPDATE public.posting_share_links
     SET label               = btrim(p_label),
         channel             = COALESCE(p_channel, channel),
         sender_user_id      = pr.id,
         sender_name         = left(NULLIF(btrim(pr.name), ''), 80),
         sender_phone        = public.profile_contact_phone(pr.agent_info),
         show_price          = COALESCE(p_show_price, false),
         show_exact_address  = COALESCE(p_show_exact_address, false),
         show_sender_contact = COALESCE(p_show_sender_contact, false),
         expires_at          = CASE
                                 WHEN NOT COALESCE(p_change_expiry, false) THEN expires_at
                                 WHEN p_expires_in_days IS NULL THEN NULL
                                 ELSE now() + make_interval(days => p_expires_in_days)
                               END
   WHERE id = l.id
   RETURNING * INTO l;

  RETURN jsonb_build_object('ok', true, 'link', public.posting_share_link_json(l, true));
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_share_link(p_link_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  l public.posting_share_links%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO l FROM public.posting_share_links WHERE id = p_link_id FOR UPDATE;
  IF NOT FOUND OR NOT public.share_link_can(l.posting_id, l.workspace_id, l.branch_id, 'view') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.share_link_can(l.posting_id, l.workspace_id, l.branch_id, 'manage') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF l.revoked_at IS NULL THEN
    UPDATE public.posting_share_links SET revoked_at = now() WHERE id = l.id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- RPC cũ của hồ sơ = lớp bọc (giữ chữ ký cho client chưa cập nhật).
CREATE OR REPLACE FUNCTION public.create_posting_share_link(
  p_posting_id UUID, p_label TEXT, p_show_price BOOLEAN, p_show_exact_address BOOLEAN,
  p_show_sender_contact BOOLEAN, p_expires_in_days INTEGER, p_sender_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.create_share_link(NULL, p_posting_id, NULL, 'other', p_label, p_show_price, p_show_exact_address,
                                  p_show_sender_contact, p_expires_in_days, p_sender_user_id)
$$;

CREATE OR REPLACE FUNCTION public.update_posting_share_link(
  p_link_id UUID, p_label TEXT, p_show_price BOOLEAN, p_show_exact_address BOOLEAN,
  p_show_sender_contact BOOLEAN, p_change_expiry BOOLEAN, p_expires_in_days INTEGER,
  p_sender_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.update_share_link(p_link_id, NULL, p_label, p_show_price, p_show_exact_address,
                                  p_show_sender_contact, p_change_expiry, p_expires_in_days, p_sender_user_id)
$$;

CREATE OR REPLACE FUNCTION public.revoke_posting_share_link(p_link_id UUID)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.revoke_share_link(p_link_id)
$$;

-- Người gửi chọn được: hồ sơ ⇒ như posting_share_senders; tin ⇒ thành viên đang hoạt động của Trạm.
CREATE OR REPLACE FUNCTION public.share_link_senders(p_workspace_id UUID, p_posting_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF p_posting_id IS NOT NULL THEN
    RETURN public.posting_share_senders(p_posting_id);
  END IF;
  IF p_workspace_id IS NULL OR NOT public.owner_ws_can(p_workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_ws_has(p_workspace_id, 'truyen-thong', 'create') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  RETURN jsonb_build_object('ok', true, 'senders', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'user_id',   pr.id,
             'name',      NULLIF(btrim(pr.name), ''),
             'email',     pr.email,
             'phone',     public.profile_contact_phone(pr.agent_info),
             'role_name', r.name)
           ORDER BY (pr.id = auth.uid()) DESC, COALESCE(r.is_system, false) DESC,
                    lower(COALESCE(NULLIF(btrim(pr.name), ''), pr.email)))
      FROM public.asset_owner_workspace_members m
      LEFT JOIN public.owner_ws_roles r ON r.id = m.role_id
      JOIN public.profiles pr ON pr.id = m.user_id
     WHERE m.workspace_id = p_workspace_id AND m.status = 'active'), '[]'::JSONB));
END;
$$;

-- posting_share_senders cũ: cho phép cả người có truyen-thong:create (luật quản lý link chung).
CREATE OR REPLACE FUNCTION public.posting_share_senders(p_posting_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p public.asset_postings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO p FROM public.asset_postings WHERE id = p_posting_id;
  IF NOT FOUND OR NOT public.owner_posting_can(p.id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.share_link_can(p.id, p.workspace_id, p.branch_id, 'manage') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  RETURN jsonb_build_object('ok', true, 'senders', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'user_id',   pr.id,
             'name',      NULLIF(btrim(pr.name), ''),
             'email',     pr.email,
             'phone',     public.profile_contact_phone(pr.agent_info),
             'role_name', s.role_name)
           ORDER BY (pr.id = auth.uid()) DESC, s.is_owner DESC, lower(COALESCE(NULLIF(btrim(pr.name), ''), pr.email)))
      FROM (
        SELECT m.user_id, r.name AS role_name, COALESCE(r.is_system, false) AS is_owner
          FROM public.asset_owner_workspace_members m
          LEFT JOIN public.owner_ws_roles r ON r.id = m.role_id
         WHERE p.workspace_id IS NOT NULL AND m.workspace_id = p.workspace_id AND m.status = 'active'
        UNION ALL
        SELECT p.user_id, NULL, true WHERE p.workspace_id IS NULL
      ) s
      JOIN public.profiles pr ON pr.id = s.user_id), '[]'::JSONB));
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Đọc link (chủ tài sản)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.owner_posting_share_links(p_posting_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p           public.asset_postings%ROWTYPE;
  v_can_share BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO p FROM public.asset_postings WHERE id = p_posting_id;
  IF NOT FOUND OR NOT public.share_link_can(p.id, p.workspace_id, p.branch_id, 'view') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  v_can_share := public.share_link_can(p.id, p.workspace_id, p.branch_id, 'manage');

  RETURN jsonb_build_object(
    'ok', true,
    'can_share', v_can_share,
    'links', COALESCE((
      SELECT jsonb_agg(public.posting_share_link_json(l, v_can_share) ORDER BY l.created_at DESC)
        FROM public.posting_share_links l
       WHERE l.posting_id = p_posting_id), '[]'::jsonb));
END;
$$;

-- Tổng hợp mọi link của Trạm (menu "Link theo dõi"); p_campaign_id lọc link của một chiến dịch.
-- Phạm vi chi nhánh lọc ở server; lọc còn lại ở client. Trần 2.000 dòng mới nhất.
CREATE OR REPLACE FUNCTION public.owner_share_links(p_workspace_id UUID, p_campaign_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF p_workspace_id IS NULL OR NOT public.owner_ws_can(p_workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'can_create', public.owner_ws_has(p_workspace_id, 'truyen-thong', 'create')
                  OR public.owner_ws_has(p_workspace_id, 'so-hoa', 'share'),
    'links', COALESCE((
      SELECT jsonb_agg(x.j ORDER BY x.created_at DESC)
        FROM (
          -- Mã: người quản lý link; link chiến dịch thêm người có truyen-thong:share (xuất bộ tư liệu).
          SELECT l.created_at,
                 public.posting_share_link_json(l, m.can_manage OR (l.campaign_id IS NOT NULL
                   AND public.owner_ws_has_in(l.workspace_id, 'truyen-thong', 'share', l.branch_id)))
                   || jsonb_build_object('can_manage', m.can_manage) AS j
            FROM public.posting_share_links l
           CROSS JOIN LATERAL (SELECT public.share_link_can(l.posting_id, l.workspace_id, l.branch_id, 'manage') AS can_manage) m
           WHERE l.workspace_id = p_workspace_id
             AND (p_campaign_id IS NULL OR l.campaign_id = p_campaign_id)
             AND public.share_link_can(l.posting_id, l.workspace_id, l.branch_id, 'view')
           ORDER BY l.created_at DESC
           LIMIT 2000) x), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_share_link_detail(p_link_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  l        public.posting_share_links%ROWTYPE;
  v_manage BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO l FROM public.posting_share_links WHERE id = p_link_id;
  IF NOT FOUND OR NOT public.share_link_can(l.posting_id, l.workspace_id, l.branch_id, 'view') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  v_manage := public.share_link_can(l.posting_id, l.workspace_id, l.branch_id, 'manage');
  RETURN jsonb_build_object('ok', true, 'can_manage', v_manage,
                            'link', public.posting_share_link_json(l, v_manage));
END;
$$;

-- NỘI BỘ — chuỗi theo ngày (giờ VN, có cả ngày trống); khoảng > 120 ngày gom theo tuần.
-- Tổng kỳ đếm người KHÁC NHAU trên cả kỳ (không cộng dồn từng ngày).
CREATE OR REPLACE FUNCTION public.share_link_series_core(p_link_ids UUID[], p_from DATE, p_to DATE, p_device TEXT)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH prm AS (
    SELECT CASE WHEN p_to - p_from > 120 THEN 'week' ELSE 'day' END AS unit,
           p_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'       AS t0,
           (p_to + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'   AS t1
  ),
  ev AS (
    SELECT e.event, e.visitor_id,
           date_trunc(prm.unit, e.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS d
      FROM public.posting_share_events e, prm
     WHERE e.link_id = ANY (p_link_ids)
       AND e.created_at >= prm.t0 AND e.created_at < prm.t1
       AND (p_device IS NULL OR e.device = p_device)
  ),
  days AS (
    SELECT g::date AS d
      FROM prm, generate_series(date_trunc(prm.unit, p_from::timestamp), p_to::timestamp,
                                ('1 ' || prm.unit)::interval) g
  ),
  per AS (
    SELECT ev.d,
           count(*) FILTER (WHERE ev.event = 'view')                             AS views,
           count(DISTINCT ev.visitor_id) FILTER (WHERE ev.event = 'view')        AS viewers,
           count(*) FILTER (WHERE ev.event = 'cta_dossier')                      AS dossier,
           count(DISTINCT ev.visitor_id) FILTER (WHERE ev.event = 'cta_dossier') AS dossier_people,
           count(*) FILTER (WHERE ev.event = 'cta_pdf')                          AS pdf,
           count(*) FILTER (WHERE ev.event = 'cta_follow')                       AS follow,
           count(*) FILTER (WHERE ev.event = 'cta_call')                         AS call
      FROM ev GROUP BY ev.d
  )
  SELECT jsonb_build_object(
    'unit', (SELECT unit FROM prm),
    'from', p_from,
    'to',   p_to,
    'series', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'date', days.d,
               'views', COALESCE(per.views, 0), 'viewers', COALESCE(per.viewers, 0),
               'dossier', COALESCE(per.dossier, 0), 'dossier_people', COALESCE(per.dossier_people, 0),
               'pdf', COALESCE(per.pdf, 0), 'follow', COALESCE(per.follow, 0), 'call', COALESCE(per.call, 0))
             ORDER BY days.d)
        FROM days LEFT JOIN per ON per.d = days.d), '[]'::jsonb),
    'totals', (
      SELECT jsonb_build_object(
               'views',          count(*) FILTER (WHERE ev.event = 'view'),
               'viewers',        count(DISTINCT ev.visitor_id) FILTER (WHERE ev.event = 'view'),
               'dossier',        count(*) FILTER (WHERE ev.event = 'cta_dossier'),
               'dossier_people', count(DISTINCT ev.visitor_id) FILTER (WHERE ev.event = 'cta_dossier'),
               'pdf',            count(*) FILTER (WHERE ev.event = 'cta_pdf'),
               'follow',         count(*) FILTER (WHERE ev.event = 'cta_follow'),
               'call',           count(*) FILTER (WHERE ev.event = 'cta_call'))
        FROM ev))
$$;
REVOKE ALL ON FUNCTION public.share_link_series_core(UUID[], DATE, DATE, TEXT) FROM PUBLIC, anon, authenticated;

-- Khoảng ngày chung của hai RPC chuỗi: thiếu "từ" = từ ngày bắt đầu; tối đa 366 ngày (cắt phần đầu).
CREATE OR REPLACE FUNCTION public.share_link_series_range(p_from DATE, p_to DATE, p_start TIMESTAMPTZ)
RETURNS DATE[]
LANGUAGE sql STABLE SET search_path = public
AS $$
  WITH r AS (
    SELECT COALESCE(p_to, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS t,
           COALESCE(p_from, (p_start AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS f
  )
  SELECT ARRAY[greatest(least(r.f, r.t), r.t - 366), r.t] FROM r
$$;

CREATE OR REPLACE FUNCTION public.owner_share_link_series(p_link_id UUID, p_from DATE, p_to DATE, p_device TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  l   public.posting_share_links%ROWTYPE;
  v_r DATE[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO l FROM public.posting_share_links WHERE id = p_link_id;
  IF NOT FOUND OR NOT public.share_link_can(l.posting_id, l.workspace_id, l.branch_id, 'view') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF p_device IS NOT NULL AND public.posting_share_device(p_device) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'device_invalid');
  END IF;
  v_r := public.share_link_series_range(p_from, p_to, l.created_at);
  RETURN jsonb_build_object('ok', true) || public.share_link_series_core(ARRAY[l.id], v_r[1], v_r[2], p_device);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_mkt_campaign_series(p_campaign_id UUID, p_from DATE, p_to DATE, p_device TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c     public.owner_mkt_campaigns%ROWTYPE;
  v_ids UUID[];
  v_r   DATE[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO c FROM public.owner_mkt_campaigns WHERE id = p_campaign_id;
  IF NOT FOUND OR NOT public.owner_ws_can(c.workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF p_device IS NOT NULL AND public.posting_share_device(p_device) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'device_invalid');
  END IF;
  SELECT COALESCE(array_agg(l.id), '{}') INTO v_ids
    FROM public.posting_share_links l
   WHERE l.campaign_id = c.id
     AND public.share_link_can(l.posting_id, l.workspace_id, l.branch_id, 'view');
  v_r := public.share_link_series_range(p_from, p_to, COALESCE(c.approved_at, c.created_at));
  RETURN jsonb_build_object('ok', true) || public.share_link_series_core(v_ids, v_r[1], v_r[2], p_device);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_share_link(UUID, UUID, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_share_link(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_share_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.share_link_senders(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_share_links(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_share_link_detail(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_share_link_series(UUID, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_mkt_campaign_series(UUID, DATE, DATE, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_share_link(UUID, UUID, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_share_link(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_share_link(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.share_link_senders(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.owner_share_links(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.owner_share_link_detail(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.owner_share_link_series(UUID, DATE, DATE, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.owner_mkt_campaign_series(UUID, DATE, DATE, TEXT) FROM anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Tự kiểm
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  l      public.posting_share_links%ROWTYPE;
  p      public.asset_postings%ROWTYPE;
  v_keys TEXT[];
BEGIN
  -- Payload mọi link hồ sơ hiện có đúng bằng danh sách trắng.
  FOR l IN SELECT * FROM public.posting_share_links WHERE posting_id IS NOT NULL LOOP
    SELECT * INTO p FROM public.asset_postings WHERE id = l.posting_id;
    SELECT array_agg(k ORDER BY k) INTO v_keys FROM jsonb_object_keys(public.posting_share_payload(l, p)) k;
    IF v_keys IS DISTINCT FROM (SELECT array_agg(k ORDER BY k) FROM unnest(public.posting_share_public_keys()) k) THEN
      RAISE EXCEPTION 'self-check: payload hồ sơ lệch danh sách trắng: %', v_keys;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.posting_share_links sl
               JOIN public.asset_postings ap ON ap.id = sl.posting_id
              WHERE sl.branch_id IS DISTINCT FROM ap.branch_id) THEN
    RAISE EXCEPTION 'self-check: branch_id link hồ sơ chưa backfill';
  END IF;

  IF has_function_privilege('authenticated', 'public.share_link_insert(uuid, uuid, uuid, uuid, text, text, uuid, boolean, boolean, boolean, timestamptz, uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.share_link_series_core(uuid[], date, date, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'self-check: hàm nội bộ đang mở cho client';
  END IF;
  IF has_column_privilege('authenticated', 'public.posting_share_links', 'code', 'SELECT')
     OR has_column_privilege('authenticated', 'public.posting_share_links', 'legacy_code', 'SELECT') THEN
    RAISE EXCEPTION 'self-check: cột mã link đang đọc được trực tiếp';
  END IF;
END;
$$;

-- Hàm dựng JSON / payload chỉ gọi từ RPC SECURITY DEFINER: client tự ghép dòng giả sẽ đọc được
-- tên hồ sơ / tin / người gửi theo id tuỳ ý ⇒ không cấp.
REVOKE ALL ON FUNCTION public.posting_share_link_json(public.posting_share_links, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.posting_share_payload(public.posting_share_links, public.asset_postings) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.posting_share_listing_payload(public.posting_share_links, public.listings) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.posting_share_sender_json(public.posting_share_links) FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Nhật ký — bản LIVE của owner_audit_row + nhánh link trỏ tin (module truyen-thong)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.owner_audit_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
         'asset_broker_requests', 'consignment_contracts', 'asset_valuation_orders' THEN
      -- Mã link là mật khẩu của link ⇒ không vào nhật ký (nhãn lẫn thay đổi).
      IF TG_TABLE_NAME = 'posting_share_links' THEN
        _changes := _changes - 'code' - 'legacy_code';
      END IF;
      -- Link Hồ sơ online trỏ TIN trên sàn (20261004210000): ghi vào module Truyền thông.
      IF TG_TABLE_NAME = 'posting_share_links' AND _r ->> 'listing_id' IS NOT NULL THEN
        _ws := (_r ->> 'workspace_id')::UUID;
        _branch := (_r ->> 'branch_id')::UUID;
        _module := 'truyen-thong';
        SELECT concat_ws(' · ', NULLIF(_r ->> 'label', ''), li.title) INTO _label
          FROM public.listings li WHERE li.id = (_r ->> 'listing_id')::UUID;
        _label := COALESCE(_label, _r ->> 'label');
        _meta := jsonb_build_object('listing_id', _r ->> 'listing_id');
        PERFORM public.owner_audit_write(_ws, NULL, _branch, _module, _action, TG_TABLE_NAME, _eid, _label,
                                         public.owner_audit_enrich(_changes), _meta, NULL);
        RETURN NULL;
      END IF;
      _pid := COALESCE(_r ->> 'asset_posting_id', _r ->> 'posting_id')::UUID;
      SELECT p.workspace_id, p.user_id, p.branch_id, concat_ws(' · ', p.code, p.title)
        INTO _ws, _subject, _branch, _label
        FROM public.asset_postings p WHERE p.id = _pid;
      -- Hồ sơ cha đã bị xoá (xoá dây chuyền): dòng xoá hồ sơ đã đủ.
      IF NOT FOUND THEN RETURN NULL; END IF;
      IF _r ->> 'code' IS NOT NULL AND TG_TABLE_NAME <> 'posting_share_links' THEN
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
$function$;
