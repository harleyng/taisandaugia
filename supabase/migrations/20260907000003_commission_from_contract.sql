-- Nối hợp đồng vào luồng tiền: mức hoa hồng tự suy từ hợp đồng đang hiệu lực
-- thay vì gõ tay.
--
-- ⚠️ "Tự động" ở đây là tự suy MỨC, không phải tự suy SỐ TIỀN. Giá trị thương vụ
-- ký gửi chỉ biết sau khi đấu giá xong, nên admin vẫn nhập `gross` lúc chốt
-- thắng; hệ thống nhân với mức trong hợp đồng.
--
-- ⚠️ Đừng nhầm với `asset_service_requests.quote_commission_pct` — đó là hoa hồng
-- tổ chức đấu giá thu của CHỦ TÀI SẢN. Ở đây là phần SÀN thu của tổ chức đấu giá.

-- ─── 1. Dịch vụ hoa hồng dùng chung nhiều đối tác ────────────────────────────
--
-- `services_commission_requires_supplier` (20260719000002) khoá mỗi dịch vụ
-- commission vào ĐÚNG MỘT supplier. Đúng với công cụ đấu giá (mỗi nhà cung cấp
-- một dịch vụ), nhưng SAI với môi giới ký gửi: một dịch vụ, mọi tổ chức đấu giá.
--
-- `per_order` = supplier nằm trên ĐƠN chứ không trên dịch vụ. Không hở, vì
-- `orders_commission_required_check` + trigger `orders_sync_kind_and_commission`
-- vẫn bắt buộc `orders.supplier_id IS NOT NULL` cho mọi đơn hoa hồng.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS supplier_scope TEXT NOT NULL DEFAULT 'fixed';

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_supplier_scope_check;
ALTER TABLE public.services
  ADD CONSTRAINT services_supplier_scope_check
    CHECK (supplier_scope IN ('fixed', 'per_order'));

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_commission_requires_supplier;
ALTER TABLE public.services
  ADD CONSTRAINT services_commission_requires_supplier
    CHECK (kind <> 'commission'
           OR supplier_scope = 'per_order'
           OR supplier_id IS NOT NULL);

-- ─── 2. Truy vết trên đơn & cơ hội ───────────────────────────────────────────
-- Đơn VẪN chụp ảnh điều khoản của chính nó (orders.commission_type/value) —
-- quy tắc gốc của 20260719000002 giữ nguyên. Hai cột dưới chỉ trả lời câu
-- "mức này ở đâu ra", KHÔNG phải thứ báo cáo đọc lúc chạy.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS contract_id      UUID REFERENCES public.supplier_contracts(id)      ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_line_id UUID REFERENCES public.supplier_contract_lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_contract
  ON public.orders (contract_id) WHERE contract_id IS NOT NULL;

-- `opportunities` chưa từng có supplier_id (20260719000006) — thiếu cột này thì
-- cơ hội ký gửi không mang nổi "tổ chức đấu giá nào sẽ trả hoa hồng".
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS supplier_id      UUID REFERENCES public.suppliers(id)               ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS contract_id      UUID REFERENCES public.supplier_contracts(id)      ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_line_id UUID REFERENCES public.supplier_contract_lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_supplier
  ON public.opportunities (supplier_id) WHERE supplier_id IS NOT NULL;

-- ─── 3. Resolver — hai hàm, hai mức quyền ────────────────────────────────────
--
-- Tách làm hai vì PostgREST phơi MỌI hàm mà vai `authenticated` gọi được: một
-- hàm SECURITY DEFINER trả về biên hoa hồng của đối tác mà grant cho
-- `authenticated` là rò rỉ bí mật thương mại cho bất kỳ ai đăng nhập.
--   • resolve_contract_terms       — nội bộ, REVOKE hết, chỉ RPC definer khác gọi.
--   • admin_resolve_contract_terms — cho form admin, có gác quyền.

