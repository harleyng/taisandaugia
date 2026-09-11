-- Tài liệu phiên (case documents) — nguồn DUY NHẤT để trả lời câu hỏi người mua.
--
-- Mỗi phiên đấu giá có tối đa một tài liệu cho mỗi loại: thông báo đấu giá, quy
-- chế, điều kiện tiền đặt trước & thời hạn, lịch xem tài sản, và "giải đáp bổ
-- sung" (sinh từ câu hỏi chuyển tiếp, không có tệp). Tài liệu được tách thành
-- ĐIỀU KHOẢN; câu trả lời AI chỉ được trích nguyên văn từ điều khoản CITABLE:
--
--   citable = clause.status = 'confirmed'
--             AND (document.review_status = 'confirmed' OR doc_type = 'clarification')
--
-- VÌ SAO KHÔNG CÓ POLICY ĐỌC CÔNG KHAI:
--   RLS lọc DÒNG, không giấu CỘT — policy công khai sẽ phơi confirmed_by / source,
--   và nhân viên tổ chức xem trang sàn sẽ thấy cả điều khoản NHÁP (policy tổ chức
--   cũng khớp). Trang công khai + engine đọc qua RPC case_citable_clauses, liệt kê
--   cột bằng tay và chỉ trả điều khoản citable.
--
-- TRÍCH XUẤT HÔM NAY LÀ GIẢ LẬP (src/lib/caseQa/caseExtraction.ts): không đọc PDF,
-- chỉ dựng khuôn điền dữ liệu phiên, thiếu thì để `[[CẦN NHẬP: …]]`. CHECK
-- case_document_clauses_no_placeholder chặn xác nhận điều khoản còn chỗ trống ⇒
-- giá trị bịa không bao giờ trích dẫn được.
--
-- Quyền: tài liệu phiên là một phần của phiên ⇒ dùng lại module `phien-dau-gia`
-- (xem = view, mọi thay đổi = update), giống lô tài sản.

-- ─── 1. Tài liệu ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.case_documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Trigger điền lại từ phiên; giá trị client gửi lên bị bỏ qua.
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id         UUID NOT NULL REFERENCES public.auction_sessions(id) ON DELETE CASCADE,
  doc_type           TEXT NOT NULL
                       CHECK (doc_type IN ('notice', 'rules', 'deposit_terms', 'viewing_schedule', 'clarification')),
  -- Tên riêng của tài liệu ("Quy chế cuộc đấu giá số 12/2026/QC") — dùng trong dòng "Căn cứ".
  title              TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 200),
  storage_path       TEXT,
  original_filename  TEXT,
  size_bytes         BIGINT CHECK (size_bytes IS NULL OR size_bytes BETWEEN 0 AND 10485760),
  mime_type          TEXT,
  extraction_status  TEXT NOT NULL DEFAULT 'none' CHECK (extraction_status IN ('none', 'extracted', 'failed')),
  extraction_engine  TEXT,
  extracted_at       TIMESTAMPTZ,
  review_status      TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'confirmed')),
  confirmed_at       TIMESTAMPTZ,
  confirmed_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by        UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT case_documents_file_check CHECK (doc_type = 'clarification' OR storage_path IS NOT NULL),
  CONSTRAINT case_documents_session_type_key UNIQUE (session_id, doc_type)
);

CREATE INDEX IF NOT EXISTS idx_case_documents_org ON public.case_documents (organization_id);

-- ─── 2. Điều khoản ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.case_document_clauses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID NOT NULL REFERENCES public.case_documents(id) ON DELETE CASCADE,
  -- Hai cột dưới do trigger điền từ tài liệu cha.
  session_id       UUID NOT NULL REFERENCES public.auction_sessions(id) ON DELETE CASCADE,
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clause_ref       TEXT NOT NULL CHECK (char_length(btrim(clause_ref)) BETWEEN 1 AND 40),
  heading          TEXT CHECK (heading IS NULL OR char_length(heading) <= 200),
  body             TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 10 AND 4000),
  -- Mã chủ đề — nguồn sự thật là CASE_TOPICS (src/lib/caseQa/topics.ts); cố ý
  -- KHÔNG liệt kê giá trị ở đây để khỏi nhân bản SQL↔TS.
  topics           TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(topics) <= 6),
  sort_order       INT NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
  source           TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('extracted', 'manual')),
  confirmed_at     TIMESTAMPTZ,
  confirmed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by       UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT case_document_clauses_no_placeholder CHECK (status <> 'confirmed' OR body !~ '\[\[')
);

