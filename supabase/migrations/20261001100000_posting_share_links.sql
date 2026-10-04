-- "Hồ sơ online" — link công khai /hs/:code của một hồ sơ số hoá (docs/owner-marketing-plan.md
-- Phase M0). Cán bộ ngân hàng gửi link qua kênh RIÊNG của ngân hàng (Zalo, email, RM) ⇒ sàn
-- không bao giờ nhận danh sách khách của ngân hàng; ngân hàng chỉ thấy SỐ ĐẾM (lượt xem,
-- bấm "Mua hồ sơ", người theo dõi), không bao giờ thấy ai.
--
-- Quyết định (đã chốt trong plan, không hỏi lại):
--   D1 Giá khởi điểm ẩn mặc định khi hồ sơ chưa có phiên đã công bố; bật theo từng link.
--   D2 "Nhận thông báo khi mở phiên" cần tài khoản sàn; ngân hàng chỉ thấy số đếm.
--   D3 Chỉ tạo link khi hồ sơ đã duyệt (review_status = 'approved') và chưa huỷ. Trang công
--      khai cũng kiểm lại LÚC MỞ: hồ sơ bị sửa (về chờ duyệt) / huỷ ⇒ tạm không xem được.
--
-- Quyền mới so-hoa:share ("Chia sẻ hồ sơ") — cấp cho đúng các vai trò đang có so-hoa:update
-- (Trưởng đơn vị luôn toàn quyền). Không ai thêm / mất quyền nào khác (tự kiểm cuối file).
--
-- Mã link (12 ký tự base64url) là MẬT KHẨU của link: authenticated không có quyền SELECT cột
-- code (quyền theo cột, như share_token của báo cáo định kỳ) — chỉ đọc qua RPC
-- owner_posting_share_links và chỉ người có so-hoa:share mới nhận được.
--
-- Mọi ghi qua RPC SECURITY DEFINER; bảng không có policy INSERT / UPDATE / DELETE.
-- Payload công khai là DANH SÁCH TRẮNG (posting_share_public_keys) — tự kiểm bằng một link
-- thử trên hồ sơ đã duyệt có thật.

LOCK TABLE public.owner_ws_role_permissions IN SHARE ROW EXCLUSIVE MODE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Quyền so-hoa:share
-- ═══════════════════════════════════════════════════════════════════════════

-- BẢN GỐC của catalog; bản sao client: src/lib/ownerWorkspace/permissions.ts.
CREATE OR REPLACE FUNCTION public.owner_ws_permission_catalog()
RETURNS TABLE (module TEXT, action TEXT)
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  VALUES
    ('chi-tieu', 'view'), ('chi-tieu', 'create'), ('chi-tieu', 'update'), ('chi-tieu', 'delete'),
    ('tai-san', 'view'), ('tai-san', 'update'),
    ('ket-qua', 'view'), ('ket-qua', 'update'), ('ket-qua', 'delete'),
    ('so-hoa', 'view'), ('so-hoa', 'create'), ('so-hoa', 'update'), ('so-hoa', 'share'),
    ('ky-gui', 'view'), ('ky-gui', 'create'), ('ky-gui', 'update'),
    ('hop-dong-mua-ban', 'view'), ('hop-dong-mua-ban', 'update'),
    ('thu-tien', 'view'), ('thu-tien', 'create'), ('thu-tien', 'update'), ('thu-tien', 'delete'),
    ('phan-tich', 'view'),
    ('dong-tien', 'view'),
    ('bao-cao-dinh-ky', 'view'), ('bao-cao-dinh-ky', 'create'), ('bao-cao-dinh-ky', 'update'),
    ('bao-cao-dinh-ky', 'delete'), ('bao-cao-dinh-ky', 'finalize'), ('bao-cao-dinh-ky', 'share'),
    ('chi-nhanh', 'view'), ('chi-nhanh', 'update'),
    ('thanh-vien', 'view'), ('thanh-vien', 'create'), ('thanh-vien', 'update'), ('thanh-vien', 'delete'),
    ('vai-tro', 'view'), ('vai-tro', 'create'), ('vai-tro', 'update'), ('vai-tro', 'delete'),
    ('lien-ket', 'view'), ('lien-ket', 'update')
$$;

