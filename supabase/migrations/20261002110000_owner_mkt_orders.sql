-- Truyền thông của chủ tài sản — Phase M4 "Giao việc cho sàn" (docs/owner-marketing-plan.md §B3).
--
-- Trạm Điều Hành đặt SÀN làm truyền thông cho một tài sản trên sàn, theo dõi tới khi xong;
-- admin thực hiện bằng công cụ sẵn có (email / banner / cờ nổi bật) ở /admin/yeu-cau-dich-vu.
--
--   1. Danh mục: 2 nhóm dịch vụ category 'marketing_owner'.
--        • Giá cố định (kind credit): mkt_featured_owner "Tin nổi bật 7 ngày",
--          mkt_social_owner "Đăng trên kênh mạng xã hội của sàn". Trả bằng HẠN MỨC gói dịch vụ
--          trước (_owner_sub_consume — tin nổi bật dùng quyền lợi "Tin đăng ưu tiên"), hết thì
--          credit (_charge_owner_feature_credits) — đặt là trả luôn, bỏ qua bước báo giá.
--        • Báo giá (kind direct): mkt_banner_owner "Banner trên sàn", mkt_full_owner "Gói trọn
--          chiến dịch". requested → (admin báo giá VND) quoted → (VNPay mô phỏng) paid.
--        • mkt_email_owner KHÔNG seed, KHÔNG bán: truyền thông tới người mua trên sàn đang HOÃN
--          (chủ sản phẩm, 2026-10-01).
--   2. owner_mkt_orders: requested → quoted → paid → in_progress → completed | cancelled.
--      Mọi GHI qua RPC SECURITY DEFINER; bảng chỉ có SELECT cho thành viên Trạm / admin.
--   3. Doanh thu: credit đã ghi lúc NẠP, gói đã ghi lúc trả gói ⇒ chỉ đơn trả VND (vnpay) sinh
--      MỘT dòng `orders` (direct) lúc HOÀN TẤT. Huỷ sau khi trả: hoàn lượt / credit tự động;
--      VND hoàn ngoài hệ thống (ghi refund_note).
--   4. Tin nổi bật: thêm listings.featured_until; cờ featured / featured_until chỉ ADMIN (hoặc
--      migration / service_role) đổi được — trigger nuốt thay đổi của người khác, kẻo chủ tin tự
--      bật miễn phí thứ sàn đang bán.
--   5. owner_mkt_order_results: chủ tài sản xem SỐ LIỆU TỔNG của chiến dịch email / banner gắn
--      với đơn (marketing_campaigns, advertisements là bảng admin-only) — không lộ người nhận.
--
-- Quyền: đặt / huỷ / trả = 'truyen-thong:share' (+ phạm vi chi nhánh của tài sản); xem = thành
-- viên Trạm. Admin: module 'don-truyen-thong' (view / update).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Danh mục dịch vụ
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.services (name, kind, category, audience, price, description, is_active, sort_order)
SELECT 'Truyền thông chủ tài sản', 'credit', 'marketing_owner', 'owner', 0,
       'Gói truyền thông giá cố định chủ tài sản đặt sàn làm (tin nổi bật, đăng mạng xã hội). Trả bằng hạn mức gói dịch vụ, hết thì trừ credit.',
       true, 50
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Truyền thông chủ tài sản');

INSERT INTO public.services (name, kind, category, audience, price, description, is_active, sort_order)
SELECT 'Truyền thông chủ tài sản (báo giá)', 'direct', 'marketing_owner', 'owner', 0,
       'Gói truyền thông sàn báo giá riêng từng đơn (banner, trọn chiến dịch). Doanh thu ghi lúc hoàn tất đơn.',
       true, 51
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Truyền thông chủ tài sản (báo giá)');

-- Giá credit là GIÁ GIỮ CHỖ — sửa ở /admin/dich-vu (quyết định D2 của plan).
INSERT INTO public.service_variants (service_id, variant_key, name, price, credit_cost, is_active, sort_order)
SELECT s.id, v.key, v.name, 0, v.cost, true, v.sort
  FROM public.services s
 CROSS JOIN (VALUES ('mkt_featured_owner', 'Tin nổi bật 7 ngày', 199, 1),
                    ('mkt_social_owner', 'Đăng trên kênh mạng xã hội của sàn', 99, 2)) AS v(key, name, cost, sort)
 WHERE s.name = 'Truyền thông chủ tài sản'
ON CONFLICT (variant_key) DO NOTHING;

INSERT INTO public.service_variants (service_id, variant_key, name, price, is_active, sort_order)
SELECT s.id, v.key, v.name, 0, true, v.sort
  FROM public.services s
 CROSS JOIN (VALUES ('mkt_banner_owner', 'Banner trên sàn', 1),
                    ('mkt_full_owner', 'Gói trọn chiến dịch', 2)) AS v(key, name, sort)
 WHERE s.name = 'Truyền thông chủ tài sản (báo giá)'
