-- Hợp đồng cung ứng dịch vụ (HDCU) — chủ tài sản ĐỒNG Ý điều khoản trước khi trả
-- tiền 4 dịch vụ: VR tour, giám định, tư vấn pháp lý, tư vấn đấu giá.
--
-- Một dòng = một lần đồng ý cho MỘT báo giá (service_kind, order_id, quoted_at).
-- Admin báo giá lại ⇒ quoted_at đổi ⇒ phải đồng ý lại. Bảng CHỈ GHI THÊM: không
-- ai sửa/xoá, kể cả SECURITY DEFINER (trigger chặn).
--
-- Bên A = consignment_posting_owner_party(hồ sơ) + người bấm đồng ý (signatory).
-- Bên B = sàn, lấy từ khối provider_* của mẫu đang áp dụng. terms = dữ kiện đơn.
-- Nội dung điều khoản không chép vào dòng: template_id FK RESTRICT tới mẫu bất biến.
--
-- Cổng thanh toán (trigger trên 4 bảng đơn) nằm ở migration RIÊNG, áp sau khi
-- giao diện "đồng ý trước khi trả" đã lên production.

-- slug dịch vụ → mã quyền admin của module đơn (đọc hợp đồng của đơn mình xử lý).
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
         END
$$;

CREATE SEQUENCE public.service_contract_code_seq;

CREATE TABLE public.service_contracts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT NOT NULL UNIQUE
                     DEFAULT ('HDCU' || lpad(nextval('public.service_contract_code_seq')::text, 6, '0')),
  service_kind     TEXT NOT NULL CHECK (service_kind IN ('vr-tour', 'giam-dinh', 'tu-van-phap-ly', 'tu-van-dau-gia')),
  -- Đa hình theo service_kind nên không FK; RPC đồng ý kiểm đơn có thật.
  order_id         UUID NOT NULL,
  order_code       TEXT NOT NULL,
  asset_posting_id UUID NOT NULL REFERENCES public.asset_postings(id) ON DELETE RESTRICT,
  quoted_at        TIMESTAMPTZ NOT NULL,
  price            NUMERIC(18, 0) NOT NULL CHECK (price >= 0),
  template_id      UUID NOT NULL REFERENCES public.contract_templates(id) ON DELETE RESTRICT,
  template_version TEXT NOT NULL,
  owner_party      JSONB NOT NULL,
  provider_party   JSONB NOT NULL,
  terms            JSONB NOT NULL,
  content_hash     TEXT NOT NULL,
  -- Không FK (bảng bất biến; SET NULL là UPDATE).
  accepted_by      UUID NOT NULL,
  accepted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_kind, order_id, quoted_at)
);

CREATE INDEX idx_service_contracts_order ON public.service_contracts (service_kind, order_id);
CREATE INDEX idx_service_contracts_posting ON public.service_contracts (asset_posting_id);

CREATE OR REPLACE FUNCTION public.service_contracts_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Hợp đồng dịch vụ đã giao kết không sửa hay xoá được.'
    USING ERRCODE = 'P0001', HINT = 'SC_IMMUTABLE';
END;
$$;

CREATE TRIGGER service_contracts_immutable
  BEFORE UPDATE OR DELETE ON public.service_contracts
  FOR EACH ROW EXECUTE FUNCTION public.service_contracts_immutable();

ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;

-- Đọc: thành viên đọc được hồ sơ, admin module Hợp đồng, admin module của đơn.
-- Không policy ghi — chỉ ghi qua owner_accept_service_contract.
CREATE POLICY service_contracts_read ON public.service_contracts
  FOR SELECT TO authenticated
  USING (public.owner_posting_can(asset_posting_id, 'read')
         OR public.admin_has_permission('hop-dong', 'view')
         OR public.admin_has_permission(public.service_kind_admin_module(service_kind), 'view'));

REVOKE INSERT, UPDATE, DELETE ON public.service_contracts FROM authenticated, anon;

-- ─── Đơn dịch vụ chuẩn hoá (dùng nội bộ bởi các RPC bên dưới) ────────────────
-- done_at: VR = giao link, giám định = cấp chứng thư, tư vấn = hoàn tất.
CREATE OR REPLACE FUNCTION public._service_orders()
RETURNS TABLE(service_kind text, order_id uuid, order_code text, asset_posting_id uuid,
              user_id uuid, status text, quoted_price numeric, quoted_at timestamptz,
              quote_expires_at timestamptz, quote_note text, package_name text,
              partner_name text, expert_name text, posting_title text, paid_at timestamptz,
              done_at timestamptz, cancelled_at timestamptz, created_at timestamptz,
              extra jsonb)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public._service_orders() FROM PUBLIC, anon, authenticated;