CREATE INDEX IF NOT EXISTS idx_case_clauses_document ON public.case_document_clauses (document_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_case_clauses_citable
  ON public.case_document_clauses (session_id) WHERE status = 'confirmed';

-- ─── 3. Trigger ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS case_documents_updated_at ON public.case_documents;
CREATE TRIGGER case_documents_updated_at
  BEFORE UPDATE ON public.case_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS case_document_clauses_updated_at ON public.case_document_clauses;
CREATE TRIGGER case_document_clauses_updated_at
  BEFORE UPDATE ON public.case_document_clauses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Guard RAISE thay vì âm thầm nuốt thay đổi (bài học trigger duyệt asset_postings).
CREATE OR REPLACE FUNCTION public.case_documents_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org    UUID;
  v_status TEXT;
  v_total  INT;
  v_drafts INT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.session_id IS DISTINCT FROM OLD.session_id THEN
      RAISE EXCEPTION 'Không chuyển được tài liệu sang phiên khác.';
    END IF;
    IF NEW.doc_type IS DISTINCT FROM OLD.doc_type THEN
      RAISE EXCEPTION 'Không đổi được loại tài liệu.';
    END IF;
  END IF;

  SELECT s.organization_id, s.status INTO v_org, v_status
    FROM public.auction_sessions s WHERE s.id = NEW.session_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy phiên đấu giá.';
  END IF;
  IF v_status = 'cancelled' THEN
    RAISE EXCEPTION 'Phiên đã huỷ — không sửa được tài liệu phiên.';
  END IF;
  NEW.organization_id := v_org;

  IF NEW.storage_path IS NOT NULL
     AND NEW.storage_path NOT LIKE v_org::text || '/' || NEW.session_id::text || '/' || NEW.id::text || '/%' THEN
    RAISE EXCEPTION 'Đường dẫn tệp tài liệu phiên không hợp lệ.';
  END IF;

  -- Đổi tệp ⇒ mọi đối chiếu trước đó hết giá trị: tài liệu + điều khoản về nháp.
  IF TG_OP = 'UPDATE' AND NEW.storage_path IS DISTINCT FROM OLD.storage_path THEN
    NEW.review_status := 'draft';
    UPDATE public.case_document_clauses
       SET status = 'draft'
     WHERE document_id = NEW.id AND status = 'confirmed';
  END IF;

  IF NEW.review_status = 'confirmed' AND (TG_OP = 'INSERT' OR OLD.review_status <> 'confirmed') THEN
    SELECT count(*), count(*) FILTER (WHERE c.status = 'draft')
      INTO v_total, v_drafts
      FROM public.case_document_clauses c WHERE c.document_id = NEW.id;
    IF v_total = 0 THEN
      RAISE EXCEPTION 'Tài liệu chưa có điều khoản nào để xác nhận.';
    END IF;
    IF v_drafts > 0 THEN
      RAISE EXCEPTION 'Còn % điều khoản chưa xác nhận.', v_drafts;
    END IF;
    NEW.confirmed_at := now();
    NEW.confirmed_by := auth.uid();
  ELSIF NEW.review_status = 'draft' THEN
    NEW.confirmed_at := NULL;
    NEW.confirmed_by := NULL;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS case_documents_guard ON public.case_documents;
CREATE TRIGGER case_documents_guard
  BEFORE INSERT OR UPDATE ON public.case_documents
  FOR EACH ROW EXECUTE FUNCTION public.case_documents_guard();

CREATE OR REPLACE FUNCTION public.case_document_clauses_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session UUID;
  v_org     UUID;
  v_status  TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.document_id IS DISTINCT FROM OLD.document_id THEN
    RAISE EXCEPTION 'Không chuyển được điều khoản sang tài liệu khác.';
  END IF;

  SELECT d.session_id, d.organization_id INTO v_session, v_org
    FROM public.case_documents d WHERE d.id = NEW.document_id;
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy tài liệu phiên.';
  END IF;
  SELECT s.status INTO v_status FROM public.auction_sessions s WHERE s.id = v_session;
  IF v_status = 'cancelled' THEN
    RAISE EXCEPTION 'Phiên đã huỷ — không sửa được tài liệu phiên.';
  END IF;
  NEW.session_id := v_session;
  NEW.organization_id := v_org;

  -- Sửa NỘI DUNG điều khoản đã xác nhận ⇒ về nháp (so từng cột có tên, không so
  -- NEW.* với OLD.*: updated_at do trigger khác đổi sẽ làm mọi update đều "khác").
  -- Muốn xác nhận lại thì một lệnh UPDATE riêng chỉ đổi status.
  IF TG_OP = 'UPDATE' AND OLD.status = 'confirmed'
     AND (NEW.clause_ref IS DISTINCT FROM OLD.clause_ref
       OR NEW.heading    IS DISTINCT FROM OLD.heading
       OR NEW.body       IS DISTINCT FROM OLD.body
       OR NEW.topics     IS DISTINCT FROM OLD.topics) THEN
    NEW.status := 'draft';
  END IF;

  IF NEW.status = 'confirmed' AND (TG_OP = 'INSERT' OR OLD.status <> 'confirmed') THEN
    NEW.confirmed_at := now();
    NEW.confirmed_by := auth.uid();
  ELSIF NEW.status = 'draft' THEN
    NEW.confirmed_at := NULL;
    NEW.confirmed_by := NULL;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS case_document_clauses_guard ON public.case_document_clauses;
CREATE TRIGGER case_document_clauses_guard
  BEFORE INSERT OR UPDATE ON public.case_document_clauses
  FOR EACH ROW EXECUTE FUNCTION public.case_document_clauses_guard();

REVOKE EXECUTE ON FUNCTION public.case_documents_guard()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.case_document_clauses_guard() FROM PUBLIC, anon, authenticated;

-- ─── 4. RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_document_clauses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "case_documents_select" ON public.case_documents;
CREATE POLICY "case_documents_select" ON public.case_documents
  FOR SELECT TO authenticated
  USING (public.can_manage_auction_sessions(organization_id, 'view'));

DROP POLICY IF EXISTS "case_documents_insert" ON public.case_documents;
CREATE POLICY "case_documents_insert" ON public.case_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_auction_sessions(organization_id, 'update'));