ON CONFLICT (variant_key) DO NOTHING;

-- Quyền lợi gói dịch vụ (owner_sub_benefits) trả thay credit cho gói giá cố định.
-- "Tin nổi bật 7 ngày" dùng hạn mức "Tin đăng ưu tiên" ⇒ quyền lợi đó chuyển từ chỉ hiển thị
-- sang HỆ THỐNG KIỂM. Đăng MXH chưa có quyền lợi tương ứng ⇒ chỉ credit.
-- Bản sao client: MKT_ORDER_BENEFIT ở src/lib/ownerMarketing/orders.ts.
CREATE FUNCTION public.owner_mkt_order_benefit_key(p_variant_key TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$ SELECT CASE p_variant_key WHEN 'mkt_featured_owner' THEN 'priority_listing' END $$;

UPDATE public.owner_sub_benefits SET source = 'enforced' WHERE key = 'priority_listing';

-- Lượt gói ghi cho đơn truyền thông. Bản LIVE trước khi thay: ('asset_3d_scan', 'owner_report_view').
ALTER TABLE public.owner_subscription_usage
  DROP CONSTRAINT owner_subscription_usage_ref_type_check,
  ADD CONSTRAINT owner_subscription_usage_ref_type_check
    CHECK (ref_type = ANY (ARRAY['asset_3d_scan', 'owner_report_view', 'owner_mkt_order']));

-- Gói được phép ĐẶT (bản sao client: MKT_ORDER_PACKAGES ở src/lib/ownerMarketing/orders.ts).
CREATE FUNCTION public.owner_mkt_order_variant_keys()
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE
AS $$ SELECT ARRAY['mkt_featured_owner', 'mkt_social_owner', 'mkt_banner_owner', 'mkt_full_owner']::TEXT[] $$;

-- Số ngày nổi bật của gói mkt_featured_owner (bản sao client: FEATURED_DAYS).
CREATE FUNCTION public.owner_mkt_featured_days()
RETURNS INTEGER
LANGUAGE sql IMMUTABLE
AS $$ SELECT 7 $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Tin nổi bật trên sàn
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.listings ADD COLUMN featured_until TIMESTAMPTZ;

COMMENT ON COLUMN public.listings.featured_until IS
  'Hết hạn nổi bật. Tin đang nổi bật = featured AND (featured_until IS NULL OR featured_until > now()). Chỉ admin đổi (trigger listings_guard_featured).';

-- Nuốt (không RAISE) để form sửa tin gửi cả dòng của tổ chức / chủ tin vẫn lưu được.
CREATE FUNCTION public.listings_guard_featured()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.featured := false;
    NEW.featured_until := NULL;
  ELSE
    NEW.featured := OLD.featured;
    NEW.featured_until := OLD.featured_until;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER listings_guard_featured
  BEFORE INSERT OR UPDATE OF featured, featured_until ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.listings_guard_featured();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Đơn giao việc
-- ═══════════════════════════════════════════════════════════════════════════

CREATE SEQUENCE public.owner_mkt_order_code_seq;

CREATE TABLE public.owner_mkt_orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL UNIQUE
                        DEFAULT ('GVS' || lpad(nextval('public.owner_mkt_order_code_seq')::text, 6, '0')),
  workspace_id          UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  -- Snapshot: admin không đọc được asset_owner_workspaces.
  workspace_name        TEXT NOT NULL,
  -- Suy từ tin đã nhận (chi nhánh của pháp nhân trên claim), như owner_mkt_links.
  branch_id             UUID REFERENCES public.workspace_branches(id) ON DELETE SET NULL,
  listing_id            UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  listing_title         TEXT NOT NULL,
  service_variant_id    UUID NOT NULL REFERENCES public.service_variants(id) ON DELETE RESTRICT,
  variant_key           TEXT NOT NULL CHECK (variant_key ~ '^mkt_[a-z_]+_owner$'),
  package_name          TEXT NOT NULL,
  pricing               TEXT NOT NULL CHECK (pricing IN ('credits', 'quote')),
  goal                  TEXT NOT NULL CHECK (goal IN ('registrations', 'awareness', 'price_discovery', 'other')),
  brief                 TEXT CHECK (brief IS NULL OR char_length(brief) <= 2000),
  status                TEXT NOT NULL DEFAULT 'requested'
                        CHECK (status IN ('requested', 'quoted', 'paid', 'in_progress', 'completed', 'cancelled')),
  -- Giá cố định: số credit lúc đặt (0 khi gói dịch vụ bao). Báo giá: VND.
  credit_cost           INTEGER CHECK (credit_cost IS NULL OR credit_cost >= 0),
  quoted_price          NUMERIC(18,0) CHECK (quoted_price IS NULL OR quoted_price > 0),
  quote_note            TEXT CHECK (quote_note IS NULL OR char_length(quote_note) <= 1000),
  quote_expires_at      TIMESTAMPTZ,
  quoted_at             TIMESTAMPTZ,
  quoted_by             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  payment_method        TEXT CHECK (payment_method IN ('credits', 'subscription', 'vnpay')),
  paid_at               TIMESTAMPTZ,
  paid_by               UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  payment_txn_ref       TEXT,
  credit_transaction_id UUID REFERENCES public.credit_transactions(id) ON DELETE SET NULL,
  subscription_usage_id UUID REFERENCES public.owner_subscription_usage(id) ON DELETE SET NULL,
  assignee              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at            TIMESTAMPTZ,
  featured_from         TIMESTAMPTZ,
  featured_until        TIMESTAMPTZ,
  -- Thứ đã dùng để thực hiện đơn.
  marketing_campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  advertisement_id      UUID REFERENCES public.advertisements(id) ON DELETE SET NULL,
  -- Chiến dịch tự truyền thông (Phase M2) sàn soạn giúp — để dành cho gói trọn chiến dịch.
  owner_mkt_campaign_id UUID REFERENCES public.owner_mkt_campaigns(id) ON DELETE SET NULL,
  post_url              TEXT CHECK (post_url IS NULL OR post_url ~* '^https?://'),
  result_note           TEXT CHECK (result_note IS NULL OR char_length(result_note) <= 2000),
  result_summary        JSONB,
  completed_at          TIMESTAMPTZ,
  completed_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  revenue_order_id      UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  cancel_reason         TEXT CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 1000),
  cancelled_at          TIMESTAMPTZ,
  cancelled_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  refunded_at           TIMESTAMPTZ,
  refund_note           TEXT,
  created_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT owner_mkt_orders_paid_shape CHECK (
    status NOT IN ('paid', 'in_progress', 'completed') OR (paid_at IS NOT NULL AND payment_method IS NOT NULL)),
  CONSTRAINT owner_mkt_orders_method_matches_pricing CHECK (
    payment_method IS NULL
    OR (pricing = 'credits' AND payment_method IN ('credits', 'subscription'))
    OR (pricing = 'quote' AND payment_method = 'vnpay'))
);