-- ─── Đồng ý hợp đồng ─────────────────────────────────────────────────────────
-- Chỉ NGƯỜI GỬI yêu cầu (cũng là người duy nhất _settle_* cho trả tiền) và còn
-- quyền ghi hồ sơ. Mẫu phải đúng bản đang áp dụng mà người dùng vừa xem.
CREATE OR REPLACE FUNCTION public.owner_accept_service_contract(
  _kind           TEXT,
  _order_id       UUID,
  _template_id    UUID,
  _expected_price NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
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
  IF NOT public.owner_posting_can(o.asset_posting_id, 'write') THEN
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
$$;

REVOKE ALL ON FUNCTION public.owner_accept_service_contract(TEXT, UUID, UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_accept_service_contract(TEXT, UUID, UUID, NUMERIC) TO authenticated;

-- ─── Danh sách hợp đồng dịch vụ theo TENANT (cổng chủ tài sản) ───────────────
-- Một dòng / đơn đã có báo giá mà: đã đồng ý báo giá hiện hành, HOẶC đang chờ đồng
-- ý (quoted, chưa hết hạn), HOẶC đã trả trước khi có hợp đồng (legacy).
-- Scope giống owner_consignment_summary: NULL = hồ sơ cá nhân, có = không gian.
CREATE OR REPLACE FUNCTION public.owner_service_contracts(p_workspace_id UUID DEFAULT NULL)
RETURNS TABLE(service_kind text, order_id uuid, order_code text, asset_posting_id uuid,
              posting_title text, package_name text, partner_name text, order_status text,
              quoted_price numeric, quoted_at timestamptz, quote_expires_at timestamptz,
              paid_at timestamptz, done_at timestamptz, cancelled_at timestamptz,
              contract_id uuid, contract_code text, accepted_at timestamptz,
              needs_acceptance boolean, can_accept boolean, legacy boolean, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH o AS (
    SELECT s.*, p.workspace_id, p.branch_id, p.user_id AS posting_user_id
      FROM public._service_orders() s
      JOIN public.asset_postings p ON p.id = s.asset_posting_id
     WHERE s.quoted_at IS NOT NULL
       AND CASE
             WHEN p_workspace_id IS NULL
               THEN p.workspace_id IS NULL AND p.user_id = auth.uid()
             ELSE p.workspace_id = p_workspace_id AND public.owner_ws_can(p_workspace_id, 'read')
           END
  ), j AS (
    SELECT o.*, sc.id AS sc_id, sc.code AS sc_code, sc.accepted_at AS sc_accepted_at,
           (o.status = 'quoted'
            AND (o.quote_expires_at IS NULL OR o.quote_expires_at >= now())) AS open_quote
      FROM o
      LEFT JOIN public.service_contracts sc
        ON sc.service_kind = o.service_kind AND sc.order_id = o.order_id
       AND sc.quoted_at = o.quoted_at AND sc.price = o.quoted_price
  )
  SELECT j.service_kind, j.order_id, j.order_code, j.asset_posting_id, j.posting_title, j.package_name,
         j.partner_name, j.status, j.quoted_price, j.quoted_at, j.quote_expires_at, j.paid_at, j.done_at,
         j.cancelled_at, j.sc_id, j.sc_code, j.sc_accepted_at,
         (j.sc_id IS NULL AND j.open_quote),
         (j.sc_id IS NULL AND j.open_quote AND j.user_id = auth.uid()
          AND public.owner_posting_row_can(j.workspace_id, j.branch_id, j.posting_user_id, 'write')),
         (j.sc_id IS NULL AND j.paid_at IS NOT NULL),
         j.created_at
    FROM j
   WHERE j.sc_id IS NOT NULL OR j.open_quote OR j.paid_at IS NOT NULL
   ORDER BY COALESCE(j.sc_accepted_at, j.quoted_at) DESC
$$;

REVOKE ALL ON FUNCTION public.owner_service_contracts(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_service_contracts(UUID) TO authenticated;

-- ─── Chi tiết một hợp đồng dịch vụ (chủ tài sản + admin dùng chung) ──────────
CREATE OR REPLACE FUNCTION public.service_contract_detail(_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sc   public.service_contracts%ROWTYPE;
  tpl  public.contract_templates%ROWTYPE;
  o    RECORD;
  v_by TEXT;
BEGIN
  SELECT * INTO sc FROM public.service_contracts WHERE id = _contract_id;
  IF NOT FOUND
     OR NOT (public.owner_posting_can(sc.asset_posting_id, 'read')
             OR public.admin_has_permission('hop-dong', 'view')
             OR public.admin_has_permission(public.service_kind_admin_module(sc.service_kind), 'view')) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO tpl FROM public.contract_templates WHERE id = sc.template_id;
  SELECT * INTO o FROM public._service_orders() s
   WHERE s.service_kind = sc.service_kind AND s.order_id = sc.order_id;
  SELECT pr.name INTO v_by FROM public.profiles pr WHERE pr.id = sc.accepted_by;

  RETURN jsonb_build_object(
    'ok', true,
    'contract', to_jsonb(sc),
    'template', jsonb_build_object('id', tpl.id, 'version', tpl.version,
                                   'effective_date', tpl.effective_date, 'clauses', tpl.clauses),
    'order', CASE WHEN o.order_id IS NULL THEN NULL ELSE jsonb_build_object(
               'status', o.status, 'quoted_at', o.quoted_at, 'quoted_price', o.quoted_price,
               'paid_at', o.paid_at, 'done_at', o.done_at, 'cancelled_at', o.cancelled_at) END,
    -- Báo giá hiện hành của đơn còn là báo giá đã đồng ý không (admin báo lại ⇒ không).
    'is_current', o.order_id IS NOT NULL AND o.quoted_at = sc.quoted_at AND o.quoted_price = sc.price,
    'accepted_by_name', v_by);
END;
$$;

REVOKE ALL ON FUNCTION public.service_contract_detail(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.service_contract_detail(UUID) TO authenticated;

-- ─── Danh sách mọi hợp đồng cho admin (module "hop-dong") ────────────────────
-- Chuẩn hoá 3 loại. Cổng ở đây vì quyền đọc bảng đơn dịch vụ theo module riêng
-- từng dịch vụ — admin chỉ có hop-dong:view vẫn phải thấy đủ.
CREATE OR REPLACE FUNCTION public.admin_contract_list()
RETURNS TABLE(contract_type text, service_kind text, id uuid, code text, status text,
              stage text, title text, party_a text, party_b text, value numeric,
              created_at timestamptz, signed_at timestamptz, cancelled_at timestamptz,
              asset_posting_id uuid, order_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_has_permission('hop-dong', 'view') THEN
    RAISE EXCEPTION 'Không có quyền xem hợp đồng.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  (SELECT 'consignment'::text, NULL::text, c.id, c.code, c.status, c.status,
          c.asset_snapshot ->> 'title',
          COALESCE(NULLIF(c.owner_party ->> 'org_name', ''), c.owner_party ->> 'full_name'),
          c.org_party ->> 'name',
          NULLIF(c.terms ->> 'service_fee', '')::numeric,
          c.created_at, c.signed_at, c.cancelled_at, c.asset_posting_id, NULL::uuid
     FROM public.consignment_contracts c
    ORDER BY c.created_at DESC LIMIT 500)
  UNION ALL
  (SELECT 'sale'::text, NULL::text, s.id, s.code, s.status, public.sale_contract_stage(s),
          s.asset_snapshot ->> 'title',
          COALESCE(NULLIF(s.seller_party ->> 'org_name', ''), s.seller_party ->> 'name'),
          s.buyer_party ->> 'full_name',
          s.price, s.created_at, s.signed_at, s.cancelled_at, NULL::uuid, NULL::uuid
     FROM public.auction_sale_contracts s
    ORDER BY s.created_at DESC LIMIT 500)
  UNION ALL
  (SELECT 'service'::text, sc.service_kind, sc.id, sc.code, COALESCE(o.status, 'unknown'),
          -- Admin báo giá lại sau khi chủ đã đồng ý ⇒ hợp đồng này không còn hiệu lực.
          CASE WHEN o.order_id IS NOT NULL
                    AND (o.quoted_at IS DISTINCT FROM sc.quoted_at OR o.quoted_price IS DISTINCT FROM sc.price)
               THEN 'requoted' ELSE COALESCE(o.status, 'unknown') END,
          sc.terms ->> 'posting_title',
          COALESCE(NULLIF(sc.owner_party ->> 'org_name', ''), sc.owner_party ->> 'full_name',
                   sc.owner_party -> 'signatory' ->> 'name'),
          sc.provider_party ->> 'partner_name',
          sc.price, sc.accepted_at, sc.accepted_at, o.cancelled_at, sc.asset_posting_id, sc.order_id
     FROM public.service_contracts sc
     LEFT JOIN public._service_orders() o
       ON o.service_kind = sc.service_kind AND o.order_id = sc.order_id
    ORDER BY sc.accepted_at DESC LIMIT 500);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_contract_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_contract_list() TO authenticated;
