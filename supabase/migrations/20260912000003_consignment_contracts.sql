-- Hợp đồng dịch vụ đấu giá tài sản: CHỦ TÀI SẢN ↔ TỔ CHỨC ĐẤU GIÁ
--
-- Trước đây luồng ký gửi dừng ở "chủ tài sản chốt một báo giá" — hợp đồng hoàn
-- toàn nằm ngoài nền tảng, không bên nào thấy tiến độ, và tổ chức đưa được tài
-- sản vào phiên khi chưa có hợp đồng nào. Không phải `supplier_contracts` (hợp
-- đồng hoa hồng giữa SÀN và tổ chức, admin-only).
--
-- Cách làm: tổ chức chia sẻ dự thảo → hai bên ký bản giấy → một bên tải bản scan
-- → CẢ HAI xác nhận trên sàn → 'signed'. Không tích hợp chữ ký số.
--
--   drafting ─(tổ chức chia sẻ dự thảo)→ awaiting_signatures
--            ─(một bên tải bản đã ký)──→ awaiting_confirmation ─(đủ 2 xác nhận)→ signed
--   mọi trạng thái mở ─(một bên huỷ, kèm lý do)→ cancelled
--
-- Bảng riêng, KHÔNG thêm cột vào asset_service_requests: hợp đồng có vòng đời,
-- tệp, hai lần xác nhận, lịch sử huỷ riêng; và tổ chức đọc được NGUYÊN DÒNG yêu
-- cầu qua asr_org_read — dòng hợp đồng chứa CCCD / địa chỉ chủ tài sản nên KHÔNG
-- có policy đọc cho tổ chức, tổ chức đọc qua RPC org_consignment_contract.

-- ─── 1. Yêu cầu dịch vụ: trạng thái huỷ hợp đồng ─────────────────────────────

ALTER TABLE public.asset_service_requests
  DROP CONSTRAINT IF EXISTS asset_service_requests_status_check;
ALTER TABLE public.asset_service_requests
  ADD CONSTRAINT asset_service_requests_status_check
  CHECK (status IN ('sent', 'seen', 'quoted', 'accepted', 'declined', 'selected',
                    'not_selected', 'withdrawn', 'contract_cancelled'));

ALTER TABLE public.asset_service_requests
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ;

COMMENT ON COLUMN public.asset_service_requests.reopened_at IS
  'Thời điểm dòng not_selected được mở lại vì hợp đồng của tổ chức đã chốt bị huỷ.';

-- ─── 2. Bảng hợp đồng ────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.consignment_contract_code_seq;

