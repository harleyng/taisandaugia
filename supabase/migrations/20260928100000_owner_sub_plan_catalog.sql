-- Danh mục gói dịch vụ cho tổ chức chủ tài sản (2026-09-28).
--
-- Trước đây mỗi Trạm có đúng MỘT gói do admin cấu hình riêng (20260927200000). Nay thêm
-- DANH MỤC gói công khai (Cơ bản / Tiêu chuẩn / Chuyên nghiệp…) để Trưởng đơn vị tự đăng
-- ký / nâng cấp / chuyển gói, chọn kỳ 3 / 6 / 12 tháng có chiết khấu. Gói riêng của admin
-- vẫn giữ nguyên (owner_subscriptions.plan_id IS NULL).
--
-- Luật (người dùng chốt 2026-09-28):
--   • Gói danh mục chỉ TIÊU hạn mức ở các tính năng đã hỗ trợ (owner_sub_supported_variants).
--     `benefits` là dòng quyền lợi admin tự nhập, CHỈ ĐỂ HIỂN THỊ — hệ thống không kiểm.
--   • Đổi sang gói KHÁC khi gói đang hiệu lực ⇒ trả tiền ngay, gói mới áp dụng TỪ KỲ KẾ
--     TIẾP (ends_on + 1). Chỉ một lần đổi gói chờ áp dụng tại một thời điểm.
--   • Mua lại CÙNG gói ⇒ nối kỳ; hạn mức cập nhật ngay theo cấu hình gói hiện hành.
--   • Chưa có gói / hết hạn / chờ thanh toán / nháp / đã huỷ ⇒ gói mới hiệu lực HÔM NAY,
--     thay cấu hình cũ (sự kiện ghi lại cấu hình bị thay).
--   • Chuyển gói chờ áp dụng được "cuộn" LƯỜI (_owner_sub_roll) ở mọi điểm đọc/tiêu hạn
--     mức — không cần cron.
--   • Giá kỳ = giá tháng × số tháng × (1 − chiết khấu), làm tròn nghìn đồng. Bản sao TS:
--     planTermPrice (src/lib/ownerSubscription/catalog.ts).

-- ─── 1. Bảng danh mục ─────────────────────────────────────────────────────────

CREATE TABLE public.owner_subscription_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 60),
  fit_line          TEXT CHECK (fit_line IS NULL OR char_length(fit_line) <= 120),
  highlight_line    TEXT CHECK (highlight_line IS NULL OR char_length(highlight_line) <= 120),
  tier              TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('basic', 'standard', 'premium')),
  monthly_price_vnd NUMERIC(14,0) NOT NULL CHECK (monthly_price_vnd >= 0),
  overage_mode      TEXT NOT NULL DEFAULT 'credits' CHECK (overage_mode IN ('block', 'credits')),
  is_featured       BOOLEAN NOT NULL DEFAULT false,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  -- [{group, label, value}] — quyền lợi hiển thị, KHÔNG được hệ thống kiểm.
  benefits          JSONB NOT NULL DEFAULT '[]'::jsonb
                    CHECK (jsonb_typeof(benefits) = 'array' AND jsonb_array_length(benefits) <= 20),
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Nhiều nhất một gói "Phổ biến nhất".
CREATE UNIQUE INDEX owner_sub_plans_one_featured ON public.owner_subscription_plans ((true)) WHERE is_featured;
CREATE TRIGGER owner_subscription_plans_updated_at BEFORE UPDATE ON public.owner_subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.owner_subscription_plan_entitlements (
  plan_id       UUID NOT NULL REFERENCES public.owner_subscription_plans(id) ON DELETE CASCADE,
  variant_key   TEXT NOT NULL REFERENCES public.service_variants(variant_key) ON DELETE RESTRICT,
  -- NULL = không giới hạn.
  monthly_quota INTEGER CHECK (monthly_quota IS NULL OR monthly_quota > 0),
  PRIMARY KEY (plan_id, variant_key),
  CONSTRAINT owner_sub_plan_ent_supported CHECK (variant_key = ANY (public.owner_sub_supported_variants()))
);

CREATE TABLE public.owner_subscription_term_options (
  months       INTEGER PRIMARY KEY CHECK (months BETWEEN 1 AND 36),
  discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 50),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  updated_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. Gói của Trạm: gắn gói danh mục + ô "đổi gói chờ áp dụng" ────────────