CREATE INDEX owner_mkt_orders_workspace_idx ON public.owner_mkt_orders (workspace_id, created_at DESC);
CREATE INDEX owner_mkt_orders_listing_idx ON public.owner_mkt_orders (listing_id);
CREATE INDEX owner_mkt_orders_status_idx ON public.owner_mkt_orders (status, created_at DESC);
-- Một đơn ĐANG MỞ cho mỗi tài sản × gói (đặt trùng = bấm hai lần).
CREATE UNIQUE INDEX owner_mkt_orders_open_uniq ON public.owner_mkt_orders (listing_id, variant_key)
  WHERE status IN ('requested', 'quoted', 'paid', 'in_progress');

COMMENT ON TABLE public.owner_mkt_orders IS
  'Giao việc truyền thông cho sàn (Phase M4). Ghi chỉ qua RPC owner_mkt_order_* / admin_mkt_order_* / pay_owner_mkt_order.';

CREATE TRIGGER owner_mkt_orders_updated_at
  BEFORE UPDATE ON public.owner_mkt_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.owner_mkt_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_mkt_orders_member_read ON public.owner_mkt_orders
  FOR SELECT TO authenticated
  USING (public.owner_ws_can(workspace_id, 'read'));

CREATE POLICY owner_mkt_orders_admin_read ON public.owner_mkt_orders
  FOR SELECT TO authenticated
  USING (public.admin_has_permission('don-truyen-thong', 'view'));

REVOKE ALL ON public.owner_mkt_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.owner_mkt_orders TO authenticated;
REVOKE ALL ON SEQUENCE public.owner_mkt_order_code_seq FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RPC phía chủ tài sản
-- ═══════════════════════════════════════════════════════════════════════════

