-- Bộ gói: danh mục gói dịch vụ chia theo đối tượng (2026-10-04, design "Danh Muc Goi - Admin v3").
--
-- Trước đây (20261001120000) mỗi gói có danh sách Trạm được dùng riêng, còn kỳ mua 3/6/12
-- tháng dùng chung cho mọi gói. Nay:
--   • BỘ GÓI (owner_sub_packages) = nhiều gói + các kỳ mua riêng + gói "Phổ biến" riêng.
--     Mỗi gói thuộc ĐÚNG MỘT bộ.
--   • Mỗi Trạm thuộc ĐÚNG MỘT bộ (owner_sub_package_workspaces, PK = workspace_id). Trạm
--     chưa gán thấy BỘ MẶC ĐỊNH (đúng một bộ is_default, không ngừng bán được).
--   • THƯ VIỆN KỲ MUA (owner_sub_term_library): số tháng + chiết khấu + ghi chú; có thể có
--     "12 tháng −10%" lẫn "12 tháng −15% theo HĐ ngân hàng". Mỗi bộ chọn kỳ từ thư viện,
--     nhưng trong MỘT bộ không có hai kỳ trùng số tháng ⇒ checkout vẫn định danh kỳ bằng
--     số tháng (?months=12), RPC thanh toán giữ nguyên chữ ký.
--   • Mua / gia hạn: gói phải đang bán, bộ của gói đang bán và là bộ của Trạm; chiết khấu
--     lấy từ kỳ của bộ. Chuyển Trạm sang bộ khác / ngừng bán ⇒ gói đang chạy giữ tới hết
--     hạn nhưng không gia hạn được ('plan_not_available' / 'plan_inactive').
--   • Không xoá gói (đơn / gói Trạm cũ còn trỏ tới) — chỉ ngừng bán.
--
-- Bảng cũ owner_subscription_term_options + owner_subscription_plan_workspaces GIỮ LẠI chỉ
-- đọc cho frontend production cũ; xoá ở supabase/pending/owner_sub_drop_legacy_catalog.sql.

-- ─── 1. Bảng ─────────────────────────────────────────────────────────────────

CREATE TABLE public.owner_sub_packages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 60),
  description      TEXT CHECK (description IS NULL OR char_length(description) <= 160),
  is_default       BOOLEAN NOT NULL DEFAULT false,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  featured_plan_id UUID,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT owner_sub_packages_default_active CHECK (NOT is_default OR is_active)
);
CREATE UNIQUE INDEX owner_sub_packages_one_default ON public.owner_sub_packages ((true)) WHERE is_default;
CREATE TRIGGER owner_sub_packages_updated_at BEFORE UPDATE ON public.owner_sub_packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.owner_sub_term_library (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  months       INTEGER NOT NULL CHECK (months BETWEEN 1 AND 36),
  discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 50),
  note         TEXT CHECK (note IS NULL OR char_length(note) <= 120),
  updated_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT owner_sub_term_library_unique UNIQUE (months, discount_pct)
);
CREATE TRIGGER owner_sub_term_library_updated_at BEFORE UPDATE ON public.owner_sub_term_library
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Không hai kỳ trùng số tháng trong một bộ: kiểm ở admin_owner_sub_package_save và
-- admin_owner_sub_term_save (ghi chỉ qua RPC).
CREATE TABLE public.owner_sub_package_terms (
  package_id UUID NOT NULL REFERENCES public.owner_sub_packages(id) ON DELETE CASCADE,
  term_id    UUID NOT NULL REFERENCES public.owner_sub_term_library(id) ON DELETE RESTRICT,
  PRIMARY KEY (package_id, term_id)
);
CREATE INDEX idx_owner_sub_package_terms_term ON public.owner_sub_package_terms (term_id);

