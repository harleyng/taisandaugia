-- Hồ sơ hoàn chỉnh & điểm tin cậy (docs/owner-dossier-plan.md — Phase 1).
--
--  • Mỗi hồ sơ số hoá có tối đa 3 "phần dịch vụ": thẩm định giá / pháp lý / tổ chức đấu giá.
--    Mỗi phần có đúng 1 nguồn: 'marketplace' (Tìm qua sàn — luồng RFQ/tư vấn hiện có, KHÔNG đổi),
--    'external_partner' (Đã có đối tác — chủ tự nhập kết quả + tài liệu), 'none' (Chưa cần).
--  • Điểm tin cậy 0–100 + mức Cơ bản / Đầy đủ / Hoàn chỉnh TÍNH LÚC ĐỌC trong SQL
--    (_dossier_trust_compute) — frontend không bao giờ tự tính lại.
--  • Bảng phụ thay vì cột trên asset_postings: review guard đẩy hồ sơ đã duyệt về chờ duyệt
--    khi đổi BẤT KỲ cột nào (cùng lý do với 3D/VR/giám định/làng nghề).
--  • Kết quả qua sàn được SUY RA lúc đọc, bất kể dòng dossier ghi nguồn gì:
--      - pháp lý: asset_legal_consultations status completed/superseded ⇒ 20 điểm, Sàn xác nhận
--      - tổ chức đấu giá: asset_service_requests status selected/accepted ⇒ 15 điểm, Sàn xác nhận
--      - thẩm định giá: pricing_mode = 'appraisal' + báo giá đã chọn có scope 'tham_dinh_gia'
--        ⇒ 10 điểm (partial) — sàn chưa thu được giá trị/chứng thư nên chưa đủ 25.
--    Lấy điểm CAO HƠN giữa kết quả qua sàn và dòng tự nhập.
--  • Tệp chứng cứ & tên đối tác KHÔNG BAO GIỜ công khai; giá thẩm định chỉ công khai khi chủ bật.

-- ─── 1. Bảng phần dịch vụ của hồ sơ ───────────────────────────────────────────
CREATE TABLE public.asset_posting_dossier_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_id           UUID NOT NULL REFERENCES public.asset_postings(id) ON DELETE CASCADE,
  workspace_id         UUID REFERENCES public.asset_owner_workspaces(id) ON DELETE SET NULL, -- chép từ hồ sơ
  kind                 TEXT NOT NULL CHECK (kind IN ('appraisal','legal','auction')),
  source               TEXT NOT NULL CHECK (source IN ('marketplace','external_partner','none')),
  service_request_id   UUID REFERENCES public.asset_service_requests(id) ON DELETE SET NULL,
  partner_org_id       UUID REFERENCES public.auction_organizations(id) ON DELETE SET NULL,
  partner_name         TEXT,
  issued_at            DATE,          -- ngày chứng thư / văn bản ý kiến / hợp đồng dịch vụ
  valid_until          DATE,          -- chỉ thẩm định giá
  appraised_value      NUMERIC(18,0),
  show_appraised_value BOOLEAN NOT NULL DEFAULT false,
  legal_conclusion     TEXT CHECK (legal_conclusion IN ('clean','has_issues')),
  legal_summary        TEXT,
  planned_auction_date DATE,
  evidence_urls        TEXT[] NOT NULL DEFAULT '{}',   -- đường dẫn trong bucket posting-dossier-evidence
  created_by           UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (posting_id, kind),
  CONSTRAINT ext_needs_partner   CHECK (source <> 'external_partner' OR partner_org_id IS NOT NULL OR partner_name IS NOT NULL),
  CONSTRAINT ext_appraisal_value CHECK (kind <> 'appraisal' OR source <> 'external_partner' OR appraised_value IS NOT NULL),
  CONSTRAINT ext_legal_conclusion CHECK (kind <> 'legal' OR source <> 'external_partner' OR legal_conclusion IS NOT NULL)
);

CREATE INDEX idx_asset_posting_dossier_items_workspace
  ON public.asset_posting_dossier_items (workspace_id);

CREATE TRIGGER asset_posting_dossier_items_updated_at
  BEFORE UPDATE ON public.asset_posting_dossier_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- workspace_id luôn theo hồ sơ cha; posting_id / created_by bất biến sau khi tạo.