CREATE TABLE IF NOT EXISTS public.consignment_contracts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT UNIQUE,
  contract_no          TEXT,
  service_request_id   UUID NOT NULL UNIQUE
                         REFERENCES public.asset_service_requests(id) ON DELETE CASCADE,
  asset_posting_id     UUID NOT NULL REFERENCES public.asset_postings(id) ON DELETE CASCADE,
  auction_org_id       UUID NOT NULL REFERENCES public.auction_organizations(id),
  organization_id      UUID NOT NULL REFERENCES public.organizations(id),
  owner_user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opportunity_id       UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,

  status               TEXT NOT NULL DEFAULT 'drafting'
                         CHECK (status IN ('drafting', 'awaiting_signatures',
                                           'awaiting_confirmation', 'signed', 'cancelled')),
  source               TEXT NOT NULL DEFAULT 'platform'
                         CHECK (source IN ('platform', 'backfill')),

  terms                JSONB NOT NULL DEFAULT '{}'::jsonb,
  owner_party          JSONB NOT NULL DEFAULT '{}'::jsonb,
  org_party            JSONB NOT NULL DEFAULT '{}'::jsonb,
  asset_snapshot       JSONB NOT NULL DEFAULT '{}'::jsonb,

  draft_doc_path       TEXT,
  draft_source         TEXT CHECK (draft_source IS NULL OR draft_source IN ('generated', 'uploaded')),
  draft_uploaded_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  draft_uploaded_at    TIMESTAMPTZ,

  signed_doc_path      TEXT,
  signed_uploaded_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  signed_uploaded_side TEXT CHECK (signed_uploaded_side IS NULL OR signed_uploaded_side IN ('owner', 'org')),
  signed_uploaded_at   TIMESTAMPTZ,
  signed_date          DATE,

  owner_confirmed_at   TIMESTAMPTZ,
  owner_confirmed_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  org_confirmed_at     TIMESTAMPTZ,
  org_confirmed_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  signed_at            TIMESTAMPTZ,

  cancelled_at         TIMESTAMPTZ,
  cancelled_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_side       TEXT CHECK (cancelled_side IS NULL OR cancelled_side IN ('owner', 'org')),
  cancel_reason        TEXT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cc_awaiting_sig_has_draft
    CHECK (status <> 'awaiting_signatures' OR draft_doc_path IS NOT NULL),
  CONSTRAINT cc_awaiting_conf_has_scan
    CHECK (status <> 'awaiting_confirmation' OR signed_doc_path IS NOT NULL),
  -- Hợp đồng từ backfill (đã ký ngoài sàn trước khi có luồng này) được miễn.
  CONSTRAINT cc_signed_complete
    CHECK (status <> 'signed' OR source = 'backfill' OR
           (signed_doc_path IS NOT NULL AND signed_date IS NOT NULL
            AND owner_confirmed_at IS NOT NULL AND org_confirmed_at IS NOT NULL)),
  CONSTRAINT cc_cancel_reason
    CHECK (status <> 'cancelled' OR
           (cancelled_at IS NOT NULL AND char_length(btrim(COALESCE(cancel_reason, ''))) > 0))
);

-- Tối đa một hợp đồng CÒN HIỆU LỰC / hồ sơ (song song với uq_asr_one_selection_per_posting).
CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_one_open_per_posting
  ON public.consignment_contracts (asset_posting_id) WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_cc_org_status   ON public.consignment_contracts (auction_org_id, status);
CREATE INDEX IF NOT EXISTS idx_cc_owner_status ON public.consignment_contracts (owner_user_id, status);

COMMENT ON TABLE public.consignment_contracts IS
  'Hợp đồng dịch vụ đấu giá giữa chủ tài sản và tổ chức đã được chốt. Mọi thao tác ghi qua RPC consignment_contract_*. Tổ chức đọc qua org_consignment_contract.';
COMMENT ON COLUMN public.consignment_contracts.terms IS
  'Báo giá đóng băng lúc chốt — bất biến.';
COMMENT ON COLUMN public.consignment_contracts.owner_party IS
  'Bên A chụp từ KYC; làm mới mỗi lần chia sẻ dự thảo / tải bản ký, đóng băng khi signed.';

-- ─── 3. Nhật ký (bằng chứng pháp lý: đổi tệp thì đường dẫn cũ vẫn còn ở đây) ──

CREATE TABLE IF NOT EXISTS public.consignment_contract_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.consignment_contracts(id) ON DELETE CASCADE,
  action      TEXT NOT NULL CHECK (action IN ('created', 'draft_shared', 'signed_uploaded',
                                              'confirmed', 'signed', 'cancelled')),
  side        TEXT CHECK (side IS NULL OR side IN ('owner', 'org')),
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  data        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cce_contract ON public.consignment_contract_events (contract_id, created_at);