CREATE TABLE public.owner_sub_package_workspaces (
  workspace_id UUID PRIMARY KEY REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  package_id   UUID NOT NULL REFERENCES public.owner_sub_packages(id) ON DELETE CASCADE,
  added_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_owner_sub_package_ws_package ON public.owner_sub_package_workspaces (package_id);

-- ─── 2. Backfill: bộ mặc định "Đại trà" = 3 gói hiện có + kỳ 3/6/12 ─────────

INSERT INTO public.owner_sub_term_library (months, discount_pct)
SELECT months, discount_pct FROM public.owner_subscription_term_options
ON CONFLICT ON CONSTRAINT owner_sub_term_library_unique DO NOTHING;

INSERT INTO public.owner_sub_packages (name, description, is_default, is_active, featured_plan_id)
VALUES ('Đại trà', 'Trạm, công ty đấu giá tư nhân', true, true,
        (SELECT id FROM public.owner_subscription_plans WHERE is_featured LIMIT 1));

INSERT INTO public.owner_sub_package_terms (package_id, term_id)
SELECT p.id, t.id
  FROM public.owner_sub_packages p
  JOIN public.owner_subscription_term_options o ON o.is_active
  JOIN public.owner_sub_term_library t ON t.months = o.months AND t.discount_pct = o.discount_pct
 WHERE p.is_default;

ALTER TABLE public.owner_subscription_plans
  ADD COLUMN package_id UUID REFERENCES public.owner_sub_packages(id) ON DELETE RESTRICT;
UPDATE public.owner_subscription_plans SET package_id = (SELECT id FROM public.owner_sub_packages WHERE is_default);
ALTER TABLE public.owner_subscription_plans ALTER COLUMN package_id SET NOT NULL;
CREATE INDEX idx_owner_sub_plans_package ON public.owner_subscription_plans (package_id, sort_order);

ALTER TABLE public.owner_sub_packages
  ADD CONSTRAINT owner_sub_packages_featured_fkey
  FOREIGN KEY (featured_plan_id) REFERENCES public.owner_subscription_plans(id) ON DELETE SET NULL;

-- "Phổ biến nhất" chuyển lên bộ gói.
DROP INDEX IF EXISTS public.owner_sub_plans_one_featured;
ALTER TABLE public.owner_subscription_plans DROP COLUMN is_featured;

-- ─── 3. RLS: admin đọc trực tiếp; chủ tài sản đọc qua owner_sub_catalog ──────

ALTER TABLE public.owner_sub_packages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_sub_term_library       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_sub_package_terms      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_sub_package_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_sub_packages_admin_read ON public.owner_sub_packages
  FOR SELECT TO authenticated USING (public.admin_has_permission('goi-thue-bao', 'view'));
CREATE POLICY owner_sub_term_library_admin_read ON public.owner_sub_term_library
  FOR SELECT TO authenticated USING (public.admin_has_permission('goi-thue-bao', 'view'));
CREATE POLICY owner_sub_package_terms_admin_read ON public.owner_sub_package_terms
  FOR SELECT TO authenticated USING (public.admin_has_permission('goi-thue-bao', 'view'));
CREATE POLICY owner_sub_package_ws_read ON public.owner_sub_package_workspaces
  FOR SELECT TO authenticated
  USING (public.admin_has_permission('goi-thue-bao', 'view') OR public.owner_ws_can(workspace_id, 'read'));

REVOKE INSERT, UPDATE, DELETE ON public.owner_sub_packages, public.owner_sub_term_library,
  public.owner_sub_package_terms, public.owner_sub_package_workspaces FROM authenticated, anon;

-- ─── 4. Bộ của một Trạm + gói có mua được không ──────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_sub_workspace_package(p_workspace_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT package_id FROM public.owner_sub_package_workspaces WHERE workspace_id = p_workspace_id),
    (SELECT id FROM public.owner_sub_packages WHERE is_default))