CREATE FUNCTION public.asset_posting_dossier_items_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.posting_id IS DISTINCT FROM OLD.posting_id THEN
      RAISE EXCEPTION 'Không đổi được hồ sơ của phần dịch vụ' USING ERRCODE = '22023';
    END IF;
    NEW.created_by := OLD.created_by;
  END IF;
  SELECT p.workspace_id INTO NEW.workspace_id
    FROM public.asset_postings p WHERE p.id = NEW.posting_id;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.asset_posting_dossier_items_sync() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER asset_posting_dossier_items_sync
  BEFORE INSERT OR UPDATE ON public.asset_posting_dossier_items
  FOR EACH ROW EXECUTE FUNCTION public.asset_posting_dossier_items_sync();

ALTER TABLE public.asset_posting_dossier_items ENABLE ROW LEVEL SECURITY;

-- Đọc: ai đọc được hồ sơ cha (RLS của asset_postings: chủ / thành viên Trạm / admin) thì đọc được.
CREATE POLICY asset_posting_dossier_items_read ON public.asset_posting_dossier_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.asset_postings p WHERE p.id = posting_id));

-- Ghi: cùng quyền sửa hồ sơ số hoá (module 'so-hoa', 'update' + phạm vi chi nhánh).
CREATE POLICY asset_posting_dossier_items_insert ON public.asset_posting_dossier_items
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid()
              AND public.owner_posting_can(posting_id, 'so-hoa', 'update'));
CREATE POLICY asset_posting_dossier_items_update ON public.asset_posting_dossier_items
  FOR UPDATE TO authenticated
  USING (public.owner_posting_can(posting_id, 'so-hoa', 'update'))
  WITH CHECK (public.owner_posting_can(posting_id, 'so-hoa', 'update'));
CREATE POLICY asset_posting_dossier_items_delete ON public.asset_posting_dossier_items
  FOR DELETE TO authenticated
  USING (public.owner_posting_can(posting_id, 'so-hoa', 'update'));

REVOKE ALL ON public.asset_posting_dossier_items FROM anon;

-- ─── 2. Bucket tài liệu chứng cứ (riêng tư) ───────────────────────────────────
-- Đường dẫn: {posting_id}/{kind}/{tệp}. Thứ tự ghi: tạo dòng → tải tệp → cập nhật evidence_urls.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('posting-dossier-evidence', 'posting-dossier-evidence', false, 10485760,
        ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- _action: 'read' | 'write'. Trả false (không ném lỗi) với đường dẫn rác.
CREATE FUNCTION public.posting_dossier_evidence_ok(_name TEXT, _action TEXT)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_posting UUID;
BEGIN
  BEGIN
    v_posting := split_part(_name, '/', 1)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;
  IF split_part(_name, '/', 2) NOT IN ('appraisal','legal','auction')
     OR split_part(_name, '/', 3) = '' THEN
    RETURN false;
  END IF;

  IF _action = 'read' THEN
    RETURN public.owner_posting_can(v_posting, 'read')
        OR public.admin_has_permission('tai-san-tu-nguyen', 'view');
  ELSIF _action = 'write' THEN
    RETURN public.owner_posting_can(v_posting, 'so-hoa', 'update');
  END IF;
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.posting_dossier_evidence_ok(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.posting_dossier_evidence_ok(TEXT, TEXT) TO authenticated;

DROP POLICY IF EXISTS posting_dossier_evidence_select ON storage.objects;
CREATE POLICY posting_dossier_evidence_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'posting-dossier-evidence'
         AND public.posting_dossier_evidence_ok(name, 'read'));

DROP POLICY IF EXISTS posting_dossier_evidence_insert ON storage.objects;
CREATE POLICY posting_dossier_evidence_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'posting-dossier-evidence'
              AND public.posting_dossier_evidence_ok(name, 'write'));

-- Không có policy UPDATE: chứng cứ chỉ thêm hoặc xoá, không ghi đè.
DROP POLICY IF EXISTS posting_dossier_evidence_delete ON storage.objects;
CREATE POLICY posting_dossier_evidence_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'posting-dossier-evidence'
         AND public.posting_dossier_evidence_ok(name, 'write'));

