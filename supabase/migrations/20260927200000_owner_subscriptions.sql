-- Gói thuê bao cho TỔ CHỨC chủ tài sản (2026-09-27).
--
-- Tổ chức chuyên nghiệp (ngân hàng, AMC, cơ quan THADS…) trả MỘT gói theo kỳ thay vì
-- trả credit từng lượt. Mỗi tổ chức (= một asset_owner_workspaces) có đúng MỘT dòng gói
-- do admin cấu hình riêng: giá, số tháng mỗi kỳ, hạn mức THEO THÁNG cho từng tính năng
-- tính credit, và cách xử lý khi hết hạn mức (mặc định CHẶN, admin đổi được sang "trừ
-- credit"). Chủ tài sản cá nhân và tenant "Cá nhân" vẫn trả credit như cũ.
--
-- Luật (người dùng chốt 2026-09-27):
--   • Hạn mức reset theo THÁNG DƯƠNG LỊCH giờ Việt Nam, không cộng dồn. Tháng đầu vẫn
--     đủ hạn mức (không chia tỷ lệ).
--   • Chỉ THÀNH VIÊN TRỰC TIẾP của Trạm được gói bao; trụ sở xem chi nhánh qua liên kết
--     vẫn trả credit. Gói của trụ sở KHÔNG bao chi nhánh.
--   • Thanh toán: Trưởng đơn vị (vai trò OWNER) trả qua VNPay mô phỏng, HOẶC admin kích
--     hoạt tay (chuyển khoản / hợp đồng / tặng). Gia hạn nối tiếp từ ends_on + 1.
--   • Doanh thu = một đơn `direct` lúc thanh toán (luật "direct ghi nhận lúc đặt"); kích
--     hoạt tặng 0 ₫ không sinh đơn.
--
-- Toàn bộ GHI đi qua RPC SECURITY DEFINER; bảng chỉ có policy SELECT cho admin. Thành
-- viên Trạm đọc qua owner_subscription_status (không lộ ghi chú nội bộ).
-- Tiêu thụ hạn mức (3D, báo cáo danh mục) nằm ở migration kế tiếp …200100.

-- ─── 1. Catalog: một nhóm dịch vụ direct để đơn hàng có service_id ────────────
-- Giá thật nằm trên từng gói của tổ chức; biến thể giữ price = 0. category
-- 'subscription' ⇒ packagesForAudience (lọc 'package') không bao giờ hiện nó.

INSERT INTO public.services (name, kind, category, audience, price, description, is_active, sort_order)
SELECT 'Gói thuê bao chủ tài sản', 'direct', 'subscription', 'owner', 0,
       'Gói thuê bao theo kỳ cho tổ chức chủ tài sản — giá và hạn mức do admin cấu hình riêng cho từng tổ chức.',
       true, 40
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Gói thuê bao chủ tài sản');

INSERT INTO public.service_variants (service_id, variant_key, name, price, is_active, sort_order)
SELECT s.id, 'owner_subscription', 'Gói thuê bao tổ chức (giá theo từng tổ chức)', 0, true, 1
  FROM public.services s WHERE s.name = 'Gói thuê bao chủ tài sản'
ON CONFLICT (variant_key) DO NOTHING;

-- ─── 2. Bảng ─────────────────────────────────────────────────────────────────

-- Tính năng được phép đưa vào gói = những tính năng ĐÃ biết tiêu hạn mức. Thêm tính
-- năng mới: sửa hàm này + SUPPORTED_SUB_VARIANTS (src/lib/ownerSubscription/status.ts)
-- + nối _owner_sub_consume vào điểm trừ credit của tính năng đó.
CREATE OR REPLACE FUNCTION public.owner_sub_supported_variants()
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE
AS $$ SELECT ARRAY['scan_3d_owner', 'report_portfolio_owner']::TEXT[] $$;

CREATE SEQUENCE IF NOT EXISTS public.owner_subscription_code_seq;

CREATE TABLE public.owner_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE,
  workspace_id  UUID NOT NULL UNIQUE REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  plan_name     TEXT NOT NULL DEFAULT 'Gói Doanh nghiệp'
                CHECK (char_length(btrim(plan_name)) BETWEEN 2 AND 120),
  price_vnd     NUMERIC(14,0) NOT NULL DEFAULT 0 CHECK (price_vnd >= 0),
  term_months   INTEGER NOT NULL DEFAULT 12 CHECK (term_months BETWEEN 1 AND 36),
  overage_mode  TEXT NOT NULL DEFAULT 'block' CHECK (overage_mode IN ('block', 'credits')),
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'offered', 'active', 'cancelled')),
  starts_on     DATE,
  ends_on       DATE,
  cancelled_at  TIMESTAMPTZ,
  cancel_reason TEXT,
  note          TEXT CHECK (note IS NULL OR char_length(note) <= 2000),
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT owner_sub_dates_order CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on),
  CONSTRAINT owner_sub_active_has_dates CHECK (status <> 'active' OR (starts_on IS NOT NULL AND ends_on IS NOT NULL))
);