-- Trạm mới: Cán bộ có so-hoa:update ⇒ có luôn so-hoa:share (khớp luật cấp cho Trạm cũ ở dưới).
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
              ('so-hoa', 'create'), ('so-hoa', 'update'), ('so-hoa', 'share'),
              ('ky-gui', 'create'), ('ky-gui', 'update'),
              ('hop-dong-mua-ban', 'update'),
              ('thu-tien', 'create'), ('thu-tien', 'update'), ('thu-tien', 'delete'),
              ('bao-cao-dinh-ky', 'create'), ('bao-cao-dinh-ky', 'update'), ('bao-cao-dinh-ky', 'delete'))))
$$;

CREATE TEMP TABLE _psl_perm_before ON COMMIT DROP AS
  SELECT role_id, module, action FROM public.owner_ws_role_permissions;

INSERT INTO public.owner_ws_role_permissions (role_id, module, action)
SELECT p.role_id, 'so-hoa', 'share'
  FROM public.owner_ws_role_permissions p
 WHERE p.module = 'so-hoa' AND p.action = 'update'
ON CONFLICT (role_id, module, action) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Bảng
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.posting_share_links (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_id          UUID NOT NULL REFERENCES public.asset_postings(id) ON DELETE CASCADE,
  -- NULL = hồ sơ của chủ tài sản cá nhân (không có Trạm).
  workspace_id        UUID REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  code                TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Za-z0-9_-]{12}$'),
  -- Gửi cho ai — chỉ để cán bộ nhận ra link của mình trong bảng ("Anh Minh – KHDN").
  label               TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
  sender_name         TEXT CHECK (sender_name IS NULL OR char_length(btrim(sender_name)) BETWEEN 1 AND 80),
  sender_phone        TEXT CHECK (sender_phone IS NULL OR sender_phone ~ '^0[0-9]{9}$'),
  show_price          BOOLEAN NOT NULL DEFAULT false,
  show_exact_address  BOOLEAN NOT NULL DEFAULT false,
  show_sender_contact BOOLEAN NOT NULL DEFAULT false,
  expires_at          TIMESTAMPTZ,
  revoked_at          TIMESTAMPTZ,
  view_count          INT NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  unique_view_count   INT NOT NULL DEFAULT 0 CHECK (unique_view_count >= 0),
  cta_dossier_count   INT NOT NULL DEFAULT 0 CHECK (cta_dossier_count >= 0),
  cta_pdf_count       INT NOT NULL DEFAULT 0 CHECK (cta_pdf_count >= 0),
  cta_follow_count    INT NOT NULL DEFAULT 0 CHECK (cta_follow_count >= 0),
  cta_call_count      INT NOT NULL DEFAULT 0 CHECK (cta_call_count >= 0),
  last_viewed_at      TIMESTAMPTZ,
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Bật "hiện liên hệ người gửi" mà không có gì để hiện là lỗi nhập.
  CONSTRAINT psl_sender_contact_has_value CHECK (
    NOT show_sender_contact OR sender_name IS NOT NULL OR sender_phone IS NOT NULL)
);

CREATE INDEX idx_posting_share_links_posting ON public.posting_share_links (posting_id, created_at DESC);
CREATE INDEX idx_posting_share_links_workspace ON public.posting_share_links (workspace_id);
CREATE INDEX idx_posting_share_links_created_by ON public.posting_share_links (created_by);

-- Lượt xem / bấm không phải "sửa link" ⇒ không đổi updated_at.
CREATE TRIGGER posting_share_links_updated_at
  BEFORE UPDATE ON public.posting_share_links
  FOR EACH ROW
  WHEN (OLD.view_count IS NOT DISTINCT FROM NEW.view_count
        AND OLD.cta_dossier_count IS NOT DISTINCT FROM NEW.cta_dossier_count
        AND OLD.cta_pdf_count IS NOT DISTINCT FROM NEW.cta_pdf_count
        AND OLD.cta_follow_count IS NOT DISTINCT FROM NEW.cta_follow_count
        AND OLD.cta_call_count IS NOT DISTINCT FROM NEW.cta_call_count)
  EXECUTE FUNCTION public.set_updated_at();