-- ─── 3. Tính điểm (nội bộ — nguồn sự thật DUY NHẤT) ───────────────────────────
-- Trả {score, level, items[]}; item = {key, label, points_earned, points_max, status, proof,
-- hint, source?, valid_until?}. status ∈ done | partial | missing | expired;
-- proof ∈ self | document | platform | null. Không kiểm quyền — hàm bọc ngoài kiểm.
CREATE FUNCTION public._dossier_trust_compute(p_posting_id UUID)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  -- Trọng số (D1 — bảng A5 của docs/owner-dossier-plan.md; đổi ở đây và business-rules.md).
  c_ownership_docs      CONSTANT INT := 15;  -- nhóm "giấy tờ": ≥ 1 giấy tờ sở hữu
  c_ownership_decl      CONSTANT INT := 10;  -- nhóm "cam kết": cam kết đã ký hợp lệ
  c_ownership_max       CONSTANT INT := 15;
  c_legal_self          CONSTANT INT := 5;
  c_legal_conclusion    CONSTANT INT := 10;
  c_legal_file          CONSTANT INT := 10;
  c_legal_max           CONSTANT INT := 20;
  c_appraisal_value     CONSTANT INT := 10;
  c_appraisal_file      CONSTANT INT := 10;
  c_appraisal_valid     CONSTANT INT := 5;
  c_appraisal_platform  CONSTANT INT := 10;
  c_appraisal_max       CONSTANT INT := 25;
  c_auction_directory   CONSTANT INT := 10;
  c_auction_free_text   CONSTANT INT := 5;
  c_auction_date        CONSTANT INT := 5;
  c_auction_max         CONSTANT INT := 15;
  c_media_images        CONSTANT INT := 5;
  c_media_docs          CONSTANT INT := 5;
  c_media_max           CONSTANT INT := 10;
  c_review              CONSTANT INT := 10;
  c_level_full          CONSTANT INT := 40;
  c_level_complete      CONSTANT INT := 75;
  c_min_images          CONSTANT INT := 1;                    -- = MIN_IMAGES (src/constants/asset-posting-rules.ts)
  c_appraisal_validity  CONSTANT INTERVAL := interval '6 months';  -- D4: hiệu lực chứng thư mặc định
  -- Nhóm "cam kết" của getProofMode (src/constants/asset-posting-rules.ts) — NHÂN BẢN SQL↔TS.
  c_declaration_slugs   CONSTANT TEXT[] := ARRAY['may-moc','hang-hoa','do-dung','thu-cong-my-nghe','co-vat-suu-tam'];

  p             public.asset_postings%ROWTYPE;
  r_app         public.asset_posting_dossier_items%ROWTYPE;
  r_leg         public.asset_posting_dossier_items%ROWTYPE;
  r_auc         public.asset_posting_dossier_items%ROWTYPE;
  v_selected    public.asset_service_requests%ROWTYPE;
  v_has_sel     BOOLEAN;
  v_legal_done  BOOLEAN;
  v_legal_open  BOOLEAN;
  v_items       jsonb := '[]'::jsonb;
  v_score       INT := 0;
  v_pts         INT;
  v_status      TEXT;
  v_proof       TEXT;
  v_hint        TEXT;
  v_valid       DATE;
  v_expired     BOOLEAN;
  v_decl_name   TEXT;
  v_app_status  TEXT;
  v_leg_status  TEXT;
  v_level       TEXT;
