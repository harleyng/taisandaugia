-- RPC chuyển đổi CRM: lead → khách hàng, và chốt thắng cơ hội → đơn hàng.
--
-- Vì sao RPC chứ không phải trigger: chốt thắng đụng 4 bảng và cần THÔNG TIN
-- NGƯỜI DÙNG NHẬP mà trigger không nhận được — chọn gộp trùng khách hàng nào,
-- số chốt thực tế, ngày ghi nhận (cho phép nhập lùi). Trigger chỉ thấy hàng.
--
-- SECURITY DEFINER + gác bằng admin_has_permission ⇒ enforcement ở DB, không
-- chỉ ẩn nút trên UI.
--
-- Thứ tự khóa THỐNG NHẤT ở cả hai hàm: lead → cơ hội → khách hàng. Khóa ngược
-- chiều giữa hai hàm chạy song song sẽ deadlock.

-- ─── admin_convert_lead ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_convert_lead(
  _lead_id     UUID,
  _customer_id UUID DEFAULT NULL   -- admin chọn khách có sẵn để gộp trùng
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead     public.leads%ROWTYPE;
  v_customer UUID;
  v_dup      UUID;
  v_phone    TEXT;
BEGIN
  IF NOT public.admin_has_permission('khach-hang-tiem-nang', 'update') THEN
    RAISE EXCEPTION 'Không có quyền chuyển đổi khách hàng tiềm năng'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = _lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy khách hàng tiềm năng' USING ERRCODE = 'no_data_found';
  END IF;

  -- Idempotent theo CON TRỎ chứ không theo status: nếu khách hàng bị xóa,
  -- converted_customer_id thành NULL và lead chuyển đổi lại được, không kẹt.
  IF v_lead.converted_customer_id IS NOT NULL THEN
    RETURN v_lead.converted_customer_id;
  END IF;

  IF _customer_id IS NOT NULL THEN
    SELECT id INTO v_customer FROM public.customers WHERE id = _customer_id FOR UPDATE;
    IF v_customer IS NULL THEN
      RAISE EXCEPTION 'Không tìm thấy khách hàng để gộp' USING ERRCODE = 'no_data_found';
    END IF;
  ELSE
    -- Kiểm tra trùng LẠI bên trong transaction: bản ghi trùng có thể vừa xuất
    -- hiện sau khi UI đã dựng danh sách gợi ý.
    v_phone := regexp_replace(COALESCE(v_lead.phone, ''), '\D', '', 'g');
    SELECT c.id INTO v_dup
      FROM public.customers c
     WHERE (NULLIF(v_phone, '') IS NOT NULL
            AND regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g') = v_phone)
        OR (NULLIF(v_lead.email, '') IS NOT NULL AND lower(c.email) = lower(v_lead.email))
     LIMIT 1;

    IF v_dup IS NOT NULL THEN
      RAISE EXCEPTION 'Đã có khách hàng trùng số điện thoại hoặc email — hãy chọn gộp vào khách hàng đó'
        USING ERRCODE = 'unique_violation';
    END IF;

    INSERT INTO public.customers (name, customer_type, segment, contact_name, phone, email, address, note, source_lead_id)
    VALUES (
      COALESCE(NULLIF(v_lead.company_name, ''), v_lead.name),
      CASE WHEN v_lead.lead_type IN ('asset_owner','investor','broker') AND v_lead.company_name IS NULL
           THEN 'individual' ELSE 'company' END,
      v_lead.lead_type,                       -- cùng từ vựng ⇒ copy 1:1
      COALESCE(v_lead.contact_name, v_lead.name),
      v_lead.phone, v_lead.email, v_lead.province, v_lead.note, v_lead.id
    )
    RETURNING id INTO v_customer;
  END IF;

  -- Dời mọi cơ hội đang treo ở lead sang khách hàng (giữ nguyên xor 1-trong-2).
  UPDATE public.opportunities
     SET customer_id = v_customer, lead_id = NULL
   WHERE lead_id = _lead_id;

  UPDATE public.leads
     SET status = 'converted', converted_customer_id = v_customer, converted_at = now()
   WHERE id = _lead_id;

  RETURN v_customer;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_convert_lead(UUID, UUID) TO authenticated;

-- ─── admin_win_opportunity ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_win_opportunity(
  _opportunity_id UUID,
  _amount         NUMERIC     DEFAULT NULL,  -- số chốt thực tế (mặc định = dự kiến)
  _gross          NUMERIC     DEFAULT NULL,
  _ordered_at     TIMESTAMPTZ DEFAULT now(), -- cho phép nhập lùi
  _customer_id    UUID        DEFAULT NULL   -- gộp vào khách có sẵn khi convert
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opp      public.opportunities%ROWTYPE;
  v_customer UUID;
  v_order    UUID;
  v_mode     TEXT;
  v_amount   NUMERIC(18,0);
  v_gross    NUMERIC(18,0);
BEGIN
  IF NOT public.admin_has_permission('co-hoi', 'approve') THEN
    RAISE EXCEPTION 'Không có quyền chốt cơ hội' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Đọc trước (không khóa) để biết có lead không → khóa lead TRƯỚC, rồi mới
  -- khóa lại cơ hội. Giữ đúng thứ tự lead → cơ hội → khách hàng.
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

  -- Mở guard trong PHẠM VI TRANSACTION (tham số thứ 3 = true). Dùng false là
  -- session-scoped, sẽ mở guard cho mọi câu lệnh sau đó trên cùng kết nối.
  PERFORM set_config('app.admin_win', 'on', true);

  IF v_opp.service_kind = 'credit' THEN
    -- Gói credit: đơn chỉ ra đời khi khách NẠP THẬT. Không bịa đơn ở đây.
    v_mode := 'credit_ledger';
  ELSE
    INSERT INTO public.orders (
      customer_id, service_id, service_variant_id, opportunity_id,
      quantity, amount, gross_amount,
      commission_type, commission_value,
      fulfillment_status, ordered_at, note
    ) VALUES (
      v_customer, v_opp.service_id, v_opp.service_variant_id, v_opp.id,
      1,
      v_amount,
      CASE WHEN v_opp.service_kind = 'commission' THEN v_gross ELSE v_amount END,
      v_opp.commission_type, v_opp.commission_value,
      'pending', _ordered_at,
      'Chốt từ cơ hội ' || COALESCE(v_opp.code, '')
    )
    RETURNING id INTO v_order;
    v_mode := 'order';
  END IF;

  UPDATE public.opportunities
     SET stage = 'won', won_order_id = v_order, revenue_mode = v_mode,
         customer_id = v_customer, lead_id = NULL,
         amount = v_amount, gross_amount = v_gross, closed_at = now()
   WHERE id = _opportunity_id;

  RETURN jsonb_build_object(
    'customer_id', v_customer,
    'order_id',    v_order,
    'revenue_mode', v_mode
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_win_opportunity(UUID, NUMERIC, NUMERIC, TIMESTAMPTZ, UUID) TO authenticated;

-- ─── admin_unwin_opportunity ─────────────────────────────────────────────────
-- Thiếu hàm này thì bỏ-thắng rồi thắng lại sinh ĐƠN THỨ HAI và cộng trùng
-- doanh thu vĩnh viễn. Hủy đơn cũ chứ không xóa: giữ dấu vết kế toán.

CREATE OR REPLACE FUNCTION public.admin_unwin_opportunity(_opportunity_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_opp public.opportunities%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission('co-hoi', 'approve') THEN
    RAISE EXCEPTION 'Không có quyền bỏ chốt cơ hội' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_opp FROM public.opportunities WHERE id = _opportunity_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy cơ hội' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_opp.stage <> 'won' THEN
    RAISE EXCEPTION 'Cơ hội chưa ở trạng thái Thành công' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('app.admin_win', 'on', true);

  IF v_opp.won_order_id IS NOT NULL THEN
    UPDATE public.orders SET fulfillment_status = 'cancelled' WHERE id = v_opp.won_order_id;
  END IF;

  UPDATE public.opportunities
     SET stage = 'selling', won_order_id = NULL, revenue_mode = 'none', closed_at = NULL
   WHERE id = _opportunity_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_unwin_opportunity(UUID) TO authenticated;
