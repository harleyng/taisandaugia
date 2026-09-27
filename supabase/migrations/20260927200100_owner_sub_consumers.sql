-- Gói thuê bao tổ chức chủ tài sản — nối hạn mức vào 2 điểm trừ credit (2026-09-27).
--
-- Thứ tự ở MỌI điểm trừ: hạn mức gói của Trạm trước (_owner_sub_consume) ⇒ 'covered'
-- miễn phí | 'blocked' từ chối (quota_exhausted) | 'none'/'fallback' ⇒ trừ credit qua
-- _charge_owner_feature_credits (ví cá nhân hôm nay; Phase 15d đổi ví ở đó).
--
-- 1. start_asset_3d_scan: dựng lại từ bản LIVE (pg_get_functiondef, trùng khớp
--    20260927170100 dòng 427–501); chỉ thêm nhánh gói.
-- 2. _asset_3d_refund: quét 3D được gói bao ⇒ hoàn LƯỢT (dòng đảo), không hoàn credit.
-- 3. owner_charge_portfolio_report: chuyển việc trừ credit báo cáo danh mục từ client
--    (chargeOwnerReport, đọc-rồi-ghi không atomic) lên server.
-- 4. owner_report_views: bỏ policy "own rows" FOR ALL. Giữ SELECT + INSERT của chính
--    mình (bản production cũ vẫn tự ghi dòng xem), cấm gắn lượt gói từ client, cấm sửa/xoá.

-- ─── 1. Quét 3D ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.start_asset_3d_scan(_posting_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid        UUID := auth.uid();
  v_posting    public.asset_postings%ROWTYPE;
  v_scan       public.asset_3d_scans%ROWTYPE;
  v_variant_id UUID;
  v_cost       INTEGER;
  v_tx_id      UUID;
  v_scan_id    UUID := gen_random_uuid();
  v_sub        JSONB;
  v_covered    BOOLEAN := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- FOR UPDATE tuần tự hoá hai lần bấm đồng thời trên cùng hồ sơ ⇒ không trừ credit
  -- hai lần. Khoá dòng không kích hoạt trigger UPDATE nên review guard không liên quan.
  SELECT * INTO v_posting
    FROM public.asset_postings
   WHERE id = _posting_id AND public.owner_posting_can(id, 'so-hoa', 'update')
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_posting.status IN ('cancelled', 'contracted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'posting_closed');
  END IF;

  PERFORM public._asset_3d_expire_stale(_posting_id);

  -- Đang có phiên quét chạy ⇒ trả lại phiên đó, không trừ thêm.
  SELECT * INTO v_scan
    FROM public.asset_3d_scans
   WHERE asset_posting_id = _posting_id AND status IN ('awaiting_scan', 'processing');
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'reused', true, 'scan_id', v_scan.id,
                              'scan_token', v_scan.scan_token, 'lot_id', _posting_id, 'cost', 0);
  END IF;

  SELECT v.id, v.credit_cost INTO v_variant_id, v_cost
    FROM public.service_variants v
   WHERE v.variant_key = 'scan_3d_owner' AND v.is_active;
  IF v_variant_id IS NULL OR v_cost IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'service_unavailable');
  END IF;

  -- Gói thuê bao của Trạm (hồ sơ tenant "Cá nhân" có workspace_id NULL ⇒ 'none').
  v_sub := public._owner_sub_consume(v_posting.workspace_id, 'scan_3d_owner', 1,
                                     'asset_3d_scan', v_scan_id, v_uid);
  IF v_sub->>'mode' = 'blocked' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quota_exhausted',
                              'quota', v_sub->'quota', 'used', v_sub->'used');
  END IF;
  v_covered := v_sub->>'mode' = 'covered';

  IF v_covered THEN
    v_cost := 0;
  ELSIF v_cost > 0 THEN
    v_tx_id := public._charge_owner_feature_credits(
      v_uid, v_posting.workspace_id, 'scan_3d_owner', v_cost, 'scan_3d',
      'Quét 3D tài sản — ' || left(v_posting.title, 80));
    IF v_tx_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'cost', v_cost);
    END IF;
  END IF;

  INSERT INTO public.asset_3d_scans
    (id, asset_posting_id, user_id, partner, scan_token, credit_cost, credit_transaction_id,
     subscription_usage_id)
  VALUES (v_scan_id, _posting_id, v_uid, 'mock',
          replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
          v_cost, v_tx_id,
          CASE WHEN v_covered THEN (v_sub->>'usage_id')::uuid END)
  RETURNING * INTO v_scan;

  RETURN jsonb_build_object('ok', true, 'reused', false, 'scan_id', v_scan.id,
                            'scan_token', v_scan.scan_token, 'lot_id', _posting_id, 'cost', v_cost,
                            'covered', v_covered,
                            'remaining', CASE WHEN v_covered THEN v_sub->'remaining' END);
END;
$function$;

