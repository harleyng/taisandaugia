-- ─────────────────────────────────────────────────────────────────────────────
-- Kế hoạch đấu giá — bước "Mở lại để sửa" (returned → draft)
-- Phase 2 của docs/owner-auction-planning-plan.md, bổ khuyết luồng ở mục A4.2.
--
-- A4.2 vẽ luồng `submitted → (returned → draft) → approved`, nhưng danh sách RPC
-- ở prompt Phase 2 không nêu bước `returned → draft`. Thiếu nó thì một kế hoạch
-- bị TRẢ LẠI nằm chết: `returned` không thuộc {draft, adjusting} nên trường mốc
-- vẫn khoá, mà không có đường nào về nháp.
--
-- Đặt ở migration RIÊNG vì 20261026110000 đã áp lên DB thật — không bao giờ sửa
-- một migration đã áp.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auction_plan_reopen(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid  UUID := auth.uid();
  _plan public.auction_plans%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;

  SELECT * INTO _plan FROM public.auction_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  -- Cùng quyền với việc sửa danh mục: ai sửa được thì mở lại được.
  IF NOT public.owner_ws_has_in(_plan.workspace_id, 'ke-hoach', 'update', _plan.branch_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF _plan.status <> 'returned' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', _plan.status);
  END IF;

  PERFORM set_config('auction_plan.rpc', 'on', true);
  UPDATE public.auction_plans SET status = 'draft' WHERE id = p_plan_id;
  PERFORM set_config('auction_plan.rpc', 'off', true);

  PERFORM public.owner_audit_write(_plan.workspace_id, NULL, _plan.branch_id, 'ke-hoach', 'update',
            'auction_plans', p_plan_id::TEXT,
            COALESCE(NULLIF(_plan.title, ''), 'Kế hoạch đấu giá năm ' || _plan.plan_year::TEXT),
            jsonb_build_object('status', jsonb_build_array('returned', 'draft')),
            jsonb_build_object('plan_id', p_plan_id), NULL);

  RETURN jsonb_build_object('ok', true, 'status', 'draft');
END;
$$;

COMMENT ON FUNCTION public.auction_plan_reopen(UUID) IS
  'Kế hoạch bị trả lại → nháp, để cán bộ sửa danh mục rồi trình lại (A4.2). Cần ke-hoach:update + đúng chi nhánh.';

REVOKE ALL ON FUNCTION public.auction_plan_reopen(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_reopen(UUID) TO authenticated;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.auction_plan_reopen(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'auction_plan_reopen: phải REVOKE khỏi anon';
  END IF;
END $$;