-- Trừ hạn mức gói trước, rồi credit. p_ref = id đơn (chưa cần tồn tại). Không ghi gì khi lỗi.
CREATE FUNCTION public._owner_mkt_order_charge(
  p_workspace_id UUID, p_variant_key TEXT, p_cost INTEGER, p_ref UUID, p_uid UUID, p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_benefit TEXT := public.owner_mkt_order_benefit_key(p_variant_key);
  v_sub     JSONB := jsonb_build_object('mode', 'none');
  v_tx      UUID;
BEGIN
  IF v_benefit IS NOT NULL THEN
    v_sub := public._owner_sub_consume(p_workspace_id, v_benefit, 1, 'owner_mkt_order', p_ref, p_uid);
  END IF;
  IF v_sub->>'mode' = 'blocked' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quota_exhausted',
                              'quota', v_sub->'quota', 'used', v_sub->'used');
  END IF;
  IF v_sub->>'mode' = 'covered' THEN
    RETURN jsonb_build_object('ok', true, 'method', 'subscription', 'cost', 0,
                              'usage_id', v_sub->>'usage_id', 'remaining', v_sub->'remaining');
  END IF;

  IF COALESCE(p_cost, 0) > 0 THEN
    v_tx := public._charge_owner_feature_credits(p_uid, p_workspace_id, p_variant_key, p_cost,
                                                 'owner_mkt_order', p_description);
    IF v_tx IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'cost', p_cost);
    END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'method', 'credits', 'cost', COALESCE(p_cost, 0), 'tx_id', v_tx);
END;
$$;

-- Đặt gói. Giá cố định ⇒ trả luôn (status 'paid'); báo giá ⇒ 'requested'.
-- Lỗi: forbidden · package_unavailable · invalid_goal · brief_too_long · listing_not_in_workspace ·
--      listing_not_active · duplicate_open_order · quota_exhausted · insufficient.
CREATE FUNCTION public.owner_mkt_order_create(
  p_workspace_id UUID, p_listing_id UUID, p_variant_key TEXT, p_goal TEXT, p_brief TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_id      UUID := gen_random_uuid();
  v_var     RECORD;
  v_owner   UUID;
  v_title   TEXT;
  v_lstatus TEXT;
  v_branch  UUID;
  v_brief   TEXT := NULLIF(btrim(COALESCE(p_brief, '')), '');
  v_pay     JSONB;
  v_code    TEXT;
BEGIN
  IF v_uid IS NULL OR p_workspace_id IS NULL
     OR NOT public.owner_ws_has(p_workspace_id, 'truyen-thong', 'share') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT v.id, v.name, COALESCE(v.credit_cost, 0) AS credit_cost,
         CASE s.kind WHEN 'credit' THEN 'credits' ELSE 'quote' END AS pricing
    INTO v_var
    FROM public.service_variants v
    JOIN public.services s ON s.id = v.service_id
   WHERE v.variant_key = p_variant_key
     AND p_variant_key = ANY (public.owner_mkt_order_variant_keys())
     AND s.category = 'marketing_owner' AND s.is_active AND v.is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'package_unavailable');
  END IF;

  IF p_goal IS NULL OR p_goal NOT IN ('registrations', 'awareness', 'price_discovery', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_goal');
  END IF;
  IF char_length(COALESCE(v_brief, '')) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'brief_too_long');
  END IF;

  SELECT c.asset_owner_id, l.title, l.status::text INTO v_owner, v_title, v_lstatus
    FROM public.asset_owner_claims c
    JOIN public.listings l ON l.id = c.listing_id
   WHERE c.workspace_id = p_workspace_id AND c.listing_id = p_listing_id
     AND c.status IN ('auto_claimed', 'confirmed');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'listing_not_in_workspace');
  END IF;

  v_branch := (SELECT wb.id FROM public.workspace_branches wb
                WHERE wb.workspace_id = p_workspace_id AND wb.asset_owner_id = v_owner);
  IF NOT public.owner_ws_has_in(p_workspace_id, 'truyen-thong', 'share', v_branch) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  -- Chỉ tin đang mở bán mới đáng (và mới hiện công khai để) truyền thông.
  IF v_lstatus <> 'ACTIVE' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'listing_not_active');
  END IF;

  -- Khoá theo tài sản × gói để hai cú bấm song song không cùng trừ tiền.
  PERFORM pg_advisory_xact_lock(hashtext('owner_mkt_order:' || p_listing_id::text || ':' || p_variant_key));
  IF EXISTS (SELECT 1 FROM public.owner_mkt_orders o
              WHERE o.listing_id = p_listing_id AND o.variant_key = p_variant_key
                AND o.status IN ('requested', 'quoted', 'paid', 'in_progress')) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_open_order');
  END IF;

  IF v_var.pricing = 'credits' THEN
    v_pay := public._owner_mkt_order_charge(p_workspace_id, p_variant_key, v_var.credit_cost, v_id, v_uid,
                                            'Truyền thông: ' || v_var.name || ' · ' || left(v_title, 80));
    IF NOT (v_pay->>'ok')::boolean THEN
      RETURN v_pay;
    END IF;
  END IF;

  INSERT INTO public.owner_mkt_orders (
    id, workspace_id, workspace_name, branch_id, listing_id, listing_title, service_variant_id,
    variant_key, package_name, pricing, goal, brief, status, credit_cost,
    payment_method, paid_at, paid_by, credit_transaction_id, subscription_usage_id, created_by)
  VALUES (
    v_id, p_workspace_id,
    COALESCE((SELECT w.primary_name FROM public.asset_owner_workspaces w WHERE w.id = p_workspace_id), 'Trạm'),
    v_branch, p_listing_id, COALESCE(NULLIF(btrim(v_title), ''), 'Tài sản'), v_var.id,
    p_variant_key, v_var.name, v_var.pricing, p_goal, v_brief,
    CASE WHEN v_var.pricing = 'credits' THEN 'paid' ELSE 'requested' END,
    CASE WHEN v_var.pricing = 'credits' THEN (v_pay->>'cost')::int END,
    v_pay->>'method',
    CASE WHEN v_var.pricing = 'credits' THEN now() END,
    CASE WHEN v_var.pricing = 'credits' THEN v_uid END,
    (v_pay->>'tx_id')::uuid, (v_pay->>'usage_id')::uuid, v_uid)
  RETURNING code INTO v_code;

  RETURN jsonb_build_object(
    'ok', true, 'order_id', v_id, 'code', v_code,
    'status', CASE WHEN v_var.pricing = 'credits' THEN 'paid' ELSE 'requested' END,
    'payment_method', v_pay->>'method', 'cost', (v_pay->>'cost')::int, 'remaining', v_pay->'remaining');
