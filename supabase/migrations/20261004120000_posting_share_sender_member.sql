-- Người gửi của link Hồ sơ online phải là THÀNH VIÊN của Trạm (hồ sơ cá nhân: chính chủ hồ sơ),
-- không còn gõ tự do. Tên + SĐT lấy từ hồ sơ cá nhân của thành viên (profiles.name +
-- agent_info.basic.phone) — trang công khai đọc SỐNG nên thành viên bổ sung SĐT sau thì link
-- đã gửi cũng hiện. sender_name / sender_phone vẫn được ghi lại lúc lưu (nhật ký + link cũ).
--
-- SĐT của thành viên chưa có thì người có thanh-vien:update bổ sung ở trang Thành viên
-- (owner_ws_set_member_phone) — không bao giờ đè SĐT chủ tài khoản đã xác thực OTP.

-- ─── 1. Cột + hàm đọc SĐT hồ sơ ───────────────────────────────────────────────

ALTER TABLE public.posting_share_links
  ADD COLUMN sender_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

GRANT SELECT (sender_user_id) ON public.posting_share_links TO authenticated;

-- SĐT liên hệ trong hồ sơ cá nhân (ProfileBasicSection ghi agent_info.basic.phone).
CREATE FUNCTION public.profile_contact_phone(p_agent_info JSONB)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE WHEN btrim(p_agent_info #>> '{basic,phone}') ~ '^0[0-9]{9}$'
              THEN btrim(p_agent_info #>> '{basic,phone}') END
$$;

-- ─── 2. Thành viên kèm SĐT (trang Thành viên) ────────────────────────────────

DROP FUNCTION public.owner_ws_list_members(UUID);
CREATE FUNCTION public.owner_ws_list_members(p_workspace_id UUID)
RETURNS TABLE (
  member_id      UUID,
  user_id        UUID,
  full_name      TEXT,
  email          TEXT,
  role           TEXT,       -- tier di sản cho frontend cũ — bỏ ở bước C
  role_id        UUID,
  role_name      TEXT,
  is_owner       BOOLEAN,
  branch_scope   UUID[],
  status         TEXT,
  joined_at      TIMESTAMPTZ,
  phone          TEXT,
  phone_verified BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.user_id, p.name, p.email,
         public.owner_ws_role_tier(m.role_id),
         r.id, r.name, COALESCE(r.is_system, false),
         m.branch_scope, m.status, m.joined_at,
         public.profile_contact_phone(p.agent_info),
         public.profile_contact_phone(p.agent_info) IS NOT NULL
           AND COALESCE((p.agent_info #>> '{basic,phone_verified}')::BOOLEAN, false)
    FROM public.asset_owner_workspace_members m
    JOIN public.profiles p ON p.id = m.user_id
    LEFT JOIN public.owner_ws_roles r ON r.id = m.role_id
   WHERE m.workspace_id = p_workspace_id
     AND m.status = 'active'
     AND public.owner_ws_role(p_workspace_id) IS NOT NULL
   ORDER BY COALESCE(r.is_system, false) DESC,
            r.name,
            m.joined_at NULLS LAST,
            p.email
$$;
REVOKE ALL ON FUNCTION public.owner_ws_list_members(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_ws_list_members(UUID) TO authenticated;

-- ─── 3. Bổ sung SĐT cho thành viên ───────────────────────────────────────────

CREATE FUNCTION public.owner_ws_set_member_phone(p_member_id UUID, p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid   UUID := auth.uid();
  _m     public.asset_owner_workspace_members%ROWTYPE;
  _p     public.profiles%ROWTYPE;
  _phone TEXT := NULLIF(btrim(p_phone), '');
  _old   TEXT;
  _basic JSONB;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO _m FROM public.asset_owner_workspace_members WHERE id = p_member_id AND status = 'active';
  IF NOT FOUND OR public.owner_ws_role(_m.workspace_id) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_ws_has(_m.workspace_id, 'thanh-vien', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  -- SĐT của chính mình: sửa ở Hồ sơ cá nhân (có xác thực OTP).
  IF _m.user_id = _uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cannot_change_self');
  END IF;
  IF public.owner_ws_role_is_owner(_m.role_id) AND NOT public.owner_ws_is_owner(_m.workspace_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'owner_only');
  END IF;
  IF _phone IS NOT NULL AND _phone !~ '^0[0-9]{9}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_phone');
  END IF;

  SELECT * INTO _p FROM public.profiles WHERE id = _m.user_id FOR UPDATE;
  _old := public.profile_contact_phone(_p.agent_info);
  IF _old IS NOT NULL AND COALESCE((_p.agent_info #>> '{basic,phone_verified}')::BOOLEAN, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'phone_verified');
  END IF;
  IF _old IS NOT DISTINCT FROM _phone THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  _basic := COALESCE(_p.agent_info -> 'basic', '{}'::JSONB) - 'phone' - 'phone_verified';
  IF _phone IS NOT NULL THEN
    _basic := _basic || jsonb_build_object('phone', _phone, 'phone_verified', false);
  END IF;
  UPDATE public.profiles
     SET agent_info = jsonb_set(COALESCE(agent_info, '{}'::JSONB), '{basic}', _basic)
   WHERE id = _p.id;

  PERFORM public.owner_audit_write(
    _m.workspace_id, NULL, NULL, 'thanh-vien', 'update', 'asset_owner_workspace_members', _m.id::TEXT,
    COALESCE(NULLIF(btrim(_p.name), ''), _p.email),
    jsonb_build_object('phone', jsonb_build_array(_old, _phone)), '{}'::JSONB, NULL);

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.owner_ws_set_member_phone(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_ws_set_member_phone(UUID, TEXT) TO authenticated;

-- ─── 4. Ai được làm người gửi ────────────────────────────────────────────────

-- Thành viên đang hoạt động của Trạm sở hữu hồ sơ; hồ sơ cá nhân: chính chủ hồ sơ.
CREATE FUNCTION public.posting_share_sender_ok(p public.asset_postings, p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user IS NULL THEN false
    WHEN p.workspace_id IS NULL THEN p_user = p.user_id
    ELSE EXISTS (SELECT 1 FROM public.asset_owner_workspace_members m
                  WHERE m.workspace_id = p.workspace_id AND m.user_id = p_user AND m.status = 'active')
  END
$$;
REVOKE ALL ON FUNCTION public.posting_share_sender_ok(public.asset_postings, UUID) FROM PUBLIC, anon, authenticated;

-- Danh sách cho ô "Người gửi" — cùng luật với posting_share_sender_ok.
CREATE FUNCTION public.posting_share_senders(p_posting_id UUID)
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
  IF NOT public.owner_posting_can(p.id, 'so-hoa', 'share') THEN
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
REVOKE ALL ON FUNCTION public.posting_share_senders(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.posting_share_senders(UUID) TO authenticated;

-- ─── 5. Kiểm hợp lệ + tạo / sửa link theo người gửi là thành viên ───────────

DROP FUNCTION public.create_posting_share_link(UUID, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, INT);
DROP FUNCTION public.update_posting_share_link(UUID, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INT);
DROP FUNCTION public.posting_share_validate(TEXT, TEXT, TEXT, BOOLEAN, INT);

-- Lỗi trả về NULL = hợp lệ. Người gửi chỉ bắt buộc khi hiện liên hệ cho khách.
CREATE FUNCTION public.posting_share_validate(
  p public.asset_postings, p_label TEXT, p_sender_user_id UUID, p_show_sender_contact BOOLEAN, p_days INT)
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
  IF NOT public.posting_share_sender_ok(p, p_sender_user_id) THEN RETURN 'invalid_sender'; END IF;
  SELECT * INTO pr FROM public.profiles WHERE id = p_sender_user_id;
  IF COALESCE(p_show_sender_contact, false)
     AND NULLIF(btrim(pr.name), '') IS NULL AND public.profile_contact_phone(pr.agent_info) IS NULL THEN
    RETURN 'sender_no_contact';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.posting_share_validate(public.asset_postings, TEXT, UUID, BOOLEAN, INT)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.create_posting_share_link(
  p_posting_id          UUID,
  p_label               TEXT,
  p_show_price          BOOLEAN,
  p_show_exact_address  BOOLEAN,
  p_show_sender_contact BOOLEAN,
  p_expires_in_days     INT,
  p_sender_user_id      UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p        public.asset_postings%ROWTYPE;
  pr       public.profiles%ROWTYPE;
  v_err    TEXT;
  v_code   TEXT;
  v_link   public.posting_share_links%ROWTYPE;
  v_tries  INT := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO p FROM public.asset_postings WHERE id = p_posting_id FOR SHARE;
  IF NOT FOUND OR NOT public.owner_posting_can(p.id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_posting_can(p.id, 'so-hoa', 'share') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF p.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'posting_closed');
  END IF;
  IF p.review_status IS DISTINCT FROM 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_approved');
  END IF;

  v_err := public.posting_share_validate(p, p_label, p_sender_user_id, p_show_sender_contact, p_expires_in_days);
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_err);
  END IF;
  SELECT * INTO pr FROM public.profiles WHERE id = p_sender_user_id;

  -- Chặn rải link vô hạn trên một hồ sơ (link đã thu hồi không tính).
  IF (SELECT count(*) FROM public.posting_share_links
       WHERE posting_id = p.id AND revoked_at IS NULL) >= 100 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_many_links');
  END IF;

  LOOP
    v_tries := v_tries + 1;
    v_code := public.posting_share_new_code();
    BEGIN
      INSERT INTO public.posting_share_links (
        posting_id, workspace_id, code, label, sender_user_id, sender_name, sender_phone, show_price,
        show_exact_address, show_sender_contact, expires_at, created_by)
      VALUES (
        p.id, p.workspace_id, v_code, btrim(p_label),
        pr.id, left(NULLIF(btrim(pr.name), ''), 80), public.profile_contact_phone(pr.agent_info),
        COALESCE(p_show_price, false), COALESCE(p_show_exact_address, false),
        COALESCE(p_show_sender_contact, false),
        CASE WHEN p_expires_in_days IS NOT NULL THEN now() + make_interval(days => p_expires_in_days) END,
        auth.uid())
      RETURNING * INTO v_link;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_tries >= 5 THEN RAISE; END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'link', public.posting_share_link_json(v_link, true));
END;
$$;

CREATE FUNCTION public.update_posting_share_link(
  p_link_id             UUID,
  p_label               TEXT,
  p_show_price          BOOLEAN,
  p_show_exact_address  BOOLEAN,
  p_show_sender_contact BOOLEAN,
  p_change_expiry       BOOLEAN,
  p_expires_in_days     INT,
  p_sender_user_id      UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  l     public.posting_share_links%ROWTYPE;
  p     public.asset_postings%ROWTYPE;
  pr    public.profiles%ROWTYPE;
  v_err TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO l FROM public.posting_share_links WHERE id = p_link_id FOR UPDATE;
  IF NOT FOUND OR NOT public.owner_posting_can(l.posting_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_posting_can(l.posting_id, 'so-hoa', 'share') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF l.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'revoked');
  END IF;

  SELECT * INTO p FROM public.asset_postings WHERE id = l.posting_id;
  v_err := public.posting_share_validate(p, p_label, p_sender_user_id, p_show_sender_contact,
                                          CASE WHEN p_change_expiry THEN p_expires_in_days END);
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_err);
  END IF;
  SELECT * INTO pr FROM public.profiles WHERE id = p_sender_user_id;

  UPDATE public.posting_share_links
     SET label               = btrim(p_label),
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

REVOKE ALL ON FUNCTION public.create_posting_share_link(UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, INT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_posting_share_link(UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_posting_share_link(UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, INT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_posting_share_link(UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INT, UUID) TO authenticated;

-- ─── 6. Tên / SĐT người gửi đọc SỐNG từ hồ sơ thành viên ────────────────────

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
    'created_at',          l.created_at)
    FROM (SELECT 1) one
    LEFT JOIN public.profiles s ON s.id = l.sender_user_id
$$;

CREATE OR REPLACE FUNCTION public.posting_share_payload(l public.posting_share_links, p public.asset_postings)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session JSONB := public.posting_share_session(p.id);
  v_model   JSONB;
  v_vr      TEXT;
  v_owner   TEXT;
  v_sender  JSONB;
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

  -- Người gửi là thành viên ⇒ tên / SĐT hiện tại trong hồ sơ của họ; link cũ: bản ghi lúc tạo.
  IF l.show_sender_contact THEN
    SELECT jsonb_build_object(
             'name',  COALESCE(NULLIF(btrim(s.name), ''), l.sender_name),
             'phone', COALESCE(public.profile_contact_phone(s.agent_info), l.sender_phone))
      INTO v_sender
      FROM (SELECT 1) one
      LEFT JOIN public.profiles s ON s.id = l.sender_user_id;
  END IF;

  RETURN jsonb_build_object(
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
    'sender',      v_sender,
    'expires_at',  l.expires_at
  );
END;
$$;