DROP POLICY IF EXISTS "case_documents_update" ON public.case_documents;
CREATE POLICY "case_documents_update" ON public.case_documents
  FOR UPDATE TO authenticated
  USING      (public.can_manage_auction_sessions(organization_id, 'update'))
  WITH CHECK (public.can_manage_auction_sessions(organization_id, 'update'));

DROP POLICY IF EXISTS "case_documents_delete" ON public.case_documents;
CREATE POLICY "case_documents_delete" ON public.case_documents
  FOR DELETE TO authenticated
  USING (public.can_manage_auction_sessions(organization_id, 'update'));

DROP POLICY IF EXISTS "case_documents_admin_all" ON public.case_documents;
CREATE POLICY "case_documents_admin_all" ON public.case_documents
  FOR ALL
  USING      (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS "case_document_clauses_select" ON public.case_document_clauses;
CREATE POLICY "case_document_clauses_select" ON public.case_document_clauses
  FOR SELECT TO authenticated
  USING (public.can_manage_auction_sessions(organization_id, 'view'));

DROP POLICY IF EXISTS "case_document_clauses_insert" ON public.case_document_clauses;
CREATE POLICY "case_document_clauses_insert" ON public.case_document_clauses
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_auction_sessions(organization_id, 'update'));

DROP POLICY IF EXISTS "case_document_clauses_update" ON public.case_document_clauses;
CREATE POLICY "case_document_clauses_update" ON public.case_document_clauses
  FOR UPDATE TO authenticated
  USING      (public.can_manage_auction_sessions(organization_id, 'update'))
  WITH CHECK (public.can_manage_auction_sessions(organization_id, 'update'));