END;
$$;

-- Huỷ khi chưa trả (requested / quoted). Lỗi: forbidden · not_found · invalid_status · reason_required.
CREATE FUNCTION public.owner_mkt_order_cancel(p_order_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_o   public.owner_mkt_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_o FROM public.owner_mkt_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_uid IS NULL OR NOT public.owner_ws_can(v_o.workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_ws_has_in(v_o.workspace_id, 'truyen-thong', 'share', v_o.branch_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF v_o.status NOT IN ('requested', 'quoted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_o.status);
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;

  UPDATE public.owner_mkt_orders
     SET status = 'cancelled', cancel_reason = left(btrim(p_reason), 1000),
         cancelled_at = now(), cancelled_by = v_uid
   WHERE id = v_o.id;
  RETURN jsonb_build_object('ok', true, 'status', 'cancelled');
END;
$$;

-- ⚠️ MÔ PHỎNG VNPay (cùng khuôn pay_authentication_order): người trả tự báo "đã thanh toán",
-- idempotent theo mã giao dịch. Xoá khi có IPN thật. Lỗi: missing_txn · not_found · forbidden ·
-- invalid_status · quote_expired · quote_changed · txn_used.
CREATE FUNCTION public.pay_owner_mkt_order(p_order_id UUID, p_txn_ref TEXT, p_expected_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_o     public.owner_mkt_orders%ROWTYPE;
  v_txn   TEXT := btrim(COALESCE(p_txn_ref, ''));
  v_claim TEXT;
BEGIN
  IF v_uid IS NULL OR v_txn = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_txn');
  END IF;
  SELECT * INTO v_o FROM public.owner_mkt_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT public.owner_ws_can(v_o.workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_o.payment_txn_ref = v_txn THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_paid', 'order_id', v_o.id, 'code', v_o.code);
  END IF;
  IF NOT public.owner_ws_has_in(v_o.workspace_id, 'truyen-thong', 'share', v_o.branch_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF v_o.status <> 'quoted' OR v_o.pricing <> 'quote' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_o.status);
  END IF;
  IF v_o.quote_expires_at IS NOT NULL AND v_o.quote_expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quote_expired');
  END IF;
  IF p_expected_amount IS DISTINCT FROM v_o.quoted_price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quote_changed');
  END IF;

  INSERT INTO public.payment_claims (txn_ref, user_id, variant_key, unlock_param)
  VALUES (v_txn, v_uid, v_o.variant_key, 'mkt_order:' || v_o.id)
  ON CONFLICT (txn_ref) DO NOTHING
  RETURNING txn_ref INTO v_claim;
  IF v_claim IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'txn_used');
  END IF;

  UPDATE public.owner_mkt_orders
     SET status = 'paid', payment_method = 'vnpay', paid_at = now(), paid_by = v_uid,
         payment_txn_ref = v_txn
   WHERE id = v_o.id;
  RETURN jsonb_build_object('ok', true, 'status', 'paid', 'order_id', v_o.id, 'code', v_o.code);
END;
$$;

-- Số liệu của thứ đã dùng để thực hiện đơn — chỉ số TỔNG (không người nhận, không khách hàng).
CREATE FUNCTION public.owner_mkt_order_results(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_o    public.owner_mkt_orders%ROWTYPE;
  v_camp JSONB;
  v_ad   JSONB;
BEGIN
  SELECT * INTO v_o FROM public.owner_mkt_orders WHERE id = p_order_id;
  IF NOT FOUND OR auth.uid() IS NULL
     OR NOT (public.owner_ws_can(v_o.workspace_id, 'read')
             OR public.admin_has_permission('don-truyen-thong', 'view')) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object('name', c.name, 'status', c.status, 'sent_at', c.sent_at,
                            'recipients', c.recipient_count, 'sent', c.sent_count,
                            'opened', c.opened_count, 'clicked', c.clicked_count)
    INTO v_camp
    FROM public.marketing_campaigns c WHERE c.id = v_o.marketing_campaign_id;

  SELECT jsonb_build_object('name', a.name, 'status', a.status, 'start_at', a.start_at,
                            'end_at', a.end_at, 'views', a.view_count, 'clicks', a.click_count)
    INTO v_ad
    FROM public.advertisements a WHERE a.id = v_o.advertisement_id;

  RETURN jsonb_build_object(
    'campaign', v_camp,
    'advertisement', v_ad,
    'featured', CASE WHEN v_o.featured_until IS NULL THEN NULL ELSE jsonb_build_object(
                  'from', v_o.featured_from, 'until', v_o.featured_until,
                  'active', v_o.featured_until > now()) END,
    'post_url', v_o.post_url);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RPC phía admin (module 'don-truyen-thong')
-- ═══════════════════════════════════════════════════════════════════════════

-- Báo giá / báo lại (khi chưa trả). Khớp isValidQuoteTerms: giá > 0, hiệu lực 1–60 ngày.
CREATE FUNCTION public.admin_mkt_order_quote(p_order_id UUID, p_price NUMERIC, p_note TEXT, p_valid_days INTEGER)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_o public.owner_mkt_orders%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission('don-truyen-thong', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  SELECT * INTO v_o FROM public.owner_mkt_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_o.pricing <> 'quote' OR v_o.status NOT IN ('requested', 'quoted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_o.status);
  END IF;
  IF p_price IS NULL OR p_price <= 0 OR p_valid_days IS NULL OR p_valid_days NOT BETWEEN 1 AND 60 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_quote');
  END IF;

  UPDATE public.owner_mkt_orders
     SET status = 'quoted', quoted_price = round(p_price), quote_note = NULLIF(left(btrim(COALESCE(p_note, '')), 1000), ''),
         quote_expires_at = now() + make_interval(days => p_valid_days),
         quoted_at = now(), quoted_by = auth.uid()
   WHERE id = v_o.id;
  RETURN jsonb_build_object('ok', true, 'status', 'quoted');
END;
$$;

-- Nhận việc: paid → in_progress. Gói nổi bật bật cờ ngay (nối tiếp nếu tin đang nổi bật).
CREATE FUNCTION public.admin_mkt_order_start(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_o     public.owner_mkt_orders%ROWTYPE;
  v_until TIMESTAMPTZ;
BEGIN
  IF NOT public.admin_has_permission('don-truyen-thong', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  SELECT * INTO v_o FROM public.owner_mkt_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_o.status <> 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_o.status);
  END IF;

  IF v_o.variant_key = 'mkt_featured_owner' THEN
    IF v_o.listing_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'listing_missing');
    END IF;
    UPDATE public.listings l
       SET featured = true,
           featured_until = GREATEST(CASE WHEN l.featured THEN l.featured_until END, now())
                            + make_interval(days => public.owner_mkt_featured_days())
     WHERE l.id = v_o.listing_id
    RETURNING l.featured_until INTO v_until;
  END IF;

  UPDATE public.owner_mkt_orders
     SET status = 'in_progress', started_at = now(), assignee = auth.uid(),
         featured_from = CASE WHEN v_until IS NOT NULL THEN now() END,
         featured_until = v_until
   WHERE id = v_o.id;
  RETURN jsonb_build_object('ok', true, 'status', 'in_progress', 'featured_until', v_until);
END;
$$;

-- Gắn / bỏ gắn chiến dịch email hoặc banner đã dùng để thực hiện đơn (p_target NULL = bỏ gắn).
CREATE FUNCTION public.admin_mkt_order_link(p_order_id UUID, p_kind TEXT, p_target UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_o public.owner_mkt_orders%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission('don-truyen-thong', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF p_kind NOT IN ('campaign', 'advertisement') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_kind');
  END IF;
  SELECT * INTO v_o FROM public.owner_mkt_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_o.status <> 'in_progress' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_o.status);
  END IF;
  IF p_target IS NOT NULL AND NOT (
       (p_kind = 'campaign' AND EXISTS (SELECT 1 FROM public.marketing_campaigns c WHERE c.id = p_target))
    OR (p_kind = 'advertisement' AND EXISTS (SELECT 1 FROM public.advertisements a WHERE a.id = p_target))) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'target_not_found');
  END IF;

  IF p_kind = 'campaign' THEN
    UPDATE public.owner_mkt_orders SET marketing_campaign_id = p_target WHERE id = v_o.id;
  ELSE
    UPDATE public.owner_mkt_orders SET advertisement_id = p_target WHERE id = v_o.id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Hoàn tất: in_progress → completed. Đóng băng số liệu vào result_summary; đơn trả VND sinh
-- dòng doanh thu `orders` (direct). Gói đăng MXH bắt buộc link bài đăng.
-- Lỗi: forbidden · not_found · invalid_status · note_required · post_url_required.
CREATE FUNCTION public.admin_mkt_order_complete(p_order_id UUID, p_note TEXT, p_post_url TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_o       public.owner_mkt_orders%ROWTYPE;
  v_url     TEXT := NULLIF(btrim(COALESCE(p_post_url, '')), '');
  v_note    TEXT := btrim(COALESCE(p_note, ''));
  v_results JSONB;
  v_rev     UUID;
BEGIN
  IF NOT public.admin_has_permission('don-truyen-thong', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  SELECT * INTO v_o FROM public.owner_mkt_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_o.status <> 'in_progress' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_o.status);
  END IF;
  IF char_length(v_note) < 5 OR char_length(v_note) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'note_required');
  END IF;
  IF v_url IS NOT NULL AND v_url !~* '^https?://' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'post_url_invalid');
  END IF;
  IF v_o.variant_key = 'mkt_social_owner' AND v_url IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'post_url_required');
  END IF;

  UPDATE public.owner_mkt_orders SET post_url = v_url WHERE id = v_o.id;
  v_results := public.owner_mkt_order_results(v_o.id);

  IF v_o.payment_method = 'vnpay' AND COALESCE(v_o.quoted_price, 0) > 0 THEN
    INSERT INTO public.orders
      (service_id, service_variant_id, user_id, quantity, amount, fulfillment_status,
       ordered_at, fulfilled_at, advertisement_id, note, created_by)
    SELECT v.service_id, v.id, COALESCE(v_o.paid_by, v_o.created_by), 1, v_o.quoted_price, 'fulfilled',
           COALESCE(v_o.paid_at, now()), now(), v_o.advertisement_id,
           'Giao việc truyền thông ' || v_o.code || ' · ' || left(v_o.listing_title, 120), auth.uid()
      FROM public.service_variants v WHERE v.id = v_o.service_variant_id
    RETURNING id INTO v_rev;
  END IF;

  UPDATE public.owner_mkt_orders
     SET status = 'completed', completed_at = now(), completed_by = auth.uid(),
         result_note = v_note,
         result_summary = v_results || jsonb_build_object('completed_at', now()),
         revenue_order_id = v_rev
   WHERE id = v_o.id;
  RETURN jsonb_build_object('ok', true, 'status', 'completed', 'revenue_order_id', v_rev);
END;
$$;

-- Huỷ (requested / quoted / paid). Đã trả: trả lại lượt gói hoặc credit tự động; VND ghi chú
-- hoàn ngoài hệ thống. Đang thực hiện thì không huỷ — hoàn tất với ghi chú kết quả.
CREATE FUNCTION public.admin_mkt_order_cancel(p_order_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_o      public.owner_mkt_orders%ROWTYPE;
  v_refund TEXT;
  v_at     TIMESTAMPTZ;
BEGIN
  IF NOT public.admin_has_permission('don-truyen-thong', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  SELECT * INTO v_o FROM public.owner_mkt_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_o.status NOT IN ('requested', 'quoted', 'paid') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_o.status);
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;

  IF v_o.status = 'paid' THEN
    IF v_o.payment_method = 'subscription' AND v_o.subscription_usage_id IS NOT NULL THEN
      PERFORM public._owner_sub_reverse(v_o.subscription_usage_id, 'Hoàn lượt — huỷ đơn truyền thông ' || v_o.code);
      v_refund := 'Đã trả lại 1 lượt gói dịch vụ';
      v_at := now();
    ELSIF v_o.payment_method = 'credits' AND COALESCE(v_o.credit_cost, 0) > 0 AND v_o.paid_by IS NOT NULL THEN
      INSERT INTO public.user_credits (user_id, balance)
      VALUES (v_o.paid_by, v_o.credit_cost)
      ON CONFLICT (user_id) DO UPDATE
        SET balance = public.user_credits.balance + EXCLUDED.balance, updated_at = now();
      INSERT INTO public.credit_transactions (user_id, type, description, credit_delta, variant_key, service_variant_id)
      VALUES (v_o.paid_by, 'owner_mkt_order_refund', 'Hoàn credit — huỷ đơn truyền thông ' || v_o.code,
              v_o.credit_cost, v_o.variant_key, v_o.service_variant_id);
      v_refund := 'Đã hoàn ' || v_o.credit_cost || ' credit';
      v_at := now();
    ELSIF v_o.payment_method = 'vnpay' THEN
      v_refund := 'Hoàn tiền VNPay xử lý ngoài hệ thống';
    END IF;
  END IF;

  UPDATE public.owner_mkt_orders
     SET status = 'cancelled', cancel_reason = left(btrim(p_reason), 1000),
         cancelled_at = now(), cancelled_by = auth.uid(),
         refund_note = v_refund, refunded_at = v_at
   WHERE id = v_o.id;
  RETURN jsonb_build_object('ok', true, 'status', 'cancelled', 'refund', v_refund);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Quyền gọi hàm
-- ═══════════════════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public.owner_mkt_order_variant_keys() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_mkt_featured_days() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_mkt_order_benefit_key(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.listings_guard_featured() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._owner_mkt_order_charge(UUID, TEXT, INTEGER, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.owner_mkt_order_create(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_mkt_order_cancel(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pay_owner_mkt_order(UUID, TEXT, NUMERIC) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_mkt_order_results(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_mkt_order_quote(UUID, NUMERIC, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_mkt_order_start(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_mkt_order_link(UUID, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_mkt_order_complete(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_mkt_order_cancel(UUID, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.owner_mkt_order_create(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_mkt_order_cancel(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_owner_mkt_order(UUID, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_mkt_order_results(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mkt_order_quote(UUID, NUMERIC, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mkt_order_start(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mkt_order_link(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mkt_order_complete(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mkt_order_cancel(UUID, TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Tự kiểm
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  f TEXT;
BEGIN
  IF (SELECT count(*) FROM public.service_variants v JOIN public.services s ON s.id = v.service_id
       WHERE s.category = 'marketing_owner' AND v.variant_key = ANY (public.owner_mkt_order_variant_keys())) <> 4 THEN
    RAISE EXCEPTION 'self-check: thiếu biến thể dịch vụ truyền thông';
  END IF;
  IF EXISTS (SELECT 1 FROM public.service_variants WHERE variant_key = 'mkt_email_owner') THEN
    RAISE EXCEPTION 'self-check: mkt_email_owner đang hoãn, không được seed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.owner_sub_benefits
                  WHERE key = public.owner_mkt_order_benefit_key('mkt_featured_owner') AND source = 'enforced') THEN
    RAISE EXCEPTION 'self-check: quyền lợi tin nổi bật phải là enforced';
  END IF;

  IF has_table_privilege('anon', 'public.owner_mkt_orders', 'SELECT') THEN
    RAISE EXCEPTION 'self-check: anon đọc được owner_mkt_orders';
  END IF;
  IF has_table_privilege('authenticated', 'public.owner_mkt_orders', 'INSERT')
     OR has_table_privilege('authenticated', 'public.owner_mkt_orders', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.owner_mkt_orders', 'DELETE') THEN
    RAISE EXCEPTION 'self-check: authenticated ghi thẳng được owner_mkt_orders';
  END IF;

  FOREACH f IN ARRAY ARRAY[
    'public._owner_mkt_order_charge(uuid, text, integer, uuid, uuid, text)',
    'public.listings_guard_featured()'] LOOP
    IF has_function_privilege('authenticated', f, 'EXECUTE') OR has_function_privilege('anon', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'self-check: client gọi được %', f;
    END IF;
  END LOOP;

  FOREACH f IN ARRAY ARRAY[
    'public.owner_mkt_order_create(uuid, uuid, text, text, text)',
    'public.owner_mkt_order_cancel(uuid, text)',
    'public.pay_owner_mkt_order(uuid, text, numeric)',
    'public.owner_mkt_order_results(uuid)',
    'public.admin_mkt_order_quote(uuid, numeric, text, integer)',
    'public.admin_mkt_order_start(uuid)',
    'public.admin_mkt_order_link(uuid, text, uuid)',
    'public.admin_mkt_order_complete(uuid, text, text)',
    'public.admin_mkt_order_cancel(uuid, text)'] LOOP
    IF has_function_privilege('anon', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'self-check: anon gọi được %', f;
    END IF;
    IF NOT has_function_privilege('authenticated', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'self-check: authenticated phải gọi được %', f;
    END IF;
  END LOOP;
END;
$$;
