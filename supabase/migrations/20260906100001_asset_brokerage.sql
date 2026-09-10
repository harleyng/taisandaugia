-- Ký gửi tài sản: chủ tài sản TỰ CHỌN tổ chức, hoặc NHỜ SÀN CHỌN GIÚP.
--
-- Trước migration này `asset_service_requests` là ngõ cụt ghi-một-chiều: chủ tài
-- sản insert một dòng rồi thôi. Không màn admin, không màn tổ chức, và bốn trạng
-- thái seen/accepted/declined/withdrawn không có ai ghi. Migration này biến nó
-- thành một vòng khép kín:
--
--   Chủ tài sản "nhờ sàn chọn giúp"  → asset_broker_requests (pending)
--   Admin gửi tới NHIỀU tổ chức      → N × asset_service_requests (origin='platform')
--   Tổ chức duyệt / từ chối          → quoted (kèm báo giá) | declined
--   Chủ tài sản chọn 1 báo giá       → selected + lead & cơ hội trong CRM
--
-- ⚠️ KHÔNG ghi gì vào `asset_postings` từ luồng này. Trigger
-- `asset_postings_review_guard` (20260906000001) đá hồ sơ đã duyệt về 'pending'
-- với MỌI caller không có quyền ('duyet-tai-san','approve') — kể cả RPC
-- SECURITY DEFINER, vì auth.uid() bên trong vẫn là uid của người gọi. Đặt
-- chosen_org_id/status='matched' ở đây = chủ tài sản chốt báo giá xong thì hồ sơ
-- âm thầm về "chờ duyệt" và UI ký gửi biến mất. Quan hệ với tổ chức vì vậy nằm
-- HOÀN TOÀN trong asset_service_requests — đúng như quyết định 2026-07-26.

-- ─── 1. Cầu nối organizations → auction_organizations ────────────────────────
-- RLS phải trả lời "user này có thuộc tổ chức đấu giá X không". Đường duy nhất
-- hiện có là organizations.license_info->>'auction_org_id' — cast JSONB trong
-- policy là bom hẹn giờ: một chuỗi rác làm cả câu query lỗi chứ không trả false.
-- Nên tách hẳn ra cột có FK. license_info giữ nguyên (usePortalOrg.ts còn đọc).

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS auction_org_id UUID REFERENCES public.auction_organizations(id);

UPDATE public.organizations
   SET auction_org_id = (license_info->>'auction_org_id')::uuid
 WHERE auction_org_id IS NULL
   AND license_info->>'auction_org_id' ~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

CREATE INDEX IF NOT EXISTS idx_organizations_auction_org
  ON public.organizations (auction_org_id) WHERE auction_org_id IS NOT NULL;

-- Thành viên ACTIVE của tổ chức đã duyệt KYC trỏ tới danh bạ này.
-- `OR o.owner_id = auth.uid()` là lưới an toàn cho tổ chức cũ thiếu dòng
-- membership (trigger create_owner_membership chỉ chạy từ lúc nó tồn tại).
CREATE OR REPLACE FUNCTION public.user_in_auction_org(_auction_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organizations o
    LEFT JOIN public.organization_memberships m
           ON m.organization_id = o.id
          AND m.user_id = auth.uid()
          AND m.status = 'ACTIVE'
    WHERE o.auction_org_id = _auction_org_id
      AND o.kyc_status = 'APPROVED'
      AND (m.user_id IS NOT NULL OR o.owner_id = auth.uid())
  )
$$;

-- Tổ chức "gửi được" = đã có tài khoản duyệt KYC. `organizations` chỉ owner/admin
-- đọc được nên client phải đi qua definer.
CREATE OR REPLACE FUNCTION public.accounted_auction_org_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT auction_org_id
  FROM public.organizations
  WHERE kyc_status = 'APPROVED' AND auction_org_id IS NOT NULL
$$;

GRANT EXECUTE ON FUNCTION public.user_in_auction_org(UUID)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounted_auction_org_ids()   TO authenticated;

-- ─── 2. asset_broker_requests — yêu cầu "nhờ sàn chọn giúp" ──────────────────