-- ─── 4. Trigger ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.consignment_contracts_fill()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.code := 'HDKG' || lpad(nextval('public.consignment_contract_code_seq')::text, 6, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consignment_contracts_fill ON public.consignment_contracts;
CREATE TRIGGER consignment_contracts_fill
  BEFORE INSERT ON public.consignment_contracts
  FOR EACH ROW EXECUTE FUNCTION public.consignment_contracts_fill();

-- Tên trigger là load-bearing: '_guard' phải sắp TRƯỚC '_updated_at'.
CREATE OR REPLACE FUNCTION public.consignment_contracts_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE
  -- Cột được phép đổi trên hợp đồng đã khép: chỉ FK bị ON DELETE SET NULL.
  v_fk_cols CONSTANT TEXT[] := ARRAY['opportunity_id', 'draft_uploaded_by', 'signed_uploaded_by',
                                     'owner_confirmed_by', 'org_confirmed_by', 'cancelled_by', 'updated_at'];
BEGIN
  IF OLD.status IN ('signed', 'cancelled') THEN
    IF (to_jsonb(NEW) - v_fk_cols) = (to_jsonb(OLD) - v_fk_cols) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Hợp đồng % đã %, không sửa được nữa.',
      OLD.code, CASE WHEN OLD.status = 'signed' THEN 'ký' ELSE 'huỷ' END
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.id                 := OLD.id;
  NEW.code               := OLD.code;
  NEW.service_request_id := OLD.service_request_id;
  NEW.asset_posting_id   := OLD.asset_posting_id;
  NEW.auction_org_id     := OLD.auction_org_id;
  NEW.organization_id    := OLD.organization_id;
  NEW.owner_user_id      := OLD.owner_user_id;
  NEW.source             := OLD.source;
  NEW.terms              := OLD.terms;
  NEW.created_at         := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consignment_contracts_guard ON public.consignment_contracts;
CREATE TRIGGER consignment_contracts_guard
  BEFORE UPDATE ON public.consignment_contracts
  FOR EACH ROW EXECUTE FUNCTION public.consignment_contracts_guard();

DROP TRIGGER IF EXISTS consignment_contracts_updated_at ON public.consignment_contracts;
CREATE TRIGGER consignment_contracts_updated_at
  BEFORE UPDATE ON public.consignment_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Chủ tài sản có policy FOR ALL trên asset_postings ⇒ xoá hồ sơ sẽ CASCADE xoá
-- mất hợp đồng đang hiệu lực. Chặn ở đây.
CREATE OR REPLACE FUNCTION public.asset_postings_guard_contract_delete()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.consignment_contracts
              WHERE asset_posting_id = OLD.id AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'Hồ sơ đang có hợp đồng dịch vụ với tổ chức đấu giá — không xoá được.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS asset_postings_guard_contract_delete ON public.asset_postings;
CREATE TRIGGER asset_postings_guard_contract_delete
  BEFORE DELETE ON public.asset_postings
  FOR EACH ROW EXECUTE FUNCTION public.asset_postings_guard_contract_delete();

-- ─── 5. RLS — chỉ đọc; mọi ghi qua RPC ───────────────────────────────────────

ALTER TABLE public.consignment_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignment_contract_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_owner_read ON public.consignment_contracts;
CREATE POLICY cc_owner_read ON public.consignment_contracts
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS cc_admin_read ON public.consignment_contracts;
CREATE POLICY cc_admin_read ON public.consignment_contracts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS cce_owner_read ON public.consignment_contract_events;
CREATE POLICY cce_owner_read ON public.consignment_contract_events
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.consignment_contracts c
     WHERE c.id = contract_id AND c.owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS cce_admin_read ON public.consignment_contract_events;
CREATE POLICY cce_admin_read ON public.consignment_contract_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ─── 6. Helper nội bộ ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.consignment_request_terms(_r public.asset_service_requests)
RETURNS JSONB
LANGUAGE sql IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'commission_pct', _r.quote_commission_pct,
    'service_fee',    _r.quote_service_fee,
    'starting_price', _r.quote_starting_price,
    'lead_time_days', _r.quote_lead_time_days,
    'plan',           _r.quote_plan,
    'fee_items',      _r.quote_fee_items,
    'note',           _r.quote_note,
    'quote_doc_path', _r.quote_doc_path,
    'quoted_at',      _r.quoted_at
  );
$$;