ALTER TABLE public.owner_subscriptions
  ADD COLUMN plan_id           UUID REFERENCES public.owner_subscription_plans(id) ON DELETE SET NULL,
  ADD COLUMN pending_plan_id   UUID REFERENCES public.owner_subscription_plans(id) ON DELETE SET NULL,
  ADD COLUMN pending_from      DATE,
  ADD COLUMN pending_months    INTEGER,
  ADD COLUMN pending_price_vnd NUMERIC(14,0),
  -- {plan_id, name, tier, overage_mode, entitlements:[{variant_key, monthly_quota}]}
  ADD COLUMN pending_snapshot  JSONB,
  ADD CONSTRAINT owner_sub_pending_complete CHECK (
    (pending_from IS NULL) = (pending_snapshot IS NULL)
    AND (pending_from IS NULL) = (pending_months IS NULL)
    AND (pending_from IS NULL) = (pending_price_vnd IS NULL));

ALTER TABLE public.owner_subscription_terms
  ADD COLUMN plan_id UUID REFERENCES public.owner_subscription_plans(id) ON DELETE SET NULL;

ALTER TABLE public.owner_subscription_events DROP CONSTRAINT owner_subscription_events_event_type_check;
ALTER TABLE public.owner_subscription_events ADD CONSTRAINT owner_subscription_events_event_type_check
  CHECK (event_type IN ('created', 'settings_updated', 'offered', 'unpublished', 'cancelled',
                        'activated_manual', 'paid_online',
                        'plan_purchased', 'plan_scheduled', 'plan_switched'));

-- ─── 3. RLS: danh mục đọc được bởi mọi người đăng nhập; ghi qua RPC ─────────

ALTER TABLE public.owner_subscription_plans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_subscription_plan_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_subscription_term_options      ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_sub_plans_read ON public.owner_subscription_plans
  FOR SELECT TO authenticated
  USING (is_active OR public.admin_has_permission('goi-thue-bao', 'view'));
CREATE POLICY owner_sub_plan_ent_read ON public.owner_subscription_plan_entitlements
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.owner_subscription_plans p WHERE p.id = plan_id));
CREATE POLICY owner_sub_term_options_read ON public.owner_subscription_term_options
  FOR SELECT TO authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.owner_subscription_plans,
  public.owner_subscription_plan_entitlements, public.owner_subscription_term_options
  FROM authenticated, anon;

-- ─── 4. Tiện ích ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_sub_plan_price(p_monthly NUMERIC, p_months INTEGER, p_discount_pct NUMERIC)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE
AS $$ SELECT round(p_monthly * p_months * (1 - COALESCE(p_discount_pct, 0) / 100) / 1000) * 1000 $$;

CREATE OR REPLACE FUNCTION public._owner_sub_plan_snapshot(p_plan_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'plan_id', p.id, 'name', p.name, 'tier', p.tier, 'overage_mode', p.overage_mode,
    'entitlements', (SELECT COALESCE(jsonb_agg(jsonb_build_object('variant_key', e.variant_key,
                              'monthly_quota', e.monthly_quota) ORDER BY e.variant_key), '[]'::jsonb)
                       FROM public.owner_subscription_plan_entitlements e WHERE e.plan_id = p.id))
    FROM public.owner_subscription_plans p WHERE p.id = p_plan_id
$$;
REVOKE ALL ON FUNCTION public._owner_sub_plan_snapshot(UUID) FROM PUBLIC, anon, authenticated;