CREATE TABLE public.asset_broker_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_posting_id    UUID NOT NULL REFERENCES public.asset_postings(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'sourcing', 'quoted', 'selected', 'cancelled')),
  note                TEXT,          -- lời nhắn của chủ tài sản
  admin_note          TEXT,          -- ghi chú nội bộ, KHÔNG hiện cho chủ tài sản
  assigned_admin_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  selected_request_id UUID,          -- FK gắn sau, asset_service_requests chưa có cột đối ứng
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mỗi hồ sơ chỉ một yêu cầu ĐANG MỞ; huỷ rồi thì nhờ lại được.
CREATE UNIQUE INDEX idx_abr_one_open
  ON public.asset_broker_requests (asset_posting_id) WHERE status <> 'cancelled';
CREATE INDEX idx_abr_status ON public.asset_broker_requests (status, created_at DESC);
CREATE INDEX idx_abr_user   ON public.asset_broker_requests (user_id);

CREATE TRIGGER asset_broker_requests_updated_at
  BEFORE UPDATE ON public.asset_broker_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.asset_broker_requests ENABLE ROW LEVEL SECURITY;

-- Chủ tài sản tạo và huỷ được, KHÔNG tự đẩy trạng thái (khuôn asset_owner_kyc).
CREATE POLICY "abr_owner_rows"
  ON public.asset_broker_requests FOR ALL
  USING       (auth.uid() = user_id)
  WITH CHECK  (auth.uid() = user_id AND status IN ('pending', 'cancelled'));