$$;
REVOKE ALL ON FUNCTION public.owner_sub_workspace_package(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_sub_workspace_package(UUID) TO authenticated;

-- NULL = mua được; còn lại là reason.
CREATE OR REPLACE FUNCTION public._owner_sub_plan_unavailable(p_workspace_id UUID, p_plan_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN p.id IS NULL OR NOT p.is_active OR NOT k.is_active THEN 'plan_inactive'
    WHEN p.package_id IS DISTINCT FROM public.owner_sub_workspace_package(p_workspace_id) THEN 'plan_not_available'
  END
    FROM (SELECT 1) one
    LEFT JOIN public.owner_subscription_plans p ON p.id = p_plan_id
    LEFT JOIN public.owner_sub_packages k ON k.id = p.package_id
$$;
REVOKE ALL ON FUNCTION public._owner_sub_plan_unavailable(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Gói đọc được: gói đang bán thuộc bộ của một Trạm mình đọc được, HOẶC gói hiện tại / chờ
-- áp dụng của Trạm mình (thẻ gói hiện tại vẫn đủ quyền lợi sau khi Trạm đổi bộ).
CREATE OR REPLACE FUNCTION public.owner_sub_plan_visible(p_plan_id UUID, p_is_active BOOLEAN)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (p_is_active AND EXISTS (
            SELECT 1
              FROM public.owner_subscription_plans p
              JOIN public.owner_sub_packages k ON k.id = p.package_id AND k.is_active
              JOIN public.asset_owner_workspaces w ON public.owner_sub_workspace_package(w.id) = k.id
             WHERE p.id = p_plan_id AND public.owner_ws_can(w.id, 'read')))
      OR EXISTS (
            SELECT 1 FROM public.owner_subscriptions s
             WHERE (s.plan_id = p_plan_id OR s.pending_plan_id = p_plan_id)
               AND public.owner_ws_can(s.workspace_id, 'read'))
$$;

-- ─── 5. Danh mục chủ tài sản thấy ────────────────────────────────────────────
-- Gói đang bán của bộ của Trạm + các kỳ của bộ. Bộ ngừng bán ⇒ rỗng. `is_featured` giữ
-- tên cũ để cổng chủ tài sản không phải đổi.

CREATE OR REPLACE FUNCTION public.owner_sub_catalog(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pkg public.owner_sub_packages%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.owner_ws_can(p_workspace_id, 'read') THEN
    RETURN jsonb_build_object('plans', '[]'::jsonb, 'terms', '[]'::jsonb);
  END IF;
  SELECT * INTO v_pkg FROM public.owner_sub_packages WHERE id = public.owner_sub_workspace_package(p_workspace_id);
  IF NOT FOUND OR NOT v_pkg.is_active THEN
    RETURN jsonb_build_object('plans', '[]'::jsonb, 'terms', '[]'::jsonb);
  END IF;
  RETURN jsonb_build_object(
    'package_id', v_pkg.id,
    'plans', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.name, 'fit_line', p.fit_line, 'highlight_line', p.highlight_line,
               'tier', p.tier, 'monthly_price_vnd', p.monthly_price_vnd, 'overage_mode', p.overage_mode,
               'is_featured', p.id IS NOT DISTINCT FROM v_pkg.featured_plan_id, 'is_active', p.is_active,
               'sort_order', p.sort_order,
               'benefits', COALESCE((
                 SELECT jsonb_agg(jsonb_build_object('benefit_key', e.benefit_key, 'quota', e.quota,
                                                     'cycle', e.cycle, 'sort_order', e.sort_order,
                                                     'benefit', to_jsonb(b))
                                  ORDER BY e.sort_order, e.benefit_key)
                   FROM public.owner_subscription_plan_entitlements e
                   JOIN public.owner_sub_benefits b ON b.key = e.benefit_key
                  WHERE e.plan_id = p.id), '[]'::jsonb))
             ORDER BY p.sort_order, p.created_at)
        FROM public.owner_subscription_plans p
       WHERE p.package_id = v_pkg.id AND p.is_active), '[]'::jsonb),
    'terms', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('months', t.months, 'discount_pct', t.discount_pct, 'is_active', true)
                       ORDER BY t.months)
        FROM public.owner_sub_package_terms pt
        JOIN public.owner_sub_term_library t ON t.id = pt.term_id
       WHERE pt.package_id = v_pkg.id), '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.owner_sub_catalog(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_sub_catalog(UUID) TO authenticated;

-- ─── 6. Đánh giá lượt mua: bộ của Trạm + kỳ của bộ ───────────────────────────
-- Thân hàm giữ nguyên bản 20261001120000, đổi kiểm gói mở cho Trạm và nguồn chiết khấu.