-- Thay TOÀN BỘ hạn mức đang chạy của gói bằng danh sách trong snapshot.
CREATE OR REPLACE FUNCTION public._owner_sub_set_entitlements(p_sub_id UUID, p_entitlements JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.owner_subscription_entitlements WHERE subscription_id = p_sub_id;
  INSERT INTO public.owner_subscription_entitlements (subscription_id, variant_key, monthly_quota)
  SELECT p_sub_id, e->>'variant_key',
         CASE WHEN jsonb_typeof(e->'monthly_quota') = 'number' THEN (e->>'monthly_quota')::int END
    FROM jsonb_array_elements(COALESCE(p_entitlements, '[]'::jsonb)) e;
END;
$$;
REVOKE ALL ON FUNCTION public._owner_sub_set_entitlements(UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- Áp "đổi gói chờ áp dụng" khi tới ngày. Idempotent; không đổi trạng thái / ngày hiệu lực.
CREATE OR REPLACE FUNCTION public._owner_sub_roll(p_sub_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub  public.owner_subscriptions%ROWTYPE;
  v_snap JSONB;
BEGIN
  -- Kiểm không khoá trước: đa số lượt gọi không có gì để cuộn.
  IF NOT EXISTS (SELECT 1 FROM public.owner_subscriptions
                  WHERE id = p_sub_id AND pending_from IS NOT NULL
                    AND pending_from <= public.contract_today()) THEN
    RETURN;
  END IF;
  SELECT * INTO v_sub FROM public.owner_subscriptions WHERE id = p_sub_id FOR UPDATE;
  IF v_sub.pending_from IS NULL OR v_sub.pending_from > public.contract_today() THEN
    RETURN;
  END IF;
  v_snap := v_sub.pending_snapshot;

  PERFORM public._owner_sub_set_entitlements(v_sub.id, v_snap->'entitlements');
  UPDATE public.owner_subscriptions
     SET plan_id = v_sub.pending_plan_id,
         plan_name = v_snap->>'name',
         overage_mode = v_snap->>'overage_mode',
         price_vnd = v_sub.pending_price_vnd,
         term_months = v_sub.pending_months,
         pending_plan_id = NULL, pending_from = NULL, pending_months = NULL,
         pending_price_vnd = NULL, pending_snapshot = NULL
   WHERE id = v_sub.id;

  INSERT INTO public.owner_subscription_events (subscription_id, event_type, actor_id, payload)
  VALUES (v_sub.id, 'plan_switched', NULL,
          jsonb_build_object('from', jsonb_build_object('plan_id', v_sub.plan_id, 'plan_name', v_sub.plan_name),
                             'to', v_snap, 'effective_on', v_sub.pending_from));
END;
$$;
REVOKE ALL ON FUNCTION public._owner_sub_roll(UUID) FROM PUBLIC, anon, authenticated;

-- ─── 5. Nối _owner_sub_roll vào điểm tiêu hạn mức + điểm đọc ────────────────
-- Thân hàm giữ nguyên bản 20260927200000, chỉ thêm lượt cuộn ở đầu.

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

  PERFORM public._owner_sub_roll(s.id) FROM public.owner_subscriptions s WHERE s.workspace_id = p_workspace_id;

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
REVOKE ALL ON FUNCTION public._owner_sub_consume(UUID, TEXT, INTEGER, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- VOLATILE (trước là STABLE) vì có thể cuộn đổi gói. Thêm plan_id / plan_tier / pending.
CREATE OR REPLACE FUNCTION public.owner_subscription_status(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_admin  BOOLEAN := public.admin_has_permission('goi-thue-bao', 'view');
  v_sub    public.owner_subscriptions%ROWTYPE;
  v_ws     TEXT;
  v_eff    TEXT;
  v_member BOOLEAN;
  v_owner  BOOLEAN;
  v_tier   TEXT;
BEGIN
  IF v_uid IS NULL OR NOT (public.owner_ws_can(p_workspace_id, 'read') OR v_admin) THEN
    RETURN NULL;
  END IF;
  PERFORM public._owner_sub_roll(s.id) FROM public.owner_subscriptions s WHERE s.workspace_id = p_workspace_id;
  SELECT * INTO v_sub FROM public.owner_subscriptions WHERE workspace_id = p_workspace_id;
  IF NOT FOUND OR (v_sub.status = 'draft' AND NOT v_admin) THEN
    RETURN NULL;
  END IF;

  SELECT primary_name INTO v_ws FROM public.asset_owner_workspaces WHERE id = p_workspace_id;
  SELECT tier INTO v_tier FROM public.owner_subscription_plans WHERE id = v_sub.plan_id;
  v_eff := public.owner_sub_effective_status(v_sub.status, v_sub.starts_on, v_sub.ends_on);
  v_member := EXISTS (SELECT 1 FROM public.asset_owner_workspace_members m
                       WHERE m.workspace_id = p_workspace_id AND m.user_id = v_uid AND m.status = 'active');
  v_owner := public.owner_ws_user_is_owner(p_workspace_id, v_uid);

  RETURN jsonb_build_object(
    'id', v_sub.id, 'code', v_sub.code, 'workspace_id', p_workspace_id, 'workspace_name', v_ws,
    'plan_name', v_sub.plan_name, 'plan_id', v_sub.plan_id, 'plan_tier', v_tier,
    'status', v_eff, 'starts_on', v_sub.starts_on, 'ends_on', v_sub.ends_on,
    'term_months', v_sub.term_months, 'price_vnd', v_sub.price_vnd, 'overage_mode', v_sub.overage_mode,
    'period_month', public.owner_sub_month(),
    'next_reset_on', (public.owner_sub_month() + interval '1 month')::date,
    'covered_for_me', v_member AND v_eff = 'active',
    'can_pay', v_owner AND v_eff IN ('offered', 'active', 'expired', 'scheduled') AND v_sub.price_vnd > 0,
    'is_owner', v_owner,
    'pending', CASE WHEN v_sub.pending_from IS NULL THEN NULL ELSE jsonb_build_object(
                 'plan_id', v_sub.pending_plan_id, 'plan_name', v_sub.pending_snapshot->>'name',
                 'tier', v_sub.pending_snapshot->>'tier', 'from', v_sub.pending_from,
                 'months', v_sub.pending_months, 'price_vnd', v_sub.pending_price_vnd) END,
    'lines', public._owner_sub_lines(v_sub.id));
END;
$$;
REVOKE ALL ON FUNCTION public.owner_subscription_status(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_subscription_status(UUID) TO authenticated;

-- ─── 6. Báo giá + thanh toán gói danh mục ────────────────────────────────────

-- Đánh giá một lượt mua (dùng chung cho báo giá và thanh toán). Không ghi gì.
CREATE OR REPLACE FUNCTION public._owner_sub_plan_eval(
  p_workspace_id UUID, p_plan_id UUID, p_months INTEGER, p_uid UUID
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws     TEXT;
  v_plan   public.owner_subscription_plans%ROWTYPE;
  v_term   public.owner_subscription_term_options%ROWTYPE;
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
  SELECT * INTO v_plan FROM public.owner_subscription_plans WHERE id = p_plan_id;
  IF NOT FOUND OR NOT v_plan.is_active THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'plan_inactive');
  END IF;
  SELECT * INTO v_term FROM public.owner_subscription_term_options WHERE months = p_months AND is_active;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_term'); END IF;

  v_amount := public.owner_sub_plan_price(v_plan.monthly_price_vnd, p_months, v_term.discount_pct);
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
    'months', p_months, 'discount_pct', v_term.discount_pct,
    'monthly_price_vnd', v_plan.monthly_price_vnd, 'amount_vnd', v_amount,
    'effect', v_effect, 'starts_on', v_start, 'ends_on', public.owner_sub_term_end(v_start, p_months),
    'subscription_id', CASE WHEN v_has THEN v_sub.id END,
    'current_plan_name', CASE WHEN v_has THEN v_sub.plan_name END,
    'can_pay', v_reason IS NULL, 'reason', v_reason);
END;
$$;
REVOKE ALL ON FUNCTION public._owner_sub_plan_eval(UUID, UUID, INTEGER, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_sub_plan_quote(p_workspace_id UUID, p_plan_id UUID, p_months INTEGER)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.owner_ws_can(p_workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  PERFORM public._owner_sub_roll(s.id) FROM public.owner_subscriptions s WHERE s.workspace_id = p_workspace_id;
  RETURN public._owner_sub_plan_eval(p_workspace_id, p_plan_id, p_months, auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.owner_sub_plan_quote(UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_sub_plan_quote(UUID, UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public._settle_owner_sub_plan(
  p_workspace_id UUID, p_plan_id UUID, p_months INTEGER, p_txn_ref TEXT,
  p_expected_amount NUMERIC, p_uid UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_txn    TEXT := btrim(COALESCE(p_txn_ref, ''));
  v_ws     TEXT;
  v_term   public.owner_subscription_terms%ROWTYPE;
  v_sub    public.owner_subscriptions%ROWTYPE;
  v_has    BOOLEAN;
  v_eval   JSONB;
  v_snap   JSONB;
  v_amount NUMERIC;
  v_effect TEXT;
  v_start  DATE;
  v_end    DATE;
  v_claim  TEXT;
  v_order  UUID;
  v_res    JSONB;
  v_before JSONB;
  v_term_id UUID;
BEGIN
  IF p_uid IS NULL OR v_txn = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_txn');
  END IF;
  SELECT primary_name INTO v_ws FROM public.asset_owner_workspaces WHERE id = p_workspace_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;

  PERFORM public._owner_sub_roll(s.id) FROM public.owner_subscriptions s WHERE s.workspace_id = p_workspace_id;
  SELECT * INTO v_sub FROM public.owner_subscriptions WHERE workspace_id = p_workspace_id FOR UPDATE;
  v_has := FOUND;

  -- F5 / quay lại trang kết quả: cùng mã giao dịch ⇒ báo đã trả, không làm gì.
  SELECT * INTO v_term FROM public.owner_subscription_terms WHERE payment_txn_ref = v_txn;
  IF FOUND THEN
    IF v_term.workspace_id <> p_workspace_id THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'txn_used');
    END IF;
    RETURN jsonb_build_object('ok', true, 'status', 'already_paid', 'code', v_sub.code,
                              'workspace_id', p_workspace_id, 'workspace_name', v_ws,
                              'plan_name', (SELECT name FROM public.owner_subscription_plans WHERE id = v_term.plan_id),
                              'effect', CASE WHEN v_sub.pending_from = v_term.starts_on THEN 'next_term' ELSE 'now' END,
                              'starts_on', v_term.starts_on, 'ends_on', v_term.ends_on);
  END IF;

  v_eval := public._owner_sub_plan_eval(p_workspace_id, p_plan_id, p_months, p_uid);
  IF NOT (v_eval->>'ok')::boolean THEN RETURN v_eval; END IF;
  IF NOT (v_eval->>'can_pay')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_eval->>'reason');
  END IF;
  v_amount := (v_eval->>'amount_vnd')::numeric;
  IF p_expected_amount IS DISTINCT FROM v_amount THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quote_changed');
  END IF;

  INSERT INTO public.payment_claims (txn_ref, user_id, variant_key, unlock_param)
  VALUES (v_txn, p_uid, 'owner_subscription', 'owner_sub_plan:' || p_workspace_id || ':' || p_plan_id)
  ON CONFLICT (txn_ref) DO NOTHING
  RETURNING txn_ref INTO v_claim;
  IF v_claim IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'txn_used');
  END IF;

  v_snap := public._owner_sub_plan_snapshot(p_plan_id);
  v_effect := v_eval->>'effect';
  v_start := (v_eval->>'starts_on')::date;

  IF NOT v_has THEN
    INSERT INTO public.owner_subscriptions
      (workspace_id, plan_name, price_vnd, term_months, overage_mode, plan_id, created_by, updated_by)
    VALUES (p_workspace_id, v_snap->>'name', v_amount, p_months, v_snap->>'overage_mode', p_plan_id, p_uid, p_uid)
    RETURNING * INTO v_sub;
    INSERT INTO public.owner_subscription_events (subscription_id, event_type, actor_id, payload)
    VALUES (v_sub.id, 'created', p_uid, jsonb_build_object('source', 'plan_catalog', 'plan_id', p_plan_id));
  END IF;

  v_order := public._owner_sub_order(
    v_sub, p_uid, v_amount, now(),
    'Gói dịch vụ ' || (v_snap->>'name') || ' · ' || v_sub.code || ' · ' || v_ws || ' · ' || p_months
      || ' tháng (VNPay' || CASE WHEN v_effect = 'next_term' THEN ', áp dụng từ kỳ sau' ELSE '' END || ')',
    p_uid);

  IF v_effect = 'next_term' THEN
    -- Kỳ mới nối sau kỳ đang chạy, chụp cấu hình GÓI MỚI; hạn mức đổi khi tới pending_from.
    v_end := public.owner_sub_term_end(v_start, p_months);
    INSERT INTO public.owner_subscription_terms
      (subscription_id, workspace_id, starts_on, ends_on, months, amount_vnd, source, method,
       payment_txn_ref, order_id, paid_on, entitlements_snapshot, overage_mode_snapshot,
       price_snapshot, plan_id, created_by)
    VALUES (v_sub.id, p_workspace_id, v_start, v_end, p_months, v_amount, 'vnpay', NULL,
            v_txn, v_order, public.contract_today(), v_snap->'entitlements', v_snap->>'overage_mode',
            v_amount, p_plan_id, p_uid)
    RETURNING id INTO v_term_id;
    UPDATE public.owner_subscriptions
       SET ends_on = v_end, pending_plan_id = p_plan_id, pending_from = v_start,
           pending_months = p_months, pending_price_vnd = v_amount, pending_snapshot = v_snap,
           updated_by = p_uid
     WHERE id = v_sub.id;
    v_res := jsonb_build_object('term_id', v_term_id, 'starts_on', v_start, 'ends_on', v_end);
  ELSE
    -- Hiệu lực ngay (now) hoặc nối kỳ cùng gói (extend): chép cấu hình gói vào hạn mức
    -- đang chạy rồi ghi kỳ như luồng cũ.
    v_before := jsonb_build_object(
      'plan_id', v_sub.plan_id, 'plan_name', v_sub.plan_name, 'status', v_sub.status,
      'price_vnd', v_sub.price_vnd, 'term_months', v_sub.term_months, 'overage_mode', v_sub.overage_mode,
      'entitlements', (SELECT COALESCE(jsonb_agg(jsonb_build_object('variant_key', e.variant_key,
                                        'monthly_quota', e.monthly_quota) ORDER BY e.variant_key), '[]'::jsonb)
                         FROM public.owner_subscription_entitlements e WHERE e.subscription_id = v_sub.id));
    PERFORM public._owner_sub_set_entitlements(v_sub.id, v_snap->'entitlements');
    UPDATE public.owner_subscriptions
       SET plan_id = p_plan_id, plan_name = v_snap->>'name', overage_mode = v_snap->>'overage_mode',
           price_vnd = v_amount, term_months = p_months, updated_by = p_uid
     WHERE id = v_sub.id
    RETURNING * INTO v_sub;
    v_res := public._owner_sub_apply_term(v_sub, v_start, p_months, v_amount, 'vnpay', NULL, v_txn,
                                          v_order, public.contract_today(), NULL, p_uid);
    UPDATE public.owner_subscription_terms SET plan_id = p_plan_id WHERE id = (v_res->>'term_id')::uuid;
  END IF;

  INSERT INTO public.owner_subscription_events (subscription_id, event_type, actor_id, payload)
  VALUES (v_sub.id, CASE WHEN v_effect = 'next_term' THEN 'plan_scheduled' ELSE 'plan_purchased' END, p_uid,
          v_res || jsonb_build_object('plan', v_snap, 'effect', v_effect, 'months', p_months,
                                      'amount_vnd', v_amount, 'order_id', v_order, 'txn_ref', v_txn,
                                      'replaced', v_before));

  RETURN jsonb_build_object('ok', true, 'status', 'paid', 'code', v_sub.code,
                            'workspace_id', p_workspace_id, 'workspace_name', v_ws,
                            'plan_name', v_snap->>'name', 'effect', v_effect, 'order_id', v_order) || v_res;
END;
$$;
REVOKE ALL ON FUNCTION public._settle_owner_sub_plan(UUID, UUID, INTEGER, TEXT, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;

-- ⚠️ MÔ PHỎNG: Trưởng đơn vị tự báo "đã thanh toán". Xoá khi có IPN VNPay thật.
CREATE OR REPLACE FUNCTION public.pay_owner_sub_plan(
  p_workspace_id UUID, p_plan_id UUID, p_months INTEGER, p_txn_ref TEXT, p_expected_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN public._settle_owner_sub_plan(p_workspace_id, p_plan_id, p_months, p_txn_ref, p_expected_amount, auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.pay_owner_sub_plan(UUID, UUID, INTEGER, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_owner_sub_plan(UUID, UUID, INTEGER, TEXT, NUMERIC) TO authenticated;

-- ─── 7. Admin: quản lý danh mục ──────────────────────────────────────────────

-- p_plan_id NULL ⇒ tạo mới. p_entitlements / p_benefits THAY TOÀN BỘ. Sửa danh mục KHÔNG
-- đụng tới gói Trạm đã mua (chúng giữ hạn mức đã chép); áp dụng từ lần mua / gia hạn sau.
CREATE OR REPLACE FUNCTION public.admin_owner_sub_plan_upsert(
  p_plan_id UUID, p_name TEXT, p_fit_line TEXT, p_highlight_line TEXT, p_tier TEXT,
  p_monthly_price_vnd NUMERIC, p_overage_mode TEXT, p_is_featured BOOLEAN, p_is_active BOOLEAN,
  p_sort_order INTEGER, p_entitlements JSONB, p_benefits JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_id   UUID := p_plan_id;
  v_line JSONB;
  v_key  TEXT;
BEGIN
  IF v_id IS NULL AND NOT public.admin_has_permission('goi-thue-bao', 'create') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF v_id IS NOT NULL AND NOT public.admin_has_permission('goi-thue-bao', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF char_length(btrim(COALESCE(p_name, ''))) NOT BETWEEN 2 AND 60 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_name');
  END IF;
  IF p_tier NOT IN ('basic', 'standard', 'premium') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_tier');
  END IF;
  IF p_overage_mode NOT IN ('block', 'credits') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_overage');
  END IF;
  IF p_monthly_price_vnd IS NULL OR p_monthly_price_vnd < 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;
  IF char_length(COALESCE(p_fit_line, '')) > 120 OR char_length(COALESCE(p_highlight_line, '')) > 120 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_text');
  END IF;

  IF jsonb_typeof(COALESCE(p_entitlements, '[]'::jsonb)) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_entitlements');
  END IF;
  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_entitlements, '[]'::jsonb)) LOOP
    v_key := v_line->>'variant_key';
    IF v_key IS NULL OR NOT (v_key = ANY (public.owner_sub_supported_variants())) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'unsupported_variant', 'variant_key', v_key);
    END IF;
    IF jsonb_typeof(v_line->'monthly_quota') = 'number' AND (v_line->>'monthly_quota')::int <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_quota', 'variant_key', v_key);
    END IF;
  END LOOP;

  IF jsonb_typeof(COALESCE(p_benefits, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_benefits, '[]'::jsonb)) > 20 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_benefits');
  END IF;
  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_benefits, '[]'::jsonb)) LOOP
    IF jsonb_typeof(v_line) <> 'object'
       OR char_length(btrim(COALESCE(v_line->>'group', ''))) NOT BETWEEN 1 AND 40
       OR char_length(btrim(COALESCE(v_line->>'label', ''))) NOT BETWEEN 1 AND 80
       OR char_length(btrim(COALESCE(v_line->>'value', ''))) NOT BETWEEN 1 AND 60 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_benefits');
    END IF;
  END LOOP;

  IF COALESCE(p_is_featured, false) THEN
    UPDATE public.owner_subscription_plans SET is_featured = false
     WHERE is_featured AND id IS DISTINCT FROM v_id;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.owner_subscription_plans
      (name, fit_line, highlight_line, tier, monthly_price_vnd, overage_mode, is_featured,
       is_active, sort_order, benefits, created_by, updated_by)
    VALUES (btrim(p_name), NULLIF(btrim(COALESCE(p_fit_line, '')), ''),
            NULLIF(btrim(COALESCE(p_highlight_line, '')), ''), p_tier, p_monthly_price_vnd,
            p_overage_mode, COALESCE(p_is_featured, false), COALESCE(p_is_active, true),
            COALESCE(p_sort_order, 0), COALESCE(p_benefits, '[]'::jsonb), v_uid, v_uid)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.owner_subscription_plans
       SET name = btrim(p_name), fit_line = NULLIF(btrim(COALESCE(p_fit_line, '')), ''),
           highlight_line = NULLIF(btrim(COALESCE(p_highlight_line, '')), ''), tier = p_tier,
           monthly_price_vnd = p_monthly_price_vnd, overage_mode = p_overage_mode,
           is_featured = COALESCE(p_is_featured, false), is_active = COALESCE(p_is_active, true),
           sort_order = COALESCE(p_sort_order, 0), benefits = COALESCE(p_benefits, '[]'::jsonb),
           updated_by = v_uid
     WHERE id = v_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  END IF;

  DELETE FROM public.owner_subscription_plan_entitlements WHERE plan_id = v_id;
  INSERT INTO public.owner_subscription_plan_entitlements (plan_id, variant_key, monthly_quota)
  SELECT v_id, e->>'variant_key',
         CASE WHEN jsonb_typeof(e->'monthly_quota') = 'number' THEN (e->>'monthly_quota')::int END
    FROM jsonb_array_elements(COALESCE(p_entitlements, '[]'::jsonb)) e;

  RETURN jsonb_build_object('ok', true, 'plan_id', v_id, 'created', p_plan_id IS NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_owner_sub_plan_upsert(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, BOOLEAN, BOOLEAN, INTEGER, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_owner_sub_plan_upsert(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, BOOLEAN, BOOLEAN, INTEGER, JSONB, JSONB) TO authenticated;

-- p_options: [{months, discount_pct, is_active}] — THAY TOÀN BỘ danh sách kỳ.
CREATE OR REPLACE FUNCTION public.admin_owner_sub_term_options_set(p_options JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_line JSONB;
BEGIN
  IF NOT public.admin_has_permission('goi-thue-bao', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF jsonb_typeof(COALESCE(p_options, 'null'::jsonb)) <> 'array' OR jsonb_array_length(p_options) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_term');
  END IF;
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_options) LOOP
    IF jsonb_typeof(v_line->'months') <> 'number' OR (v_line->>'months')::int NOT BETWEEN 1 AND 36
       OR jsonb_typeof(v_line->'discount_pct') <> 'number'
       OR (v_line->>'discount_pct')::numeric NOT BETWEEN 0 AND 50 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_term');
    END IF;
  END LOOP;
  IF (SELECT count(DISTINCT (e->>'months')::int) FROM jsonb_array_elements(p_options) e) <> jsonb_array_length(p_options) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_term');
  END IF;

  DELETE FROM public.owner_subscription_term_options
   WHERE months NOT IN (SELECT (e->>'months')::int FROM jsonb_array_elements(p_options) e);
  INSERT INTO public.owner_subscription_term_options (months, discount_pct, is_active, updated_by, updated_at)
  SELECT (e->>'months')::int, (e->>'discount_pct')::numeric, COALESCE((e->>'is_active')::boolean, true),
         auth.uid(), now()
    FROM jsonb_array_elements(p_options) e
  ON CONFLICT (months) DO UPDATE
    SET discount_pct = EXCLUDED.discount_pct, is_active = EXCLUDED.is_active,
        updated_by = EXCLUDED.updated_by, updated_at = now();
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_owner_sub_term_options_set(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_owner_sub_term_options_set(JSONB) TO authenticated;

-- ─── 8. Dữ liệu khởi tạo (giá / quyền lợi theo design — admin sửa được) ──────

INSERT INTO public.owner_subscription_term_options (months, discount_pct) VALUES
  (3, 0), (6, 5), (12, 10)
ON CONFLICT (months) DO NOTHING;

WITH seed(name, fit_line, highlight_line, tier, price, featured, sort_order, scan, rep, benefits) AS (
  VALUES
  ('Cơ bản', 'Ít tài sản, số hoá theo đợt', 'Bắt đầu số hoá và đấu giá', 'basic', 2500000, false, 1, 5, 20,
   '[{"group":"Tài sản","label":"Số hoá hồ sơ","value":"20 hồ sơ / tháng"},
     {"group":"Tài sản","label":"Tin đăng ưu tiên","value":"2 tin / tháng"},
     {"group":"Báo cáo","label":"Xuất báo cáo PDF","value":"10 bản / tháng"},
     {"group":"Tiếp cận","label":"Thư mời gửi nhà đầu tư","value":"200 thư / tháng"},
     {"group":"Tổ chức","label":"Thành viên","value":"5 người"}]'::jsonb),
  ('Tiêu chuẩn', 'Đấu giá đều đặn hằng tháng', 'Đủ dùng cho cả Trạm mỗi tháng', 'standard', 4500000, true, 2, 10, NULL,
   '[{"group":"Tài sản","label":"Số hoá hồ sơ","value":"50 hồ sơ / tháng"},
     {"group":"Tài sản","label":"Tin đăng ưu tiên","value":"5 tin / tháng"},
     {"group":"Báo cáo","label":"Báo cáo thị trường","value":"10 lượt xem / tháng"},
     {"group":"Báo cáo","label":"Xuất báo cáo PDF","value":"40 bản / tháng"},
     {"group":"Tiếp cận","label":"Thư mời gửi nhà đầu tư","value":"1,000 thư / tháng"},
     {"group":"Tổ chức","label":"Thành viên","value":"15 người"}]'::jsonb),
  ('Chuyên nghiệp', 'Nhiều chi nhánh, khối lượng lớn', 'Hạn mức lớn, gần như không giới hạn', 'premium', 9000000, false, 3, 30, NULL,
   '[{"group":"Tài sản","label":"Số hoá hồ sơ","value":"Không giới hạn"},
     {"group":"Tài sản","label":"Tin đăng ưu tiên","value":"15 tin / tháng"},
     {"group":"Báo cáo","label":"Báo cáo thị trường","value":"Không giới hạn"},
     {"group":"Báo cáo","label":"Xuất báo cáo PDF","value":"Không giới hạn"},
     {"group":"Tiếp cận","label":"Thư mời gửi nhà đầu tư","value":"5,000 thư / tháng"},
     {"group":"Tổ chức","label":"Thành viên","value":"Không giới hạn"}]'::jsonb)
), ins AS (
  INSERT INTO public.owner_subscription_plans
    (name, fit_line, highlight_line, tier, monthly_price_vnd, overage_mode, is_featured, sort_order, benefits)
  SELECT s.name, s.fit_line, s.highlight_line, s.tier, s.price, 'credits', s.featured, s.sort_order, s.benefits
    FROM seed s
   WHERE NOT EXISTS (SELECT 1 FROM public.owner_subscription_plans)
  RETURNING id, name
)
INSERT INTO public.owner_subscription_plan_entitlements (plan_id, variant_key, monthly_quota)
SELECT ins.id, x.variant_key, x.quota
  FROM ins JOIN seed s ON s.name = ins.name
  CROSS JOIN LATERAL (VALUES ('scan_3d_owner', s.scan), ('report_portfolio_owner', s.rep)) AS x(variant_key, quota);
