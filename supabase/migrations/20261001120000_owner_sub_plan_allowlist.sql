-- Gói dịch vụ: admin tạo gói rồi CHỌN TỔ CHỨC được dùng (2026-10-01).
--
-- Trước đây admin cấu hình gói riêng NGAY TRÊN gói của từng Trạm (admin_owner_sub_upsert:
-- tên, giá, kỳ, hạn mức), còn danh mục gói thì mọi Trạm đều thấy. Nay:
--   • Cấu hình gói CHỈ nằm ở danh mục (owner_subscription_plans). Admin không còn sửa
--     tên / giá / hạn mức trên gói của một Trạm.
--   • Mỗi gói có DANH SÁCH TRẠM được dùng (owner_subscription_plan_workspaces). Không
--     có nhóm — admin chọn từng Trạm. Gói chưa chọn Trạm nào = ẨN với chủ tài sản.
--   • Gán = CHO THẤY: Trạm được chọn thấy gói trong danh mục và tự mua; admin kích hoạt
--     tay cũng chỉ được chọn gói đã mở cho Trạm đó (admin_owner_sub_plan_activate).
--   • Gỡ Trạm khỏi gói: gói đang chạy giữ nguyên tới hết hạn, nhưng KHÔNG gia hạn / mua
--     lại được (_owner_sub_plan_eval trả 'plan_not_available').
--   • Sửa gói áp dụng từ lần mua / gia hạn sau (giữ nguyên hành vi admin_owner_sub_plan_upsert).
--
-- admin_owner_sub_upsert và admin_owner_sub_activate(p_sub_id…) bị THU quyền gọi (giữ
-- hàm cho lịch sử). Luồng trả gói riêng ?sub= (pay_owner_subscription) không còn đường
-- tạo dữ liệu mới — dọn sau.

-- ─── 1. Danh sách Trạm được dùng gói ─────────────────────────────────────────

CREATE TABLE public.owner_subscription_plan_workspaces (
  plan_id      UUID NOT NULL REFERENCES public.owner_subscription_plans(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  added_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, workspace_id)
);
CREATE INDEX idx_owner_sub_plan_ws_workspace ON public.owner_subscription_plan_workspaces (workspace_id);

ALTER TABLE public.owner_subscription_plan_workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_sub_plan_ws_read ON public.owner_subscription_plan_workspaces
  FOR SELECT TO authenticated
  USING (public.admin_has_permission('goi-thue-bao', 'view') OR public.owner_ws_can(workspace_id, 'read'));
REVOKE INSERT, UPDATE, DELETE ON public.owner_subscription_plan_workspaces FROM authenticated, anon;

-- ─── 2. Ai đọc được một gói ──────────────────────────────────────────────────
-- Gói đang bán + mở cho một Trạm mình đọc được, HOẶC là gói hiện tại / chờ áp dụng của
-- Trạm mình (để thẻ gói hiện tại vẫn đủ quyền lợi sau khi bị gỡ khỏi danh sách).
-- SECURITY DEFINER vì owner_subscriptions chỉ có policy SELECT cho admin.

CREATE OR REPLACE FUNCTION public.owner_sub_plan_visible(p_plan_id UUID, p_is_active BOOLEAN)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (p_is_active AND EXISTS (
            SELECT 1 FROM public.owner_subscription_plan_workspaces a
             WHERE a.plan_id = p_plan_id AND public.owner_ws_can(a.workspace_id, 'read')))
      OR EXISTS (
            SELECT 1 FROM public.owner_subscriptions s
             WHERE (s.plan_id = p_plan_id OR s.pending_plan_id = p_plan_id)
               AND public.owner_ws_can(s.workspace_id, 'read'))