-- ─── 2. Hoàn khi quét thất bại / quá hạn ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public._asset_3d_refund(_scan_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_scan public.asset_3d_scans%ROWTYPE;
BEGIN
  -- refunded_at IS NULL trong WHERE là chốt chống hoàn hai lần khi webhook gửi lại.
  UPDATE public.asset_3d_scans
     SET refunded_at = now()
   WHERE id = _scan_id AND refunded_at IS NULL
     AND (credit_cost > 0 OR subscription_usage_id IS NOT NULL)
  RETURNING * INTO v_scan;
  IF NOT FOUND THEN RETURN; END IF;

  -- Được gói bao ⇒ trả lại LƯỢT, không đụng credit.
  IF v_scan.subscription_usage_id IS NOT NULL THEN
    PERFORM public._owner_sub_reverse(v_scan.subscription_usage_id,
                                      'Hoàn lượt quét 3D (quét không thành công)');
    RETURN;
  END IF;

  INSERT INTO public.user_credits (user_id, balance)
  VALUES (v_scan.user_id, v_scan.credit_cost)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.user_credits.balance + EXCLUDED.balance, updated_at = now();

  INSERT INTO public.credit_transactions (user_id, type, description, credit_delta, variant_key)
  VALUES (v_scan.user_id, 'scan_3d_refund', 'Hoàn credit quét 3D (quét không thành công)',
          v_scan.credit_cost, 'scan_3d_owner');
END;
$function$;

REVOKE ALL ON FUNCTION public._asset_3d_refund(UUID) FROM PUBLIC, anon, authenticated;

-- ─── 3. Báo cáo danh mục (server-side) ───────────────────────────────────────
-- Bộ lọc mặc định miễn phí. Bộ lọc tuỳ chỉnh: gói ⇒ credit. Trả mode
-- 'free' | 'covered' | 'credits'; lỗi 'quota_exhausted' | 'insufficient' | 'not_found'.

CREATE OR REPLACE FUNCTION public.owner_charge_portfolio_report(
  p_workspace_id UUID, p_filter JSONB, p_is_default BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_view_id UUID := gen_random_uuid();
  v_cost    INTEGER;
  v_sub     JSONB;
  v_tx      UUID;
BEGIN
  IF v_uid IS NULL OR p_workspace_id IS NULL OR NOT public.owner_ws_can(p_workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF COALESCE(p_is_default, false) THEN
    INSERT INTO public.owner_report_views (id, workspace_id, user_id, filter_combo, is_default, credits_charged)
    VALUES (v_view_id, p_workspace_id, v_uid, COALESCE(p_filter, '{}'::jsonb), true, 0);
    RETURN jsonb_build_object('ok', true, 'mode', 'free', 'cost', 0);
  END IF;

  v_sub := public._owner_sub_consume(p_workspace_id, 'report_portfolio_owner', 1,
                                     'owner_report_view', v_view_id, v_uid);
  IF v_sub->>'mode' = 'blocked' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quota_exhausted',
                              'quota', v_sub->'quota', 'used', v_sub->'used');
  END IF;

  IF v_sub->>'mode' = 'covered' THEN
    INSERT INTO public.owner_report_views
      (id, workspace_id, user_id, filter_combo, is_default, credits_charged, subscription_usage_id)
    VALUES (v_view_id, p_workspace_id, v_uid, COALESCE(p_filter, '{}'::jsonb), false, 0,
            (v_sub->>'usage_id')::uuid);
    RETURN jsonb_build_object('ok', true, 'mode', 'covered', 'cost', 0, 'remaining', v_sub->'remaining');
  END IF;

  SELECT v.credit_cost INTO v_cost FROM public.service_variants v
   WHERE v.variant_key = 'report_portfolio_owner' AND v.is_active;
  v_cost := COALESCE(v_cost, 0);
  IF v_cost > 0 THEN
    v_tx := public._charge_owner_feature_credits(v_uid, p_workspace_id, 'report_portfolio_owner',
                                                 v_cost, 'owner_report_view', 'Báo cáo danh mục tài sản');
    IF v_tx IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'cost', v_cost);
    END IF;
  END IF;

  INSERT INTO public.owner_report_views (id, workspace_id, user_id, filter_combo, is_default, credits_charged)
  VALUES (v_view_id, p_workspace_id, v_uid, COALESCE(p_filter, '{}'::jsonb), false, v_cost);
  RETURN jsonb_build_object('ok', true, 'mode', 'credits', 'cost', v_cost);
END;
$$;
REVOKE ALL ON FUNCTION public.owner_charge_portfolio_report(UUID, JSONB, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_charge_portfolio_report(UUID, JSONB, BOOLEAN) TO authenticated;

-- ─── 4. owner_report_views: siết policy ──────────────────────────────────────

DROP POLICY IF EXISTS "own rows" ON public.owner_report_views;
CREATE POLICY owner_report_views_own_read ON public.owner_report_views
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Tạm giữ cho bản production cũ (client tự ghi dòng xem sau khi trừ credit). Không bao
-- giờ gắn được lượt gói từ client. Bỏ policy này khi code mới đã lên production.
CREATE POLICY owner_report_views_own_insert_legacy ON public.owner_report_views
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND subscription_usage_id IS NULL);
REVOKE UPDATE, DELETE ON public.owner_report_views FROM authenticated, anon;