CREATE OR REPLACE FUNCTION public._owner_sub_plan_eval(
  p_workspace_id UUID, p_plan_id UUID, p_months INTEGER, p_uid UUID
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws     TEXT;
  v_plan   public.owner_subscription_plans%ROWTYPE;
  v_disc   NUMERIC;
  v_sub    public.owner_subscriptions%ROWTYPE;
  v_has    BOOLEAN;
  v_eff    TEXT;
  v_effect TEXT;
  v_start  DATE;
  v_amount NUMERIC;
  v_reason TEXT;
  v_owner  BOOLEAN;
BEGIN
  SELECT primary_name INTO v_ws FROM public.asset_owner_workspaces WHERE id = p_workspace_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  v_reason := public._owner_sub_plan_unavailable(p_workspace_id, p_plan_id);
  IF v_reason IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', v_reason); END IF;
  SELECT * INTO v_plan FROM public.owner_subscription_plans WHERE id = p_plan_id;
  SELECT t.discount_pct INTO v_disc
    FROM public.owner_sub_package_terms pt
    JOIN public.owner_sub_term_library t ON t.id = pt.term_id
   WHERE pt.package_id = v_plan.package_id AND t.months = p_months
   ORDER BY t.discount_pct DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_term'); END IF;

  v_amount := public.owner_sub_plan_price(v_plan.monthly_price_vnd, p_months, v_disc);
  v_owner := public.owner_ws_user_is_owner(p_workspace_id, p_uid);

  SELECT * INTO v_sub FROM public.owner_subscriptions WHERE workspace_id = p_workspace_id;
  v_has := FOUND;
  v_eff := CASE WHEN v_has THEN public.owner_sub_effective_status(v_sub.status, v_sub.starts_on, v_sub.ends_on) END;

  IF v_has AND v_eff IN ('active', 'scheduled') THEN
    v_start := v_sub.ends_on + 1;
    IF v_sub.pending_from IS NOT NULL THEN
      v_reason := 'pending_exists';
    END IF;
    v_effect := CASE WHEN v_sub.plan_id IS NOT DISTINCT FROM p_plan_id THEN 'extend' ELSE 'next_term' END;
  ELSE
    v_start := public.contract_today();
    v_effect := 'now';
  END IF;

  IF v_reason IS NULL AND NOT v_owner THEN v_reason := 'not_owner'; END IF;
  IF v_reason IS NULL AND v_amount <= 0 THEN v_reason := 'not_payable'; END IF;

  RETURN jsonb_build_object(
    'ok', true, 'workspace_id', p_workspace_id, 'workspace_name', v_ws,
    'plan_id', v_plan.id, 'plan_name', v_plan.name, 'tier', v_plan.tier,
    'months', p_months, 'discount_pct', v_disc,
    'monthly_price_vnd', v_plan.monthly_price_vnd, 'amount_vnd', v_amount,
    'effect', v_effect, 'starts_on', v_start, 'ends_on', public.owner_sub_term_end(v_start, p_months),
    'subscription_id', CASE WHEN v_has THEN v_sub.id END,
    'current_plan_name', CASE WHEN v_has THEN v_sub.plan_name END,
    'can_pay', v_reason IS NULL, 'reason', v_reason);
END;
$$;
REVOKE ALL ON FUNCTION public._owner_sub_plan_eval(UUID, UUID, INTEGER, UUID) FROM PUBLIC, anon, authenticated;

-- ─── 7. Kích hoạt tay: gói phải thuộc bộ của Trạm ────────────────────────────
-- Thân hàm giữ nguyên bản 20261001120000, chỉ đổi kiểm gói mở cho Trạm.

CREATE OR REPLACE FUNCTION public.admin_owner_sub_plan_activate(
  p_workspace_id UUID, p_plan_id UUID, p_months INTEGER, p_starts_on DATE, p_amount_vnd NUMERIC,
  p_method TEXT, p_paid_on DATE, p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_ws     public.asset_owner_workspaces%ROWTYPE;
  v_plan   public.owner_subscription_plans%ROWTYPE;
  v_sub    public.owner_subscriptions%ROWTYPE;
  v_has    BOOLEAN;
  v_eff    TEXT;
  v_effect TEXT;
  v_start  DATE;
  v_paid   DATE := COALESCE(p_paid_on, public.contract_today());
  v_order  UUID;
  v_res    JSONB;
  v_reason TEXT;
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
  IF p_method IS NULL OR p_method NOT IN ('bank_transfer', 'contract', 'complimentary', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_method');
  END IF;

  SELECT * INTO v_ws FROM public.asset_owner_workspaces WHERE id = p_workspace_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  v_reason := public._owner_sub_plan_unavailable(p_workspace_id, p_plan_id);
  IF v_reason IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', v_reason); END IF;
  SELECT * INTO v_plan FROM public.owner_subscription_plans WHERE id = p_plan_id;

  PERFORM public._owner_sub_roll(s.id) FROM public.owner_subscriptions s WHERE s.workspace_id = p_workspace_id;
  SELECT * INTO v_sub FROM public.owner_subscriptions WHERE workspace_id = p_workspace_id FOR UPDATE;
  v_has := FOUND;
  v_eff := CASE WHEN v_has THEN public.owner_sub_effective_status(v_sub.status, v_sub.starts_on, v_sub.ends_on) END;

  IF v_has AND v_eff IN ('active', 'scheduled') THEN
    IF v_sub.pending_from IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'pending_exists');
    END IF;
    v_start := v_sub.ends_on + 1;
    v_effect := CASE WHEN v_sub.plan_id IS NOT DISTINCT FROM p_plan_id THEN 'extend' ELSE 'next_term' END;
  ELSE
    v_start := COALESCE(p_starts_on, public.contract_today());
    v_effect := 'now';
  END IF;

  v_sub := public._owner_sub_plan_ensure(p_workspace_id, p_plan_id, p_months, p_amount_vnd, v_uid, 'admin_manual');

  IF p_amount_vnd > 0 THEN
    v_order := public._owner_sub_order(
      v_sub, v_ws.owner_user_id, p_amount_vnd, v_paid::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh',
      'Gói dịch vụ ' || v_plan.name || ' · ' || v_sub.code || ' · ' || v_ws.primary_name || ' · ' || p_months
        || ' tháng (kích hoạt tay' || CASE WHEN v_effect = 'next_term' THEN ', áp dụng từ kỳ sau' ELSE '' END || ')',
      v_uid);
  END IF;

  v_res := public._owner_sub_plan_apply(v_sub, p_plan_id, v_effect, v_start, p_months, p_amount_vnd,
                                        'manual', p_method, NULL, v_order, v_paid, p_note, v_uid);

  INSERT INTO public.owner_subscription_events (subscription_id, event_type, actor_id, payload)
  VALUES (v_sub.id, 'activated_manual', v_uid,
          v_res || jsonb_build_object('effect', v_effect, 'months', p_months, 'amount_vnd', p_amount_vnd,
                                      'method', p_method, 'order_id', v_order));
  RETURN jsonb_build_object('ok', true, 'order_id', v_order, 'effect', v_effect, 'code', v_sub.code)
         || (v_res - 'plan' - 'replaced');
END;
$$;

-- ─── 8. Ghi một gói (dùng chung cho lưu bộ và lưu gói lẻ) ─────────────────────
-- p: {name, fit_line, highlight_line, tier, monthly_price_vnd, overage_mode, is_active,
--     benefits:[{benefit_key, quota, cycle}]}. Kiểm hợp lệ giữ nguyên admin_owner_sub_plan_upsert cũ.

CREATE OR REPLACE FUNCTION public._owner_sub_plan_write(
  p_plan_id UUID, p_package_id UUID, p JSONB, p_sort_order INTEGER, p_uid UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id       UUID := p_plan_id;
  v_name     TEXT := btrim(COALESCE(p->>'name', ''));
  v_fit      TEXT := NULLIF(btrim(COALESCE(p->>'fit_line', '')), '');
  v_hl       TEXT := NULLIF(btrim(COALESCE(p->>'highlight_line', '')), '');
  v_tier     TEXT := p->>'tier';
  v_overage  TEXT := p->>'overage_mode';
  v_price    NUMERIC;
  v_active   BOOLEAN := COALESCE((p->>'is_active')::boolean, true);
  v_benefits JSONB := p->'benefits';
  v_line     JSONB;
  v_key      TEXT;
  v_kind     TEXT;
  v_seen     TEXT[] := '{}';
BEGIN
  IF char_length(v_name) NOT BETWEEN 2 AND 60 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_name');
  END IF;
  IF v_tier IS NULL OR v_tier NOT IN ('basic', 'standard', 'premium') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_tier');
  END IF;
  IF v_overage IS NULL OR v_overage NOT IN ('block', 'credits') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_overage');
  END IF;
  IF jsonb_typeof(p->'monthly_price_vnd') IS DISTINCT FROM 'number' OR (p->>'monthly_price_vnd')::numeric < 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;
  v_price := round((p->>'monthly_price_vnd')::numeric);
  IF char_length(COALESCE(v_fit, '')) > 120 OR char_length(COALESCE(v_hl, '')) > 120 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_text');
  END IF;

  IF jsonb_typeof(COALESCE(v_benefits, 'null'::jsonb)) <> 'array' OR jsonb_array_length(v_benefits) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_benefits');
  END IF;
  IF jsonb_array_length(v_benefits) > 30 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_benefit');
  END IF;
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_benefits) LOOP
    v_key := v_line->>'benefit_key';
    SELECT kind INTO v_kind FROM public.owner_sub_benefits WHERE key = v_key;
    IF v_kind IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'unknown_benefit', 'benefit_key', v_key);
    END IF;
    IF v_key = ANY (v_seen) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_benefit', 'benefit_key', v_key);
    END IF;
    v_seen := v_seen || v_key;
    IF v_kind = 'quota' THEN
      IF NOT (jsonb_typeof(v_line->'quota') = 'null' OR v_line->'quota' IS NULL
              OR (jsonb_typeof(v_line->'quota') = 'number' AND (v_line->>'quota')::numeric > 0
                  AND (v_line->>'quota')::numeric = floor((v_line->>'quota')::numeric)
                  AND (v_line->>'quota')::numeric <= 2000000000))
         OR COALESCE(v_line->>'cycle', '') NOT IN ('day', 'week', 'month', 'quarter', 'year', 'term') THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_benefit', 'benefit_key', v_key);
      END IF;
    ELSE
      IF jsonb_typeof(v_line->'quota') IS DISTINCT FROM 'number' OR (v_line->>'quota')::numeric <= 0
         OR (v_line->>'quota')::numeric <> floor((v_line->>'quota')::numeric)
         OR (v_line->>'quota')::numeric > 2000000000 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_benefit', 'benefit_key', v_key);
      END IF;
    END IF;
  END LOOP;

  IF v_id IS NULL THEN
    INSERT INTO public.owner_subscription_plans
      (package_id, name, fit_line, highlight_line, tier, monthly_price_vnd, overage_mode,
       is_active, sort_order, created_by, updated_by)
    VALUES (p_package_id, v_name, v_fit, v_hl, v_tier, v_price, v_overage, v_active,
            COALESCE(p_sort_order, 0), p_uid, p_uid)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.owner_subscription_plans
       SET name = v_name, fit_line = v_fit, highlight_line = v_hl, tier = v_tier,
           monthly_price_vnd = v_price, overage_mode = v_overage, is_active = v_active,
           sort_order = COALESCE(p_sort_order, sort_order), updated_by = p_uid
     WHERE id = v_id AND package_id = p_package_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  END IF;

  DELETE FROM public.owner_subscription_plan_entitlements WHERE plan_id = v_id;
  INSERT INTO public.owner_subscription_plan_entitlements (plan_id, benefit_key, quota, cycle, sort_order)
  SELECT v_id, e->>'benefit_key',
         CASE WHEN jsonb_typeof(e->'quota') = 'number' THEN (e->>'quota')::int END,
         CASE WHEN b.kind = 'quota' THEN e->>'cycle' END,
         ord::int
    FROM jsonb_array_elements(v_benefits) WITH ORDINALITY AS t(e, ord)
    JOIN public.owner_sub_benefits b ON b.key = e->>'benefit_key';

  -- Gói ngừng bán không còn là "Phổ biến".
  IF NOT v_active THEN
    UPDATE public.owner_sub_packages SET featured_plan_id = NULL
     WHERE id = p_package_id AND featured_plan_id = v_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'plan_id', v_id, 'created', p_plan_id IS NULL);