BEGIN
  SELECT * INTO p FROM public.asset_postings WHERE id = p_posting_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO r_app FROM public.asset_posting_dossier_items WHERE posting_id = p.id AND kind = 'appraisal';
  SELECT * INTO r_leg FROM public.asset_posting_dossier_items WHERE posting_id = p.id AND kind = 'legal';
  SELECT * INTO r_auc FROM public.asset_posting_dossier_items WHERE posting_id = p.id AND kind = 'auction';

  SELECT * INTO v_selected FROM public.asset_service_requests
   WHERE asset_posting_id = p.id AND status IN ('selected','accepted') LIMIT 1;
  v_has_sel := FOUND;

  SELECT EXISTS (SELECT 1 FROM public.asset_legal_consultations
                  WHERE asset_posting_id = p.id AND status IN ('completed','superseded'))
    INTO v_legal_done;
  SELECT EXISTS (SELECT 1 FROM public.asset_legal_consultations
                  WHERE asset_posting_id = p.id AND status IN ('requested','quoted','paid','in_review'))
    INTO v_legal_open;

  -- ── ownership ──
  IF COALESCE(p.parent_slug, '') = ANY (c_declaration_slugs) THEN
    v_decl_name := btrim(p.ownership_declaration ->> 'name');
    IF v_decl_name IS NOT NULL
       AND array_length(regexp_split_to_array(v_decl_name, '\s+'), 1) >= 2 THEN
      v_pts := c_ownership_decl; v_proof := 'self'; v_hint := NULL;
    ELSE
      v_pts := 0; v_proof := NULL;
      v_hint := format('Ký cam kết quyền sở hữu (+%s điểm)', c_ownership_decl);
    END IF;
  ELSE
    IF COALESCE(cardinality(p.ownership_proof_urls), 0) > 0 THEN
      v_pts := c_ownership_docs; v_proof := 'document'; v_hint := NULL;
    ELSE
      v_pts := 0; v_proof := NULL;
      v_hint := format('Tải giấy tờ sở hữu (+%s điểm)', c_ownership_docs);
    END IF;
  END IF;
  v_status := CASE WHEN v_pts = 0 THEN 'missing' WHEN v_pts >= c_ownership_max THEN 'done' ELSE 'partial' END;
  v_score := v_score + v_pts;
  v_items := v_items || jsonb_build_object('key','ownership','label','Giấy tờ sở hữu',
    'points_earned',v_pts,'points_max',c_ownership_max,'status',v_status,'proof',v_proof,'hint',v_hint);

  -- ── legal_self ──
  IF p.has_dispute IS NOT NULL AND p.has_mortgage IS NOT NULL AND p.is_seized IS NOT NULL THEN
    v_pts := c_legal_self; v_status := 'done'; v_proof := 'self'; v_hint := NULL;
  ELSE
    v_pts := 0; v_status := 'missing'; v_proof := NULL;
    v_hint := format('Trả lời đủ 3 câu tự khai pháp lý (+%s điểm)', c_legal_self);
  END IF;
  v_score := v_score + v_pts;
  v_items := v_items || jsonb_build_object('key','legal_self','label','Tự khai pháp lý',
    'points_earned',v_pts,'points_max',c_legal_self,'status',v_status,'proof',v_proof,'hint',v_hint);

  -- ── legal_partner ──
  v_pts := 0; v_proof := NULL;
  IF r_leg.source = 'external_partner' THEN
    v_pts := c_legal_conclusion; v_proof := 'self';
    IF cardinality(r_leg.evidence_urls) > 0 THEN
      v_pts := v_pts + c_legal_file; v_proof := 'document';
    END IF;
  END IF;
  IF v_legal_done AND c_legal_max > v_pts THEN
    v_pts := c_legal_max; v_proof := 'platform';
  END IF;
  v_status := CASE WHEN v_pts = 0 THEN 'missing' WHEN v_pts >= c_legal_max THEN 'done' ELSE 'partial' END;
  v_hint := CASE
    WHEN v_status = 'done' THEN NULL
    WHEN v_pts > 0 THEN format('Tải văn bản ý kiến pháp lý (+%s điểm)', c_legal_file)
    WHEN v_legal_open THEN format('Chờ kết quả tư vấn pháp lý của sàn (+%s điểm)', c_legal_max)
    ELSE format('Nhập ý kiến pháp lý của đối tác (+%s điểm)', c_legal_conclusion)
  END;
  v_leg_status := v_status;
  v_score := v_score + v_pts;
  v_items := v_items || jsonb_build_object('key','legal_partner','label','Ý kiến pháp lý',
    'points_earned',v_pts,'points_max',c_legal_max,'status',v_status,'proof',v_proof,'hint',v_hint,
    'source',r_leg.source);

  -- ── appraisal ──
  v_pts := 0; v_proof := NULL; v_expired := false; v_valid := NULL; v_hint := NULL;
  IF r_app.source = 'external_partner' THEN
    v_pts := c_appraisal_value; v_proof := 'self';
    IF cardinality(r_app.evidence_urls) > 0 THEN
      v_pts := v_pts + c_appraisal_file; v_proof := 'document';
    END IF;
    v_valid := COALESCE(r_app.valid_until, (r_app.issued_at + c_appraisal_validity)::date);
    IF v_valid IS NOT NULL AND v_valid >= current_date THEN
      v_pts := v_pts + c_appraisal_valid;
    ELSIF v_valid IS NOT NULL THEN
      v_expired := true;
    END IF;
    v_hint := CASE
      WHEN v_expired THEN format('Cập nhật chứng thư thẩm định mới (+%s điểm)', c_appraisal_valid)
      WHEN cardinality(r_app.evidence_urls) = 0 THEN format('Tải chứng thư thẩm định (+%s điểm)', c_appraisal_file)
      WHEN v_valid IS NULL THEN format('Nhập ngày hiệu lực chứng thư (+%s điểm)', c_appraisal_valid)
    END;
  END IF;
  IF v_has_sel AND p.pricing_mode = 'appraisal'
     AND COALESCE(v_selected.quote_plan -> 'scope_included', '[]'::jsonb) ? 'tham_dinh_gia'
     AND c_appraisal_platform > v_pts THEN
    v_pts := c_appraisal_platform; v_proof := 'platform'; v_expired := false;
    v_hint := format('Nhập chứng thư khi tổ chức bàn giao (+%s điểm)', c_appraisal_max - c_appraisal_platform);
  END IF;
  v_status := CASE WHEN v_expired THEN 'expired'
                   WHEN v_pts = 0 THEN 'missing'
                   WHEN v_pts >= c_appraisal_max THEN 'done' ELSE 'partial' END;
  IF v_pts = 0 THEN
    v_hint := format('Nhập kết quả thẩm định giá của đối tác (+%s điểm)', c_appraisal_value);
  END IF;
  v_app_status := v_status;
  v_score := v_score + v_pts;
  v_items := v_items || jsonb_build_object('key','appraisal','label','Thẩm định giá',
    'points_earned',v_pts,'points_max',c_appraisal_max,'status',v_status,'proof',v_proof,'hint',v_hint,
    'source',r_app.source,'valid_until',v_valid);

  -- ── auction_org ──
  v_pts := 0; v_proof := NULL;
  IF r_auc.source = 'external_partner' THEN
    v_pts := CASE WHEN r_auc.partner_org_id IS NOT NULL THEN c_auction_directory ELSE c_auction_free_text END;
    IF r_auc.issued_at IS NOT NULL OR r_auc.planned_auction_date IS NOT NULL THEN
      v_pts := v_pts + c_auction_date;
    END IF;
    v_proof := CASE WHEN cardinality(r_auc.evidence_urls) > 0 THEN 'document' ELSE 'self' END;
  END IF;
  IF v_has_sel AND c_auction_max > v_pts THEN
    v_pts := c_auction_max; v_proof := 'platform';
  END IF;
  v_status := CASE WHEN v_pts = 0 THEN 'missing' WHEN v_pts >= c_auction_max THEN 'done' ELSE 'partial' END;
  v_hint := CASE
    WHEN v_status = 'done' THEN NULL
    WHEN v_pts = 0 THEN format('Chọn tổ chức đấu giá đối tác (+%s điểm)', c_auction_directory)
    WHEN r_auc.issued_at IS NULL AND r_auc.planned_auction_date IS NULL
      THEN format('Nhập ngày ký hợp đồng hoặc ngày dự kiến đấu giá (+%s điểm)', c_auction_date)
    ELSE format('Chọn tổ chức từ danh bạ thay vì tự nhập tên (+%s điểm)', c_auction_directory - c_auction_free_text)
  END;
  v_score := v_score + v_pts;
  v_items := v_items || jsonb_build_object('key','auction_org','label','Tổ chức đấu giá',
    'points_earned',v_pts,'points_max',c_auction_max,'status',v_status,'proof',v_proof,'hint',v_hint,
    'source',r_auc.source);

  -- ── media ──
  v_pts := 0; v_proof := NULL;
  IF COALESCE(cardinality(p.image_urls), 0) >= c_min_images THEN
    v_pts := c_media_images; v_proof := 'self';
  END IF;
  IF COALESCE(cardinality(p.doc_urls), 0) > 0 THEN
    v_pts := v_pts + c_media_docs; v_proof := 'document';
  END IF;
  v_status := CASE WHEN v_pts = 0 THEN 'missing' WHEN v_pts >= c_media_max THEN 'done' ELSE 'partial' END;
  v_hint := CASE
    WHEN v_status = 'done' THEN NULL
    WHEN COALESCE(cardinality(p.image_urls), 0) < c_min_images THEN format('Tải ảnh tài sản (+%s điểm)', c_media_images)
    ELSE format('Tải tài liệu đính kèm (+%s điểm)', c_media_docs)
  END;
  v_score := v_score + v_pts;
  v_items := v_items || jsonb_build_object('key','media','label','Hình ảnh & tài liệu',
    'points_earned',v_pts,'points_max',c_media_max,'status',v_status,'proof',v_proof,'hint',v_hint);

  -- ── review ──
  IF p.review_status = 'approved' THEN
    v_pts := c_review; v_status := 'done'; v_proof := 'platform'; v_hint := NULL;
  ELSE
    v_pts := 0; v_status := 'missing'; v_proof := NULL;
    v_hint := format('Chờ sàn duyệt hồ sơ (+%s điểm)', c_review);
  END IF;
  v_score := v_score + v_pts;
  v_items := v_items || jsonb_build_object('key','review','label','Sàn đã duyệt',
    'points_earned',v_pts,'points_max',c_review,'status',v_status,'proof',v_proof,'hint',v_hint);

  -- ── mức ── 'expired' KHÔNG tính là có thẩm định cho mức Hoàn chỉnh.
  v_level := CASE
    WHEN v_score >= c_level_complete
         AND v_app_status IN ('done','partial') AND v_leg_status IN ('done','partial') THEN 'complete'
    WHEN v_score >= c_level_full THEN 'full'
    ELSE 'basic'
  END;

  RETURN jsonb_build_object('score', v_score, 'level', v_level, 'items', v_items);