-- Bên A. KYC tổ chức ưu tiên (ngân hàng / AMC ký với tư cách pháp nhân) — cùng
-- thứ tự OwnerPortalTopBar chọn tên hiển thị.
CREATE OR REPLACE FUNCTION public.consignment_owner_party(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v JSONB;
BEGIN
  SELECT jsonb_build_object(
           'kind', 'organization', 'org_name', k.org_name, 'tax_code', k.tax_code,
           'email', k.official_email, 'rep_full_name', k.rep_full_name, 'rep_title', k.rep_title,
           'rep_id_type', k.rep_id_type, 'rep_id_number', k.rep_id_number,
           'address', k.head_office_address, 'province', k.head_office_province)
    INTO v
    FROM public.asset_owner_org_kyc k
   WHERE k.created_by = _user_id AND k.status = 'approved'
   LIMIT 1;
  IF v IS NOT NULL THEN RETURN v; END IF;

  SELECT jsonb_build_object(
           'kind', 'individual', 'full_name', k.full_name, 'id_type', k.id_type,
           'id_number', k.id_number, 'phone', k.phone, 'email', k.contact_email,
           'address', k.address, 'ward', k.ward, 'province', k.province)
    INTO v
    FROM public.asset_owner_kyc k
   WHERE k.user_id = _user_id AND k.status = 'approved'
   LIMIT 1;
  IF v IS NOT NULL THEN RETURN v; END IF;

  SELECT jsonb_build_object('kind', 'unknown', 'full_name', p.name, 'email', p.email)
    INTO v FROM public.profiles p WHERE p.id = _user_id;
  RETURN COALESCE(v, jsonb_build_object('kind', 'unknown'));
END;
$$;

-- Bên B. "Thông tin chung" của tổ chức (org_general_info) ưu tiên, thiếu thì lấy danh bạ.
CREATE OR REPLACE FUNCTION public.consignment_org_party(_auction_org_id UUID, _organization_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'name',               COALESCE(NULLIF(g.name, ''), a.name),
    'tax_code',           COALESCE(NULLIF(g.tax_code, ''), a.tax_code),
    'address',            COALESCE(NULLIF(g.address, ''), a.address),
    'ward',               NULLIF(g.ward, ''),
    'district',           NULLIF(g.district, ''),
    'province',           COALESCE(NULLIF(g.province, ''), a.province),
    'phone',              COALESCE(NULLIF(g.phone, ''), a.phone),
    'email',              COALESCE(NULLIF(g.email, ''), a.email),
    'legal_rep_name',     NULLIF(g.legal_rep_name, ''),
    'legal_rep_position', NULLIF(g.legal_rep_position, '')
  )
  FROM public.auction_organizations a
  LEFT JOIN public.org_general_info g ON g.organization_id = _organization_id
  WHERE a.id = _auction_org_id;
$$;

CREATE OR REPLACE FUNCTION public.consignment_asset_snapshot(_posting_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'title', p.title, 'parent_slug', p.parent_slug, 'child_slug', p.child_slug,
    'address', p.address, 'ward', p.ward, 'district', p.district, 'province', p.province,
    'starting_price', p.starting_price, 'pricing_mode', p.pricing_mode,
    'auction_format', p.auction_format, 'has_dispute', p.has_dispute,
    'has_mortgage', p.has_mortgage, 'is_seized', p.is_seized,
    'right_to_sell', p.right_to_sell, 'legal_notes', p.legal_notes
  )
  FROM public.asset_postings p
  WHERE p.id = _posting_id;
$$;

-- Thông tin pháp lý tối thiểu để lập hợp đồng. Nhân bản ở MissingParty
-- (src/types/consignment-contract.ts) — thêm mã mới thì thêm cả hai bên.
CREATE OR REPLACE FUNCTION public.consignment_missing_parties(_owner_party JSONB, _org_party JSONB)
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN COALESCE(btrim(_owner_party->>'address'), '') = '' THEN 'owner_address' END,
    CASE WHEN COALESCE(btrim(_org_party->>'legal_rep_name'), '') = '' THEN 'org_legal_rep' END
  ], NULL);
$$;