CREATE OR REPLACE FUNCTION public.resolve_contract_terms(
  _supplier_id UUID,
  _service_id  UUID,
  _variant_id  UUID DEFAULT NULL,
  _at          DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  contract_id      UUID,
  line_id          UUID,
  code             TEXT,
  contract_no      TEXT,
  commission_type  TEXT,
  commission_value NUMERIC,
  effective_to     DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, l.id, c.code, c.contract_no,
         l.commission_type, l.commission_value, c.effective_to
    FROM public.supplier_contracts      c
    JOIN public.supplier_contract_lines l ON l.contract_id = c.id AND l.is_active
   WHERE c.supplier_id = _supplier_id
     AND l.service_id  = _service_id
     AND c.status = 'active'
     AND c.effective_from <= _at
     AND (c.effective_to IS NULL OR c.effective_to >= _at)
     -- Dòng khớp đúng biến thể, hoặc dòng cấp dịch vụ (áp cho mọi biến thể).
     AND (l.service_variant_id = _variant_id OR l.service_variant_id IS NULL)
   -- Ưu tiên dòng khớp biến thể; sau đó hợp đồng ký SAU đè hợp đồng ký trước.
   -- Trigger chống trùng (20260907000001) đã chặn phần lớn tình huống nhập
   -- nhằng — ORDER BY này là lưới an toàn cuối để kết quả luôn XÁC ĐỊNH.
   ORDER BY (l.service_variant_id IS NOT NULL) DESC,
            c.signed_date DESC, c.created_at DESC
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_contract_terms(UUID, UUID, UUID, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_contract_terms(UUID, UUID, UUID, DATE) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_contract_terms(UUID, UUID, UUID, DATE) FROM authenticated;

CREATE OR REPLACE FUNCTION public.admin_resolve_contract_terms(
  _supplier_id UUID,
  _service_id  UUID,
  _variant_id  UUID DEFAULT NULL,
  _at          DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  contract_id      UUID,
  line_id          UUID,
  code             TEXT,
  contract_no      TEXT,
  commission_type  TEXT,
  commission_value NUMERIC,
  effective_to     DATE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_has_permission('nha-cung-cap', 'view') THEN
    RAISE EXCEPTION 'Không có quyền xem hợp đồng đối tác'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT * FROM public.resolve_contract_terms(_supplier_id, _service_id, _variant_id, _at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_resolve_contract_terms(UUID, UUID, UUID, DATE) TO authenticated;

-- ─── 4. Dịch vụ "Hoa hồng môi giới ký gửi" ───────────────────────────────────
--
-- CỐ Ý tạo dịch vụ MỚI thay vì đổi `kind` của "Môi giới ký gửi tài sản"
-- (20260906100001) từ 'direct' sang 'commission':
--
--   • `services_block_kind_change` chặn đổi kind khi dịch vụ đã có đơn — và
--     trigger đó đang bảo vệ tính đúng HỒI TỐ của báo cáo tách nguồn, không nên
--     vô hiệu hoá.
--   • Quan trọng hơn: đổi tại chỗ sẽ ép MỌI cơ hội ký gửi thành commission, kể
--     cả khi tổ chức đấu giá chưa ký hợp đồng nào ⇒ `admin_win_opportunity` sẽ
--     vỡ ở `orders_commission_required_check` (thiếu supplier), khoá cứng cả
--     nghiệp vụ. Giữ hai dịch vụ song song thì đường "chưa có hợp đồng" vẫn chạy
--     như hôm nay và cũng phản ánh đúng sự thật: không hợp đồng ⇒ không hoa hồng.

INSERT INTO public.services
  (name, kind, category, audience, price, supplier_scope, description, is_active, sort_order)
SELECT 'Hoa hồng môi giới ký gửi', 'commission', 'brokerage', 'company', 0, 'per_order',
       'Phần hoa hồng sàn thu của tổ chức đấu giá khi giới thiệu thành công tài sản ký gửi. Mức lấy theo hợp đồng hợp tác đang hiệu lực.',
       true, 91
WHERE NOT EXISTS (
  SELECT 1 FROM public.services WHERE name = 'Hoa hồng môi giới ký gửi'
);

INSERT INTO public.service_variants (service_id, variant_key, name, price, is_active, sort_order)
SELECT s.id, 'broker_commission', 'Theo hợp đồng hợp tác', 0, true, 0
FROM public.services s
WHERE s.name = 'Hoa hồng môi giới ký gửi'
  AND NOT EXISTS (SELECT 1 FROM public.service_variants WHERE variant_key = 'broker_commission');

-- ─── 5. admin_win_opportunity: lấy mức từ hợp đồng ───────────────────────────
-- Khác bản 20260719000007 ở ba chỗ: resolve điều khoản theo hợp đồng tại
-- `_ordered_at`, truyền `supplier_id` xuống đơn (bắt buộc với dịch vụ
-- per_order — trigger không tự suy ra được), và ghi `contract_*` để truy vết.

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
  v_opp      public.opportunities%ROWTYPE;
  v_customer UUID;
  v_order    UUID;
  v_mode     TEXT;
  v_amount   NUMERIC(18,0);
  v_gross    NUMERIC(18,0);
  v_terms    RECORD;
  v_ctype    TEXT;
  v_cvalue   NUMERIC(12,2);
  v_cid      UUID;
  v_lineid   UUID;
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

  -- Hợp đồng là nguồn CÓ THẨM QUYỀN: tra lại tại NGÀY ĐẶT ĐƠN, không dùng mức
  -- đã đọng trên cơ hội từ lúc tạo (có thể đã tái ký từ đó tới giờ).
  IF v_opp.service_kind = 'commission' AND v_opp.supplier_id IS NOT NULL THEN
    SELECT * INTO v_terms
      FROM public.resolve_contract_terms(
        v_opp.supplier_id, v_opp.service_id, v_opp.service_variant_id, _ordered_at::date);
    IF FOUND THEN
      v_ctype  := v_terms.commission_type;
      v_cvalue := v_terms.commission_value;
      v_cid    := v_terms.contract_id;
      v_lineid := v_terms.line_id;
    END IF;
  END IF;

  IF v_opp.service_kind = 'commission' AND v_opp.supplier_id IS NULL THEN
    RAISE EXCEPTION 'Cơ hội hoa hồng chưa gắn đối tác — hãy tạo hồ sơ đối tác và hợp đồng trước'
      USING ERRCODE = 'check_violation';
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
      v_opp.supplier_id, v_ctype, v_cvalue,
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

-- ─── 6. owner_select_service_quote: gắn hợp đồng khi có ──────────────────────
-- Giữ nguyên toàn bộ phần ghi trạng thái yêu cầu; chỉ thay đoạn chọn dịch vụ +
-- tạo cơ hội. Nguyên tắc bất di: CHỦ TÀI SẢN KHÔNG BAO GIỜ BỊ CHẶN vì back-office
-- thiếu hợp đồng — không có hợp đồng thì rơi về dịch vụ 'direct' như hôm nay.

CREATE OR REPLACE FUNCTION public.owner_select_service_quote(_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_req      public.asset_service_requests%ROWTYPE;
  v_posting  public.asset_postings%ROWTYPE;
  v_org      public.auction_organizations%ROWTYPE;
  v_prof     RECORD;
  v_service  UUID;
  v_variant  UUID;
  v_lead     UUID;
  v_opp      UUID;
  v_supplier UUID;
  v_terms    RECORD;
  v_ctype    TEXT    := NULL;
  v_cvalue   NUMERIC := NULL;
  v_cid      UUID    := NULL;
  v_lineid   UUID    := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Vui lòng đăng nhập' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_req FROM public.asset_service_requests WHERE id = _request_id;
  IF NOT FOUND OR v_req.user_id <> v_uid THEN
    RAISE EXCEPTION 'Không tìm thấy yêu cầu' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_req.status <> 'quoted' THEN
    RAISE EXCEPTION 'Chỉ chọn được tổ chức đã gửi báo giá' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_posting FROM public.asset_postings WHERE id = v_req.asset_posting_id;
  SELECT * INTO v_org     FROM public.auction_organizations WHERE id = v_req.auction_org_id;

  UPDATE public.asset_service_requests SET status = 'selected' WHERE id = _request_id;

  UPDATE public.asset_service_requests
     SET status = 'not_selected'
   WHERE asset_posting_id = v_req.asset_posting_id
     AND id <> _request_id
     AND status IN ('sent', 'seen', 'quoted');

  UPDATE public.asset_broker_requests
     SET status = 'selected', selected_request_id = _request_id
   WHERE asset_posting_id = v_req.asset_posting_id AND status <> 'cancelled';

  -- ⚠️ KHÔNG đụng vào asset_postings — guard_asset_posting_review() nuốt thay đổi
  -- của mọi caller thiếu quyền, KỂ CẢ hàm SECURITY DEFINER này.

  SELECT o.id, o.lead_id INTO v_opp, v_lead
    FROM public.opportunities o
   WHERE o.asset_posting_id = v_req.asset_posting_id
     AND o.stage IN ('selling', 'pending_approval')
   LIMIT 1;
  IF v_opp IS NOT NULL THEN
    RETURN jsonb_build_object('opportunity_id', v_opp, 'lead_id', v_lead, 'deduped', true);
  END IF;

  -- Tổ chức này đã có hồ sơ đối tác + hợp đồng đang hiệu lực chưa?
  SELECT id INTO v_supplier
    FROM public.suppliers
   WHERE auction_org_id = v_req.auction_org_id AND status = 'active'
   LIMIT 1;

  IF v_supplier IS NOT NULL THEN
    SELECT s.id INTO v_service
      FROM public.services s WHERE s.name = 'Hoa hồng môi giới ký gửi' LIMIT 1;
    SELECT sv.id INTO v_variant
      FROM public.service_variants sv WHERE sv.variant_key = 'broker_commission' LIMIT 1;

    IF v_service IS NOT NULL THEN
      SELECT * INTO v_terms
        FROM public.resolve_contract_terms(v_supplier, v_service, v_variant, CURRENT_DATE);
      IF FOUND THEN
        v_ctype  := v_terms.commission_type;
        v_cvalue := v_terms.commission_value;
        v_cid    := v_terms.contract_id;
        v_lineid := v_terms.line_id;
      ELSE
        -- Có đối tác nhưng chưa có hợp đồng phủ dịch vụ này ⇒ về đường cũ.
        v_service  := NULL;
        v_variant  := NULL;
        v_supplier := NULL;
      END IF;
    ELSE
      v_supplier := NULL;
    END IF;
  END IF;

  -- Đường cũ: dịch vụ môi giới 'direct', không điều khoản hoa hồng.
  IF v_service IS NULL THEN
    SELECT s.id INTO v_service FROM public.services s WHERE s.name = 'Môi giới ký gửi tài sản' LIMIT 1;
    SELECT sv.id INTO v_variant FROM public.service_variants sv WHERE sv.variant_key = 'broker_consignment' LIMIT 1;
  END IF;

  IF v_service IS NULL THEN
    -- Không chặn chủ tài sản chỉ vì catalog thiếu: việc chọn đã ghi xong ở trên.
    RETURN jsonb_build_object('opportunity_id', NULL, 'lead_id', NULL, 'deduped', false);
  END IF;

  SELECT name, email INTO v_prof FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.leads
    (name, contact_name, phone, email, lead_type, source, status, note,
     created_by, asset_posting_id)
  VALUES (
    COALESCE(NULLIF(v_prof.name, ''), v_prof.email, 'Chủ tài sản'),
    v_prof.name, NULL, v_prof.email,
    'asset_owner', 'asset_brokerage', 'new',
    'Chốt ký gửi "' || v_posting.title || '" với ' || COALESCE(v_org.name, 'tổ chức đấu giá'),
    v_uid, v_req.asset_posting_id
  )
  RETURNING id INTO v_lead;

  INSERT INTO public.opportunities
    (name, lead_id, opportunity_type, stage, service_id, service_variant_id,
     amount, gross_amount, created_by, asset_posting_id,
     supplier_id, commission_type, commission_value, contract_id, contract_line_id)
  VALUES (
    'Ký gửi: ' || v_posting.title,
    v_lead, 'new_business', 'selling', v_service, v_variant,
    0, COALESCE(v_req.quote_service_fee, 0), v_uid, v_req.asset_posting_id,
    v_supplier, v_ctype, v_cvalue, v_cid, v_lineid
  )
  RETURNING id INTO v_opp;

  RETURN jsonb_build_object(
    'opportunity_id', v_opp, 'lead_id', v_lead, 'deduped', false,
    'contract_id', v_cid
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_select_service_quote(UUID) TO authenticated;

-- ─── 7. Kiểm chứng ───────────────────────────────────────────────────────────

DO $$
DECLARE
  v_svc  UUID;
  v_leak BOOLEAN;
BEGIN
  SELECT id INTO v_svc FROM public.services WHERE name = 'Hoa hồng môi giới ký gửi';
  IF v_svc IS NULL THEN
    RAISE EXCEPTION 'Thiếu dịch vụ "Hoa hồng môi giới ký gửi"';
  END IF;

  -- Hàm nội bộ KHÔNG được để lọt cho vai thường. Quyền cấp cho PUBLIC lan sang
  -- mọi vai, nên soi 'anon' + 'authenticated' là đủ phủ.
  SELECT bool_or(has_function_privilege(r, p.oid, 'EXECUTE'))
    INTO v_leak
    FROM pg_proc p
   CROSS JOIN unnest(ARRAY['anon', 'authenticated']) AS r
   WHERE p.proname = 'resolve_contract_terms'
     AND p.pronamespace = 'public'::regnamespace;

  IF COALESCE(v_leak, false) THEN
    RAISE EXCEPTION 'resolve_contract_terms vẫn gọi được bởi vai thường — rò rỉ biên hoa hồng';
  END IF;

  RAISE NOTICE 'OK: dịch vụ hoa hồng ký gửi sẵn sàng, resolver nội bộ đã khoá';
END $$;