CREATE TABLE public.owner_subscription_entitlements (
  subscription_id UUID NOT NULL REFERENCES public.owner_subscriptions(id) ON DELETE CASCADE,
  variant_key     TEXT NOT NULL REFERENCES public.service_variants(variant_key) ON DELETE RESTRICT,
  -- NULL = không giới hạn.
  monthly_quota   INTEGER CHECK (monthly_quota IS NULL OR monthly_quota > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (subscription_id, variant_key),
  CONSTRAINT owner_sub_ent_supported CHECK (variant_key = ANY (public.owner_sub_supported_variants()))
);

-- Mỗi kỳ đã trả / đã cấp — CHỈ GHI THÊM. Chụp cấu hình lúc mua để đối soát về sau.
CREATE TABLE public.owner_subscription_terms (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id       UUID NOT NULL REFERENCES public.owner_subscriptions(id) ON DELETE CASCADE,
  workspace_id          UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  starts_on             DATE NOT NULL,
  ends_on               DATE NOT NULL,
  months                INTEGER NOT NULL CHECK (months BETWEEN 1 AND 36),
  amount_vnd            NUMERIC(14,0) NOT NULL CHECK (amount_vnd >= 0),
  source                TEXT NOT NULL CHECK (source IN ('vnpay', 'manual')),
  method                TEXT CHECK (method IN ('bank_transfer', 'contract', 'complimentary', 'other')),
  payment_txn_ref       TEXT UNIQUE,
  order_id              UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  paid_on               DATE,
  entitlements_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  overage_mode_snapshot TEXT,
  price_snapshot        NUMERIC(14,0),
  note                  TEXT,
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT owner_sub_terms_dates CHECK (ends_on >= starts_on),
  CONSTRAINT owner_sub_terms_method CHECK ((source = 'vnpay') = (method IS NULL))
);
CREATE INDEX idx_owner_sub_terms_sub ON public.owner_subscription_terms (subscription_id, starts_on DESC);

-- Sổ tiêu hạn mức — CHỈ GHI THÊM. Hoàn = dòng đảo (qty âm, reverses_id), không xoá.
CREATE TABLE public.owner_subscription_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.owner_subscriptions(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  variant_key     TEXT NOT NULL,
  period_month    DATE NOT NULL CHECK (period_month = date_trunc('month', period_month)::date),
  qty             INTEGER NOT NULL CHECK (qty <> 0),
  ref_type        TEXT NOT NULL CHECK (ref_type IN ('asset_3d_scan', 'owner_report_view')),
  ref_id          UUID,
  reverses_id     UUID UNIQUE REFERENCES public.owner_subscription_usage(id) ON DELETE CASCADE,
  actor_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT owner_sub_usage_sign CHECK ((reverses_id IS NULL) = (qty > 0))
);
CREATE INDEX idx_owner_sub_usage_month ON public.owner_subscription_usage (subscription_id, variant_key, period_month);
CREATE INDEX idx_owner_sub_usage_created ON public.owner_subscription_usage (subscription_id, created_at DESC);

CREATE TABLE public.owner_subscription_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.owner_subscriptions(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL CHECK (event_type IN
                    ('created', 'settings_updated', 'offered', 'unpublished', 'cancelled',
                     'activated_manual', 'paid_online')),
  actor_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_owner_sub_events_sub ON public.owner_subscription_events (subscription_id, created_at DESC);

-- Liên kết lượt dùng gói ⇄ thực thể tiêu thụ.
ALTER TABLE public.asset_3d_scans
  ADD COLUMN subscription_usage_id UUID REFERENCES public.owner_subscription_usage(id) ON DELETE SET NULL,
  ADD CONSTRAINT asset_3d_scans_credit_xor_sub CHECK (NOT (credit_cost > 0 AND subscription_usage_id IS NOT NULL));
ALTER TABLE public.owner_report_views
  ADD COLUMN subscription_usage_id UUID REFERENCES public.owner_subscription_usage(id) ON DELETE SET NULL,
  ADD CONSTRAINT owner_report_views_credit_xor_sub CHECK (NOT (credits_charged > 0 AND subscription_usage_id IS NOT NULL));

-- Mã GTB######.
CREATE OR REPLACE FUNCTION public.set_owner_subscription_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'GTB' || lpad(nextval('public.owner_subscription_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER owner_subscriptions_set_code BEFORE INSERT ON public.owner_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_subscription_code();
CREATE TRIGGER owner_subscriptions_updated_at BEFORE UPDATE ON public.owner_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 3. RLS: chỉ admin đọc; mọi ghi qua RPC ──────────────────────────────────

ALTER TABLE public.owner_subscriptions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_subscription_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_subscription_terms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_subscription_usage        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_subscription_events       ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_subscriptions_admin_read ON public.owner_subscriptions
  FOR SELECT TO authenticated USING (public.admin_has_permission('goi-thue-bao', 'view'));
CREATE POLICY owner_sub_entitlements_admin_read ON public.owner_subscription_entitlements
  FOR SELECT TO authenticated USING (public.admin_has_permission('goi-thue-bao', 'view'));
CREATE POLICY owner_sub_terms_admin_read ON public.owner_subscription_terms
  FOR SELECT TO authenticated USING (public.admin_has_permission('goi-thue-bao', 'view'));
CREATE POLICY owner_sub_usage_admin_read ON public.owner_subscription_usage
  FOR SELECT TO authenticated USING (public.admin_has_permission('goi-thue-bao', 'view'));
CREATE POLICY owner_sub_events_admin_read ON public.owner_subscription_events
  FOR SELECT TO authenticated USING (public.admin_has_permission('goi-thue-bao', 'view'));

REVOKE INSERT, UPDATE, DELETE ON public.owner_subscriptions,
  public.owner_subscription_entitlements, public.owner_subscription_terms,
  public.owner_subscription_usage, public.owner_subscription_events
  FROM authenticated, anon;

-- ─── 4. Tiện ích ngày ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_sub_month(p_at TIMESTAMPTZ DEFAULT now())
RETURNS DATE LANGUAGE sql STABLE
AS $$ SELECT date_trunc('month', (p_at AT TIME ZONE 'Asia/Ho_Chi_Minh'))::date $$;

-- Ngày cuối (bao gồm) của một kỳ n tháng bắt đầu từ p_start. 31/01 + 1 tháng ⇒ 28|29/02.
CREATE OR REPLACE FUNCTION public.owner_sub_term_end(p_start DATE, p_months INTEGER)
RETURNS DATE LANGUAGE sql IMMUTABLE
AS $$ SELECT ((p_start + make_interval(months => p_months))::date - 1) $$;

-- Kỳ mới nối tiếp kỳ đang chạy; hết hạn / chưa từng chạy ⇒ từ hôm nay.
CREATE OR REPLACE FUNCTION public.owner_sub_next_start(p_ends_on DATE)
RETURNS DATE LANGUAGE sql STABLE SET search_path = public
AS $$ SELECT CASE WHEN p_ends_on IS NOT NULL AND p_ends_on >= public.contract_today()
                  THEN p_ends_on + 1 ELSE public.contract_today() END $$;

-- 'active' mà đã qua ends_on ⇒ 'expired'; 'active' chưa tới starts_on ⇒ 'scheduled'.
CREATE OR REPLACE FUNCTION public.owner_sub_effective_status(p_status TEXT, p_starts_on DATE, p_ends_on DATE)
RETURNS TEXT LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT CASE
    WHEN p_status = 'active' AND p_ends_on < public.contract_today() THEN 'expired'
    WHEN p_status = 'active' AND p_starts_on > public.contract_today() THEN 'scheduled'
    ELSE p_status END
$$;

-- ─── 5. Tiêu / hoàn hạn mức (nội bộ) ─────────────────────────────────────────
-- Trả mode: 'none' (không thuộc gói ⇒ trả credit như cũ), 'covered' (đã ghi lượt dùng),
-- 'blocked' (hết hạn mức, chặn), 'fallback' (hết hạn mức, trừ credit).
-- p_actor tường minh (không đọc auth.uid()) để IPN / service_role sau này gọi được.
-- Khoá: người gọi có thể đã khoá hồ sơ trước; hàm này chỉ khoá dòng gói ⇒ không có
-- vòng khoá ngược.

CREATE OR REPLACE FUNCTION public._owner_sub_consume(
  p_workspace_id UUID, p_variant_key TEXT, p_qty INTEGER,
  p_ref_type TEXT, p_ref_id UUID, p_actor UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub   public.owner_subscriptions%ROWTYPE;
  v_quota INTEGER;
  v_has   BOOLEAN;
  v_month DATE := public.owner_sub_month();
  v_used  INTEGER;
  v_id    UUID;
BEGIN
  IF p_workspace_id IS NULL OR p_actor IS NULL OR COALESCE(p_qty, 0) <= 0 THEN
    RETURN jsonb_build_object('mode', 'none');
  END IF;

  -- Chỉ thành viên TRỰC TIẾP đang hoạt động (trụ sở xem qua liên kết không được bao).
  IF NOT EXISTS (SELECT 1 FROM public.asset_owner_workspace_members m
                  WHERE m.workspace_id = p_workspace_id AND m.user_id = p_actor
                    AND m.status = 'active') THEN
    RETURN jsonb_build_object('mode', 'none');
  END IF;

  SELECT * INTO v_sub FROM public.owner_subscriptions
   WHERE workspace_id = p_workspace_id FOR UPDATE;
  IF NOT FOUND OR v_sub.status <> 'active'
     OR public.contract_today() NOT BETWEEN v_sub.starts_on AND v_sub.ends_on THEN
    RETURN jsonb_build_object('mode', 'none');
  END IF;

  SELECT true, e.monthly_quota INTO v_has, v_quota
    FROM public.owner_subscription_entitlements e
   WHERE e.subscription_id = v_sub.id AND e.variant_key = p_variant_key;
  IF v_has IS NULL THEN
    RETURN jsonb_build_object('mode', 'none');
  END IF;

  SELECT COALESCE(SUM(u.qty), 0) INTO v_used
    FROM public.owner_subscription_usage u
   WHERE u.subscription_id = v_sub.id AND u.variant_key = p_variant_key
     AND u.period_month = v_month;

  IF v_quota IS NULL OR v_used + p_qty <= v_quota THEN
    INSERT INTO public.owner_subscription_usage
      (subscription_id, workspace_id, variant_key, period_month, qty, ref_type, ref_id, actor_id)
    VALUES (v_sub.id, p_workspace_id, p_variant_key, v_month, p_qty, p_ref_type, p_ref_id, p_actor)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('mode', 'covered', 'usage_id', v_id, 'quota', v_quota,
                              'used', v_used + p_qty,
                              'remaining', CASE WHEN v_quota IS NULL THEN NULL
                                                ELSE v_quota - v_used - p_qty END);
  END IF;

  RETURN jsonb_build_object(
    'mode', CASE v_sub.overage_mode WHEN 'block' THEN 'blocked' ELSE 'fallback' END,
    'quota', v_quota, 'used', v_used, 'remaining', GREATEST(v_quota - v_used, 0));
END;
$$;

-- Hoàn một lượt: dòng đảo cùng period_month (hoàn qua ranh giới tháng trả về tháng cũ).
-- Idempotent nhờ UNIQUE(reverses_id). Không đụng tới credit.
CREATE OR REPLACE FUNCTION public._owner_sub_reverse(p_usage_id UUID, p_note TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.owner_subscription_usage
    (subscription_id, workspace_id, variant_key, period_month, qty, ref_type, ref_id,
     reverses_id, actor_id, note)
  SELECT u.subscription_id, u.workspace_id, u.variant_key, u.period_month, -u.qty,
         u.ref_type, u.ref_id, u.id, u.actor_id, p_note
    FROM public.owner_subscription_usage u
   WHERE u.id = p_usage_id AND u.qty > 0
  ON CONFLICT (reverses_id) DO NOTHING;
END;
$$;

-- MỘT chỗ duy nhất trừ credit cho tính năng chủ tài sản. Hôm nay: ví CÁ NHÂN của người
-- thao tác. Phase 15d (ví chung của Trạm) chỉ cần đổi ví ở ĐÂY — thứ tự vẫn là
-- hạn mức gói trước, rồi mới tới ví. Trả id dòng sổ cái; NULL = không đủ số dư.
CREATE OR REPLACE FUNCTION public._charge_owner_feature_credits(
  p_uid UUID, p_workspace_id UUID, p_variant_key TEXT, p_cost INTEGER,
  p_type TEXT, p_description TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tx UUID;
BEGIN
  UPDATE public.user_credits
     SET balance = balance - p_cost, updated_at = now()
   WHERE user_id = p_uid AND balance >= p_cost;
  IF NOT FOUND THEN RETURN NULL; END IF;

  INSERT INTO public.credit_transactions
    (user_id, type, description, credit_delta, variant_key, service_variant_id)
  SELECT p_uid, p_type, p_description, -p_cost, p_variant_key,
         (SELECT v.id FROM public.service_variants v WHERE v.variant_key = p_variant_key)
  RETURNING id INTO v_tx;
  RETURN v_tx;
END;
$$;

REVOKE ALL ON FUNCTION public._owner_sub_consume(UUID, TEXT, INTEGER, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._owner_sub_reverse(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._charge_owner_feature_credits(UUID, UUID, TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ─── 6. Đọc cho cổng chủ tài sản ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._owner_sub_lines(p_sub_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'variant_key', e.variant_key,
           'name', v.name,
           'credit_cost', v.credit_cost,
           'monthly_quota', e.monthly_quota,
           'used', GREATEST(COALESCE(u.used, 0), 0),
           'remaining', CASE WHEN e.monthly_quota IS NULL THEN NULL
                             ELSE GREATEST(e.monthly_quota - COALESCE(u.used, 0), 0) END)
         ORDER BY array_position(public.owner_sub_supported_variants(), e.variant_key)), '[]'::jsonb)
    FROM public.owner_subscription_entitlements e
    JOIN public.service_variants v ON v.variant_key = e.variant_key
    LEFT JOIN LATERAL (
      SELECT SUM(x.qty)::int AS used FROM public.owner_subscription_usage x
       WHERE x.subscription_id = e.subscription_id AND x.variant_key = e.variant_key
         AND x.period_month = public.owner_sub_month()) u ON true
   WHERE e.subscription_id = p_sub_id
$$;
REVOKE ALL ON FUNCTION public._owner_sub_lines(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_subscription_status(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_admin  BOOLEAN := public.admin_has_permission('goi-thue-bao', 'view');
  v_sub    public.owner_subscriptions%ROWTYPE;
  v_ws     TEXT;
  v_eff    TEXT;
  v_member BOOLEAN;
  v_owner  BOOLEAN;
BEGIN
  IF v_uid IS NULL OR NOT (public.owner_ws_can(p_workspace_id, 'read') OR v_admin) THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_sub FROM public.owner_subscriptions WHERE workspace_id = p_workspace_id;
  IF NOT FOUND OR (v_sub.status = 'draft' AND NOT v_admin) THEN
    RETURN NULL;
  END IF;

  SELECT primary_name INTO v_ws FROM public.asset_owner_workspaces WHERE id = p_workspace_id;
  v_eff := public.owner_sub_effective_status(v_sub.status, v_sub.starts_on, v_sub.ends_on);
  v_member := EXISTS (SELECT 1 FROM public.asset_owner_workspace_members m
                       WHERE m.workspace_id = p_workspace_id AND m.user_id = v_uid AND m.status = 'active');
  v_owner := public.owner_ws_user_is_owner(p_workspace_id, v_uid);

  RETURN jsonb_build_object(
    'id', v_sub.id, 'code', v_sub.code, 'workspace_id', p_workspace_id, 'workspace_name', v_ws,
    'plan_name', v_sub.plan_name, 'status', v_eff, 'starts_on', v_sub.starts_on, 'ends_on', v_sub.ends_on,
    'term_months', v_sub.term_months, 'price_vnd', v_sub.price_vnd, 'overage_mode', v_sub.overage_mode,
    'period_month', public.owner_sub_month(),
    'next_reset_on', (public.owner_sub_month() + interval '1 month')::date,
    'covered_for_me', v_member AND v_eff = 'active',
    'can_pay', v_owner AND v_eff IN ('offered', 'active', 'expired', 'scheduled') AND v_sub.price_vnd > 0,
    'lines', public._owner_sub_lines(v_sub.id));
END;
$$;
REVOKE ALL ON FUNCTION public.owner_subscription_status(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_subscription_status(UUID) TO authenticated;

-- ─── 7. Admin ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_owner_subscription_list()
RETURNS TABLE (
  workspace_id UUID, workspace_name TEXT, match_scope TEXT, parent_name TEXT,
  owner_name TEXT, owner_email TEXT, member_count INTEGER, workspace_created_at TIMESTAMPTZ,
  subscription_id UUID, code TEXT, plan_name TEXT, status TEXT,
  starts_on DATE, ends_on DATE, price_vnd NUMERIC, term_months INTEGER, overage_mode TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_has_permission('goi-thue-bao', 'view') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT w.id, w.primary_name, w.match_scope, pw.primary_name,
         p.name, p.email,
         (SELECT count(*)::int FROM public.asset_owner_workspace_members m
           WHERE m.workspace_id = w.id AND m.status = 'active'),
         w.created_at,
         s.id, s.code, s.plan_name,
         CASE WHEN s.id IS NULL THEN NULL
              ELSE public.owner_sub_effective_status(s.status, s.starts_on, s.ends_on) END,
         s.starts_on, s.ends_on, s.price_vnd, s.term_months, s.overage_mode
    FROM public.asset_owner_workspaces w
    LEFT JOIN public.asset_owner_workspaces pw ON pw.id = w.parent_workspace_id
    LEFT JOIN public.profiles p ON p.id = w.owner_user_id
    LEFT JOIN public.owner_subscriptions s ON s.workspace_id = w.id
   ORDER BY (s.id IS NULL), w.primary_name;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_owner_subscription_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_owner_subscription_list() TO authenticated;

-- Tạo / sửa cấu hình gói. Có hiệu lực NGAY (hạn mức so sống, kể cả tháng đang chạy).
-- p_entitlements: [{variant_key, monthly_quota|null}] — THAY TOÀN BỘ danh sách.
CREATE OR REPLACE FUNCTION public.admin_owner_sub_upsert(
  p_workspace_id UUID, p_plan_name TEXT, p_price_vnd NUMERIC, p_term_months INTEGER,
  p_overage_mode TEXT, p_entitlements JSONB, p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_sub    public.owner_subscriptions%ROWTYPE;
  v_before JSONB;
  v_new    BOOLEAN := false;
  v_line   JSONB;
  v_key    TEXT;
  v_quota  INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.asset_owner_workspaces WHERE id = p_workspace_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF p_overage_mode NOT IN ('block', 'credits') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_overage');
  END IF;
  IF p_price_vnd IS NULL OR p_price_vnd < 0 OR p_term_months IS NULL OR p_term_months NOT BETWEEN 1 AND 36 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_terms');
  END IF;
  IF char_length(btrim(COALESCE(p_plan_name, ''))) NOT BETWEEN 2 AND 120 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_name');
  END IF;
  IF jsonb_typeof(COALESCE(p_entitlements, '[]'::jsonb)) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_entitlements');
  END IF;
  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_entitlements, '[]'::jsonb)) LOOP
    v_key := v_line->>'variant_key';
    IF v_key IS NULL OR NOT (v_key = ANY (public.owner_sub_supported_variants())) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'unsupported_variant', 'variant_key', v_key);
    END IF;
    IF v_line->'monthly_quota' IS NOT NULL AND jsonb_typeof(v_line->'monthly_quota') <> 'null'
       AND (v_line->>'monthly_quota')::int <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_quota', 'variant_key', v_key);
    END IF;
  END LOOP;

  SELECT * INTO v_sub FROM public.owner_subscriptions WHERE workspace_id = p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN
    IF NOT public.admin_has_permission('goi-thue-bao', 'create') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
    END IF;
    INSERT INTO public.owner_subscriptions
      (workspace_id, plan_name, price_vnd, term_months, overage_mode, note, created_by, updated_by)
    VALUES (p_workspace_id, btrim(p_plan_name), p_price_vnd, p_term_months, p_overage_mode,
            NULLIF(btrim(COALESCE(p_note, '')), ''), v_uid, v_uid)
    RETURNING * INTO v_sub;
    v_new := true;
  ELSE
    IF NOT public.admin_has_permission('goi-thue-bao', 'update') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
    END IF;
    v_before := jsonb_build_object(
      'plan_name', v_sub.plan_name, 'price_vnd', v_sub.price_vnd, 'term_months', v_sub.term_months,
      'overage_mode', v_sub.overage_mode,
      'entitlements', (SELECT COALESCE(jsonb_agg(jsonb_build_object('variant_key', e.variant_key,
                                        'monthly_quota', e.monthly_quota) ORDER BY e.variant_key), '[]'::jsonb)
                         FROM public.owner_subscription_entitlements e WHERE e.subscription_id = v_sub.id));
    UPDATE public.owner_subscriptions
       SET plan_name = btrim(p_plan_name), price_vnd = p_price_vnd, term_months = p_term_months,
           overage_mode = p_overage_mode, note = NULLIF(btrim(COALESCE(p_note, '')), ''),
           updated_by = v_uid
     WHERE id = v_sub.id;
  END IF;

  DELETE FROM public.owner_subscription_entitlements WHERE subscription_id = v_sub.id;
  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_entitlements, '[]'::jsonb)) LOOP
    v_quota := CASE WHEN jsonb_typeof(v_line->'monthly_quota') = 'number'
                    THEN (v_line->>'monthly_quota')::int ELSE NULL END;
    INSERT INTO public.owner_subscription_entitlements (subscription_id, variant_key, monthly_quota)
    VALUES (v_sub.id, v_line->>'variant_key', v_quota)
    ON CONFLICT (subscription_id, variant_key) DO UPDATE SET monthly_quota = EXCLUDED.monthly_quota;
  END LOOP;

  INSERT INTO public.owner_subscription_events (subscription_id, event_type, actor_id, payload)
  VALUES (v_sub.id, CASE WHEN v_new THEN 'created' ELSE 'settings_updated' END, v_uid,
          jsonb_build_object('before', v_before, 'after', jsonb_build_object(
            'plan_name', btrim(p_plan_name), 'price_vnd', p_price_vnd, 'term_months', p_term_months,
            'overage_mode', p_overage_mode, 'entitlements', COALESCE(p_entitlements, '[]'::jsonb))));

  RETURN jsonb_build_object('ok', true, 'subscription_id', v_sub.id, 'created', v_new);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_owner_sub_upsert(UUID, TEXT, NUMERIC, INTEGER, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_owner_sub_upsert(UUID, TEXT, NUMERIC, INTEGER, TEXT, JSONB, TEXT) TO authenticated;

-- Chuyển trạng thái KHÔNG kèm thanh toán: nháp ⇄ chào gói, → huỷ (bắt buộc lý do),
-- huỷ → chào lại. Không bao giờ tự đặt 'active' — chỉ kích hoạt / thanh toán làm được.
CREATE OR REPLACE FUNCTION public.admin_owner_sub_set_status(p_sub_id UUID, p_status TEXT, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub public.owner_subscriptions%ROWTYPE;
  v_evt TEXT;
BEGIN
  IF NOT public.admin_has_permission('goi-thue-bao', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  SELECT * INTO v_sub FROM public.owner_subscriptions WHERE id = p_sub_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;

  IF p_status = 'offered' AND v_sub.status IN ('draft', 'cancelled') THEN
    IF NOT EXISTS (SELECT 1 FROM public.owner_subscription_entitlements WHERE subscription_id = p_sub_id) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'no_entitlements');
    END IF;
    v_evt := 'offered';
  ELSIF p_status = 'draft' AND v_sub.status = 'offered' THEN
    v_evt := 'unpublished';
  ELSIF p_status = 'cancelled' AND v_sub.status <> 'cancelled' THEN
    IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
    END IF;
    v_evt := 'cancelled';
  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_transition', 'from', v_sub.status, 'to', p_status);
  END IF;

  UPDATE public.owner_subscriptions
     SET status = p_status, updated_by = auth.uid(),
         cancelled_at = CASE WHEN p_status = 'cancelled' THEN now() ELSE NULL END,
         cancel_reason = CASE WHEN p_status = 'cancelled' THEN btrim(p_reason) ELSE NULL END
   WHERE id = p_sub_id;

  INSERT INTO public.owner_subscription_events (subscription_id, event_type, actor_id, payload)
  VALUES (p_sub_id, v_evt, auth.uid(),
          jsonb_build_object('from', v_sub.status, 'to', p_status, 'reason', NULLIF(btrim(COALESCE(p_reason, '')), '')));
  RETURN jsonb_build_object('ok', true, 'status', p_status);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_owner_sub_set_status(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_owner_sub_set_status(UUID, TEXT, TEXT) TO authenticated;

-- Ghi một kỳ + kích hoạt / nối dài gói (dùng chung cho kích hoạt tay và thanh toán).
CREATE OR REPLACE FUNCTION public._owner_sub_apply_term(
  p_sub public.owner_subscriptions, p_start DATE, p_months INTEGER, p_amount NUMERIC,
  p_source TEXT, p_method TEXT, p_txn_ref TEXT, p_order_id UUID, p_paid_on DATE,
  p_note TEXT, p_actor UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_end  DATE := public.owner_sub_term_end(p_start, p_months);
  v_term UUID;
BEGIN
  INSERT INTO public.owner_subscription_terms
    (subscription_id, workspace_id, starts_on, ends_on, months, amount_vnd, source, method,
     payment_txn_ref, order_id, paid_on, entitlements_snapshot, overage_mode_snapshot,
     price_snapshot, note, created_by)
  VALUES (p_sub.id, p_sub.workspace_id, p_start, v_end, p_months, p_amount, p_source, p_method,
          p_txn_ref, p_order_id, p_paid_on,
          (SELECT COALESCE(jsonb_agg(jsonb_build_object('variant_key', e.variant_key,
                    'monthly_quota', e.monthly_quota) ORDER BY e.variant_key), '[]'::jsonb)
             FROM public.owner_subscription_entitlements e WHERE e.subscription_id = p_sub.id),
          p_sub.overage_mode, p_sub.price_vnd, NULLIF(btrim(COALESCE(p_note, '')), ''), p_actor)
  RETURNING id INTO v_term;

  -- Còn hạn ⇒ giữ ngày bắt đầu gốc, chỉ nối ends_on. Đã hết hạn / lần đầu ⇒ mở kỳ mới.
  UPDATE public.owner_subscriptions
     SET status = 'active',
         starts_on = CASE WHEN status = 'active' AND ends_on >= public.contract_today()
                          THEN starts_on ELSE p_start END,
         ends_on = v_end, cancelled_at = NULL, cancel_reason = NULL, updated_by = p_actor
   WHERE id = p_sub.id;

  RETURN jsonb_build_object('term_id', v_term, 'starts_on', p_start, 'ends_on', v_end);
END;
$$;
REVOKE ALL ON FUNCTION public._owner_sub_apply_term(public.owner_subscriptions, DATE, INTEGER, NUMERIC, TEXT, TEXT, TEXT, UUID, DATE, TEXT, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._owner_sub_order(
  p_sub public.owner_subscriptions, p_user UUID, p_amount NUMERIC, p_ordered_at TIMESTAMPTZ,
  p_note TEXT, p_actor UUID
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order UUID;
BEGIN
  INSERT INTO public.orders
    (service_id, service_variant_id, user_id, quantity, amount, fulfillment_status,
     ordered_at, fulfilled_at, note, created_by)
  SELECT v.service_id, v.id, p_user, 1, p_amount, 'fulfilled', p_ordered_at, now(), p_note, p_actor
    FROM public.service_variants v WHERE v.variant_key = 'owner_subscription'
  RETURNING id INTO v_order;
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Thiếu biến thể dịch vụ owner_subscription';
  END IF;
  RETURN v_order;
END;
$$;
REVOKE ALL ON FUNCTION public._owner_sub_order(public.owner_subscriptions, UUID, NUMERIC, TIMESTAMPTZ, TEXT, UUID) FROM PUBLIC, anon, authenticated;

-- Kích hoạt / gia hạn TAY (chuyển khoản, hợp đồng, tặng…). amount > 0 ⇒ ghi đơn doanh
-- thu đứng tên Trưởng đơn vị gốc của Trạm; 0 ₫ ⇒ chỉ có kỳ + sự kiện.
CREATE OR REPLACE FUNCTION public.admin_owner_sub_activate(
  p_sub_id UUID, p_months INTEGER, p_starts_on DATE, p_amount_vnd NUMERIC,
  p_method TEXT, p_paid_on DATE, p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_sub   public.owner_subscriptions%ROWTYPE;
  v_ws    public.asset_owner_workspaces%ROWTYPE;
  v_start DATE;
  v_order UUID;
  v_res   JSONB;
BEGIN
  IF NOT public.admin_has_permission('goi-thue-bao', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF p_months IS NULL OR p_months NOT BETWEEN 1 AND 36 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_terms');
  END IF;
  IF p_amount_vnd IS NULL OR p_amount_vnd < 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;
  IF p_method NOT IN ('bank_transfer', 'contract', 'complimentary', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_method');
  END IF;

  SELECT * INTO v_sub FROM public.owner_subscriptions WHERE id = p_sub_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF v_sub.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_sub.status);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.owner_subscription_entitlements WHERE subscription_id = p_sub_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_entitlements');
  END IF;
  SELECT * INTO v_ws FROM public.asset_owner_workspaces WHERE id = v_sub.workspace_id;

  v_start := COALESCE(p_starts_on,
                      public.owner_sub_next_start(CASE WHEN v_sub.status = 'active' THEN v_sub.ends_on END));

  IF p_amount_vnd > 0 THEN
    v_order := public._owner_sub_order(
      v_sub, v_ws.owner_user_id, p_amount_vnd,
      COALESCE(p_paid_on, public.contract_today())::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh',
      'Gói thuê bao ' || v_sub.code || ' · ' || v_ws.primary_name || ' · ' || p_months || ' tháng (kích hoạt tay)',
      v_uid);
  END IF;

  v_res := public._owner_sub_apply_term(v_sub, v_start, p_months, p_amount_vnd, 'manual', p_method,
                                        NULL, v_order, COALESCE(p_paid_on, public.contract_today()),
                                        p_note, v_uid);

  INSERT INTO public.owner_subscription_events (subscription_id, event_type, actor_id, payload)
  VALUES (p_sub_id, 'activated_manual', v_uid,
          v_res || jsonb_build_object('months', p_months, 'amount_vnd', p_amount_vnd,
                                      'method', p_method, 'order_id', v_order));
  RETURN jsonb_build_object('ok', true, 'order_id', v_order) || v_res;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_owner_sub_activate(UUID, INTEGER, DATE, NUMERIC, TEXT, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_owner_sub_activate(UUID, INTEGER, DATE, NUMERIC, TEXT, DATE, TEXT) TO authenticated;

-- ─── 8. Thanh toán online (VNPay mô phỏng) ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_subscription_quote(p_sub_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub   public.owner_subscriptions%ROWTYPE;
  v_ws    TEXT;
  v_eff   TEXT;
  v_start DATE;
  v_owner BOOLEAN;
BEGIN
  SELECT * INTO v_sub FROM public.owner_subscriptions WHERE id = p_sub_id;
  IF NOT FOUND OR NOT public.owner_ws_can(v_sub.workspace_id, 'read') OR v_sub.status = 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  SELECT primary_name INTO v_ws FROM public.asset_owner_workspaces WHERE id = v_sub.workspace_id;
  v_eff := public.owner_sub_effective_status(v_sub.status, v_sub.starts_on, v_sub.ends_on);
  v_start := public.owner_sub_next_start(CASE WHEN v_sub.status = 'active' THEN v_sub.ends_on END);
  v_owner := public.owner_ws_user_is_owner(v_sub.workspace_id, auth.uid());
  RETURN jsonb_build_object(
    'ok', true, 'id', v_sub.id, 'code', v_sub.code, 'workspace_id', v_sub.workspace_id,
    'workspace_name', v_ws, 'plan_name', v_sub.plan_name, 'price_vnd', v_sub.price_vnd,
    'term_months', v_sub.term_months, 'status', v_eff,
    'next_starts_on', v_start, 'next_ends_on', public.owner_sub_term_end(v_start, v_sub.term_months),
    'can_pay', v_owner AND v_sub.status IN ('offered', 'active') AND v_sub.price_vnd > 0,
    'reason', CASE WHEN NOT v_owner THEN 'not_owner'
                   WHEN v_sub.status NOT IN ('offered', 'active') THEN 'invalid_status'
                   WHEN v_sub.price_vnd <= 0 THEN 'not_payable' END);
END;
$$;
REVOKE ALL ON FUNCTION public.owner_subscription_quote(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_subscription_quote(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public._settle_owner_subscription(
  p_sub_id UUID, p_txn_ref TEXT, p_expected_amount NUMERIC, p_uid UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub   public.owner_subscriptions%ROWTYPE;
  v_ws    TEXT;
  v_term  public.owner_subscription_terms%ROWTYPE;
  v_claim TEXT;
  v_start DATE;
  v_order UUID;
  v_res   JSONB;
BEGIN
  IF p_uid IS NULL OR btrim(COALESCE(p_txn_ref, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_txn');
  END IF;

  SELECT * INTO v_sub FROM public.owner_subscriptions WHERE id = p_sub_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  SELECT primary_name INTO v_ws FROM public.asset_owner_workspaces WHERE id = v_sub.workspace_id;

  -- F5 / quay lại trang kết quả: cùng mã giao dịch ⇒ báo đã trả, không làm gì.
  SELECT * INTO v_term FROM public.owner_subscription_terms
   WHERE subscription_id = p_sub_id AND payment_txn_ref = btrim(p_txn_ref);
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_paid', 'code', v_sub.code,
                              'workspace_id', v_sub.workspace_id, 'workspace_name', v_ws,
                              'starts_on', v_term.starts_on, 'ends_on', v_term.ends_on);
  END IF;

  -- Kiểm từ p_uid, không auth.uid(): IPN thật sau này gọi bằng service_role.
  IF NOT public.owner_ws_user_is_owner(v_sub.workspace_id, p_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_owner');
  END IF;
  IF v_sub.status NOT IN ('offered', 'active') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_sub.status);
  END IF;
  IF v_sub.price_vnd <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_payable');
  END IF;
  -- Admin đổi giá trong lúc Trưởng đơn vị đang ở trang thanh toán.
  IF p_expected_amount IS DISTINCT FROM v_sub.price_vnd THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quote_changed');
  END IF;

  INSERT INTO public.payment_claims (txn_ref, user_id, variant_key, unlock_param)
  VALUES (btrim(p_txn_ref), p_uid, 'owner_subscription', 'owner_sub:' || v_sub.id)
  ON CONFLICT (txn_ref) DO NOTHING
  RETURNING txn_ref INTO v_claim;
  IF v_claim IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'txn_used');
  END IF;

  v_start := public.owner_sub_next_start(CASE WHEN v_sub.status = 'active' THEN v_sub.ends_on END);
  v_order := public._owner_sub_order(
    v_sub, p_uid, v_sub.price_vnd, now(),
    'Gói thuê bao ' || v_sub.code || ' · ' || v_ws || ' · ' || v_sub.term_months || ' tháng (VNPay)',
    p_uid);
  v_res := public._owner_sub_apply_term(v_sub, v_start, v_sub.term_months, v_sub.price_vnd, 'vnpay',
                                        NULL, btrim(p_txn_ref), v_order, public.contract_today(),
                                        NULL, p_uid);

  INSERT INTO public.owner_subscription_events (subscription_id, event_type, actor_id, payload)
  VALUES (v_sub.id, 'paid_online', p_uid,
          v_res || jsonb_build_object('amount_vnd', v_sub.price_vnd, 'order_id', v_order,
                                      'txn_ref', btrim(p_txn_ref)));

  RETURN jsonb_build_object('ok', true, 'status', 'paid', 'code', v_sub.code,
                            'workspace_id', v_sub.workspace_id, 'workspace_name', v_ws,
                            'order_id', v_order) || v_res;
END;
$$;
REVOKE ALL ON FUNCTION public._settle_owner_subscription(UUID, TEXT, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;

-- ⚠️ MÔ PHỎNG: Trưởng đơn vị tự báo "đã thanh toán". Xoá khi có IPN VNPay thật.
CREATE OR REPLACE FUNCTION public.pay_owner_subscription(p_sub_id UUID, p_txn_ref TEXT, p_expected_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN public._settle_owner_subscription(p_sub_id, p_txn_ref, p_expected_amount, auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.pay_owner_subscription(UUID, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_owner_subscription(UUID, TEXT, NUMERIC) TO authenticated;