$$;
REVOKE ALL ON FUNCTION public.owner_sub_plan_visible(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_sub_plan_visible(UUID, BOOLEAN) TO authenticated;

DROP POLICY owner_sub_plans_read ON public.owner_subscription_plans;
CREATE POLICY owner_sub_plans_read ON public.owner_subscription_plans
  FOR SELECT TO authenticated
  USING (public.admin_has_permission('goi-thue-bao', 'view') OR public.owner_sub_plan_visible(id, is_active));

-- ─── 3. Đánh giá lượt mua: gói phải mở cho Trạm ──────────────────────────────
-- Thân hàm giữ nguyên bản 20260928100000, thêm kiểm 'plan_not_available'.

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
  IF NOT EXISTS (SELECT 1 FROM public.owner_subscription_plan_workspaces
                  WHERE plan_id = p_plan_id AND workspace_id = p_workspace_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'plan_not_available');
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

-- ─── 4. Lõi dùng chung: tạo gói Trạm nếu chưa có + áp gói danh mục ───────────

-- Khoá (hoặc tạo) dòng gói của Trạm. Gọi sau _owner_sub_roll.
CREATE OR REPLACE FUNCTION public._owner_sub_plan_ensure(
  p_workspace_id UUID, p_plan_id UUID, p_months INTEGER, p_amount NUMERIC, p_actor UUID, p_source TEXT
)
RETURNS public.owner_subscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub  public.owner_subscriptions%ROWTYPE;
  v_plan public.owner_subscription_plans%ROWTYPE;
BEGIN
  SELECT * INTO v_sub FROM public.owner_subscriptions WHERE workspace_id = p_workspace_id FOR UPDATE;
  IF FOUND THEN RETURN v_sub; END IF;
  SELECT * INTO v_plan FROM public.owner_subscription_plans WHERE id = p_plan_id;
  INSERT INTO public.owner_subscriptions
    (workspace_id, plan_name, price_vnd, term_months, overage_mode, plan_id, created_by, updated_by)
  VALUES (p_workspace_id, v_plan.name, p_amount, p_months, v_plan.overage_mode, p_plan_id, p_actor, p_actor)
  RETURNING * INTO v_sub;
  INSERT INTO public.owner_subscription_events (subscription_id, event_type, actor_id, payload)
  VALUES (v_sub.id, 'created', p_actor, jsonb_build_object('source', p_source, 'plan_id', p_plan_id));
  RETURN v_sub;
END;
$$;
REVOKE ALL ON FUNCTION public._owner_sub_plan_ensure(UUID, UUID, INTEGER, NUMERIC, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- Ghi một kỳ theo gói danh mục. p_effect:
--   'next_term' — kỳ mới nối sau kỳ đang chạy, chụp cấu hình GÓI MỚI vào pending_*;
--   'now' / 'extend' — chép cấu hình gói vào hạn mức đang chạy rồi ghi kỳ.
-- Trả {term_id, starts_on, ends_on, plan (snapshot), replaced (cấu hình bị thay)}.
CREATE OR REPLACE FUNCTION public._owner_sub_plan_apply(
  p_sub public.owner_subscriptions, p_plan_id UUID, p_effect TEXT, p_start DATE, p_months INTEGER,
  p_amount NUMERIC, p_source TEXT, p_method TEXT, p_txn_ref TEXT, p_order_id UUID, p_paid_on DATE,
  p_note TEXT, p_actor UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub    public.owner_subscriptions%ROWTYPE := p_sub;
  v_snap   JSONB := public._owner_sub_plan_snapshot(p_plan_id);
  v_end    DATE;
  v_term   UUID;
  v_res    JSONB;
  v_before JSONB;
BEGIN
  IF p_effect = 'next_term' THEN
    v_end := public.owner_sub_term_end(p_start, p_months);
    INSERT INTO public.owner_subscription_terms
      (subscription_id, workspace_id, starts_on, ends_on, months, amount_vnd, source, method,
       payment_txn_ref, order_id, paid_on, entitlements_snapshot, overage_mode_snapshot,
       price_snapshot, plan_id, note, created_by)
    VALUES (v_sub.id, v_sub.workspace_id, p_start, v_end, p_months, p_amount, p_source, p_method,
            p_txn_ref, p_order_id, p_paid_on, v_snap->'entitlements', v_snap->>'overage_mode',
            p_amount, p_plan_id, NULLIF(btrim(COALESCE(p_note, '')), ''), p_actor)
    RETURNING id INTO v_term;
    UPDATE public.owner_subscriptions
       SET ends_on = v_end, pending_plan_id = p_plan_id, pending_from = p_start,
           pending_months = p_months, pending_price_vnd = p_amount, pending_snapshot = v_snap,
           updated_by = p_actor
     WHERE id = v_sub.id;
    v_res := jsonb_build_object('term_id', v_term, 'starts_on', p_start, 'ends_on', v_end);
  ELSE
    v_before := jsonb_build_object(
      'plan_id', v_sub.plan_id, 'plan_name', v_sub.plan_name, 'status', v_sub.status,
      'price_vnd', v_sub.price_vnd, 'term_months', v_sub.term_months, 'overage_mode', v_sub.overage_mode,
      'entitlements', (SELECT COALESCE(jsonb_agg(jsonb_build_object('variant_key', e.variant_key,
                                        'monthly_quota', e.monthly_quota) ORDER BY e.variant_key), '[]'::jsonb)
                         FROM public.owner_subscription_entitlements e WHERE e.subscription_id = v_sub.id));
    PERFORM public._owner_sub_set_entitlements(v_sub.id, v_snap->'entitlements');
    UPDATE public.owner_subscriptions
       SET plan_id = p_plan_id, plan_name = v_snap->>'name', overage_mode = v_snap->>'overage_mode',
           price_vnd = p_amount, term_months = p_months, updated_by = p_actor
     WHERE id = v_sub.id
    RETURNING * INTO v_sub;
    v_res := public._owner_sub_apply_term(v_sub, p_start, p_months, p_amount, p_source, p_method, p_txn_ref,
                                          p_order_id, p_paid_on, p_note, p_actor);
    UPDATE public.owner_subscription_terms SET plan_id = p_plan_id WHERE id = (v_res->>'term_id')::uuid;
  END IF;
  RETURN v_res || jsonb_build_object('plan', v_snap, 'replaced', v_before);
END;
$$;
REVOKE ALL ON FUNCTION public._owner_sub_plan_apply(public.owner_subscriptions, UUID, TEXT, DATE, INTEGER, NUMERIC, TEXT, TEXT, TEXT, UUID, DATE, TEXT, UUID) FROM PUBLIC, anon, authenticated;

-- Thanh toán gói danh mục — hành vi giữ nguyên bản 20260928100000, phần áp gói chuyển
-- sang _owner_sub_plan_ensure / _owner_sub_plan_apply.
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
  v_eval   JSONB;
  v_amount NUMERIC;
  v_effect TEXT;
  v_claim  TEXT;
  v_order  UUID;
  v_res    JSONB;
BEGIN
  IF p_uid IS NULL OR v_txn = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_txn');
  END IF;
  SELECT primary_name INTO v_ws FROM public.asset_owner_workspaces WHERE id = p_workspace_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;

  PERFORM public._owner_sub_roll(s.id) FROM public.owner_subscriptions s WHERE s.workspace_id = p_workspace_id;
  SELECT * INTO v_sub FROM public.owner_subscriptions WHERE workspace_id = p_workspace_id FOR UPDATE;

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

  v_effect := v_eval->>'effect';
  v_sub := public._owner_sub_plan_ensure(p_workspace_id, p_plan_id, p_months, v_amount, p_uid, 'plan_catalog');

  v_order := public._owner_sub_order(
    v_sub, p_uid, v_amount, now(),
    'Gói dịch vụ ' || (v_eval->>'plan_name') || ' · ' || v_sub.code || ' · ' || v_ws || ' · ' || p_months
      || ' tháng (VNPay' || CASE WHEN v_effect = 'next_term' THEN ', áp dụng từ kỳ sau' ELSE '' END || ')',
    p_uid);

  v_res := public._owner_sub_plan_apply(v_sub, p_plan_id, v_effect, (v_eval->>'starts_on')::date, p_months,
                                        v_amount, 'vnpay', NULL, v_txn, v_order, public.contract_today(),
                                        NULL, p_uid);

  INSERT INTO public.owner_subscription_events (subscription_id, event_type, actor_id, payload)
  VALUES (v_sub.id, CASE WHEN v_effect = 'next_term' THEN 'plan_scheduled' ELSE 'plan_purchased' END, p_uid,
          v_res || jsonb_build_object('effect', v_effect, 'months', p_months, 'amount_vnd', v_amount,
                                      'order_id', v_order, 'txn_ref', v_txn));

  RETURN jsonb_build_object('ok', true, 'status', 'paid', 'code', v_sub.code,
                            'workspace_id', p_workspace_id, 'workspace_name', v_ws,
                            'plan_name', v_res->'plan'->>'name', 'effect', v_effect, 'order_id', v_order)
         || (v_res - 'plan' - 'replaced');
END;
$$;
REVOKE ALL ON FUNCTION public._settle_owner_sub_plan(UUID, UUID, INTEGER, TEXT, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;

-- ─── 5. Admin: chọn Trạm được dùng gói ───────────────────────────────────────
-- p_workspace_ids THAY TOÀN BỘ danh sách. Gỡ Trạm không đụng gói đang chạy của Trạm đó.

CREATE OR REPLACE FUNCTION public.admin_owner_sub_plan_set_workspaces(p_plan_id UUID, p_workspace_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ids UUID[] := ARRAY(SELECT DISTINCT unnest(COALESCE(p_workspace_ids, '{}'::uuid[])));
BEGIN
  IF NOT public.admin_has_permission('goi-thue-bao', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  PERFORM 1 FROM public.owner_subscription_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF (SELECT count(*) FROM public.asset_owner_workspaces WHERE id = ANY (v_ids)) <> cardinality(v_ids) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'workspace_not_found');
  END IF;

  DELETE FROM public.owner_subscription_plan_workspaces
   WHERE plan_id = p_plan_id AND NOT (workspace_id = ANY (v_ids));
  INSERT INTO public.owner_subscription_plan_workspaces (plan_id, workspace_id, added_by)
  SELECT p_plan_id, w, auth.uid() FROM unnest(v_ids) w
  ON CONFLICT (plan_id, workspace_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'count', cardinality(v_ids));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_owner_sub_plan_set_workspaces(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_owner_sub_plan_set_workspaces(UUID, UUID[]) TO authenticated;

-- ─── 6. Admin: kích hoạt / gia hạn TAY theo gói danh mục ─────────────────────
-- Gói phải đang bán + mở cho Trạm. Số tháng 1–36 (không buộc theo kỳ danh mục); số tiền
-- do admin nhập (hợp đồng, chuyển khoản…), > 0 ⇒ đơn doanh thu đứng tên Trưởng đơn vị.
-- Hiệu lực như khi Trạm tự mua: gói đang chạy cùng gói ⇒ nối kỳ; khác gói ⇒ từ kỳ sau;
-- chưa có / hết hạn / đã huỷ ⇒ từ p_starts_on (mặc định hôm nay).

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
  SELECT * INTO v_plan FROM public.owner_subscription_plans WHERE id = p_plan_id;
  IF NOT FOUND OR NOT v_plan.is_active THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'plan_inactive');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.owner_subscription_plan_workspaces
                  WHERE plan_id = p_plan_id AND workspace_id = p_workspace_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'plan_not_available');
  END IF;

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
REVOKE ALL ON FUNCTION public.admin_owner_sub_plan_activate(UUID, UUID, INTEGER, DATE, NUMERIC, TEXT, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_owner_sub_plan_activate(UUID, UUID, INTEGER, DATE, NUMERIC, TEXT, DATE, TEXT) TO authenticated;

-- ─── 7. Bỏ cấu hình gói riêng từng Trạm ──────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.admin_owner_sub_upsert(UUID, TEXT, NUMERIC, INTEGER, TEXT, JSONB, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_owner_sub_activate(UUID, INTEGER, DATE, NUMERIC, TEXT, DATE, TEXT) FROM authenticated;

-- Chỉ còn huỷ gói (bắt buộc lý do). Nháp ⇄ chào gói thuộc luồng gói riêng đã bỏ.
CREATE OR REPLACE FUNCTION public.admin_owner_sub_set_status(p_sub_id UUID, p_status TEXT, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub public.owner_subscriptions%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission('goi-thue-bao', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  SELECT * INTO v_sub FROM public.owner_subscriptions WHERE id = p_sub_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;

  IF p_status IS DISTINCT FROM 'cancelled' OR v_sub.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_transition', 'from', v_sub.status, 'to', p_status);
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;

  UPDATE public.owner_subscriptions
     SET status = 'cancelled', updated_by = auth.uid(), cancelled_at = now(), cancel_reason = btrim(p_reason)
   WHERE id = p_sub_id;

  INSERT INTO public.owner_subscription_events (subscription_id, event_type, actor_id, payload)
  VALUES (p_sub_id, 'cancelled', auth.uid(),
          jsonb_build_object('from', v_sub.status, 'to', 'cancelled', 'reason', btrim(p_reason)));
  RETURN jsonb_build_object('ok', true, 'status', 'cancelled');
END;
$$;

-- ─── 8. Danh sách Trạm cho admin: thêm số gói được dùng ──────────────────────

DROP FUNCTION public.admin_owner_subscription_list();
CREATE FUNCTION public.admin_owner_subscription_list()
RETURNS TABLE (
  workspace_id UUID, workspace_name TEXT, match_scope TEXT, parent_name TEXT,
  owner_name TEXT, owner_email TEXT, member_count INTEGER, workspace_created_at TIMESTAMPTZ,
  subscription_id UUID, code TEXT, plan_name TEXT, status TEXT,
  starts_on DATE, ends_on DATE, price_vnd NUMERIC, term_months INTEGER, overage_mode TEXT,
  plan_id UUID, allowed_plan_ids UUID[]
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
         s.starts_on, s.ends_on, s.price_vnd, s.term_months, s.overage_mode,
         s.plan_id,
         ARRAY(SELECT a.plan_id FROM public.owner_subscription_plan_workspaces a WHERE a.workspace_id = w.id)
    FROM public.asset_owner_workspaces w
    LEFT JOIN public.asset_owner_workspaces pw ON pw.id = w.parent_workspace_id
    LEFT JOIN public.profiles p ON p.id = w.owner_user_id
    LEFT JOIN public.owner_subscriptions s ON s.workspace_id = w.id
   ORDER BY (s.id IS NULL), w.primary_name;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_owner_subscription_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_owner_subscription_list() TO authenticated;

-- ─── 9. Dữ liệu: giữ quyền gia hạn cho Trạm đang dùng gói + demo ─────────────

INSERT INTO public.owner_subscription_plan_workspaces (plan_id, workspace_id)
SELECT DISTINCT x.plan_id, s.workspace_id
  FROM public.owner_subscriptions s
 CROSS JOIN LATERAL (VALUES (s.plan_id), (s.pending_plan_id)) x(plan_id)
 WHERE x.plan_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Trạm demo của secsosoo (scripts/seed-owner-demo.py) thấy đủ danh mục.
INSERT INTO public.owner_subscription_plan_workspaces (plan_id, workspace_id)
SELECT p.id, w.id
  FROM public.owner_subscription_plans p
  JOIN public.asset_owner_workspaces w ON w.id = '4ca4be7b-34df-4cdd-b0b5-368d0cb78ae3'
ON CONFLICT DO NOTHING;
