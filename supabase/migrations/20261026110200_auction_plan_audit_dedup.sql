-- ─────────────────────────────────────────────────────────────────────────────
-- Kế hoạch đấu giá — nhật ký: MỘT dòng cho mỗi lần chuyển bước
-- Phase 2 của docs/owner-auction-planning-plan.md.
--
-- 20261026110000 ghi nhật ký ở HAI nơi cho cùng một lần chuyển bước: trigger
-- dòng `auction_plans_audit` và lệnh `owner_audit_write` trong chính RPC. Bằng
-- chứng nghiệm thu cho thấy mỗi lần Trình / Trả lại / Phê duyệt sinh 2 dòng
-- giống nhau — rác trong trang Nhật ký hoạt động.
--
-- Giữ dòng của RPC (có `meta.version` và `meta.changes` = kết quả so với bản
-- mốc, luật D4) và BỎ dòng của trigger khi lần UPDATE đó đến từ RPC. Cờ
-- `auction_plan.rpc` vẫn còn bật lúc trigger AFTER ROW chạy: nó chỉ được tắt ở
-- câu lệnh KẾ TIẾP, sau khi câu UPDATE (và trigger của nó) đã xong.
--
-- Mọi lần client tự sửa (tiêu đề, ghi chú, căn cứ pháp lý, tài sản, mốc công
-- việc) vẫn do trigger ghi như trước.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auction_plan_audit_row()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _new     JSONB;
  _old     JSONB;
  _r       JSONB;
  _action  TEXT := CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END;
  _changes JSONB;
  _label   TEXT;
  _meta    JSONB := '{}'::JSONB;
  _plan    public.auction_plans%ROWTYPE;
BEGIN
  -- Chuyển bước do RPC thực hiện: chính RPC đã ghi một dòng đầy đủ hơn.
  IF TG_TABLE_NAME = 'auction_plans' AND TG_OP = 'UPDATE' AND public.auction_plan_in_rpc() THEN
    RETURN NULL;
  END IF;

  IF TG_OP <> 'DELETE' THEN _new := to_jsonb(NEW); END IF;
  IF TG_OP <> 'INSERT' THEN _old := to_jsonb(OLD); END IF;
  _r := COALESCE(_new, _old);

  _changes := public.owner_audit_diff(_old, _new);
  IF TG_OP = 'UPDATE' AND _changes = '{}'::JSONB THEN
    RETURN NULL;
  END IF;

  IF TG_TABLE_NAME = 'auction_plans' THEN
    _label := COALESCE(NULLIF(_r ->> 'title', ''),
                       'Kế hoạch đấu giá năm ' || (_r ->> 'plan_year'));
    _meta := jsonb_build_object('plan_id', _r ->> 'id');
  ELSE
    SELECT * INTO _plan FROM public.auction_plans WHERE id = (_r ->> 'plan_id')::UUID;
    IF NOT FOUND THEN RETURN NULL; END IF;   -- xoá dây chuyền: dòng của kế hoạch đã đủ
    _label := concat_ws(' · ',
                        COALESCE(NULLIF(_plan.title, ''), 'Kế hoạch ' || _plan.plan_year::TEXT),
                        COALESCE(_r ->> 'item_code', _r ->> 'step'));
    _meta := jsonb_strip_nulls(jsonb_build_object(
               'plan_id', _r ->> 'plan_id',
               'item_id', CASE WHEN TG_TABLE_NAME = 'auction_plan_item_steps' THEN _r ->> 'item_id' END,
               'posting_id', _r ->> 'asset_posting_id',
               'listing_id', _r ->> 'listing_id'));
  END IF;

  PERFORM public.owner_audit_write((_r ->> 'workspace_id')::UUID, NULL, (_r ->> 'branch_id')::UUID,
                                   'ke-hoach', _action, TG_TABLE_NAME, _r ->> 'id', _label,
                                   public.owner_audit_enrich(_changes), _meta, NULL);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Nhật ký KHÔNG BAO GIỜ được chặn một lần ghi nghiệp vụ.
  RAISE WARNING 'auction_plan_audit_row(%): %', TG_TABLE_NAME, SQLERRM;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_audit_row() FROM PUBLIC, anon, authenticated;
