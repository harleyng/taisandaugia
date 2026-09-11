-- Hộp thư đa kênh (omnichat) + hỏi đáp theo tài liệu phiên.
--
-- Câu hỏi của người mua đến từ SÀN (trang hỏi đáp của phiên) và ZALO (hôm nay là
-- công cụ giả lập; webhook Zalo OA thật sau này ghi đúng các bảng này qua
-- external_thread_id / external_message_id). Tổ chức đấu giá làm việc trên một
-- hàng đợi duy nhất ở /portal/hoi-dap.
--
-- ═══ LUẬT GỐC ════════════════════════════════════════════════════════════════
-- Câu trả lời AI KHÔNG có trích dẫn phân giải được thì KHÔNG BAO GIỜ tới người mua.
-- Từ chối luôn chấp nhận được; đoán thì không.
--
-- ═══ RANH GIỚI TIN CẬY ═══════════════════════════════════════════════════════
-- Engine mock chạy trên TRÌNH DUYỆT (với câu hỏi trên sàn: trình duyệt của chính
-- người mua). Nên client chỉ gửi ĐỀ XUẤT `_proposal`
--   {outcome, reason?, topics[], confidence, citations:[{clause_id, quote}], engine}
-- — KHÔNG gửi văn bản câu trả lời. case_qa_apply_proposal:
--   1. kiểm từng trích dẫn: điều khoản tồn tại, citable, cùng phiên, quote là
--      chuỗi con nguyên văn (so sau khi gộp khoảng trắng);
--   2. TỰ dựng câu trả lời từ các đoạn trích + dòng "Căn cứ";
--   3. áp cấu hình tổ chức (tự gửi | soạn nháp) ngay trong cùng giao dịch.
-- Sai bất kỳ điểm nào ⇒ chuyển người (citation_invalid). CHECK
-- chat_messages_ai_must_cite là lưới cuối: dòng author_kind='ai' không có trích
-- dẫn thì không ghi được, kể cả với service_role.
-- Rủi ro chấp nhận ở giai đoạn mock: người mua giả mạo đề xuất thì tệ nhất tự nhận
-- được văn bản điều khoản CÔNG KHAI, hoặc câu hỏi của chính họ không vào sổ chuyển
-- tiếp. Khi có Edge Function `answer-case-question` thì bỏ tham số `_proposal`.
--
-- ═══ ĐỌC / GHI ═══════════════════════════════════════════════════════════════
-- Ba bảng chat CHỈ có policy SELECT cho nhân viên tổ chức. Không policy ghi, không
-- policy cho người mua: người mua đọc qua my_case_questions (bản chiếu cột), nên
-- bản NHÁP, độ tin cậy, lý do chuyển tiếp, SĐT người khác không thể lọt.
--
-- Hai trạng thái tách biệt, đừng gộp:
--   chat_messages.qa_state            = người hỏi đã được trả lời chưa
--   case_question_escalations.status  = lỗ hổng tài liệu phiên đã được bù chưa
--
-- Quyền: module `hoi-dap` (view / update = trả lời, xử lý hàng đợi) và
-- `hoi-dap-cai-dat` (update — bật TỰ GỬI là quyền tin cậy cao hơn trả lời).

-- ─── 1. Mã quyền tổ chức ────────────────────────────────────────────────────
-- Backfill CẢ MANAGER lẫn AGENT (bài học 20260906100002). OWNER không cần dòng.
INSERT INTO public.org_role_permissions (role_id, module, action)
SELECT r.id, v.module, v.action
FROM public.org_roles r
JOIN (VALUES
  ('MANAGER', 'hoi-dap', 'view'), ('MANAGER', 'hoi-dap', 'update'),
  ('MANAGER', 'hoi-dap-cai-dat', 'update'),
  ('AGENT',   'hoi-dap', 'view'), ('AGENT',   'hoi-dap', 'update')
) AS v(code, module, action) ON v.code = r.code
ON CONFLICT (role_id, module, action) DO NOTHING;