CREATE POLICY "abr_admin_all"
  ON public.asset_broker_requests FOR ALL
  USING       (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK  (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ─── 3. asset_service_requests: fan-out + báo giá ────────────────────────────

ALTER TABLE public.asset_service_requests
  ADD COLUMN broker_request_id    UUID REFERENCES public.asset_broker_requests(id) ON DELETE SET NULL,
  -- 'owner'    = chủ tài sản tự chọn tổ chức
  -- 'platform' = sàn gửi hộ sau khi nhận yêu cầu môi giới
  ADD COLUMN origin               TEXT NOT NULL DEFAULT 'owner'
                                  CHECK (origin IN ('owner', 'platform')),
  ADD COLUMN organization_id      UUID REFERENCES public.organizations(id),
  ADD COLUMN seen_at              TIMESTAMPTZ,
  ADD COLUMN responded_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN decline_reason       TEXT,
  ADD COLUMN quote_commission_pct NUMERIC(5,2),
  ADD COLUMN quote_service_fee    NUMERIC(14,0),
  ADD COLUMN quote_starting_price NUMERIC(18,0),
  ADD COLUMN quote_lead_time_days INTEGER,
  ADD COLUMN quote_note           TEXT,
  ADD COLUMN quote_doc_path       TEXT,
  ADD COLUMN quoted_at            TIMESTAMPTZ;

ALTER TABLE public.asset_broker_requests
  ADD CONSTRAINT asset_broker_requests_selected_fkey
    FOREIGN KEY (selected_request_id)
    REFERENCES public.asset_service_requests(id) ON DELETE SET NULL;

-- Trạng thái mới: 'quoted' (đã báo giá), 'selected' / 'not_selected' (chủ tài sản
-- chốt). 'accepted' GIỮ LẠI cho dòng cũ + seed 20260623000001.
DO $$
DECLARE v_name TEXT;
BEGIN
  SELECT conname INTO v_name
  FROM pg_constraint
  WHERE conrelid = 'public.asset_service_requests'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';
  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.asset_service_requests DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

ALTER TABLE public.asset_service_requests
  ADD CONSTRAINT asset_service_requests_status_check
    CHECK (status IN ('sent', 'seen', 'quoted', 'accepted',
                      'declined', 'selected', 'not_selected', 'withdrawn'));

CREATE INDEX idx_asr_broker ON public.asset_service_requests (broker_request_id)
  WHERE broker_request_id IS NOT NULL;
CREATE INDEX idx_asr_org_status ON public.asset_service_requests (auction_org_id, status);

-- ─── 4. RLS asset_service_requests ───────────────────────────────────────────
-- Policy cũ `asr_owner_rows` là FOR ALL không giới hạn cột/trạng thái ⇒ chủ tài
-- sản tự đặt được status='selected' cho chính mình. Tách nhỏ theo hành vi.

DROP POLICY IF EXISTS "asr_owner_rows" ON public.asset_service_requests;
DROP POLICY IF EXISTS "asr_admin_read" ON public.asset_service_requests;

CREATE POLICY "asr_owner_read"
  ON public.asset_service_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Tự chọn tổ chức: chỉ tạo được dòng 'sent' của chính mình. Dòng 'platform' do
-- RPC của admin tạo (definer, không qua policy này).
CREATE POLICY "asr_owner_insert"
  ON public.asset_service_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'sent' AND origin = 'owner');

-- Cập nhật DUY NHẤT mà chủ tài sản tự làm được là thu hồi. Chọn báo giá đi qua
-- owner_select_service_quote().
CREATE POLICY "asr_owner_withdraw"
  ON public.asset_service_requests FOR UPDATE
  USING       (auth.uid() = user_id AND status IN ('sent', 'seen', 'quoted'))
  WITH CHECK  (auth.uid() = user_id AND status = 'withdrawn');

-- Tổ chức ĐỌC được yêu cầu gửi tới mình. CỐ Ý không có UPDATE: trả lời phải qua
-- org_respond_service_request() để khoá máy trạng thái và tập cột ghi được.
CREATE POLICY "asr_org_read"
  ON public.asset_service_requests FOR SELECT
  USING (public.user_in_auction_org(auction_org_id));

CREATE POLICY "asr_admin_all"
  ON public.asset_service_requests FOR ALL
  USING       (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK  (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ─── 5. Bucket tệp báo giá ───────────────────────────────────────────────────
-- Path: {organization_id}/{request_id}/{file} — bắt đầu bằng organization_id
-- theo quy ước storage org-scoped.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('quote-docs', 'quote-docs', false, 10485760,
        ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "quote_docs_org_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'quote-docs'
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      LEFT JOIN public.organization_memberships m
             ON m.organization_id = o.id AND m.user_id = auth.uid() AND m.status = 'ACTIVE'
      WHERE o.id::text = (storage.foldername(name))[1]
        AND (m.user_id IS NOT NULL OR o.owner_id = auth.uid())
    )
  );

-- Đọc: chủ hồ sơ (để xem báo giá) · tổ chức ra giá · admin.
CREATE POLICY "quote_docs_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'quote-docs'
    AND EXISTS (
      SELECT 1 FROM public.asset_service_requests r
      WHERE r.id::text = (storage.foldername(name))[2]
        AND (r.user_id = auth.uid()
             OR public.user_in_auction_org(r.auction_org_id)
             OR public.has_role(auth.uid(), 'ADMIN'::app_role))
    )
  );

-- Admin thẩm định hồ sơ cần xem được giấy tờ sở hữu chủ tài sản đã nộp.
CREATE POLICY "asset_docs_admin_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'asset-docs' AND public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ─── 6. CRM: truy vết hồ sơ tài sản trên lead & cơ hội ───────────────────────

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS asset_posting_id UUID
    REFERENCES public.asset_postings(id) ON DELETE SET NULL;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS asset_posting_id UUID
    REFERENCES public.asset_postings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_asset_posting
  ON public.opportunities (asset_posting_id) WHERE asset_posting_id IS NOT NULL;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_source_check CHECK (
  source = ANY (ARRAY[
    'contact_form','partnership_form','hotline','email','referral',
    'event','ads','tool_marketplace','market_data','asset_brokerage','other'
  ])
);

-- Dịch vụ để gắn cơ hội. `opportunities.service_id` là NOT NULL nên phải có một
-- dòng thật. kind='direct' chứ KHÔNG phải 'commission': commission bắt buộc
-- supplier_id (services_commission_requires_supplier) mà môi giới ký gửi là dịch
-- vụ của chính sàn. price=0 — miễn phí với chủ tài sản; doanh thu do admin điền
-- lúc chốt thắng qua admin_win_opportunity.
INSERT INTO public.services (name, kind, category, audience, price, description, is_active, sort_order)
SELECT 'Môi giới ký gửi tài sản', 'direct', 'brokerage', 'owner', 0,
       'Sàn tìm và giới thiệu tổ chức đấu giá phù hợp cho tài sản của chủ sở hữu.', true, 90
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Môi giới ký gửi tài sản');

INSERT INTO public.service_variants (service_id, variant_key, name, price, is_active, sort_order)
SELECT s.id, 'broker_consignment', 'Ghép tổ chức đấu giá', 0, true, 0
FROM public.services s
WHERE s.name = 'Môi giới ký gửi tài sản'
  AND NOT EXISTS (SELECT 1 FROM public.service_variants WHERE variant_key = 'broker_consignment');

-- ─── 7. RPC: admin fan-out ───────────────────────────────────────────────────
-- _orgs = [{"org_id": "...", "score": 87.5}, ...]
-- Gate 'duyet-tai-san'.'update' — dùng chung module với màn Duyệt tài sản
-- (20260906000001) thay vì đẻ thêm mã quyền cho cùng một bảng.

CREATE OR REPLACE FUNCTION public.admin_dispatch_service_requests(
  _posting_id UUID,
  _orgs       JSONB,
  _message    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_posting    public.asset_postings%ROWTYPE;
  v_broker     UUID;
  v_item       JSONB;
  v_org        UUID;
  v_dispatched INT := 0;
  v_skipped    INT := 0;
BEGIN
  IF NOT public.admin_has_permission('duyet-tai-san', 'update') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_posting FROM public.asset_postings WHERE id = _posting_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ tài sản' USING ERRCODE = 'no_data_found';
  END IF;

  -- Cùng cổng chặn với màn chủ tài sản: chưa duyệt thì chưa gửi cho tổ chức.
  IF v_posting.review_status <> 'approved' THEN
    RAISE EXCEPTION 'Hồ sơ chưa được duyệt — không gửi cho tổ chức đấu giá được'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT id INTO v_broker FROM public.asset_broker_requests
   WHERE asset_posting_id = _posting_id AND status <> 'cancelled' LIMIT 1;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(_orgs, '[]'::jsonb))
  LOOP
    v_org := (v_item->>'org_id')::uuid;

    -- Tổ chức chưa có tài khoản thì không có đường trả lời ⇒ bỏ qua, không tạo
    -- ngõ cụt mới.
    IF NOT EXISTS (SELECT 1 FROM public.accounted_auction_org_ids() a WHERE a = v_org) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.asset_service_requests
      (asset_posting_id, auction_org_id, user_id, status, origin,
       broker_request_id, message, match_score)
    VALUES
      (_posting_id, v_org, v_posting.user_id, 'sent', 'platform',
       v_broker, NULLIF(_message, ''), (v_item->>'score')::numeric)
    ON CONFLICT (asset_posting_id, auction_org_id) DO NOTHING;

    IF FOUND THEN v_dispatched := v_dispatched + 1; ELSE v_skipped := v_skipped + 1; END IF;
  END LOOP;

  IF v_broker IS NOT NULL AND v_dispatched > 0 THEN
    UPDATE public.asset_broker_requests
       SET status = 'sourcing', assigned_admin_id = COALESCE(assigned_admin_id, auth.uid())
     WHERE id = v_broker AND status = 'pending';
  END IF;

  RETURN jsonb_build_object('dispatched', v_dispatched, 'skipped', v_skipped);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_dispatch_service_requests(UUID, JSONB, TEXT) TO authenticated;

-- ─── 8. RPC: hộp thư của tổ chức ─────────────────────────────────────────────
-- RLS lọc theo DÒNG nên không giấu được CỘT. Tổ chức phải thấy tài sản để định
-- giá, nhưng KHÔNG được thấy danh tính chủ tài sản, địa chỉ số nhà, hay giấy tờ
-- sở hữu trước khi trúng. Vì vậy chiếu qua RPC (khuôn public_org_auctioneers).

CREATE OR REPLACE FUNCTION public.org_service_requests(_auction_org_id UUID)
RETURNS TABLE (
  id                   UUID,
  status               TEXT,
  origin               TEXT,
  message              TEXT,
  match_score          NUMERIC,
  created_at           TIMESTAMPTZ,
  seen_at              TIMESTAMPTZ,
  quoted_at            TIMESTAMPTZ,
  decline_reason       TEXT,
  quote_commission_pct NUMERIC,
  quote_service_fee    NUMERIC,
  quote_starting_price NUMERIC,
  quote_lead_time_days INTEGER,
  quote_note           TEXT,
  quote_doc_path       TEXT,
  posting_id           UUID,
  title                TEXT,
  parent_slug          TEXT,
  child_slug           TEXT,
  description          TEXT,
  province             TEXT,
  district             TEXT,
  pricing_mode         TEXT,
  starting_price       NUMERIC,
  auction_format       TEXT,
  commission_pct       NUMERIC,
  expected_timeline    TEXT,
  delta_fields         JSONB,
  image_urls           TEXT[],
  has_dispute          BOOLEAN,
  has_mortgage         BOOLEAN,
  is_seized            BOOLEAN,
  right_to_sell        BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.user_in_auction_org(_auction_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT r.id, r.status, r.origin, r.message, r.match_score, r.created_at,
         r.seen_at, r.quoted_at, r.decline_reason,
         r.quote_commission_pct, r.quote_service_fee, r.quote_starting_price,
         r.quote_lead_time_days, r.quote_note, r.quote_doc_path,
         p.id, p.title, p.parent_slug, p.child_slug, p.description,
         p.province, p.district,          -- KHÔNG trả address / ward
         p.pricing_mode, p.starting_price, p.auction_format,
         p.commission_pct, p.expected_timeline, p.delta_fields, p.image_urls,
         p.has_dispute, p.has_mortgage, p.is_seized, p.right_to_sell
    FROM public.asset_service_requests r
    JOIN public.asset_postings p ON p.id = r.asset_posting_id
   WHERE r.auction_org_id = _auction_org_id
     AND r.status <> 'withdrawn'
   ORDER BY r.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.org_service_requests(UUID) TO authenticated;

-- ─── 9. RPC: tổ chức trả lời (xem / báo giá / từ chối) ───────────────────────

CREATE OR REPLACE FUNCTION public.org_respond_service_request(
  _request_id UUID,
  _action     TEXT,
  _quote      JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_req public.asset_service_requests%ROWTYPE;
  v_org UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Vui lòng đăng nhập' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _action NOT IN ('seen', 'quote', 'decline') THEN
    RAISE EXCEPTION 'invalid_action' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_req FROM public.asset_service_requests WHERE id = _request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy yêu cầu' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public.user_in_auction_org(v_req.auction_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id INTO v_org FROM public.organizations
   WHERE auction_org_id = v_req.auction_org_id AND kyc_status = 'APPROVED' LIMIT 1;

  IF _action <> 'seen' AND NOT public.org_has_permission(v_org, 'yeu-cau-ky-gui', 'update') THEN
    RAISE EXCEPTION 'Bạn không có quyền trả lời yêu cầu ký gửi'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Chủ tài sản đã chốt (hoặc thu hồi) thì tổ chức không lật ngược được nữa.
  IF v_req.status IN ('selected', 'not_selected', 'withdrawn') THEN
    RAISE EXCEPTION 'Yêu cầu đã kết thúc' USING ERRCODE = 'check_violation';
  END IF;

  IF _action = 'seen' THEN
    UPDATE public.asset_service_requests
       SET status = CASE WHEN status = 'sent' THEN 'seen' ELSE status END,
           seen_at = COALESCE(seen_at, now())
     WHERE id = _request_id;

  ELSIF _action = 'decline' THEN
    UPDATE public.asset_service_requests
       SET status = 'declined',
           decline_reason = NULLIF(_quote->>'decline_reason', ''),
           responded_by = auth.uid(),
           organization_id = v_org
     WHERE id = _request_id;

  ELSE -- quote (ghi đè được: tổ chức sửa lại báo giá trước khi chủ tài sản chốt)
    UPDATE public.asset_service_requests
       SET status = 'quoted',
           quote_commission_pct = (_quote->>'commission_pct')::numeric,
           quote_service_fee    = (_quote->>'service_fee')::numeric,
           quote_starting_price = (_quote->>'starting_price')::numeric,
           quote_lead_time_days = (_quote->>'lead_time_days')::int,
           quote_note           = NULLIF(_quote->>'note', ''),
           quote_doc_path       = NULLIF(_quote->>'doc_path', ''),
           quoted_at            = now(),
           responded_by         = auth.uid(),
           organization_id      = v_org
     WHERE id = _request_id;

    UPDATE public.asset_broker_requests
       SET status = 'quoted'
     WHERE id = v_req.broker_request_id AND status IN ('pending', 'sourcing');
  END IF;

  RETURN jsonb_build_object('ok', true, 'action', _action);
END;
$$;

GRANT EXECUTE ON FUNCTION public.org_respond_service_request(UUID, TEXT, JSONB) TO authenticated;

-- ─── 10. RPC: chủ tài sản chốt một báo giá → CRM ─────────────────────────────
-- Khuôn request_tool_service: RPC cho END-USER, definer để ghi vào leads /
-- opportunities (chỉ có policy admin_all), KHÔNG gọi admin_has_permission.

CREATE OR REPLACE FUNCTION public.owner_select_service_quote(_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_req     public.asset_service_requests%ROWTYPE;
  v_posting public.asset_postings%ROWTYPE;
  v_org     public.auction_organizations%ROWTYPE;
  v_prof    RECORD;
  v_service UUID;
  v_variant UUID;
  v_lead    UUID;
  v_opp     UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Vui lòng đăng nhập' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_req FROM public.asset_service_requests WHERE id = _request_id;
  IF NOT FOUND OR v_req.user_id <> v_uid THEN
    RAISE EXCEPTION 'Không tìm thấy yêu cầu' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_req.status <> 'quoted' THEN
    RAISE EXCEPTION 'Chỉ chọn được tổ chức đã gửi báo giá' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_posting FROM public.asset_postings WHERE id = v_req.asset_posting_id;
  SELECT * INTO v_org     FROM public.auction_organizations WHERE id = v_req.auction_org_id;

  UPDATE public.asset_service_requests SET status = 'selected' WHERE id = _request_id;

  -- Các tổ chức còn lại của cùng hồ sơ: đóng lại, giữ nguyên dòng đã từ chối.
  UPDATE public.asset_service_requests
     SET status = 'not_selected'
   WHERE asset_posting_id = v_req.asset_posting_id
     AND id <> _request_id
     AND status IN ('sent', 'seen', 'quoted');

  UPDATE public.asset_broker_requests
     SET status = 'selected', selected_request_id = _request_id
   WHERE asset_posting_id = v_req.asset_posting_id AND status <> 'cancelled';

  -- ⚠️ KHÔNG đụng vào asset_postings — xem ghi chú đầu file (review guard).

  -- Chống trùng: hồ sơ này đã có cơ hội đang mở.
  SELECT o.id, o.lead_id INTO v_opp, v_lead
    FROM public.opportunities o
   WHERE o.asset_posting_id = v_req.asset_posting_id
     AND o.stage IN ('selling', 'pending_approval')
   LIMIT 1;
  IF v_opp IS NOT NULL THEN
    RETURN jsonb_build_object('opportunity_id', v_opp, 'lead_id', v_lead, 'deduped', true);
  END IF;

  SELECT s.id INTO v_service FROM public.services s WHERE s.name = 'Môi giới ký gửi tài sản' LIMIT 1;
  SELECT sv.id INTO v_variant FROM public.service_variants sv WHERE sv.variant_key = 'broker_consignment' LIMIT 1;
  IF v_service IS NULL THEN
    -- Không chặn chủ tài sản chỉ vì catalog thiếu: việc chọn đã ghi xong ở trên.
    RETURN jsonb_build_object('opportunity_id', NULL, 'lead_id', NULL, 'deduped', false);
  END IF;

  SELECT name, email INTO v_prof FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.leads
    (name, contact_name, phone, email, lead_type, source, status, note,
     created_by, asset_posting_id)
  VALUES (
    COALESCE(NULLIF(v_prof.name, ''), v_prof.email, 'Chủ tài sản'),
    v_prof.name, NULL, v_prof.email,
    'asset_owner', 'asset_brokerage', 'new',
    'Chốt ký gửi "' || v_posting.title || '" với ' || COALESCE(v_org.name, 'tổ chức đấu giá'),
    v_uid, v_req.asset_posting_id
  )
  RETURNING id INTO v_lead;

  INSERT INTO public.opportunities
    (name, lead_id, opportunity_type, stage, service_id, service_variant_id,
     amount, gross_amount, created_by, asset_posting_id)
  VALUES (
    'Ký gửi: ' || v_posting.title,
    v_lead, 'new_business', 'selling', v_service, v_variant,
    0, COALESCE(v_req.quote_service_fee, 0), v_uid, v_req.asset_posting_id
  )
  RETURNING id INTO v_opp;

  RETURN jsonb_build_object('opportunity_id', v_opp, 'lead_id', v_lead, 'deduped', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_select_service_quote(UUID) TO authenticated;

-- ─── 11. Mã quyền tổ chức `yeu-cau-ky-gui` ───────────────────────────────────
-- OWNER đã tự phủ mọi quyền trong org_has_permission (r.code = 'OWNER'), chỉ cần
-- cấp cho MANAGER hiện có + preset tổ chức tạo mới.

INSERT INTO public.org_role_permissions (role_id, module, action)
SELECT r.id, 'yeu-cau-ky-gui', v.action
FROM public.org_roles r
CROSS JOIN (VALUES ('view'), ('update')) AS v(action)
WHERE r.code = 'MANAGER'
ON CONFLICT (role_id, module, action) DO NOTHING;

CREATE OR REPLACE FUNCTION public.org_seed_default_roles(_org_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _owner_role_id UUID;
BEGIN
  INSERT INTO public.org_roles (organization_id, name, code, description, is_system)
  VALUES (_org_id, 'Chủ sở hữu', 'OWNER', 'Toàn quyền trong tổ chức. Không thể xóa.', true)
  ON CONFLICT (organization_id, code) DO UPDATE SET updated_at = now()
  RETURNING id INTO _owner_role_id;

  INSERT INTO public.org_roles (organization_id, name, code, description, is_system) VALUES
    (_org_id, 'Quản lý',   'MANAGER', 'Quản lý hồ sơ năng lực, hồ sơ dự tuyển và thành viên.', false),
    (_org_id, 'Nhân viên', 'AGENT',   'Xem hồ sơ và lập hồ sơ dự tuyển.', false)
  ON CONFLICT (organization_id, code) DO NOTHING;

  INSERT INTO public.org_role_permissions (role_id, module, action)
  SELECT r.id, v.module, v.action
  FROM public.org_roles r
  JOIN (VALUES
    ('MANAGER','tong-quan','view'),
    ('MANAGER','nl-thong-tin-chung','view'),   ('MANAGER','nl-thong-tin-chung','update'),
    ('MANAGER','nl-dau-gia-vien','view'),      ('MANAGER','nl-dau-gia-vien','create'),
    ('MANAGER','nl-dau-gia-vien','update'),    ('MANAGER','nl-dau-gia-vien','delete'),
    ('MANAGER','nhan-su','view'),              ('MANAGER','nhan-su','update'),
    ('MANAGER','nhan-su','export'),
    ('MANAGER','boi-duong','view'),            ('MANAGER','boi-duong','create'),
    ('MANAGER','boi-duong','update'),          ('MANAGER','boi-duong','delete'),
    ('MANAGER','boi-duong','export'),
    ('MANAGER','nl-co-so-vat-chat','view'),    ('MANAGER','nl-co-so-vat-chat','create'),
    ('MANAGER','nl-co-so-vat-chat','update'),  ('MANAGER','nl-co-so-vat-chat','delete'),
    ('MANAGER','nl-lich-su-dau-gia','view'),   ('MANAGER','nl-lich-su-dau-gia','create'),
    ('MANAGER','nl-lich-su-dau-gia','update'), ('MANAGER','nl-lich-su-dau-gia','delete'),
    ('MANAGER','nl-lich-su-dau-gia','export'),
    ('MANAGER','nl-tai-chinh','view'),         ('MANAGER','nl-tai-chinh','update'),
    ('MANAGER','ho-so-du-tuyen','view'),       ('MANAGER','ho-so-du-tuyen','create'),
    ('MANAGER','ho-so-du-tuyen','update'),     ('MANAGER','ho-so-du-tuyen','delete'),
    ('MANAGER','ho-so-du-tuyen','export'),
    ('MANAGER','yeu-cau-ky-gui','view'),       ('MANAGER','yeu-cau-ky-gui','update'),
    ('MANAGER','tin-dang','view'),             ('MANAGER','tin-dang','create'),
    ('MANAGER','tin-dang','update'),           ('MANAGER','tin-dang','delete'),
    ('MANAGER','thanh-vien','view'),           ('MANAGER','thanh-vien','create'),
    ('MANAGER','credit','view'),
    ('AGENT','tong-quan','view'),
    ('AGENT','nl-thong-tin-chung','view'),     ('AGENT','nl-dau-gia-vien','view'),
    ('AGENT','nhan-su','view'),                ('AGENT','nhan-su','export'),
    ('AGENT','boi-duong','view'),              ('AGENT','boi-duong','export'),
    ('AGENT','nl-co-so-vat-chat','view'),      ('AGENT','nl-lich-su-dau-gia','view'),
    ('AGENT','nl-tai-chinh','view'),
    ('AGENT','ho-so-du-tuyen','view'),         ('AGENT','ho-so-du-tuyen','create'),
    ('AGENT','yeu-cau-ky-gui','view'),
    ('AGENT','tin-dang','view'),               ('AGENT','tin-dang','create')
  ) AS v(code, module, action) ON v.code = r.code
  WHERE r.organization_id = _org_id
  ON CONFLICT (role_id, module, action) DO NOTHING;

  RETURN _owner_role_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.org_seed_default_roles(UUID) TO authenticated;