END;
$$;
REVOKE ALL ON FUNCTION public._owner_sub_plan_write(UUID, UUID, JSONB, INTEGER, UUID) FROM PUBLIC, anon, authenticated;

-- Lưu một gói trong bộ đã có (trang Sửa gói). Gói mới xếp cuối bộ.
CREATE OR REPLACE FUNCTION public.admin_owner_sub_plan_save(p_package_id UUID, p_plan_id UUID, p_plan JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sort INTEGER;
BEGIN
  IF NOT public.admin_has_permission('goi-thue-bao', CASE WHEN p_plan_id IS NULL THEN 'create' ELSE 'update' END) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  PERFORM 1 FROM public.owner_sub_packages WHERE id = p_package_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF p_plan_id IS NULL THEN
    SELECT COALESCE(max(sort_order), 0) + 1 INTO v_sort FROM public.owner_subscription_plans WHERE package_id = p_package_id;
  END IF;
  UPDATE public.owner_sub_packages SET updated_by = auth.uid() WHERE id = p_package_id;
  RETURN public._owner_sub_plan_write(p_plan_id, p_package_id, p_plan, v_sort, auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.admin_owner_sub_plan_save(UUID, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_owner_sub_plan_save(UUID, UUID, JSONB) TO authenticated;

-- ─── 9. Lưu bộ gói ───────────────────────────────────────────────────────────
-- p_plans: mảng theo THỨ TỰ HIỂN THỊ. Phần tử {id} = gói đã có của bộ (chỉ đổi thứ tự —
-- sửa gói đi qua admin_owner_sub_plan_save); phần tử không id = gói MỚI (đủ trường như
-- _owner_sub_plan_write). `featured: true` trên tối đa một phần tử đang bán.
-- Mọi gói đã có của bộ phải có mặt (không xoá gói).
-- p_workspace_ids THAY TOÀN BỘ Trạm của bộ; Trạm đang ở bộ khác được CHUYỂN sang; bộ
-- mặc định không nhận Trạm (Trạm chưa gán tự thuộc bộ mặc định).

CREATE OR REPLACE FUNCTION public.admin_owner_sub_package_save(
  p_package_id UUID, p_name TEXT, p_description TEXT, p_is_active BOOLEAN,
  p_term_ids UUID[], p_workspace_ids UUID[], p_plans JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_id       UUID := p_package_id;
  v_pkg      public.owner_sub_packages%ROWTYPE;
  v_terms    UUID[] := ARRAY(SELECT DISTINCT unnest(COALESCE(p_term_ids, '{}'::uuid[])));
  v_ws       UUID[] := ARRAY(SELECT DISTINCT unnest(COALESCE(p_workspace_ids, '{}'::uuid[])));
  v_name     TEXT := btrim(COALESCE(p_name, ''));
  v_desc     TEXT := NULLIF(btrim(COALESCE(p_description, '')), '');
  v_el       JSONB;
  v_ord      INTEGER;
  v_plan_id  UUID;
  v_res      JSONB;
  v_featured UUID;
  v_n_feat   INTEGER := 0;
  v_ids      UUID[] := '{}';
BEGIN
  IF NOT public.admin_has_permission('goi-thue-bao', CASE WHEN v_id IS NULL THEN 'create' ELSE 'update' END) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF char_length(v_name) NOT BETWEEN 2 AND 60 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_package_name');
  END IF;
  IF char_length(COALESCE(v_desc, '')) > 160 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_text');
  END IF;
  IF jsonb_typeof(COALESCE(p_plans, 'null'::jsonb)) <> 'array' OR jsonb_array_length(p_plans) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_plans');
  END IF;
  IF cardinality(v_terms) = 0
     OR (SELECT count(*) FROM public.owner_sub_term_library WHERE id = ANY (v_terms)) <> cardinality(v_terms) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_terms');
  END IF;
  IF (SELECT count(DISTINCT months) FROM public.owner_sub_term_library WHERE id = ANY (v_terms)) <> cardinality(v_terms) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_term_months');
  END IF;
  IF (SELECT count(*) FROM public.asset_owner_workspaces WHERE id = ANY (v_ws)) <> cardinality(v_ws) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'workspace_not_found');
  END IF;

  IF v_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_plans) e WHERE e ? 'id' AND jsonb_typeof(e->'id') = 'string') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
    END IF;
    INSERT INTO public.owner_sub_packages (name, description, is_active, created_by, updated_by)
    VALUES (v_name, v_desc, COALESCE(p_is_active, true), v_uid, v_uid)
    RETURNING * INTO v_pkg;
    v_id := v_pkg.id;
  ELSE
    SELECT * INTO v_pkg FROM public.owner_sub_packages WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
    IF v_pkg.is_default AND NOT COALESCE(p_is_active, true) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'default_package_active');
    END IF;
    -- Mọi gói đã có của bộ phải có mặt, và không trỏ tới gói của bộ khác.
    IF EXISTS (SELECT 1 FROM public.owner_subscription_plans p
                WHERE p.package_id = v_id
                  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_plans) e WHERE e->>'id' = p.id::text))
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_plans) e
                   WHERE jsonb_typeof(e->'id') = 'string'
                     AND NOT EXISTS (SELECT 1 FROM public.owner_subscription_plans p
                                      WHERE p.id::text = e->>'id' AND p.package_id = v_id)) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'plans_changed');
    END IF;
    UPDATE public.owner_sub_packages
       SET name = v_name, description = v_desc, is_active = COALESCE(p_is_active, true), updated_by = v_uid
     WHERE id = v_id;
  END IF;

  -- Gói: tạo mới / xếp thứ tự, theo thứ tự mảng.
  FOR v_el, v_ord IN SELECT e, o::int FROM jsonb_array_elements(p_plans) WITH ORDINALITY AS t(e, o) LOOP
    IF jsonb_typeof(v_el->'id') = 'string' THEN
      v_plan_id := (v_el->>'id')::uuid;
      UPDATE public.owner_subscription_plans SET sort_order = v_ord, updated_by = v_uid
       WHERE id = v_plan_id AND sort_order IS DISTINCT FROM v_ord;
    ELSE
      v_res := public._owner_sub_plan_write(NULL, v_id, v_el, v_ord, v_uid);
      IF NOT (v_res->>'ok')::boolean THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'owner_sub_plan_invalid', DETAIL = v_res::text;
      END IF;
      v_plan_id := (v_res->>'plan_id')::uuid;
    END IF;
    IF v_plan_id = ANY (v_ids) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'owner_sub_plan_invalid',
        DETAIL = jsonb_build_object('ok', false, 'reason', 'plans_changed')::text;
    END IF;
    v_ids := v_ids || v_plan_id;
    IF COALESCE((v_el->>'featured')::boolean, false) THEN
      v_n_feat := v_n_feat + 1;
      v_featured := v_plan_id;
    END IF;
  END LOOP;
  IF v_n_feat > 1 OR (v_featured IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.owner_subscription_plans WHERE id = v_featured AND is_active)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'owner_sub_plan_invalid',
      DETAIL = jsonb_build_object('ok', false, 'reason', 'invalid_featured')::text;
  END IF;
  UPDATE public.owner_sub_packages SET featured_plan_id = v_featured WHERE id = v_id;

  -- Kỳ mua.
  DELETE FROM public.owner_sub_package_terms WHERE package_id = v_id AND NOT (term_id = ANY (v_terms));
  INSERT INTO public.owner_sub_package_terms (package_id, term_id)
  SELECT v_id, t FROM unnest(v_terms) t
  ON CONFLICT DO NOTHING;

  -- Trạm (bộ mặc định không giữ danh sách).
  IF v_pkg.is_default THEN
    IF cardinality(v_ws) > 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'owner_sub_plan_invalid',
        DETAIL = jsonb_build_object('ok', false, 'reason', 'default_package_workspaces')::text;
    END IF;
  ELSE
    DELETE FROM public.owner_sub_package_workspaces WHERE package_id = v_id AND NOT (workspace_id = ANY (v_ws));
    INSERT INTO public.owner_sub_package_workspaces (workspace_id, package_id, added_by)
    SELECT w, v_id, v_uid FROM unnest(v_ws) w
    ON CONFLICT (workspace_id) DO UPDATE
      SET package_id = EXCLUDED.package_id, added_by = EXCLUDED.added_by, added_at = now()
      WHERE owner_sub_package_workspaces.package_id IS DISTINCT FROM EXCLUDED.package_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'package_id', v_id, 'created', p_package_id IS NULL);
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM = 'owner_sub_plan_invalid' THEN
      DECLARE v_detail TEXT;
      BEGIN
        GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
        RETURN v_detail::jsonb;
      END;
    END IF;
    RAISE;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_owner_sub_package_save(UUID, TEXT, TEXT, BOOLEAN, UUID[], UUID[], JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_owner_sub_package_save(UUID, TEXT, TEXT, BOOLEAN, UUID[], UUID[], JSONB) TO authenticated;

-- ─── 10. Thư viện kỳ mua ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_owner_sub_term_save(
  p_term_id UUID, p_months INTEGER, p_discount_pct NUMERIC, p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id   UUID := p_term_id;
  v_note TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF NOT public.admin_has_permission('goi-thue-bao', CASE WHEN v_id IS NULL THEN 'create' ELSE 'update' END) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF p_months IS NULL OR p_months NOT BETWEEN 1 AND 36
     OR p_discount_pct IS NULL OR p_discount_pct NOT BETWEEN 0 AND 50 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_term');
  END IF;
  IF char_length(COALESCE(v_note, '')) > 120 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_text');
  END IF;
  IF EXISTS (SELECT 1 FROM public.owner_sub_term_library
              WHERE months = p_months AND discount_pct = round(p_discount_pct, 2) AND id IS DISTINCT FROM v_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_term');
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.owner_sub_term_library (months, discount_pct, note, updated_by)
    VALUES (p_months, p_discount_pct, v_note, auth.uid())
    RETURNING id INTO v_id;
  ELSE
    PERFORM 1 FROM public.owner_sub_term_library WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
    -- Đổi số tháng không được làm một bộ có hai kỳ trùng số tháng.
    IF EXISTS (SELECT 1
                 FROM public.owner_sub_package_terms mine
                 JOIN public.owner_sub_package_terms other
                   ON other.package_id = mine.package_id AND other.term_id <> mine.term_id
                 JOIN public.owner_sub_term_library t ON t.id = other.term_id
                WHERE mine.term_id = v_id AND t.months = p_months) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'term_months_conflict');
    END IF;
    UPDATE public.owner_sub_term_library
       SET months = p_months, discount_pct = p_discount_pct, note = v_note, updated_by = auth.uid()
     WHERE id = v_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'term_id', v_id, 'created', p_term_id IS NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_owner_sub_term_save(UUID, INTEGER, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_owner_sub_term_save(UUID, INTEGER, NUMERIC, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_owner_sub_term_delete(p_term_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_has_permission('goi-thue-bao', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF EXISTS (SELECT 1 FROM public.owner_sub_package_terms WHERE term_id = p_term_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'term_in_use');
  END IF;
  DELETE FROM public.owner_sub_term_library WHERE id = p_term_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_owner_sub_term_delete(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_owner_sub_term_delete(UUID) TO authenticated;

-- ─── 11. Danh sách Trạm của admin: bộ gói thay cho "gói được mở" ──────────────

DROP FUNCTION public.admin_owner_subscription_list();
CREATE FUNCTION public.admin_owner_subscription_list()
RETURNS TABLE(workspace_id uuid, workspace_name text, match_scope text, parent_name text, owner_name text,
              owner_email text, member_count integer, workspace_created_at timestamp with time zone,
              subscription_id uuid, code text, plan_name text, status text, starts_on date, ends_on date,
              price_vnd numeric, term_months integer, overage_mode text, plan_id uuid,
              assigned_package_id uuid, package_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_default UUID := (SELECT id FROM public.owner_sub_packages WHERE is_default);
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
         s.starts_on, s.ends_on, s.price_vnd, s.term_months, s.overage_mode,
         s.plan_id,
         a.package_id,
         COALESCE(a.package_id, v_default)
    FROM public.asset_owner_workspaces w
    LEFT JOIN public.asset_owner_workspaces pw ON pw.id = w.parent_workspace_id
    LEFT JOIN public.profiles p ON p.id = w.owner_user_id
    LEFT JOIN public.owner_subscriptions s ON s.workspace_id = w.id
    LEFT JOIN public.owner_sub_package_workspaces a ON a.workspace_id = w.id
   ORDER BY (s.id IS NULL), w.primary_name;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_owner_subscription_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_owner_subscription_list() TO authenticated;

-- ─── 12. Bỏ RPC admin của mô hình cũ ─────────────────────────────────────────

DROP FUNCTION public.admin_owner_sub_plan_upsert(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, BOOLEAN, BOOLEAN, INTEGER, JSONB);
DROP FUNCTION public.admin_owner_sub_plan_set_workspaces(UUID, UUID[]);
DROP FUNCTION public.admin_owner_sub_term_options_set(JSONB);
