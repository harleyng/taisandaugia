-- Sửa hồi quy do 20260907000003 gây ra trong `admin_win_opportunity`.
--
-- Bản trước chặn cứng: `service_kind='commission'` mà `opportunities.supplier_id`
-- NULL thì ném lỗi. Nhưng cơ hội của luồng CÔNG CỤ ĐẤU GIÁ (`request_tool_service`)
-- KHÔNG BAO GIỜ set cột đó — dịch vụ của chúng là `supplier_scope='fixed'`, đối
-- tác nằm sẵn trên `services.supplier_id` và trigger `orders_sync_kind_and_commission`
-- vẫn luôn tự điền. Guard mới đã khoá 8 cơ hội đang mở không chốt thắng được.
--
-- Đúng ra: đối tác HIỆU LỰC = supplier của cơ hội, không có thì lấy của dịch vụ.
-- Chỉ khi CẢ HAI đều rỗng (dịch vụ per_order mà chưa chọn đối tác) mới chặn —
-- lúc đó trigger cũng không suy ra được và đơn sẽ vỡ với lỗi khó hiểu hơn.
--
-- Đồng thời mở rộng phạm vi tra hợp đồng: dịch vụ fixed (công cụ đấu giá) giờ
-- cũng lấy được mức theo hợp đồng nếu đối tác đó đã ký.

CREATE OR REPLACE FUNCTION public.admin_win_opportunity(
  _opportunity_id UUID,
  _amount         NUMERIC     DEFAULT NULL,
  _gross          NUMERIC     DEFAULT NULL,
  _ordered_at     TIMESTAMPTZ DEFAULT now(),
  _customer_id    UUID        DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opp       public.opportunities%ROWTYPE;
  v_customer  UUID;
  v_order     UUID;
  v_mode      TEXT;
  v_amount    NUMERIC(18,0);
  v_gross     NUMERIC(18,0);
  v_terms     RECORD;
  v_ctype     TEXT;
  v_cvalue    NUMERIC(12,2);
  v_cid       UUID;
  v_lineid    UUID;
  v_scope     TEXT;
  v_svc_sup   UUID;
  v_supplier  UUID;
BEGIN
  IF NOT public.admin_has_permission('co-hoi', 'approve') THEN
    RAISE EXCEPTION 'Không có quyền chốt cơ hội' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_opp FROM public.opportunities WHERE id = _opportunity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy cơ hội' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_opp.lead_id IS NOT NULL THEN
    v_customer := public.admin_convert_lead(v_opp.lead_id, _customer_id);
  END IF;

  SELECT * INTO v_opp FROM public.opportunities WHERE id = _opportunity_id FOR UPDATE;
  IF v_opp.stage = 'won' THEN
    RAISE EXCEPTION 'Cơ hội đã được chốt thắng' USING ERRCODE = 'check_violation';
  END IF;

  v_customer := COALESCE(v_customer, v_opp.customer_id);
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'Cơ hội chưa gắn khách hàng' USING ERRCODE = 'check_violation';
  END IF;

  v_amount := COALESCE(_amount, v_opp.amount);
  v_gross  := COALESCE(_gross,  v_opp.gross_amount);

  v_ctype  := v_opp.commission_type;
  v_cvalue := v_opp.commission_value;
  v_cid    := v_opp.contract_id;
  v_lineid := v_opp.contract_line_id;

  IF v_opp.service_kind = 'commission' THEN
    SELECT s.supplier_scope, s.supplier_id INTO v_scope, v_svc_sup
      FROM public.services s WHERE s.id = v_opp.service_id;

    -- Đối tác hiệu lực: của cơ hội trước, không có thì của dịch vụ (fixed).
    v_supplier := COALESCE(v_opp.supplier_id, v_svc_sup);

    IF v_supplier IS NULL THEN
      RAISE EXCEPTION 'Cơ hội hoa hồng chưa gắn đối tác — hãy tạo hồ sơ đối tác và hợp đồng trước'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Hợp đồng là nguồn CÓ THẨM QUYỀN: tra lại tại NGÀY ĐẶT ĐƠN, không dùng mức
    -- đã đọng trên cơ hội từ lúc tạo (có thể đã tái ký từ đó tới giờ).
    SELECT * INTO v_terms
      FROM public.resolve_contract_terms(
        v_supplier, v_opp.service_id, v_opp.service_variant_id, _ordered_at::date);
    IF FOUND THEN
      v_ctype  := v_terms.commission_type;
      v_cvalue := v_terms.commission_value;
      v_cid    := v_terms.contract_id;
      v_lineid := v_terms.line_id;
    END IF;
  END IF;

  PERFORM set_config('app.admin_win', 'on', true);

  IF v_opp.service_kind = 'credit' THEN
    v_mode := 'credit_ledger';
  ELSE
    INSERT INTO public.orders (
      customer_id, service_id, service_variant_id, opportunity_id,
      quantity, amount, gross_amount,
      supplier_id, commission_type, commission_value,
      contract_id, contract_line_id,
      fulfillment_status, ordered_at, note
    ) VALUES (
      v_customer, v_opp.service_id, v_opp.service_variant_id, v_opp.id,
      1,
      v_amount,
      CASE WHEN v_opp.service_kind = 'commission' THEN v_gross ELSE v_amount END,
      v_supplier, v_ctype, v_cvalue,
      v_cid, v_lineid,
      'pending', _ordered_at,
      'Chốt từ cơ hội ' || COALESCE(v_opp.code, '')
    )
    RETURNING id INTO v_order;
    v_mode := 'order';
  END IF;

  UPDATE public.opportunities
     SET stage = 'won', won_order_id = v_order, revenue_mode = v_mode,
         customer_id = v_customer, lead_id = NULL,
         amount = v_amount, gross_amount = v_gross, closed_at = now(),
         supplier_id = COALESCE(supplier_id, v_supplier),
         commission_type = v_ctype, commission_value = v_cvalue,
         contract_id = v_cid, contract_line_id = v_lineid
   WHERE id = _opportunity_id;

  RETURN jsonb_build_object(
    'customer_id',  v_customer,
    'order_id',     v_order,
    'revenue_mode', v_mode,
    'contract_id',  v_cid
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_win_opportunity(UUID, NUMERIC, NUMERIC, TIMESTAMPTZ, UUID) TO authenticated;

-- Kiểm chứng: không còn cơ hội ĐANG MỞ nào bị guard khoá oan.
DO $$
DECLARE v_blocked INT;
BEGIN
  SELECT count(*) INTO v_blocked
    FROM public.opportunities o
    JOIN public.services s ON s.id = o.service_id
   WHERE o.service_kind = 'commission'
     AND o.stage IN ('selling', 'pending_approval')
     AND COALESCE(o.supplier_id, s.supplier_id) IS NULL;

  IF v_blocked > 0 THEN
    RAISE EXCEPTION 'Còn % cơ hội hoa hồng đang mở không suy ra được đối tác', v_blocked;
  END IF;
  RAISE NOTICE 'OK: mọi cơ hội hoa hồng đang mở đều suy ra được đối tác';
END $$;