-- Preset cho tổ chức tạo mới — chép nguyên bản 20260911000005, chỉ thêm hoi-dap*.
CREATE OR REPLACE FUNCTION public.org_seed_default_roles(_org_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _owner_role_id UUID;
BEGIN
  INSERT INTO public.org_roles (organization_id, name, code, description, is_system)
  VALUES (_org_id, 'Chủ sở hữu', 'OWNER', 'Toàn quyền trong tổ chức. Không thể xóa.', true)
  ON CONFLICT (organization_id, code) DO UPDATE SET updated_at = now()
  RETURNING id INTO _owner_role_id;

  INSERT INTO public.org_roles (organization_id, name, code, description, is_system) VALUES
    (_org_id, 'Quản lý',   'MANAGER', 'Quản lý hồ sơ năng lực, hồ sơ dự tuyển và thành viên.', false),
    (_org_id, 'Nhân viên', 'AGENT',   'Xem hồ sơ và lập hồ sơ dự tuyển.', false)
  ON CONFLICT (organization_id, code) DO NOTHING;

  INSERT INTO public.org_role_permissions (role_id, module, action)
  SELECT r.id, v.module, v.action
  FROM public.org_roles r
  JOIN (VALUES
    ('MANAGER','tong-quan','view'),
    ('MANAGER','nl-thong-tin-chung','view'),   ('MANAGER','nl-thong-tin-chung','update'),
    ('MANAGER','nl-dau-gia-vien','view'),      ('MANAGER','nl-dau-gia-vien','create'),
    ('MANAGER','nl-dau-gia-vien','update'),    ('MANAGER','nl-dau-gia-vien','delete'),
    ('MANAGER','nhan-su','view'),              ('MANAGER','nhan-su','update'),
    ('MANAGER','nhan-su','export'),
    ('MANAGER','boi-duong','view'),            ('MANAGER','boi-duong','create'),
    ('MANAGER','boi-duong','update'),          ('MANAGER','boi-duong','delete'),
    ('MANAGER','boi-duong','export'),
    ('MANAGER','nl-co-so-vat-chat','view'),    ('MANAGER','nl-co-so-vat-chat','create'),
    ('MANAGER','nl-co-so-vat-chat','update'),  ('MANAGER','nl-co-so-vat-chat','delete'),
    ('MANAGER','nl-lich-su-dau-gia','view'),   ('MANAGER','nl-lich-su-dau-gia','create'),
    ('MANAGER','nl-lich-su-dau-gia','update'), ('MANAGER','nl-lich-su-dau-gia','delete'),
    ('MANAGER','nl-lich-su-dau-gia','export'),
    ('MANAGER','nl-tai-chinh','view'),         ('MANAGER','nl-tai-chinh','update'),
    ('MANAGER','ho-so-du-tuyen','view'),       ('MANAGER','ho-so-du-tuyen','create'),
    ('MANAGER','ho-so-du-tuyen','update'),     ('MANAGER','ho-so-du-tuyen','delete'),
    ('MANAGER','ho-so-du-tuyen','export'),
    ('MANAGER','yeu-cau-ky-gui','view'),       ('MANAGER','yeu-cau-ky-gui','update'),
    ('MANAGER','phien-dau-gia','view'),        ('MANAGER','phien-dau-gia','create'),
    ('MANAGER','phien-dau-gia','update'),      ('MANAGER','phien-dau-gia','delete'),
    ('MANAGER','ho-so-tham-gia','view'),       ('MANAGER','ho-so-tham-gia','update'),
    ('MANAGER','hoi-dap','view'),              ('MANAGER','hoi-dap','update'),
    ('MANAGER','hoi-dap-cai-dat','update'),
    ('MANAGER','tin-dang','view'),             ('MANAGER','tin-dang','create'),
    ('MANAGER','tin-dang','update'),           ('MANAGER','tin-dang','delete'),
    ('MANAGER','thanh-vien','view'),           ('MANAGER','thanh-vien','create'),
    ('MANAGER','credit','view'),
    ('AGENT','tong-quan','view'),
    ('AGENT','nl-thong-tin-chung','view'),     ('AGENT','nl-dau-gia-vien','view'),
    ('AGENT','nhan-su','view'),                ('AGENT','nhan-su','export'),
    ('AGENT','boi-duong','view'),              ('AGENT','boi-duong','export'),
    ('AGENT','nl-co-so-vat-chat','view'),      ('AGENT','nl-lich-su-dau-gia','view'),
    ('AGENT','nl-tai-chinh','view'),
    ('AGENT','ho-so-du-tuyen','view'),         ('AGENT','ho-so-du-tuyen','create'),
    ('AGENT','yeu-cau-ky-gui','view'),
    ('AGENT','phien-dau-gia','view'),
    ('AGENT','ho-so-tham-gia','view'),
    ('AGENT','hoi-dap','view'),                ('AGENT','hoi-dap','update'),
    ('AGENT','tin-dang','view'),               ('AGENT','tin-dang','create')
  ) AS v(code, module, action) ON v.code = r.code
  WHERE r.organization_id = _org_id
  ON CONFLICT (role_id, module, action) DO NOTHING;

  RETURN _owner_role_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.org_seed_default_roles(UUID) TO authenticated;

-- ─── 2. Hàm quyền ───────────────────────────────────────────────────────────
-- Nhánh owner_id là BẮT BUỘC: org_has_permission chỉ nhìn membership ACTIVE.
CREATE OR REPLACE FUNCTION public.can_use_case_chat(_org_id UUID, _action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.org_has_permission(_org_id, 'hoi-dap', _action)
      OR EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = _org_id AND o.owner_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.can_edit_chat_settings(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.org_has_permission(_org_id, 'hoi-dap-cai-dat', 'update')
      OR EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = _org_id AND o.owner_id = auth.uid())
$$;

REVOKE EXECUTE ON FUNCTION public.can_use_case_chat(UUID, TEXT)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_chat_settings(UUID)   FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_use_case_chat(UUID, TEXT)  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.can_edit_chat_settings(UUID)   TO authenticated;

-- ─── 3. Cấu hình trả lời tự động của tổ chức ────────────────────────────────
-- Không có dòng = mặc định an toàn: soạn nháp ở mọi kênh (xem case_chat_settings).
CREATE TABLE IF NOT EXISTS public.org_chat_settings (
  organization_id   UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  marketplace_mode  TEXT NOT NULL DEFAULT 'draft' CHECK (marketplace_mode IN ('auto_send', 'draft')),
  zalo_mode         TEXT NOT NULL DEFAULT 'draft' CHECK (zalo_mode IN ('auto_send', 'draft')),
  min_confidence    NUMERIC(3,2) NOT NULL DEFAULT 0.80 CHECK (min_confidence BETWEEN 0.50 AND 0.99),
  -- Tin nhắn chờ khi chuyển chuyên viên — KHÔNG được chứa thông tin nghiệp vụ.
  escalation_reply  TEXT NOT NULL
                      DEFAULT 'Cảm ơn anh/chị đã hỏi. Nội dung này chưa có trong tài liệu phiên; chuyên viên sẽ phản hồi sớm.'
                      CHECK (char_length(escalation_reply) <= 500),
  updated_by        UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS org_chat_settings_updated_at ON public.org_chat_settings;
CREATE TRIGGER org_chat_settings_updated_at
  BEFORE UPDATE ON public.org_chat_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.org_chat_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_chat_settings_select" ON public.org_chat_settings;
CREATE POLICY "org_chat_settings_select" ON public.org_chat_settings
  FOR SELECT TO authenticated
  USING (public.can_use_case_chat(organization_id, 'view') OR public.can_edit_chat_settings(organization_id));

DROP POLICY IF EXISTS "org_chat_settings_insert" ON public.org_chat_settings;
CREATE POLICY "org_chat_settings_insert" ON public.org_chat_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_chat_settings(organization_id));

DROP POLICY IF EXISTS "org_chat_settings_update" ON public.org_chat_settings;
CREATE POLICY "org_chat_settings_update" ON public.org_chat_settings
  FOR UPDATE TO authenticated
  USING      (public.can_edit_chat_settings(organization_id))
  WITH CHECK (public.can_edit_chat_settings(organization_id));

DROP POLICY IF EXISTS "org_chat_settings_admin_all" ON public.org_chat_settings;
CREATE POLICY "org_chat_settings_admin_all" ON public.org_chat_settings
  FOR ALL
  USING      (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE OR REPLACE FUNCTION public.case_chat_settings(_org_id UUID)
RETURNS TABLE (marketplace_mode TEXT, zalo_mode TEXT, min_confidence NUMERIC, escalation_reply TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(s.marketplace_mode, 'draft'),
         COALESCE(s.zalo_mode, 'draft'),
         COALESCE(s.min_confidence, 0.80),
         COALESCE(s.escalation_reply,
                  'Cảm ơn anh/chị đã hỏi. Nội dung này chưa có trong tài liệu phiên; chuyên viên sẽ phản hồi sớm.')
    FROM (SELECT 1) AS one
    LEFT JOIN public.org_chat_settings s ON s.organization_id = _org_id
$$;

-- ─── 4. Hội thoại ───────────────────────────────────────────────────────────
-- Khoá theo (tổ chức, kênh, người liên hệ) — KHÔNG theo phiên: một luồng Zalo thật
-- hỏi nhiều phiên. Phiên nằm trên từng tin nhắn.
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel             TEXT NOT NULL CHECK (channel IN ('marketplace', 'zalo')),
  contact_name        TEXT NOT NULL CHECK (char_length(btrim(contact_name)) BETWEEN 1 AND 120),
  contact_phone       TEXT CHECK (contact_phone IS NULL OR contact_phone ~ '^0[0-9]{9}$'),
  bidder_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Zalo user id thật; "sim:{sđt}" cho công cụ giả lập.
  external_thread_id  TEXT CHECK (external_thread_id IS NULL OR char_length(external_thread_id) <= 120),
  is_simulated        BOOLEAN NOT NULL DEFAULT false,
  last_session_id     UUID REFERENCES public.auction_sessions(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  last_message_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_conversations_marketplace
  ON public.chat_conversations (organization_id, bidder_user_id)
  WHERE channel = 'marketplace' AND bidder_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_conversations_external
  ON public.chat_conversations (organization_id, channel, external_thread_id)
  WHERE external_thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_conversations_org
  ON public.chat_conversations (organization_id, last_message_at DESC);

DROP TRIGGER IF EXISTS chat_conversations_updated_at ON public.chat_conversations;
CREATE TRIGGER chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 5. Tin nhắn ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id      UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  organization_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id           UUID REFERENCES public.auction_sessions(id) ON DELETE SET NULL,
  direction            TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  author_kind          TEXT NOT NULL CHECK (author_kind IN ('bidder', 'ai', 'staff', 'system')),
  body                 TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  -- CASCADE: xoá câu hỏi thì xoá luôn trả lời (SET NULL sẽ vỡ chat_messages_ai_must_cite).
  in_reply_to          UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  qa_state             TEXT CHECK (qa_state IN ('pending', 'auto_answered', 'draft_ready', 'escalated', 'staff_answered')),
  delivery_status      TEXT CHECK (delivery_status IN ('draft', 'sent', 'discarded')),
  -- Bản chụp do server ghi: [{clause_id, document_id, doc_type, doc_title, clause_ref, heading, quote}]
  citations            JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(citations) = 'array'),
  confidence           NUMERIC(4,3) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  ai_engine            TEXT,
  external_message_id  TEXT UNIQUE,
  sent_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_inbound_is_bidder CHECK ((direction = 'inbound') = (author_kind = 'bidder')),
  CONSTRAINT chat_messages_state_by_direction CHECK (
    (direction = 'inbound') = (qa_state IS NOT NULL)
    AND (direction = 'outbound') = (delivery_status IS NOT NULL)
  ),
  -- LUẬT GỐC ở tầng dữ liệu.
  CONSTRAINT chat_messages_ai_must_cite CHECK (
    author_kind <> 'ai' OR (jsonb_array_length(citations) BETWEEN 1 AND 3 AND in_reply_to IS NOT NULL)
  ),
  CONSTRAINT chat_messages_sent_has_time CHECK (delivery_status IS DISTINCT FROM 'sent' OR sent_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON public.chat_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply ON public.chat_messages (in_reply_to) WHERE in_reply_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_drafts ON public.chat_messages (organization_id) WHERE delivery_status = 'draft';
CREATE INDEX IF NOT EXISTS idx_chat_messages_inbound
  ON public.chat_messages (organization_id, qa_state) WHERE direction = 'inbound';

CREATE OR REPLACE FUNCTION public.chat_messages_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.direction IS DISTINCT FROM OLD.direction THEN
    RAISE EXCEPTION 'Không đổi được hội thoại / chiều của tin nhắn.';
  END IF;
  IF OLD.delivery_status = 'sent'
     AND (NEW.body IS DISTINCT FROM OLD.body
       OR NEW.citations IS DISTINCT FROM OLD.citations
       OR NEW.delivery_status IS DISTINCT FROM OLD.delivery_status
       OR NEW.author_kind IS DISTINCT FROM OLD.author_kind) THEN
    RAISE EXCEPTION 'Tin nhắn đã gửi không sửa được.';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS chat_messages_guard ON public.chat_messages;
CREATE TRIGGER chat_messages_guard
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_messages_guard();

CREATE OR REPLACE FUNCTION public.chat_messages_touch_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.chat_conversations c
       SET last_message_at = GREATEST(c.last_message_at, NEW.created_at),
           status          = CASE WHEN NEW.direction = 'inbound' THEN 'open' ELSE c.status END,
           last_session_id = CASE WHEN NEW.direction = 'inbound' AND NEW.session_id IS NOT NULL
                                  THEN NEW.session_id ELSE c.last_session_id END
     WHERE c.id = NEW.conversation_id;
  ELSIF NEW.delivery_status = 'sent' AND OLD.delivery_status IS DISTINCT FROM 'sent' THEN
    UPDATE public.chat_conversations c
       SET last_message_at = GREATEST(c.last_message_at, COALESCE(NEW.sent_at, now()))
     WHERE c.id = NEW.conversation_id;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS chat_messages_touch_conversation ON public.chat_messages;
CREATE TRIGGER chat_messages_touch_conversation
  AFTER INSERT OR UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_messages_touch_conversation();

-- ─── 6. Sổ câu hỏi chuyển tiếp ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.case_question_escalations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id          UUID REFERENCES public.auction_sessions(id) ON DELETE SET NULL,
  conversation_id     UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  message_id          UUID NOT NULL UNIQUE REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  channel             TEXT NOT NULL CHECK (channel IN ('marketplace', 'zalo')),
  question            TEXT NOT NULL,
  detected_topics     TEXT[] NOT NULL DEFAULT '{}',
  reason              TEXT NOT NULL CHECK (reason IN (
                        'no_documents', 'no_match', 'out_of_scope', 'low_confidence', 'ambiguous',
                        'conflict', 'partial_match', 'citation_invalid', 'no_case', 'staff_flagged')),
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'added_to_case', 'dismissed')),
  resolution_note     TEXT CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 1000),
  resolved_clause_id  UUID REFERENCES public.case_document_clauses(id) ON DELETE SET NULL,
  resolved_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_escalations_org
  ON public.case_question_escalations (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_escalations_session
  ON public.case_question_escalations (session_id, status);

-- ─── 7. RLS: nhân viên tổ chức CHỈ ĐỌC; mọi ghi qua RPC ────────────────────
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_question_escalations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_conversations_select" ON public.chat_conversations;
CREATE POLICY "chat_conversations_select" ON public.chat_conversations
  FOR SELECT TO authenticated
  USING (public.can_use_case_chat(organization_id, 'view'));

DROP POLICY IF EXISTS "chat_conversations_admin_all" ON public.chat_conversations;
CREATE POLICY "chat_conversations_admin_all" ON public.chat_conversations
  FOR ALL
  USING      (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS "chat_messages_select" ON public.chat_messages;
CREATE POLICY "chat_messages_select" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (public.can_use_case_chat(organization_id, 'view'));

DROP POLICY IF EXISTS "chat_messages_admin_all" ON public.chat_messages;
CREATE POLICY "chat_messages_admin_all" ON public.chat_messages
  FOR ALL
  USING      (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS "case_question_escalations_select" ON public.case_question_escalations;
CREATE POLICY "case_question_escalations_select" ON public.case_question_escalations
  FOR SELECT TO authenticated
  USING (public.can_use_case_chat(organization_id, 'view'));

DROP POLICY IF EXISTS "case_question_escalations_admin_all" ON public.case_question_escalations;
CREATE POLICY "case_question_escalations_admin_all" ON public.case_question_escalations
  FOR ALL
  USING      (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ─── 8. Điều khoản citable: mở thêm cho người trực hộp thư ─────────────────
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
          OR public.can_manage_auction_sessions(c.organization_id, 'view')
          OR public.can_use_case_chat(c.organization_id, 'view'))
   ORDER BY CASE d.doc_type
              WHEN 'notice' THEN 1 WHEN 'rules' THEN 2 WHEN 'deposit_terms' THEN 3
              WHEN 'viewing_schedule' THEN 4 ELSE 5 END,
            c.sort_order, c.id
$$;

GRANT EXECUTE ON FUNCTION public.case_citable_clauses(UUID) TO anon, authenticated;

-- ─── 9. Cổng trích dẫn (NỘI BỘ) ─────────────────────────────────────────────
-- Trả mảng bản chụp đã làm giàu, hoặc NULL nếu BẤT KỲ trích dẫn nào sai (tất cả
-- hoặc không gì). Dùng lại khi gửi nháp và khi người mua đọc lại câu trả lời cũ.
CREATE OR REPLACE FUNCTION public.case_qa_validate_citations(_session_id UUID, _citations JSONB)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_out    JSONB := '[]'::jsonb;
  v_item   JSONB;
  v_id     UUID;
  v_quote  TEXT;
  v_seen   UUID[] := '{}';
  v_row    RECORD;
BEGIN
  IF _session_id IS NULL OR _citations IS NULL OR jsonb_typeof(_citations) <> 'array'
     OR jsonb_array_length(_citations) NOT BETWEEN 1 AND 3 THEN
    RETURN NULL;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_citations) LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN RETURN NULL; END IF;
    BEGIN
      v_id := (v_item->>'clause_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN NULL;
    END;
    IF v_id IS NULL OR v_id = ANY (v_seen) THEN RETURN NULL; END IF;
    v_seen := v_seen || v_id;

    v_quote := btrim(COALESCE(v_item->>'quote', ''));
    IF char_length(v_quote) NOT BETWEEN 8 AND 500 THEN RETURN NULL; END IF;

    SELECT c.id, c.document_id, d.doc_type, d.title, c.clause_ref, c.heading, c.body
      INTO v_row
      FROM public.case_document_clauses c
      JOIN public.case_documents d ON d.id = c.document_id
     WHERE c.id = v_id
       AND c.session_id = _session_id
       AND c.status = 'confirmed'
       AND (d.review_status = 'confirmed' OR d.doc_type = 'clarification');
    IF NOT FOUND THEN RETURN NULL; END IF;

    IF position(regexp_replace(v_quote, '\s+', ' ', 'g') IN regexp_replace(v_row.body, '\s+', ' ', 'g')) = 0 THEN
      RETURN NULL;
    END IF;

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'clause_id', v_row.id, 'document_id', v_row.document_id, 'doc_type', v_row.doc_type,
      'doc_title', v_row.title, 'clause_ref', v_row.clause_ref, 'heading', v_row.heading, 'quote', v_quote));
  END LOOP;

  RETURN v_out;
END; $$;

-- ⚠️ BẢN SONG SINH của composeAnswerText (src/lib/caseQa/compose.ts). Sửa định dạng thì sửa CẢ HAI.
CREATE OR REPLACE FUNCTION public.case_qa_compose_answer(_session_code TEXT, _snapshot JSONB)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT 'Theo tài liệu phiên ' || COALESCE(_session_code, '') || ':'
      || COALESCE((
           SELECT string_agg(
                    E'\n\n'
                    || CASE WHEN t.c->>'quote' IS NOT NULL THEN '“' || (t.c->>'quote') || '”' || E'\n' ELSE '' END
                    || 'Căn cứ: ' || (t.c->>'clause_ref')
                    || COALESCE(' – ' || NULLIF(t.c->>'heading', ''), '')
                    || ', ' || (t.c->>'doc_title'),
                    '' ORDER BY t.ord)
             FROM jsonb_array_elements(_snapshot) WITH ORDINALITY AS t(c, ord)
         ), '')
$$;

-- Áp đề xuất của engine lên MỘT câu hỏi. Mọi đường (sàn, Zalo giả lập, chạy lại)
-- đều đi qua đây ⇒ luật trích dẫn + cấu hình tổ chức chỉ có một bản.
CREATE OR REPLACE FUNCTION public.case_qa_apply_proposal(_inbound_id UUID, _proposal JSONB, _allow_auto BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c_engine_reasons CONSTANT TEXT[] := ARRAY[
    'no_documents', 'no_match', 'out_of_scope', 'low_confidence', 'ambiguous', 'conflict', 'partial_match'];
  v_msg      public.chat_messages%ROWTYPE;
  v_channel  TEXT;
  v_set      RECORD;
  v_auto     BOOLEAN;
  v_reason   TEXT;
  v_topics   TEXT[];
  v_conf     NUMERIC;
  v_snapshot JSONB;
  v_code     TEXT;
  v_body     TEXT;
  v_reply_id UUID;
  v_state    TEXT;
BEGIN
  SELECT * INTO v_msg FROM public.chat_messages WHERE id = _inbound_id AND direction = 'inbound' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy câu hỏi.';
  END IF;
  SELECT c.channel INTO v_channel FROM public.chat_conversations c WHERE c.id = v_msg.conversation_id;
  SELECT * INTO v_set FROM public.case_chat_settings(v_msg.organization_id);
  v_auto := COALESCE(_allow_auto, false)
            AND (CASE v_channel WHEN 'zalo' THEN v_set.zalo_mode ELSE v_set.marketplace_mode END) = 'auto_send';

  v_topics := (ARRAY(SELECT jsonb_array_elements_text(
                 CASE WHEN jsonb_typeof(_proposal->'topics') = 'array' THEN _proposal->'topics' ELSE '[]'::jsonb END)))[1:6];
  BEGIN
    v_conf := LEAST(GREATEST(COALESCE((_proposal->>'confidence')::numeric, 0), 0), 1);
  EXCEPTION WHEN others THEN
    v_conf := 0;
  END;

  IF v_msg.session_id IS NULL THEN
    v_reason := 'no_case';
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.case_document_clauses c
      JOIN public.case_documents d ON d.id = c.document_id
     WHERE c.session_id = v_msg.session_id AND c.status = 'confirmed'
       AND (d.review_status = 'confirmed' OR d.doc_type = 'clarification')
  ) THEN
    -- Kiểm ở SERVER, không tin đề xuất nói "có tài liệu".
    v_reason := 'no_documents';
  ELSIF COALESCE(_proposal->>'outcome', '') <> 'answer' THEN
    v_reason := CASE WHEN (_proposal->>'reason') = ANY (c_engine_reasons) THEN _proposal->>'reason' ELSE 'no_match' END;
  ELSE
    v_snapshot := public.case_qa_validate_citations(v_msg.session_id, _proposal->'citations');
    IF v_snapshot IS NULL THEN
      v_reason := 'citation_invalid';
    END IF;
  END IF;

  IF v_reason IS NOT NULL THEN
    INSERT INTO public.case_question_escalations
      (organization_id, session_id, conversation_id, message_id, channel, question, detected_topics, reason)
    VALUES
      (v_msg.organization_id, v_msg.session_id, v_msg.conversation_id, v_msg.id, v_channel, v_msg.body,
       COALESCE(v_topics, '{}'), v_reason)
    ON CONFLICT (message_id) DO UPDATE
      SET reason = EXCLUDED.reason, detected_topics = EXCLUDED.detected_topics
      WHERE public.case_question_escalations.status = 'open';

    UPDATE public.chat_messages SET qa_state = 'escalated' WHERE id = v_msg.id;

    IF v_auto AND btrim(v_set.escalation_reply) <> ''
       AND NOT EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.in_reply_to = v_msg.id AND m.author_kind = 'system') THEN
      INSERT INTO public.chat_messages
        (conversation_id, organization_id, session_id, direction, author_kind, body, in_reply_to, delivery_status, sent_at)
      VALUES
        (v_msg.conversation_id, v_msg.organization_id, v_msg.session_id, 'outbound', 'system',
         v_set.escalation_reply, v_msg.id, 'sent', now());
    END IF;

    RETURN jsonb_build_object('state', 'escalated', 'reason', v_reason, 'message_id', v_msg.id);
  END IF;

  SELECT s.code INTO v_code FROM public.auction_sessions s WHERE s.id = v_msg.session_id;
  v_body := public.case_qa_compose_answer(v_code, v_snapshot);
  v_state := CASE WHEN v_auto AND v_conf >= v_set.min_confidence THEN 'auto_answered' ELSE 'draft_ready' END;

  INSERT INTO public.chat_messages
    (conversation_id, organization_id, session_id, direction, author_kind, body, in_reply_to,
     delivery_status, citations, confidence, ai_engine, sent_at)
  VALUES
    (v_msg.conversation_id, v_msg.organization_id, v_msg.session_id, 'outbound', 'ai', v_body, v_msg.id,
     CASE WHEN v_state = 'auto_answered' THEN 'sent' ELSE 'draft' END,
     v_snapshot, v_conf, left(COALESCE(_proposal->>'engine', 'unknown'), 40),
     CASE WHEN v_state = 'auto_answered' THEN now() END)
  RETURNING id INTO v_reply_id;

  UPDATE public.chat_messages SET qa_state = v_state WHERE id = v_msg.id;

  -- Bản nháp KHÔNG BAO GIỜ trả về đây: người gọi có thể là người mua.
  RETURN jsonb_build_object(
    'state', v_state,
    'message_id', v_msg.id,
    'answer', CASE WHEN v_state = 'auto_answered'
                   THEN jsonb_build_object('body', v_body, 'citations', v_snapshot) END);
END; $$;

-- ─── 10. Người mua ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ask_case_question(
  _session_id    UUID,
  _question      TEXT,
  _contact_name  TEXT,
  _contact_phone TEXT,
  _proposal      JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_s     RECORD;
  v_q     TEXT := btrim(COALESCE(_question, ''));
  v_name  TEXT := btrim(COALESCE(_contact_name, ''));
  v_phone TEXT := NULLIF(regexp_replace(COALESCE(_contact_phone, ''), '\s', '', 'g'), '');
  v_conv  UUID;
  v_msg   UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Vui lòng đăng nhập để gửi câu hỏi.';
  END IF;

  SELECT s.id, s.organization_id, s.status, s.ends_at INTO v_s
    FROM public.auction_sessions s WHERE s.id = _session_id;
  IF NOT FOUND OR v_s.status <> 'published' THEN
    RAISE EXCEPTION 'Phiên này không nhận câu hỏi.';
  END IF;
  IF v_s.ends_at IS NOT NULL AND v_s.ends_at <= now() THEN
    RAISE EXCEPTION 'Phiên đã kết thúc, không nhận câu hỏi mới.';
  END IF;
  IF char_length(v_q) NOT BETWEEN 5 AND 1000 THEN
    RAISE EXCEPTION 'Câu hỏi cần từ 5 đến 1.000 ký tự.';
  END IF;
  IF char_length(v_name) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Họ tên cần từ 2 đến 120 ký tự.';
  END IF;
  IF v_phone IS NOT NULL AND v_phone !~ '^0[0-9]{9}$' THEN
    RAISE EXCEPTION 'Số điện thoại không hợp lệ.';
  END IF;

  -- Tuần tự hoá theo người hỏi để phép đếm giới hạn không bị lách bằng gửi song song.
  PERFORM pg_advisory_xact_lock(hashtextextended('ask_case_question:' || v_uid::text, 0));

  IF (SELECT count(*) FROM public.chat_messages m
        JOIN public.chat_conversations c ON c.id = m.conversation_id
       WHERE c.bidder_user_id = v_uid AND c.channel = 'marketplace'
         AND m.direction = 'inbound' AND m.created_at > now() - interval '10 minutes') >= 10
     OR (SELECT count(*) FROM public.chat_messages m
        JOIN public.chat_conversations c ON c.id = m.conversation_id
       WHERE c.bidder_user_id = v_uid AND c.channel = 'marketplace'
         AND m.direction = 'inbound' AND m.created_at > now() - interval '1 day') >= 40 THEN
    RAISE EXCEPTION 'Bạn đã gửi nhiều câu hỏi liên tiếp. Vui lòng thử lại sau ít phút.';
  END IF;

  INSERT INTO public.chat_conversations
    (organization_id, channel, contact_name, contact_phone, bidder_user_id, last_session_id)
  VALUES (v_s.organization_id, 'marketplace', v_name, v_phone, v_uid, v_s.id)
  ON CONFLICT (organization_id, bidder_user_id) WHERE channel = 'marketplace' AND bidder_user_id IS NOT NULL
  DO UPDATE SET contact_name    = EXCLUDED.contact_name,
                contact_phone   = COALESCE(EXCLUDED.contact_phone, public.chat_conversations.contact_phone),
                last_session_id = EXCLUDED.last_session_id
  RETURNING id INTO v_conv;

  INSERT INTO public.chat_messages
    (conversation_id, organization_id, session_id, direction, author_kind, body, qa_state)
  VALUES (v_conv, v_s.organization_id, v_s.id, 'inbound', 'bidder', v_q, 'pending')
  RETURNING id INTO v_msg;

  RETURN public.case_qa_apply_proposal(v_msg, _proposal, true);
END; $$;

-- Bản chiếu cho người mua: CHỈ câu hỏi của chính mình, CHỈ câu trả lời đã gửi.
-- Câu trả lời AI mà điều khoản đã đổi (trích dẫn không còn khớp) ⇒ 'outdated', ẩn nội dung.
CREATE OR REPLACE FUNCTION public.my_case_questions(_session_id UUID)
RETURNS TABLE (
  message_id       UUID,
  question         TEXT,
  asked_at         TIMESTAMPTZ,
  state            TEXT,
  answer_body      TEXT,
  answer_citations JSONB,
  answered_at      TIMESTAMPTZ,
  answered_by      TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH q AS (
    SELECT m.id, m.body, m.created_at, m.qa_state, m.session_id
      FROM public.chat_messages m
      JOIN public.chat_conversations c ON c.id = m.conversation_id
     WHERE c.bidder_user_id = auth.uid()
       AND c.channel = 'marketplace'
       AND m.direction = 'inbound'
       AND m.session_id = _session_id
     ORDER BY m.created_at DESC
     LIMIT 50
  ),
  a AS (
    SELECT q.*, r.body AS r_body, r.citations AS r_citations, r.sent_at AS r_sent_at, r.author_kind AS r_author,
           (r.author_kind = 'ai' AND public.case_qa_validate_citations(q.session_id, r.citations) IS NULL) AS r_stale
      FROM q
      LEFT JOIN LATERAL (
        SELECT m.body, m.citations, m.sent_at, m.author_kind
          FROM public.chat_messages m
         WHERE m.in_reply_to = q.id AND m.direction = 'outbound'
           AND m.delivery_status = 'sent' AND m.author_kind IN ('ai', 'staff')
         ORDER BY m.sent_at DESC
         LIMIT 1
      ) r ON true
  )
  SELECT a.id,
         a.body,
         a.created_at,
         CASE
           WHEN a.r_author IS NOT NULL AND a.r_stale THEN 'outdated'
           WHEN a.r_author IS NOT NULL THEN 'answered'
           WHEN a.qa_state = 'escalated' THEN 'escalated'
           ELSE 'pending_review'
         END,
         CASE WHEN a.r_author IS NOT NULL AND NOT a.r_stale THEN a.r_body END,
         CASE WHEN a.r_author IS NOT NULL AND NOT a.r_stale THEN a.r_citations END,
         a.r_sent_at,
         a.r_author
    FROM a
   ORDER BY a.created_at DESC;
END; $$;

-- ─── 11. Nhân viên tổ chức ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.org_simulate_zalo_message(
  _session_id   UUID,
  _sender_name  TEXT,
  _sender_phone TEXT,
  _body         TEXT,
  _proposal     JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_s     RECORD;
  v_name  TEXT := btrim(COALESCE(_sender_name, ''));
  v_phone TEXT := regexp_replace(COALESCE(_sender_phone, ''), '\D', '', 'g');
  v_body  TEXT := btrim(COALESCE(_body, ''));
  v_conv  UUID;
  v_msg   UUID;
BEGIN
  SELECT s.id, s.organization_id, s.status INTO v_s FROM public.auction_sessions s WHERE s.id = _session_id;
  IF NOT FOUND OR NOT public.can_use_case_chat(v_s.organization_id, 'update') THEN
    RAISE EXCEPTION 'Không có quyền dùng hộp thư cho phiên này.';
  END IF;
  IF v_s.status = 'cancelled' THEN
    RAISE EXCEPTION 'Phiên đã huỷ.';
  END IF;
  IF char_length(v_name) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Tên người gửi cần từ 2 đến 120 ký tự.';
  END IF;
  IF v_phone !~ '^0[0-9]{9}$' THEN
    RAISE EXCEPTION 'Số điện thoại không hợp lệ.';
  END IF;
  IF char_length(v_body) NOT BETWEEN 2 AND 1000 THEN
    RAISE EXCEPTION 'Nội dung tin nhắn cần từ 2 đến 1.000 ký tự.';
  END IF;

  INSERT INTO public.chat_conversations
    (organization_id, channel, contact_name, contact_phone, external_thread_id, is_simulated, last_session_id)
  VALUES (v_s.organization_id, 'zalo', v_name, v_phone, 'sim:' || v_phone, true, v_s.id)
  ON CONFLICT (organization_id, channel, external_thread_id) WHERE external_thread_id IS NOT NULL
  DO UPDATE SET contact_name = EXCLUDED.contact_name, last_session_id = EXCLUDED.last_session_id
  RETURNING id INTO v_conv;

  INSERT INTO public.chat_messages
    (conversation_id, organization_id, session_id, direction, author_kind, body, qa_state)
  VALUES (v_conv, v_s.organization_id, v_s.id, 'inbound', 'bidder', v_body, 'pending')
  RETURNING id INTO v_msg;

  RETURN public.case_qa_apply_proposal(v_msg, _proposal, true) || jsonb_build_object('conversation_id', v_conv);
END; $$;

-- Chạy lại AI cho một câu hỏi (sau khi bổ sung tài liệu). Có người đang ngồi đó ⇒
-- KHÔNG tự gửi, luôn ra nháp. Sổ chuyển tiếp giữ nguyên để tổ chức tự đóng.
CREATE OR REPLACE FUNCTION public.org_retry_case_answer(_message_id UUID, _proposal JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_msg public.chat_messages%ROWTYPE;
BEGIN
  SELECT * INTO v_msg FROM public.chat_messages WHERE id = _message_id AND direction = 'inbound';
  IF NOT FOUND OR NOT public.can_use_case_chat(v_msg.organization_id, 'update') THEN
    RAISE EXCEPTION 'Không có quyền xử lý câu hỏi này.';
  END IF;
  IF v_msg.qa_state NOT IN ('pending', 'draft_ready', 'escalated') THEN
    RAISE EXCEPTION 'Câu hỏi đã được trả lời.';
  END IF;

  UPDATE public.chat_messages
     SET delivery_status = 'discarded'
   WHERE in_reply_to = v_msg.id AND delivery_status = 'draft';

  RETURN public.case_qa_apply_proposal(v_msg.id, _proposal, false);
END; $$;

CREATE OR REPLACE FUNCTION public.org_send_chat_draft(_draft_id UUID, _edited_body TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_d    public.chat_messages%ROWTYPE;
  v_edit TEXT := NULLIF(btrim(COALESCE(_edited_body, '')), '');
BEGIN
  SELECT * INTO v_d FROM public.chat_messages WHERE id = _draft_id AND direction = 'outbound' FOR UPDATE;
  IF NOT FOUND OR NOT public.can_use_case_chat(v_d.organization_id, 'update') THEN
    RAISE EXCEPTION 'Không có quyền gửi tin nhắn này.';
  END IF;
  IF v_d.delivery_status <> 'draft' THEN
    RAISE EXCEPTION 'Bản nháp đã được gửi hoặc đã bỏ.';
  END IF;
  -- Điều khoản có thể đã bị sửa / mở lại sau khi AI soạn nháp.
  IF v_d.author_kind = 'ai' AND public.case_qa_validate_citations(v_d.session_id, v_d.citations) IS NULL THEN
    RAISE EXCEPTION 'Điều khoản trích dẫn đã thay đổi — hãy chạy lại AI.';
  END IF;

  IF v_edit IS NOT NULL AND v_edit IS DISTINCT FROM v_d.body THEN
    IF char_length(v_edit) > 4000 THEN
      RAISE EXCEPTION 'Nội dung quá dài.';
    END IF;
    UPDATE public.chat_messages
       SET body = v_edit, author_kind = 'staff', delivery_status = 'sent', sent_at = now(), sent_by = auth.uid()
     WHERE id = _draft_id;
    UPDATE public.chat_messages SET qa_state = 'staff_answered' WHERE id = v_d.in_reply_to;
  ELSE
    UPDATE public.chat_messages
       SET delivery_status = 'sent', sent_at = now(), sent_by = auth.uid()
     WHERE id = _draft_id;
    UPDATE public.chat_messages SET qa_state = 'auto_answered' WHERE id = v_d.in_reply_to;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.org_discard_chat_draft(_draft_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_d public.chat_messages%ROWTYPE;
BEGIN
  SELECT * INTO v_d FROM public.chat_messages WHERE id = _draft_id AND direction = 'outbound' FOR UPDATE;
  IF NOT FOUND OR NOT public.can_use_case_chat(v_d.organization_id, 'update') THEN
    RAISE EXCEPTION 'Không có quyền sửa tin nhắn này.';
  END IF;
  IF v_d.delivery_status <> 'draft' THEN
    RAISE EXCEPTION 'Chỉ bỏ được bản nháp.';
  END IF;
  UPDATE public.chat_messages SET delivery_status = 'discarded' WHERE id = _draft_id;
  -- Bỏ nháp AI nghĩa là chuyên viên sẽ tự trả lời: câu hỏi vẫn chờ.
  UPDATE public.chat_messages
     SET qa_state = 'pending'
   WHERE id = v_d.in_reply_to AND qa_state = 'draft_ready';
END; $$;

-- Chuyên viên trả lời. Được phép KHÔNG trích dẫn (nhãn "Chuyên viên trả lời"); nếu
-- đính kèm điều khoản thì phải citable + cùng phiên, server tự nối dòng "Căn cứ".
CREATE OR REPLACE FUNCTION public.org_send_staff_reply(
  _conversation_id UUID,
  _body            TEXT,
  _in_reply_to     UUID DEFAULT NULL,
  _clause_ids      UUID[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_conv     public.chat_conversations%ROWTYPE;
  v_body     TEXT := btrim(COALESCE(_body, ''));
  v_session  UUID;
  v_ids      UUID[] := ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(_clause_ids, '{}')) AS x WHERE x IS NOT NULL);
  v_snapshot JSONB := '[]'::jsonb;
  v_n        INT;
  v_id       UUID;
BEGIN
  SELECT * INTO v_conv FROM public.chat_conversations WHERE id = _conversation_id;
  IF NOT FOUND OR NOT public.can_use_case_chat(v_conv.organization_id, 'update') THEN
    RAISE EXCEPTION 'Không có quyền trả lời hội thoại này.';
  END IF;
  IF char_length(v_body) NOT BETWEEN 1 AND 3500 THEN
    RAISE EXCEPTION 'Nội dung trả lời cần từ 1 đến 3.500 ký tự.';
  END IF;

  IF _in_reply_to IS NOT NULL THEN
    SELECT m.session_id INTO v_session
      FROM public.chat_messages m
     WHERE m.id = _in_reply_to AND m.conversation_id = _conversation_id AND m.direction = 'inbound';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Câu hỏi được trả lời không thuộc hội thoại này.';
    END IF;
  END IF;
  v_session := COALESCE(v_session, v_conv.last_session_id);

  IF cardinality(v_ids) > 3 THEN
    RAISE EXCEPTION 'Đính kèm tối đa 3 điều khoản.';
  END IF;
  IF cardinality(v_ids) > 0 THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'clause_id', c.id, 'document_id', c.document_id, 'doc_type', d.doc_type, 'doc_title', d.title,
             'clause_ref', c.clause_ref, 'heading', c.heading, 'quote', NULL)
             ORDER BY array_position(v_ids, c.id)), '[]'::jsonb),
           count(*)
      INTO v_snapshot, v_n
      FROM public.case_document_clauses c
      JOIN public.case_documents d ON d.id = c.document_id
     WHERE c.id = ANY (v_ids)
       AND c.session_id = v_session
       AND c.status = 'confirmed'
       AND (d.review_status = 'confirmed' OR d.doc_type = 'clarification');
    IF v_n <> cardinality(v_ids) THEN
      RAISE EXCEPTION 'Điều khoản đính kèm phải thuộc phiên của câu hỏi và đã xác nhận.';
    END IF;
    v_body := v_body || E'\n\n' || (
      SELECT string_agg('Căn cứ: ' || (t.c->>'clause_ref') || COALESCE(' – ' || NULLIF(t.c->>'heading', ''), '')
                        || ', ' || (t.c->>'doc_title'), E'\n' ORDER BY t.ord)
        FROM jsonb_array_elements(v_snapshot) WITH ORDINALITY AS t(c, ord));
  END IF;

  INSERT INTO public.chat_messages
    (conversation_id, organization_id, session_id, direction, author_kind, body, in_reply_to,
     delivery_status, citations, sent_by, sent_at)
  VALUES
    (_conversation_id, v_conv.organization_id, v_session, 'outbound', 'staff', v_body, _in_reply_to,
     'sent', v_snapshot, auth.uid(), now())
  RETURNING id INTO v_id;

  IF _in_reply_to IS NOT NULL THEN
    UPDATE public.chat_messages
       SET delivery_status = 'discarded'
     WHERE in_reply_to = _in_reply_to AND delivery_status = 'draft';
    UPDATE public.chat_messages SET qa_state = 'staff_answered' WHERE id = _in_reply_to;
  END IF;

  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.org_set_conversation_status(_conversation_id UUID, _status TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org UUID;
BEGIN
  SELECT organization_id INTO v_org FROM public.chat_conversations WHERE id = _conversation_id;
  IF v_org IS NULL OR NOT public.can_use_case_chat(v_org, 'update') THEN
    RAISE EXCEPTION 'Không có quyền cập nhật hội thoại này.';
  END IF;
  IF _status NOT IN ('open', 'resolved') THEN
    RAISE EXCEPTION 'Trạng thái không hợp lệ.';
  END IF;
  UPDATE public.chat_conversations SET status = _status WHERE id = _conversation_id;
END; $$;

-- Bù lỗ hổng tài liệu từ một câu hỏi chuyển tiếp: tạo tài liệu "Giải đáp bổ sung"
-- nếu chưa có, thêm điều khoản. `_confirm` = chuyên viên tự viết nên xác nhận luôn
-- được; CHECK chỗ trống vẫn áp dụng.
CREATE OR REPLACE FUNCTION public.org_add_clarification_clause(
  _escalation_id UUID,
  _clause_ref    TEXT,
  _heading       TEXT,
  _body          TEXT,
  _topics        TEXT[],
  _confirm       BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_e      public.case_question_escalations%ROWTYPE;
  v_org    UUID;
  v_doc    UUID;
  v_clause UUID;
BEGIN
  SELECT * INTO v_e FROM public.case_question_escalations WHERE id = _escalation_id;
  IF NOT FOUND OR NOT public.can_use_case_chat(v_e.organization_id, 'view') THEN
    RAISE EXCEPTION 'Không tìm thấy câu hỏi chuyển tiếp.';
  END IF;
  IF v_e.session_id IS NULL THEN
    RAISE EXCEPTION 'Câu hỏi chưa gắn với phiên nào.';
  END IF;
  SELECT s.organization_id INTO v_org FROM public.auction_sessions s WHERE s.id = v_e.session_id;
  IF NOT public.can_manage_auction_sessions(v_org, 'update') THEN
    RAISE EXCEPTION 'Cần quyền sửa phiên đấu giá để bổ sung tài liệu phiên.';
  END IF;

  SELECT d.id INTO v_doc FROM public.case_documents d
   WHERE d.session_id = v_e.session_id AND d.doc_type = 'clarification';
  IF v_doc IS NULL THEN
    INSERT INTO public.case_documents (organization_id, session_id, doc_type, title)
    VALUES (v_org, v_e.session_id, 'clarification',
            left('Giải đáp bổ sung của ' || COALESCE((SELECT o.name FROM public.organizations o WHERE o.id = v_org), 'tổ chức'), 200))
    RETURNING id INTO v_doc;
  END IF;

  INSERT INTO public.case_document_clauses
    (document_id, session_id, organization_id, clause_ref, heading, body, topics, sort_order, status, source)
  VALUES
    (v_doc, v_e.session_id, v_org, btrim(COALESCE(_clause_ref, '')), NULLIF(btrim(COALESCE(_heading, '')), ''),
     btrim(COALESCE(_body, '')), COALESCE(_topics, '{}'),
     COALESCE((SELECT max(c.sort_order) + 10 FROM public.case_document_clauses c WHERE c.document_id = v_doc), 10),
     CASE WHEN _confirm THEN 'confirmed' ELSE 'draft' END, 'manual')
  RETURNING id INTO v_clause;

  UPDATE public.case_question_escalations SET resolved_clause_id = v_clause WHERE id = _escalation_id;
  RETURN v_clause;
END; $$;

CREATE OR REPLACE FUNCTION public.org_resolve_case_escalation(
  _escalation_id UUID,
  _status        TEXT,
  _note          TEXT DEFAULT NULL,
  _clause_id     UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_e      public.case_question_escalations%ROWTYPE;
  v_clause UUID;
BEGIN
  SELECT * INTO v_e FROM public.case_question_escalations WHERE id = _escalation_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_use_case_chat(v_e.organization_id, 'update') THEN
    RAISE EXCEPTION 'Không có quyền xử lý câu hỏi chuyển tiếp này.';
  END IF;
  IF _status NOT IN ('open', 'added_to_case', 'dismissed') THEN
    RAISE EXCEPTION 'Trạng thái không hợp lệ.';
  END IF;

  v_clause := COALESCE(_clause_id, v_e.resolved_clause_id);
  IF _status = 'added_to_case' AND NOT EXISTS (
    SELECT 1 FROM public.case_document_clauses c
      JOIN public.case_documents d ON d.id = c.document_id
     WHERE c.id = v_clause AND c.session_id = v_e.session_id AND c.status = 'confirmed'
       AND (d.review_status = 'confirmed' OR d.doc_type = 'clarification')
  ) THEN
    RAISE EXCEPTION 'Cần một điều khoản ĐÃ XÁC NHẬN của phiên này để đánh dấu đã bổ sung.';
  END IF;

  UPDATE public.case_question_escalations
     SET status             = _status,
         resolution_note    = NULLIF(btrim(COALESCE(_note, '')), ''),
         resolved_clause_id = CASE WHEN _status = 'added_to_case' THEN v_clause ELSE resolved_clause_id END,
         resolved_by        = CASE WHEN _status = 'open' THEN NULL ELSE auth.uid() END,
         resolved_at        = CASE WHEN _status = 'open' THEN NULL ELSE now() END
   WHERE id = _escalation_id;
END; $$;

-- Hộp thư: số đếm TÍNH, không lưu ⇒ không lệch.
CREATE OR REPLACE FUNCTION public.org_chat_inbox(
  _org_id     UUID,
  _filter     TEXT DEFAULT 'attention',
  _channel    TEXT DEFAULT NULL,
  _session_id UUID DEFAULT NULL
)
RETURNS TABLE (
  conversation_id   UUID,
  channel           TEXT,
  is_simulated      BOOLEAN,
  contact_name      TEXT,
  contact_phone     TEXT,
  last_session_id   UUID,
  session_code      TEXT,
  session_title     TEXT,
  status            TEXT,
  last_message_at   TIMESTAMPTZ,
  last_preview      TEXT,
  pending_drafts    INT,
  awaiting_reply    INT,
  open_escalations  INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.can_use_case_chat(_org_id, 'view') THEN
    RAISE EXCEPTION 'Không có quyền xem hộp thư.';
  END IF;

  RETURN QUERY
  WITH conv AS (
    SELECT c.*
      FROM public.chat_conversations c
     WHERE c.organization_id = _org_id
       AND (_channel IS NULL OR c.channel = _channel)
       AND (_session_id IS NULL OR c.last_session_id = _session_id
            OR EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.conversation_id = c.id AND m.session_id = _session_id))
  ),
  stats AS (
    SELECT c.id,
           count(m.id) FILTER (WHERE m.direction = 'outbound' AND m.delivery_status = 'draft')::int AS drafts,
           count(m.id) FILTER (
             WHERE m.direction = 'inbound' AND m.qa_state IN ('pending', 'draft_ready', 'escalated')
               AND NOT EXISTS (SELECT 1 FROM public.chat_messages r
                                WHERE r.in_reply_to = m.id AND r.delivery_status = 'sent'
                                  AND r.author_kind IN ('ai', 'staff')))::int AS awaiting
      FROM conv c
      LEFT JOIN public.chat_messages m ON m.conversation_id = c.id
     GROUP BY c.id
  ),
  esc AS (
    SELECT e.conversation_id AS cid, count(*)::int AS n
      FROM public.case_question_escalations e
     WHERE e.organization_id = _org_id AND e.status = 'open'
     GROUP BY e.conversation_id
  ),
  last_msg AS (
    SELECT DISTINCT ON (m.conversation_id) m.conversation_id AS cid, m.body AS preview
      FROM public.chat_messages m
      JOIN conv c ON c.id = m.conversation_id
     WHERE m.delivery_status IS DISTINCT FROM 'discarded'
     ORDER BY m.conversation_id, m.created_at DESC
  )
  SELECT c.id, c.channel, c.is_simulated, c.contact_name, c.contact_phone, c.last_session_id,
         s.code, s.title, c.status, c.last_message_at, left(l.preview, 160),
         st.drafts, st.awaiting, COALESCE(e.n, 0)
    FROM conv c
    JOIN stats st ON st.id = c.id
    LEFT JOIN esc e ON e.cid = c.id
    LEFT JOIN last_msg l ON l.cid = c.id
    LEFT JOIN public.auction_sessions s ON s.id = c.last_session_id
   WHERE _filter <> 'attention' OR st.awaiting > 0 OR st.drafts > 0
   ORDER BY c.last_message_at DESC
   LIMIT 200;
END; $$;

CREATE OR REPLACE FUNCTION public.org_chat_attention_counts(_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.can_use_case_chat(_org_id, 'view') THEN
    RETURN jsonb_build_object('awaiting_reply', 0, 'drafts', 0, 'open_escalations', 0);
  END IF;
  RETURN jsonb_build_object(
    'awaiting_reply', (
      SELECT count(*) FROM public.chat_messages m
       WHERE m.organization_id = _org_id AND m.direction = 'inbound'
         AND m.qa_state IN ('pending', 'draft_ready', 'escalated')
         AND NOT EXISTS (SELECT 1 FROM public.chat_messages r
                          WHERE r.in_reply_to = m.id AND r.delivery_status = 'sent'
                            AND r.author_kind IN ('ai', 'staff'))),
    'drafts', (
      SELECT count(*) FROM public.chat_messages m
       WHERE m.organization_id = _org_id AND m.delivery_status = 'draft'),
    'open_escalations', (
      SELECT count(*) FROM public.case_question_escalations e
       WHERE e.organization_id = _org_id AND e.status = 'open'));
END; $$;

-- ─── 12. Quyền thực thi ─────────────────────────────────────────────────────
-- Supabase mặc định GRANT EXECUTE hàm mới cho anon + authenticated ⇒ phải thu hồi tường minh.
REVOKE EXECUTE ON FUNCTION public.case_chat_settings(UUID)                            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.case_qa_validate_citations(UUID, JSONB)             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.case_qa_compose_answer(TEXT, JSONB)                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.case_qa_apply_proposal(UUID, JSONB, BOOLEAN)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.chat_messages_guard()                               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.chat_messages_touch_conversation()                  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.ask_case_question(UUID, TEXT, TEXT, TEXT, JSONB)          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_case_questions(UUID)                                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_simulate_zalo_message(UUID, TEXT, TEXT, TEXT, JSONB)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_retry_case_answer(UUID, JSONB)                        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_send_chat_draft(UUID, TEXT)                           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_discard_chat_draft(UUID)                              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_send_staff_reply(UUID, TEXT, UUID, UUID[])            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_set_conversation_status(UUID, TEXT)                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_add_clarification_clause(UUID, TEXT, TEXT, TEXT, TEXT[], BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_resolve_case_escalation(UUID, TEXT, TEXT, UUID)       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_chat_inbox(UUID, TEXT, TEXT, UUID)                    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_chat_attention_counts(UUID)                           FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ask_case_question(UUID, TEXT, TEXT, TEXT, JSONB)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_case_questions(UUID)                                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_simulate_zalo_message(UUID, TEXT, TEXT, TEXT, JSONB)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_retry_case_answer(UUID, JSONB)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_send_chat_draft(UUID, TEXT)                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_discard_chat_draft(UUID)                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_send_staff_reply(UUID, TEXT, UUID, UUID[])            TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_set_conversation_status(UUID, TEXT)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_add_clarification_clause(UUID, TEXT, TEXT, TEXT, TEXT[], BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_resolve_case_escalation(UUID, TEXT, TEXT, UUID)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_chat_inbox(UUID, TEXT, TEXT, UUID)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_chat_attention_counts(UUID)                           TO authenticated;

-- ─── 13. Kiểm chứng ─────────────────────────────────────────────────────────
DO $$
DECLARE
  v_leak TEXT;
BEGIN
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_leak
    FROM pg_proc p
   CROSS JOIN unnest(ARRAY['anon', 'authenticated']) AS r
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('case_chat_settings', 'case_qa_validate_citations', 'case_qa_compose_answer',
                       'case_qa_apply_proposal')
     AND has_function_privilege(r, p.oid, 'EXECUTE');
  IF v_leak IS NOT NULL THEN
    RAISE EXCEPTION 'Hàm nội bộ vẫn gọi được bởi vai thường: %', v_leak;
  END IF;

  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_leak
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND (p.proname LIKE 'org\_%chat%' OR p.proname LIKE 'org\_%case%' OR p.proname IN ('ask_case_question', 'my_case_questions', 'org_simulate_zalo_message', 'org_send_staff_reply', 'org_set_conversation_status', 'org_add_clarification_clause'))
     AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_leak IS NOT NULL THEN
    RAISE EXCEPTION 'Hàm hộp thư vẫn gọi được bởi anon: %', v_leak;
  END IF;

  -- Bảng chat không được có policy ghi cho authenticated, cũng không policy cho anon.
  SELECT string_agg(policyname, ', ') INTO v_leak
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('chat_conversations', 'chat_messages', 'case_question_escalations')
     AND policyname NOT LIKE '%admin_all'
     AND (cmd <> 'SELECT' OR 'anon' = ANY (roles) OR 'public' = ANY (roles));
  IF v_leak IS NOT NULL THEN
    RAISE EXCEPTION 'Bảng hộp thư có policy ghi / công khai: %', v_leak;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_ai_must_cite') THEN
    RAISE EXCEPTION 'Thiếu CHECK chat_messages_ai_must_cite';
  END IF;

  RAISE NOTICE 'OK: hộp thư hỏi đáp sẵn sàng';
END $$;