END;
$$;
REVOKE EXECUTE ON FUNCTION public._dossier_trust_compute(UUID) FROM PUBLIC, anon, authenticated;

-- ─── 4. RPC cho chủ / thành viên / admin ──────────────────────────────────────
CREATE FUNCTION public.asset_posting_dossier_trust(p_posting_id UUID)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.owner_posting_can(p_posting_id, 'read')
          OR public.admin_has_permission('tai-san-tu-nguyen', 'view')) THEN
    RAISE EXCEPTION 'Không có quyền xem hồ sơ này' USING ERRCODE = '42501';
  END IF;
  RETURN public._dossier_trust_compute(p_posting_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.asset_posting_dossier_trust(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.asset_posting_dossier_trust(UUID) TO authenticated;

-- ─── 5. RPC công khai (khách vãng lai / tổ chức đấu giá) ──────────────────────
-- Chỉ hồ sơ đã duyệt và chưa huỷ. Trả mức, điểm và nhãn/trạng thái/mức chứng cứ —
-- KHÔNG gợi ý, KHÔNG tên đối tác, KHÔNG tệp; giá thẩm định chỉ khi chủ bật công khai.
CREATE FUNCTION public.get_public_dossier_trust(p_posting_id UUID)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_full  jsonb;
  v_value NUMERIC;
  v_out   jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.asset_postings
                  WHERE id = p_posting_id AND review_status = 'approved' AND status <> 'cancelled') THEN
    RETURN NULL;
  END IF;

  v_full := public._dossier_trust_compute(p_posting_id);
  v_out := jsonb_build_object(
    'score', v_full -> 'score',
    'level', v_full -> 'level',
    'items', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                       'key', i -> 'key', 'label', i -> 'label',
                       'status', i -> 'status', 'proof', i -> 'proof')), '[]'::jsonb)
                FROM jsonb_array_elements(v_full -> 'items') i));

  SELECT d.appraised_value INTO v_value
    FROM public.asset_posting_dossier_items d
   WHERE d.posting_id = p_posting_id AND d.kind = 'appraisal'
     AND d.source = 'external_partner' AND d.show_appraised_value;
  IF v_value IS NOT NULL THEN
    v_out := v_out || jsonb_build_object('appraised_value', v_value);
  END IF;
  RETURN v_out;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_dossier_trust(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_dossier_trust(UUID) TO anon, authenticated;