-- Người gọi có quyền THAO TÁC trên hợp đồng với tư cách một bên không.
-- Tổ chức: thành viên + quyền yeu-cau-ky-gui.update (hoặc chủ sở hữu tổ chức).
CREATE OR REPLACE FUNCTION public.consignment_can_act(
  _owner_user_id UUID, _auction_org_id UUID, _organization_id UUID, _side TEXT
)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN _side = 'owner' THEN _owner_user_id = auth.uid()
    WHEN _side = 'org' THEN
      public.user_in_auction_org(_auction_org_id)
      AND (public.org_has_permission(_organization_id, 'yeu-cau-ky-gui', 'update')
           OR EXISTS (SELECT 1 FROM public.organizations o
                       WHERE o.id = _organization_id AND o.owner_id = auth.uid()))
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.consignment_path_uuid(_name TEXT, _seg INT)
RETURNS UUID
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  RETURN NULLIF(split_part(_name, '/', _seg), '')::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

-- NULL = hợp lệ; ngược lại là mã lỗi. Tệp phải nằm ĐÚNG thư mục của hợp đồng,
-- đúng loại (draft-/signed-), và đã thực sự được tải lên.
CREATE OR REPLACE FUNCTION public.consignment_contract_file_check(
  _organization_id UUID, _contract_id UUID, _path TEXT, _kind TEXT
)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _path IS NULL
     OR public.consignment_path_uuid(_path, 1) IS DISTINCT FROM _organization_id
     OR public.consignment_path_uuid(_path, 2) IS DISTINCT FROM _contract_id
     OR split_part(_path, '/', 3) NOT LIKE _kind || '-%'
     OR split_part(_path, '/', 4) <> '' THEN
    RETURN 'invalid_path';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o
                  WHERE o.bucket_id = 'consignment-contracts' AND o.name = _path) THEN
    RETURN 'file_missing';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.consignment_request_terms(public.asset_service_requests) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consignment_owner_party(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consignment_org_party(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consignment_asset_snapshot(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consignment_missing_parties(JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consignment_can_act(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consignment_path_uuid(TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consignment_contract_file_check(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ─── 7. Storage: bucket PRIVATE consignment-contracts ────────────────────────
-- Path: {organization_id}/{contract_id}/{draft|signed}-{epoch}-{tên}. Lưu PATH,
-- mở bằng createSignedUrl. Không UPDATE/DELETE: tệp là bằng chứng, chỉ thêm.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('consignment-contracts', 'consignment-contracts', false, 10485760,
        ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- Hai helper dưới đây được policy gọi dưới quyền người dùng ⇒ phải GRANT.
-- Chúng chỉ trả boolean về chính người gọi.
CREATE OR REPLACE FUNCTION public.can_read_consignment_contract_file(_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.consignment_contracts c
     WHERE c.id = public.consignment_path_uuid(_name, 2)
       AND c.organization_id = public.consignment_path_uuid(_name, 1)
       AND (c.owner_user_id = auth.uid()
            OR public.has_role(auth.uid(), 'ADMIN'::app_role)
            -- Tổ chức mất quyền đọc khi hợp đồng bị huỷ.
            OR (c.status <> 'cancelled' AND public.user_in_auction_org(c.auction_org_id)))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_upload_consignment_contract_file(_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.consignment_contracts c
     WHERE c.id = public.consignment_path_uuid(_name, 2)
       AND c.organization_id = public.consignment_path_uuid(_name, 1)
       AND c.status IN ('drafting', 'awaiting_signatures', 'awaiting_confirmation')
       AND (public.consignment_can_act(c.owner_user_id, c.auction_org_id, c.organization_id, 'owner')
            OR public.consignment_can_act(c.owner_user_id, c.auction_org_id, c.organization_id, 'org'))
  );
$$;

REVOKE ALL ON FUNCTION public.can_read_consignment_contract_file(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_upload_consignment_contract_file(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_consignment_contract_file(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_consignment_contract_file(TEXT) TO authenticated;

DROP POLICY IF EXISTS consignment_contract_files_read ON storage.objects;
CREATE POLICY consignment_contract_files_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'consignment-contracts' AND public.can_read_consignment_contract_file(name));

DROP POLICY IF EXISTS consignment_contract_files_insert ON storage.objects;
CREATE POLICY consignment_contract_files_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'consignment-contracts' AND public.can_upload_consignment_contract_file(name));

-- Giấy tờ sở hữu (asset-docs, path {owner_uid}/…): tổ chức ĐÃ CHỐT đọc được khi
-- hợp đồng còn hiệu lực — đúng lời hứa "bản gốc trao đổi sau khi hai bên chốt".
CREATE OR REPLACE FUNCTION public.can_read_asset_doc_for_contract(_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.consignment_contracts c
      JOIN public.asset_postings p ON p.id = c.asset_posting_id
     WHERE c.owner_user_id = public.consignment_path_uuid(_name, 1)
       AND c.status <> 'cancelled'
       AND _name = ANY (COALESCE(p.ownership_proof_urls, '{}') || COALESCE(p.doc_urls, '{}'))
       AND public.user_in_auction_org(c.auction_org_id)
  );
$$;

REVOKE ALL ON FUNCTION public.can_read_asset_doc_for_contract(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_asset_doc_for_contract(TEXT) TO authenticated;

DROP POLICY IF EXISTS asset_docs_contract_org_read ON storage.objects;
CREATE POLICY asset_docs_contract_org_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'asset-docs' AND public.can_read_asset_doc_for_contract(name));

-- ─── 8. Backfill: mọi yêu cầu đã chốt có sẵn → hợp đồng 'drafting' ──────────

INSERT INTO public.consignment_contracts
  (service_request_id, asset_posting_id, auction_org_id, organization_id, owner_user_id,
   opportunity_id, status, source, terms, owner_party, org_party, asset_snapshot)
SELECT r.id, r.asset_posting_id, r.auction_org_id, v.org_id, r.user_id,
       (SELECT o.id FROM public.opportunities o
         WHERE o.asset_posting_id = r.asset_posting_id
         ORDER BY o.created_at DESC LIMIT 1),
       'drafting', 'backfill',
       public.consignment_request_terms(r),
       public.consignment_owner_party(r.user_id),
       public.consignment_org_party(r.auction_org_id, v.org_id),
       public.consignment_asset_snapshot(r.asset_posting_id)
  FROM public.asset_service_requests r
  CROSS JOIN LATERAL (
    SELECT COALESCE(r.organization_id, (
      SELECT o.id FROM public.organizations o
       WHERE o.auction_org_id = r.auction_org_id AND o.kyc_status = 'APPROVED'
       ORDER BY o.created_at LIMIT 1
    )) AS org_id
  ) v
 WHERE r.status = 'selected' AND v.org_id IS NOT NULL
ON CONFLICT (service_request_id) DO NOTHING;

INSERT INTO public.consignment_contract_events (contract_id, action, data)
SELECT c.id, 'created', jsonb_build_object('source', 'backfill')
  FROM public.consignment_contracts c
 WHERE c.source = 'backfill'
   AND NOT EXISTS (SELECT 1 FROM public.consignment_contract_events e WHERE e.contract_id = c.id);

-- ─── 9. Kiểm chứng ───────────────────────────────────────────────────────────

DO $verify$
DECLARE v_missing INT;
BEGIN
  SELECT count(*) INTO v_missing
    FROM public.asset_service_requests r
    LEFT JOIN public.consignment_contracts c ON c.service_request_id = r.id
   WHERE r.status = 'selected' AND c.id IS NULL
     AND EXISTS (SELECT 1 FROM public.organizations o
                  WHERE o.auction_org_id = r.auction_org_id AND o.kyc_status = 'APPROVED');
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'Còn % yêu cầu đã chốt chưa có hợp đồng', v_missing;
  END IF;

  IF has_function_privilege('authenticated', 'public.consignment_owner_party(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Helper chứa CCCD đang phơi cho authenticated';
  END IF;
END
$verify$;