-- Nhật ký sự kiện ẩn danh. KHÔNG lưu IP; visitor_id là chuỗi ngẫu nhiên phía trình duyệt.
CREATE TABLE public.posting_share_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id    UUID NOT NULL REFERENCES public.posting_share_links(id) ON DELETE CASCADE,
  event      TEXT NOT NULL CHECK (event IN ('view', 'cta_dossier', 'cta_pdf', 'cta_follow', 'cta_call')),
  visitor_id TEXT NOT NULL CHECK (visitor_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  device     TEXT CHECK (device IS NULL OR device IN ('mobile', 'tablet', 'desktop')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_posting_share_events_dedupe
  ON public.posting_share_events (link_id, visitor_id, event, created_at DESC);

-- Người mua bấm "Nhận thông báo khi mở phiên". Gửi thông báo thật = phase sau.
CREATE TABLE public.posting_share_follows (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_id UUID NOT NULL REFERENCES public.asset_postings(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  link_id    UUID REFERENCES public.posting_share_links(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT posting_share_follows_once UNIQUE (posting_id, user_id)
);

CREATE INDEX idx_posting_share_follows_user ON public.posting_share_follows (user_id);
CREATE INDEX idx_posting_share_follows_link ON public.posting_share_follows (link_id);

COMMENT ON TABLE public.posting_share_links IS
  'Link công khai /hs/:code của hồ sơ số hoá (Hồ sơ online). Cột code không cấp SELECT — đọc qua owner_posting_share_links. Ghi chỉ qua RPC.';
COMMENT ON TABLE public.posting_share_events IS
  'Sự kiện ẩn danh của trang /hs/:code (không IP). Ghi chỉ qua get_shared_posting / track_posting_share_event.';
COMMENT ON TABLE public.posting_share_follows IS
  'Người mua theo dõi hồ sơ qua link Hồ sơ online. Chủ tài sản / ngân hàng KHÔNG đọc được — chỉ thấy cta_follow_count.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. RLS + quyền bảng
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.posting_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posting_share_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posting_share_follows ENABLE ROW LEVEL SECURITY;

-- Thành viên có so-hoa:view trong phạm vi chi nhánh của hồ sơ; hồ sơ cá nhân: người tạo.
CREATE POLICY posting_share_links_member_read ON public.posting_share_links
  FOR SELECT TO authenticated
  USING (public.owner_posting_can(posting_id, 'so-hoa', 'view'));

CREATE POLICY posting_share_events_member_read ON public.posting_share_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posting_share_links l
                  WHERE l.id = link_id AND public.owner_posting_can(l.posting_id, 'so-hoa', 'view')));

CREATE POLICY posting_share_follows_own_read ON public.posting_share_follows
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY posting_share_follows_own_delete ON public.posting_share_follows
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.posting_share_links, public.posting_share_events, public.posting_share_follows FROM anon;
REVOKE ALL ON public.posting_share_links, public.posting_share_events, public.posting_share_follows FROM authenticated;
-- Mọi cột TRỪ code ⇒ không được select('*') bảng này — luôn liệt kê cột.
GRANT SELECT (id, posting_id, workspace_id, label, sender_name, sender_phone, show_price,
              show_exact_address, show_sender_contact, expires_at, revoked_at, view_count,
              unique_view_count, cta_dossier_count, cta_pdf_count, cta_follow_count, cta_call_count,
              last_viewed_at, created_by, created_at, updated_at)
  ON public.posting_share_links TO authenticated;
GRANT SELECT ON public.posting_share_events TO authenticated;
GRANT SELECT, DELETE ON public.posting_share_follows TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Hàm nội bộ
-- ═══════════════════════════════════════════════════════════════════════════

-- 9 byte ngẫu nhiên = đúng 12 ký tự base64url, không đệm. pgcrypto ở schema extensions.
CREATE FUNCTION public.posting_share_new_code()
RETURNS TEXT
LANGUAGE sql VOLATILE SET search_path = public
AS $$
  SELECT translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_')
$$;

-- Danh sách trắng khoá cấp 1 của payload công khai (tự kiểm so đúng tập này).
CREATE FUNCTION public.posting_share_public_keys()
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT ARRAY['title', 'category', 'location', 'description', 'specs', 'legal', 'image_urls',
               'video_urls', 'model_3d', 'vr_url', 'authenticated', 'starting_price', 'session',
               'owner_name', 'sender', 'expires_at']
$$;

-- Thiết bị khai từ client — chỉ nhận 3 giá trị, còn lại bỏ trống.
CREATE FUNCTION public.posting_share_device(p TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE WHEN p IN ('mobile', 'tablet', 'desktop') THEN p END
$$;

-- Lỗi nhập chung cho tạo / sửa. NULL = hợp lệ.
CREATE FUNCTION public.posting_share_validate(
  p_label TEXT, p_sender_name TEXT, p_sender_phone TEXT, p_show_sender_contact BOOLEAN, p_days INT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE
    WHEN char_length(btrim(COALESCE(p_label, ''))) NOT BETWEEN 1 AND 80 THEN 'invalid_label'
    WHEN NULLIF(btrim(p_sender_name), '') IS NOT NULL AND char_length(btrim(p_sender_name)) > 80 THEN 'invalid_sender_name'
    WHEN NULLIF(btrim(p_sender_phone), '') IS NOT NULL AND btrim(p_sender_phone) !~ '^0[0-9]{9}$' THEN 'invalid_phone'
    WHEN COALESCE(p_show_sender_contact, false)
         AND NULLIF(btrim(p_sender_name), '') IS NULL AND NULLIF(btrim(p_sender_phone), '') IS NULL THEN 'sender_required'
    WHEN p_days IS NOT NULL AND p_days NOT BETWEEN 1 AND 365 THEN 'invalid_expiry'
  END
$$;

-- Phiên đã CÔNG BỐ chứa hồ sơ: ưu tiên phiên chưa kết thúc, rồi phiên gần nhất.
CREATE FUNCTION public.posting_share_session(p_posting_id UUID)
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
   WHERE i.asset_posting_id = p_posting_id
   ORDER BY (s.ends_at > now()) DESC, s.starts_at DESC
   LIMIT 1
$$;

-- Payload công khai — CHỈ các khoá của posting_share_public_keys(). Không bao giờ: giấy tờ
-- (ownership_proof_urls / doc_urls — bucket private), cam kết sở hữu, ghi chú pháp lý, mọi
-- cột duyệt, thù lao, user_id / workspace_id / id hồ sơ / id link / bộ đếm.
CREATE FUNCTION public.posting_share_payload(l public.posting_share_links, p public.asset_postings)
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
    'sender',      CASE WHEN l.show_sender_contact
                        THEN jsonb_build_object('name', l.sender_name, 'phone', l.sender_phone) END,
    'expires_at',  l.expires_at
  );
END;
$$;

-- Hồ sơ còn được công khai (D3, kiểm lại lúc mở link).
CREATE FUNCTION public.posting_share_posting_live(p public.asset_postings)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT p.review_status = 'approved' AND p.status <> 'cancelled'
$$;

-- Dạng hiển thị một link cho cổng chủ tài sản. Mã chỉ trả cho người có quyền chia sẻ.
CREATE FUNCTION public.posting_share_link_json(l public.posting_share_links, p_with_code BOOLEAN)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id',                  l.id,
    'code',                CASE WHEN p_with_code THEN l.code END,
    'label',               l.label,
    'sender_name',         l.sender_name,
    'sender_phone',        l.sender_phone,
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
$$;

REVOKE ALL ON FUNCTION public.posting_share_new_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.posting_share_public_keys() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.posting_share_device(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.posting_share_validate(TEXT, TEXT, TEXT, BOOLEAN, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.posting_share_session(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.posting_share_payload(public.posting_share_links, public.asset_postings) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.posting_share_posting_live(public.asset_postings) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.posting_share_link_json(public.posting_share_links, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RPC cổng chủ tài sản. {ok:false, reason} cho lỗi nghiệp vụ.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE FUNCTION public.owner_posting_share_links(p_posting_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_can_share BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.owner_posting_can(p_posting_id, 'so-hoa', 'view') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  v_can_share := public.owner_posting_can(p_posting_id, 'so-hoa', 'share');

  RETURN jsonb_build_object(
    'ok', true,
    'can_share', v_can_share,
    'links', COALESCE((
      SELECT jsonb_agg(public.posting_share_link_json(l, v_can_share) ORDER BY l.created_at DESC)
        FROM public.posting_share_links l
       WHERE l.posting_id = p_posting_id), '[]'::jsonb));
END;
$$;

CREATE FUNCTION public.create_posting_share_link(
  p_posting_id          UUID,
  p_label               TEXT,
  p_sender_name         TEXT,
  p_sender_phone        TEXT,
  p_show_price          BOOLEAN,
  p_show_exact_address  BOOLEAN,
  p_show_sender_contact BOOLEAN,
  p_expires_in_days     INT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p        public.asset_postings%ROWTYPE;
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

  v_err := public.posting_share_validate(p_label, p_sender_name, p_sender_phone, p_show_sender_contact, p_expires_in_days);
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_err);
  END IF;

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
        posting_id, workspace_id, code, label, sender_name, sender_phone, show_price,
        show_exact_address, show_sender_contact, expires_at, created_by)
      VALUES (
        p.id, p.workspace_id, v_code, btrim(p_label),
        NULLIF(btrim(p_sender_name), ''), NULLIF(btrim(p_sender_phone), ''),
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

-- Sửa nội dung link. p_change_expiry = false ⇒ giữ nguyên hạn hiện tại.
CREATE FUNCTION public.update_posting_share_link(
  p_link_id             UUID,
  p_label               TEXT,
  p_sender_name         TEXT,
  p_sender_phone        TEXT,
  p_show_price          BOOLEAN,
  p_show_exact_address  BOOLEAN,
  p_show_sender_contact BOOLEAN,
  p_change_expiry       BOOLEAN,
  p_expires_in_days     INT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  l     public.posting_share_links%ROWTYPE;
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

  v_err := public.posting_share_validate(p_label, p_sender_name, p_sender_phone, p_show_sender_contact,
                                          CASE WHEN p_change_expiry THEN p_expires_in_days END);
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_err);
  END IF;

  UPDATE public.posting_share_links
     SET label               = btrim(p_label),
         sender_name         = NULLIF(btrim(p_sender_name), ''),
         sender_phone        = NULLIF(btrim(p_sender_phone), ''),
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

-- Thu hồi: link mở ra "không còn hiệu lực" (giống mã sai). Giữ số đếm. Gọi lại vô hại.
CREATE FUNCTION public.revoke_posting_share_link(p_link_id UUID)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  l public.posting_share_links%ROWTYPE;
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

  IF l.revoked_at IS NULL THEN
    UPDATE public.posting_share_links SET revoked_at = now() WHERE id = l.id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.owner_posting_share_links(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_posting_share_link(UUID, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_posting_share_link(UUID, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_posting_share_link(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_posting_share_links(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_posting_share_link(UUID, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_posting_share_link(UUID, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_posting_share_link(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RPC công khai — trang /hs/:code (anon) + bot xem trước link (visitor 'crawler').
-- ═══════════════════════════════════════════════════════════════════════════

CREATE FUNCTION public.get_shared_posting(p_code TEXT, p_visitor_id TEXT, p_device TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  l       public.posting_share_links%ROWTYPE;
  p       public.asset_postings%ROWTYPE;
  v_count BOOLEAN;
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

  SELECT * INTO p FROM public.asset_postings WHERE id = l.posting_id;
  IF NOT FOUND OR NOT public.posting_share_posting_live(p) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unavailable');
  END IF;

  -- Chỉ đếm người NGOÀI đơn vị; bot xem trước link (crawler) và visitor_id lạ không đếm.
  v_count := p_visitor_id IS NOT NULL
         AND p_visitor_id ~ '^[A-Za-z0-9_-]{8,64}$'
         AND (auth.uid() IS NULL OR NOT public.owner_posting_can(p.id, 'read'));

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

  RETURN jsonb_build_object('ok', true, 'posting', public.posting_share_payload(l, p));
END;
$$;

-- Bấm CTA trên trang công khai. 'cta_follow' chỉ ghi sự kiện (bộ đếm do follow_shared_posting
-- giữ, mỗi tài khoản một lần). Mã lạ / hết hạn / thu hồi ⇒ bỏ qua im lặng.
CREATE FUNCTION public.track_posting_share_event(p_code TEXT, p_visitor_id TEXT, p_event TEXT, p_device TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
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
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'counted', false);
  END IF;
  IF auth.uid() IS NOT NULL AND public.owner_posting_can(l.posting_id, 'read') THEN
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

-- "Nhận thông báo khi mở phiên" — cần đăng nhập. Mỗi tài khoản đếm một lần cho mỗi hồ sơ.
CREATE FUNCTION public.follow_shared_posting(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
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
  SELECT * INTO p FROM public.asset_postings WHERE id = l.posting_id;
  IF NOT FOUND OR NOT public.posting_share_posting_live(p) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unavailable');
  END IF;

  INSERT INTO public.posting_share_follows (posting_id, user_id, link_id)
  VALUES (p.id, auth.uid(), l.id)
  ON CONFLICT (posting_id, user_id) DO NOTHING;
  v_new := FOUND;

  IF v_new AND NOT public.owner_posting_can(p.id, 'read') THEN
    UPDATE public.posting_share_links SET cta_follow_count = cta_follow_count + 1 WHERE id = l.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'already', NOT v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_posting(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_posting_share_event(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.follow_shared_posting(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shared_posting(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_posting_share_event(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.follow_shared_posting(TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Tự kiểm
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  _bad    TEXT;
  _post   public.asset_postings%ROWTYPE;
  _code   TEXT;
  _res    JSONB;
  _keys   TEXT[];
  _views  INT;
  c       TEXT;
BEGIN
  -- 1. Quyền: chỉ thêm đúng so-hoa:share cho vai trò đang có so-hoa:update, không gì khác.
  IF EXISTS (SELECT role_id, module, action FROM _psl_perm_before
             EXCEPT SELECT role_id, module, action FROM public.owner_ws_role_permissions) THEN
    RAISE EXCEPTION 'posting_share self-check: có vai trò bị MẤT quyền';
  END IF;
  SELECT string_agg(DISTINCT x.role_id::text || ':' || x.module || '/' || x.action, ', ') INTO _bad
    FROM (SELECT role_id, module, action FROM public.owner_ws_role_permissions
          EXCEPT SELECT role_id, module, action FROM _psl_perm_before) x
   WHERE NOT (x.module = 'so-hoa' AND x.action = 'share'
              AND EXISTS (SELECT 1 FROM _psl_perm_before b
                           WHERE b.role_id = x.role_id AND b.module = 'so-hoa' AND b.action = 'update'));
  IF _bad IS NOT NULL THEN
    RAISE EXCEPTION 'posting_share self-check: quyền thêm ngoài dự kiến: %', _bad;
  END IF;
  IF EXISTS (SELECT 1 FROM _psl_perm_before b
              WHERE b.module = 'so-hoa' AND b.action = 'update'
                AND NOT EXISTS (SELECT 1 FROM public.owner_ws_role_permissions r
                                 WHERE r.role_id = b.role_id AND r.module = 'so-hoa' AND r.action = 'share')) THEN
    RAISE EXCEPTION 'posting_share self-check: vai trò có so-hoa:update chưa có so-hoa:share';
  END IF;
  IF (SELECT count(*) FROM public.owner_ws_permission_catalog()) <> 42
     OR (SELECT count(*) FROM public.owner_ws_default_role_permissions('STAFF')) <> 29
     OR (SELECT count(*) FROM public.owner_ws_default_role_permissions('VIEWER')) <> 14 THEN
    RAISE EXCEPTION 'posting_share self-check: catalog / mặc định lệch bản sao client (42 / 29 / 14)';
  END IF;

  -- 2. Không ai đọc được cột code trực tiếp; client không ghi được bảng.
  IF has_column_privilege('authenticated', 'public.posting_share_links', 'code', 'SELECT')
     OR has_column_privilege('anon', 'public.posting_share_links', 'code', 'SELECT') THEN
    RAISE EXCEPTION 'posting_share self-check: client đọc được cột code';
  END IF;
  FOREACH c IN ARRAY ARRAY['posting_share_links', 'posting_share_events', 'posting_share_follows'] LOOP
    IF has_table_privilege('anon', 'public.' || c, 'SELECT')
       OR has_table_privilege('authenticated', 'public.' || c, 'INSERT')
       OR has_table_privilege('authenticated', 'public.' || c, 'UPDATE') THEN
      RAISE EXCEPTION 'posting_share self-check: quyền bảng % mở quá rộng', c;
    END IF;
  END LOOP;

  -- 3. Hàm: anon chỉ gọi được 2 RPC công khai; hàm nội bộ không ai gọi được.
  IF NOT has_function_privilege('anon', 'public.get_shared_posting(text, text, text)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.track_posting_share_event(text, text, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'posting_share self-check: anon không gọi được RPC công khai';
  END IF;
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO _bad
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND (p.proname LIKE 'posting\_share\_%'
          OR p.proname IN ('owner_posting_share_links', 'create_posting_share_link',
                           'update_posting_share_link', 'revoke_posting_share_link', 'follow_shared_posting'))
     AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF _bad IS NOT NULL THEN
    RAISE EXCEPTION 'posting_share self-check: anon còn EXECUTE: %', _bad;
  END IF;
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO _bad
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname LIKE 'posting\_share\_%'
     AND has_function_privilege('authenticated', p.oid, 'EXECUTE');
  IF _bad IS NOT NULL THEN
    RAISE EXCEPTION 'posting_share self-check: hàm nội bộ mở cho authenticated: %', _bad;
  END IF;

  IF public.posting_share_new_code() !~ '^[A-Za-z0-9_-]{12}$' THEN
    RAISE EXCEPTION 'posting_share self-check: mã link sai định dạng';
  END IF;

  -- 4. Payload công khai trên một hồ sơ đã duyệt có thật: đúng danh sách trắng, không lộ
  --    khoá riêng tư, bot không tính lượt xem. Link thử bị xoá ngay.
  SELECT * INTO _post FROM public.asset_postings
   WHERE review_status = 'approved' AND status <> 'cancelled'
   ORDER BY COALESCE(cardinality(doc_urls), 0) + COALESCE(cardinality(ownership_proof_urls), 0) DESC
   LIMIT 1;
  IF FOUND THEN
    _code := public.posting_share_new_code();
    INSERT INTO public.posting_share_links (posting_id, workspace_id, code, label, show_price,
                                            show_exact_address, show_sender_contact, sender_name)
    VALUES (_post.id, _post.workspace_id, _code, 'self-check', true, true, true, 'Kiểm tra');

    _res := public.get_shared_posting(_code, 'crawler', NULL);
    IF (_res ->> 'ok')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'posting_share self-check: link thử không mở được: %', _res;
    END IF;
    SELECT array_agg(k ORDER BY k) INTO _keys FROM jsonb_object_keys(_res -> 'posting') k;
    IF _keys IS DISTINCT FROM (SELECT array_agg(k ORDER BY k) FROM unnest(public.posting_share_public_keys()) k) THEN
      RAISE EXCEPTION 'posting_share self-check: khoá payload lệch danh sách trắng: %', _keys;
    END IF;
    IF (_res::text) ~* '(ownership|doc_urls|legal_notes|review|commission|user_id|workspace_id|posting_id|link_id|view_count|"id")'
       OR (_res::text) LIKE '%' || _post.id::text || '%'
       OR (_post.workspace_id IS NOT NULL AND (_res::text) LIKE '%' || _post.workspace_id::text || '%') THEN
      RAISE EXCEPTION 'posting_share self-check: payload lộ dữ liệu riêng tư';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(COALESCE(_post.doc_urls, '{}') || COALESCE(_post.ownership_proof_urls, '{}')) d
                WHERE (_res::text) LIKE '%' || d || '%') THEN
      RAISE EXCEPTION 'posting_share self-check: payload lộ đường dẫn giấy tờ';
    END IF;
    SELECT view_count INTO _views FROM public.posting_share_links WHERE code = _code;
    IF _views <> 0 THEN
      RAISE EXCEPTION 'posting_share self-check: bot xem trước link bị tính lượt xem';
    END IF;

    -- Thu hồi ⇒ not_found (giống mã sai).
    UPDATE public.posting_share_links SET revoked_at = now() WHERE code = _code;
    IF public.get_shared_posting(_code, 'crawler', NULL) ->> 'reason' IS DISTINCT FROM 'not_found' THEN
      RAISE EXCEPTION 'posting_share self-check: link thu hồi vẫn mở được';
    END IF;
    DELETE FROM public.posting_share_links WHERE code = _code;
  END IF;
END;
$$;