DROP POLICY IF EXISTS "case_document_clauses_delete" ON public.case_document_clauses;
CREATE POLICY "case_document_clauses_delete" ON public.case_document_clauses
  FOR DELETE TO authenticated
  USING (public.can_manage_auction_sessions(organization_id, 'update'));

DROP POLICY IF EXISTS "case_document_clauses_admin_all" ON public.case_document_clauses;
CREATE POLICY "case_document_clauses_admin_all" ON public.case_document_clauses
  FOR ALL
  USING      (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ─── 5. Storage bucket riêng tư ─────────────────────────────────────────────
-- Đường dẫn: {organization_id}/{session_id}/{document_id}/{tên tệp}. Policy kiểm
-- CẢ hai segment đầu: segment 1 là tổ chức VÀ phiên ở segment 2 thuộc đúng tổ
-- chức đó — nếu không, thành viên tổ chức A ghi được vào prefix phiên của tổ chức B.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('case-documents', 'case-documents', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.case_document_object_org(_name TEXT)
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org     UUID;
  v_session UUID;
BEGIN
  BEGIN
    v_org     := split_part(_name, '/', 1)::uuid;
    v_session := split_part(_name, '/', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;
  RETURN (SELECT s.organization_id FROM public.auction_sessions s
           WHERE s.id = v_session AND s.organization_id = v_org);
END; $$;

REVOKE EXECUTE ON FUNCTION public.case_document_object_org(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.case_document_object_org(TEXT) TO authenticated;

DROP POLICY IF EXISTS case_documents_storage_select ON storage.objects;
CREATE POLICY case_documents_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'case-documents'
         AND public.can_manage_auction_sessions(public.case_document_object_org(name), 'view'));

DROP POLICY IF EXISTS case_documents_storage_insert ON storage.objects;
CREATE POLICY case_documents_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'case-documents'
              AND public.can_manage_auction_sessions(public.case_document_object_org(name), 'update'));

DROP POLICY IF EXISTS case_documents_storage_update ON storage.objects;
CREATE POLICY case_documents_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING      (bucket_id = 'case-documents'
              AND public.can_manage_auction_sessions(public.case_document_object_org(name), 'update'))
  WITH CHECK (bucket_id = 'case-documents'
              AND public.can_manage_auction_sessions(public.case_document_object_org(name), 'update'));

DROP POLICY IF EXISTS case_documents_storage_delete ON storage.objects;
CREATE POLICY case_documents_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'case-documents'
         AND public.can_manage_auction_sessions(public.case_document_object_org(name), 'update'));

-- ─── 6. RPC ─────────────────────────────────────────────────────────────────
-- Đầu vào DUY NHẤT của engine hỏi đáp và trang công khai. Người ngoài chỉ thấy
-- khi phiên đã công bố/huỷ; nhân viên tổ chức thấy cả phiên nháp (để xem trước).
-- Migration 20260912000101 mở thêm cho người có quyền hộp thư `hoi-dap`.
CREATE OR REPLACE FUNCTION public.case_citable_clauses(_session_id UUID)
RETURNS TABLE (
  clause_id   UUID,
  document_id UUID,
  doc_type    TEXT,
  doc_title   TEXT,
  clause_ref  TEXT,
  heading     TEXT,
  body        TEXT,
  topics      TEXT[],
  sort_order  INT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.document_id, d.doc_type, d.title, c.clause_ref, c.heading, c.body, c.topics, c.sort_order
    FROM public.case_document_clauses c
    JOIN public.case_documents d ON d.id = c.document_id
   WHERE c.session_id = _session_id
     AND c.status = 'confirmed'
     AND (d.review_status = 'confirmed' OR d.doc_type = 'clarification')
     AND (public.auction_session_is_public(_session_id)
          OR public.can_manage_auction_sessions(c.organization_id, 'view'))
   ORDER BY CASE d.doc_type
              WHEN 'notice' THEN 1 WHEN 'rules' THEN 2 WHEN 'deposit_terms' THEN 3
              WHEN 'viewing_schedule' THEN 4 ELSE 5 END,
            c.sort_order, c.id
$$;

GRANT EXECUTE ON FUNCTION public.case_citable_clauses(UUID) TO anon, authenticated;

-- Lưu kết quả trích xuất: thay TOÀN BỘ điều khoản trích xuất còn nháp trong một
-- giao dịch. Điều khoản nhập tay và điều khoản đã xác nhận giữ nguyên.
CREATE OR REPLACE FUNCTION public.org_save_extracted_clauses(_document_id UUID, _clauses JSONB, _engine TEXT)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_doc public.case_documents%ROWTYPE;
  v_item JSONB;
  v_n INT := 0;
BEGIN
  SELECT * INTO v_doc FROM public.case_documents WHERE id = _document_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_auction_sessions(v_doc.organization_id, 'update') THEN
    RAISE EXCEPTION 'Không có quyền sửa tài liệu phiên này.';
  END IF;
  IF v_doc.doc_type = 'clarification' THEN
    RAISE EXCEPTION 'Giải đáp bổ sung không trích xuất từ tệp.';
  END IF;
  IF v_doc.review_status = 'confirmed' THEN
    RAISE EXCEPTION 'Tài liệu đã xác nhận — mở lại để chỉnh sửa trước khi trích xuất lại.';
  END IF;
  IF jsonb_typeof(_clauses) IS DISTINCT FROM 'array'
     OR jsonb_array_length(_clauses) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Kết quả trích xuất không hợp lệ.';
  END IF;

  DELETE FROM public.case_document_clauses
   WHERE document_id = _document_id AND source = 'extracted' AND status = 'draft';

  FOR v_item IN SELECT * FROM jsonb_array_elements(_clauses) LOOP
    INSERT INTO public.case_document_clauses
      (document_id, session_id, organization_id, clause_ref, heading, body, topics, sort_order, status, source)
    VALUES (
      _document_id, v_doc.session_id, v_doc.organization_id,
      btrim(v_item->>'clause_ref'),
      NULLIF(btrim(COALESCE(v_item->>'heading', '')), ''),
      v_item->>'body',
      ARRAY(SELECT jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(v_item->'topics') = 'array' THEN v_item->'topics' ELSE '[]'::jsonb END)),
      COALESCE((v_item->>'sort_order')::int, (v_n + 1) * 10),
      'draft', 'extracted'
    );
    v_n := v_n + 1;
  END LOOP;

  UPDATE public.case_documents
     SET extraction_status = 'extracted',
         extraction_engine = left(COALESCE(_engine, 'unknown'), 40),
         extracted_at = now()
   WHERE id = _document_id;

  RETURN v_n;
END; $$;

REVOKE EXECUTE ON FUNCTION public.org_save_extracted_clauses(UUID, JSONB, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.org_save_extracted_clauses(UUID, JSONB, TEXT) TO authenticated;

-- ─── 7. Kiểm chứng ──────────────────────────────────────────────────────────
DO $$
DECLARE
  v_leak TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'case-documents' AND public = false) THEN
    RAISE EXCEPTION 'Bucket case-documents phải tồn tại và riêng tư';
  END IF;

  -- Không bảng tài liệu phiên nào được có policy cho anon.
  SELECT string_agg(policyname, ', ') INTO v_leak
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('case_documents', 'case_document_clauses')
     AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
     AND policyname NOT LIKE '%admin_all';
  IF v_leak IS NOT NULL THEN
    RAISE EXCEPTION 'Tài liệu phiên có policy mở cho khách: %', v_leak;
  END IF;

  IF has_function_privilege('anon', 'public.org_save_extracted_clauses(uuid,jsonb,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'org_save_extracted_clauses không được mở cho anon';
  END IF;

  RAISE NOTICE 'OK: tài liệu phiên sẵn sàng';
END $$;
