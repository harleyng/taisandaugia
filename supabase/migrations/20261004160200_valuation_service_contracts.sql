-- Thẩm định giá vào hợp đồng cung ứng dịch vụ (HDCU) như 4 dịch vụ kia: chủ tài sản
-- ĐỒNG Ý điều khoản của đúng báo giá trước khi trả tiền đơn asset_valuation_orders.

ALTER TABLE public.service_contracts DROP CONSTRAINT service_contracts_service_kind_check;
ALTER TABLE public.service_contracts ADD CONSTRAINT service_contracts_service_kind_check
  CHECK (service_kind IN ('vr-tour', 'giam-dinh', 'tu-van-phap-ly', 'tu-van-dau-gia', 'tham-dinh'));

ALTER TABLE public.contract_templates DROP CONSTRAINT contract_templates_template_type_check;
ALTER TABLE public.contract_templates ADD CONSTRAINT contract_templates_template_type_check
  CHECK (template_type IN ('consignment', 'sale',
                           'service:vr-tour', 'service:giam-dinh',
                           'service:tu-van-phap-ly', 'service:tu-van-dau-gia', 'service:tham-dinh'));

CREATE OR REPLACE FUNCTION public.service_kind_admin_module(_kind TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _kind
           WHEN 'vr-tour' THEN 'don-vr-tour'
           WHEN 'giam-dinh' THEN 'don-giam-dinh'
           WHEN 'tu-van-phap-ly' THEN 'tu-van-phap-ly'
           WHEN 'tu-van-dau-gia' THEN 'tu-van-dau-gia'
           WHEN 'tham-dinh' THEN 'tham-dinh-gia'
         END
$$;

CREATE OR REPLACE FUNCTION public.service_kind_label(_kind TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _kind
           WHEN 'vr-tour' THEN 'VR tour'
           WHEN 'giam-dinh' THEN 'Giám định tài sản'
           WHEN 'tu-van-phap-ly' THEN 'Tư vấn pháp lý'
           WHEN 'tu-van-dau-gia' THEN 'Tư vấn đấu giá'
           WHEN 'tham-dinh' THEN 'Thẩm định giá tài sản'
         END
$$;

-- Đơn dịch vụ chuẩn hoá (chép bản LIVE + nhánh tham-dinh). done_at = hoàn tất thẩm định.
CREATE OR REPLACE FUNCTION public._service_orders()
 RETURNS TABLE(service_kind text, order_id uuid, order_code text, asset_posting_id uuid, user_id uuid, status text, quoted_price numeric, quoted_at timestamp with time zone, quote_expires_at timestamp with time zone, quote_note text, package_name text, partner_name text, expert_name text, posting_title text, paid_at timestamp with time zone, done_at timestamp with time zone, cancelled_at timestamp with time zone, created_at timestamp with time zone, extra jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 'vr-tour', o.id, o.code, o.asset_posting_id, o.user_id, o.status, o.quoted_price, o.quoted_at,
         o.quote_expires_at, o.quote_note, o.package_name, o.partner_name, NULL::text, o.posting_title,
         o.paid_at, o.delivered_at, o.cancelled_at, o.created_at,
         jsonb_build_object('site_address', o.site_address)
    FROM public.asset_vr_tour_orders o
  UNION ALL
  SELECT 'giam-dinh', o.id, o.code, o.asset_posting_id, o.user_id, o.status, o.quoted_price, o.quoted_at,
         o.quote_expires_at, o.quote_note, o.package_name, o.partner_name, NULL::text, o.posting_title,
         o.paid_at, o.issued_at, o.cancelled_at, o.created_at,
         jsonb_build_object('method', o.method, 'site_address', o.site_address)
    FROM public.asset_authentication_orders o
  UNION ALL
  SELECT 'tu-van-phap-ly', o.id, o.code, o.asset_posting_id, o.user_id, o.status, o.quoted_price, o.quoted_at,
         o.quote_expires_at, o.quote_note, o.package_name, o.partner_name, o.expert_name, o.posting_title,
         o.paid_at, o.completed_at, o.cancelled_at, o.created_at,
         jsonb_build_object('doc_count', COALESCE(array_length(o.submitted_doc_paths, 1), 0))
    FROM public.asset_legal_consultations o
  UNION ALL
  SELECT 'tu-van-dau-gia', o.id, o.code, o.asset_posting_id, o.user_id, o.status, o.quoted_price, o.quoted_at,
         o.quote_expires_at, o.quote_note, o.package_name, o.partner_name, o.expert_name, o.posting_title,
         o.paid_at, o.completed_at, o.cancelled_at, o.created_at,
         jsonb_build_object('sale_goal', o.sale_goal)
    FROM public.asset_auction_consultations o
  UNION ALL
  SELECT 'tham-dinh', o.id, o.code, o.asset_posting_id, o.user_id, o.status, o.quoted_price, o.quoted_at,
         o.quote_expires_at, o.quote_note, o.package_name, o.partner_name, o.expert_name, o.posting_title,
         o.paid_at, o.completed_at, o.cancelled_at, o.created_at,
         jsonb_build_object('purpose', o.purpose, 'site_address', o.site_address)
    FROM public.asset_valuation_orders o
$function$;

-- Đồng ý HDCU (chép bản LIVE 20260927170100 + khoá dòng đơn tham-dinh).
CREATE OR REPLACE FUNCTION public.owner_accept_service_contract(_kind text, _order_id uuid, _template_id uuid, _expected_price numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid      UUID := auth.uid();
  o          RECORD;
  v_tpl      public.contract_templates%ROWTYPE;
  v_existing public.service_contracts%ROWTYPE;
  v_owner    JSONB;
  v_provider JSONB;
  v_terms    JSONB;
  v_row      public.service_contracts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF public.service_kind_admin_module(_kind) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_kind');
  END IF;

  -- Khoá dòng đơn: admin không báo giá lại xen giữa lúc đang chụp điều khoản.
  IF _kind = 'vr-tour' THEN
    PERFORM 1 FROM public.asset_vr_tour_orders WHERE id = _order_id FOR UPDATE;
  ELSIF _kind = 'giam-dinh' THEN
    PERFORM 1 FROM public.asset_authentication_orders WHERE id = _order_id FOR UPDATE;
  ELSIF _kind = 'tu-van-phap-ly' THEN
    PERFORM 1 FROM public.asset_legal_consultations WHERE id = _order_id FOR UPDATE;
  ELSIF _kind = 'tham-dinh' THEN
    PERFORM 1 FROM public.asset_valuation_orders WHERE id = _order_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.asset_auction_consultations WHERE id = _order_id FOR UPDATE;
  END IF;

  SELECT * INTO o FROM public._service_orders() s
   WHERE s.service_kind = _kind AND s.order_id = _order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF o.user_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_requester');
  END IF;
  IF NOT public.owner_posting_can(o.asset_posting_id, 'so-hoa', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  IF o.status <> 'quoted' OR o.quoted_price IS NULL OR o.quoted_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', o.status);
  END IF;
  IF o.quote_expires_at IS NOT NULL AND o.quote_expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quote_expired');
  END IF;
  IF _expected_price IS DISTINCT FROM o.quoted_price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quote_changed');
  END IF;

  -- Idempotent theo báo giá: bấm lại / hai tab ⇒ trả hợp đồng đã có.
  SELECT * INTO v_existing FROM public.service_contracts
   WHERE service_kind = _kind AND order_id = _order_id AND quoted_at = o.quoted_at
     AND price = o.quoted_price;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_accepted',
                              'contract_id', v_existing.id, 'code', v_existing.code);
  END IF;

  SELECT * INTO v_tpl FROM public.active_contract_template('service:' || _kind);
  IF v_tpl.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_template');
  END IF;
  IF v_tpl.id IS DISTINCT FROM _template_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'template_changed');
  END IF;

  SELECT public.consignment_posting_owner_party(o.asset_posting_id)
         || jsonb_build_object('signatory', jsonb_build_object(
              'user_id', v_uid, 'name', pr.name, 'email', pr.email))
    INTO v_owner
    FROM public.profiles pr WHERE pr.id = v_uid;

  v_provider := jsonb_build_object(
    'name', v_tpl.clauses ->> 'provider_name',
    'tax_code', v_tpl.clauses ->> 'provider_tax_code',
    'address', v_tpl.clauses ->> 'provider_address',
    'representative', v_tpl.clauses ->> 'provider_representative',
    'rep_title', v_tpl.clauses ->> 'provider_rep_title',
    'email', v_tpl.clauses ->> 'provider_email',
    'partner_name', o.partner_name,
    'expert_name', o.expert_name);

  v_terms := jsonb_build_object(
    'service_label', public.service_kind_label(_kind),
    'order_code', o.order_code,
    'package_name', o.package_name,
    'posting_title', o.posting_title,
    'price', o.quoted_price,
    'quote_note', o.quote_note,
    'quoted_at', o.quoted_at,
    'quote_expires_at', o.quote_expires_at,
    'extra', o.extra);

  INSERT INTO public.service_contracts (
    service_kind, order_id, order_code, asset_posting_id, quoted_at, price,
    template_id, template_version, owner_party, provider_party, terms, content_hash, accepted_by)
  VALUES (
    _kind, _order_id, o.order_code, o.asset_posting_id, o.quoted_at, o.quoted_price,
    v_tpl.id, v_tpl.version, COALESCE(v_owner, jsonb_build_object('kind', 'unknown')), v_provider, v_terms,
    encode(sha256(convert_to(jsonb_build_object(
      'template', v_tpl.version, 'clauses', v_tpl.clauses, 'terms', v_terms,
      'owner', v_owner, 'provider', v_provider)::text, 'UTF8')), 'hex'),
    v_uid)
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'status', 'accepted', 'contract_id', v_row.id, 'code', v_row.code);
END;
$function$;

-- Mẫu HDCU thẩm định giá: phần chung chép từ mẫu TVPL đang có, thay phạm vi / sản phẩm / miễn trừ.
INSERT INTO public.contract_templates (template_type, version, effective_date, changelog, clauses)
SELECT 'service:tham-dinh', 'HDCU-TDG-MAU-2026-10', DATE '2026-10-01',
       'Bản đầu. CHƯA RÀ SOÁT PHÁP LÝ — thông tin Bên B còn [CẦN NHẬP].',
       (t.clauses - 'scope' - 'deliverables' - 'disclaimer') || jsonb_build_object(
         'scope', jsonb_build_array(
           'Khảo sát hiện trạng và hồ sơ của tài sản do Bên A cung cấp; khảo sát tại chỗ khi đơn vị thẩm định yêu cầu.',
           'Thẩm định giá tài sản theo mục đích Bên A đã chọn, áp dụng phương pháp thẩm định giá phù hợp theo Hệ thống tiêu chuẩn thẩm định giá Việt Nam.'),
         'deliverables',
           'Chứng thư thẩm định giá (PDF) kèm giá trị tài sản, ngày thẩm định và thời hạn hiệu lực, xem trên sàn.',
         'disclaimer', jsonb_build_array(
           'Giá trị thẩm định phản ánh hiện trạng tài sản và thị trường tại thời điểm thẩm định, chỉ có hiệu lực trong thời hạn ghi trên chứng thư.',
           'Kết quả thẩm định giá mang tính tham khảo, không tự động trở thành giá khởi điểm và không làm thay đổi trạng thái duyệt hồ sơ trên sàn.',
           'Bên B không chịu trách nhiệm về tính xác thực của tài liệu do Bên A cung cấp.'))
  FROM public.contract_templates t
 WHERE t.template_type = 'service:tu-van-phap-ly' AND t.version = 'HDCU-TVPL-MAU-2026-09'
ON CONFLICT (template_type, version) DO NOTHING;
