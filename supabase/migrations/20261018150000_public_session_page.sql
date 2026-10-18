-- Trang phiên đấu giá trên sàn (/sessions, /sessions/:id) theo design
-- "San - Phien Dau Gia - De xuat" (979d4c55). Bốn thứ trang công khai cần mà
-- chưa có đường đọc:
--
--   1. Tài liệu phiên (danh sách + tải về) — case_documents KHÔNG có policy đọc
--      công khai (xem 20260912000100: RLS lọc dòng, không giấu cột). Đọc qua RPC
--      liệt kê cột bằng tay; tải tệp qua policy storage riêng chỉ khớp tệp của
--      tài liệu ĐÃ XÁC NHẬN thuộc phiên đã công bố/huỷ.
--   2. Số liệu tổ chức (số phiên, tỷ lệ phiên thành, số tài sản đã bán) — chỉ
--      tổng hợp từ phiên ĐÃ CÔNG BỐ; lọc status tường minh vì RLS cho thành viên
--      tổ chức đọc cả phiên nháp của mình.
--   3. "Còn N suất" trên thẻ danh sách — bản gộp của
--      auction_session_contract_summary để không bắn N RPC.
--   4. "Nhận email khi mở bán hồ sơ" — bảng đăng ký own-rows. GỬI EMAIL nằm ở
--      edge function notify-session-open (service role); dự án chưa có nhà cung
--      cấp email nên hàm đó chạy chế độ stub khi thiếu RESEND_API_KEY.

-- ─── 1. Tài liệu phiên công khai ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.public_session_documents(_session_id UUID)
RETURNS TABLE (
  id           UUID,
  doc_type     TEXT,
  title        TEXT,
  mime_type    TEXT,
  size_bytes   BIGINT,
  storage_path TEXT,
  issued_at    TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT d.id, d.doc_type, d.title, d.mime_type, d.size_bytes, d.storage_path,
         COALESCE(d.confirmed_at, d.created_at)
    FROM public.case_documents d
    JOIN public.auction_sessions s ON s.id = d.session_id
   WHERE d.session_id = _session_id
     AND s.status IN ('published', 'cancelled')
     AND d.review_status = 'confirmed'
     AND d.storage_path IS NOT NULL
   ORDER BY array_position(ARRAY['notice', 'rules', 'deposit_terms', 'viewing_schedule'], d.doc_type), d.created_at;
$$;

REVOKE EXECUTE ON FUNCTION public.public_session_documents(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.public_session_documents(UUID) TO anon, authenticated;

-- Policy storage gọi hàm này: chạy với quyền người gọi thì anon không đọc được
-- case_documents ⇒ EXISTS luôn false. SECURITY DEFINER + chỉ trả boolean.
CREATE OR REPLACE FUNCTION public.case_document_is_public(_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.case_documents d
      JOIN public.auction_sessions s ON s.id = d.session_id
     WHERE d.storage_path = _name
       AND d.review_status = 'confirmed'
       AND s.status IN ('published', 'cancelled')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.case_document_is_public(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.case_document_is_public(TEXT) TO anon, authenticated;

DROP POLICY IF EXISTS case_documents_storage_public_read ON storage.objects;
CREATE POLICY case_documents_storage_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'case-documents' AND public.case_document_is_public(name));

-- ─── 2. Số liệu tổ chức đấu giá ─────────────────────────────────────────────
-- successful_sessions = phiên đã chốt có ít nhất một tài sản bán được.
CREATE OR REPLACE FUNCTION public.public_auction_org_stats(_auction_org_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH s AS (
    SELECT id, finalized_at
      FROM public.auction_sessions
     WHERE auction_org_id = _auction_org_id AND status = 'published'
  )
  SELECT jsonb_build_object(
    'sessions_count',      (SELECT count(*) FROM s),
    'finalized_count',     (SELECT count(*) FROM s WHERE finalized_at IS NOT NULL),
    'successful_sessions', (SELECT count(*) FROM s
                             WHERE finalized_at IS NOT NULL
                               AND EXISTS (SELECT 1 FROM public.auction_lot_states ls
                                            WHERE ls.session_id = s.id AND ls.result = 'sold')),
    'lots_sold',           (SELECT count(*) FROM public.auction_lot_states ls
                              JOIN s ON s.id = ls.session_id
                             WHERE s.finalized_at IS NOT NULL AND ls.result = 'sold')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.public_auction_org_stats(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.public_auction_org_stats(UUID) TO anon, authenticated;

-- ─── 3. Số hồ sơ đã bán / đang giữ chỗ — gộp nhiều phiên ────────────────────
-- Cùng phép đếm với auction_session_contract_summary (sửa một bên phải sửa cả hai).
CREATE OR REPLACE FUNCTION public.public_session_seat_counts(_session_ids UUID[])
RETURNS TABLE (session_id UUID, paid_count INT, held_count INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id,
         (count(c.id) FILTER (WHERE c.status = 'paid'))::int,
         (count(c.id) FILTER (WHERE c.status = 'pending_payment' AND c.hold_expires_at > now()))::int
    FROM public.auction_sessions s
    LEFT JOIN public.auction_bidding_contracts c ON c.session_id = s.id
   WHERE s.id = ANY(_session_ids[1:500]) AND s.status = 'published'
   GROUP BY s.id;
$$;

REVOKE EXECUTE ON FUNCTION public.public_session_seat_counts(UUID[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.public_session_seat_counts(UUID[]) TO anon, authenticated;

-- ─── 4. Đăng ký nhận email khi mở bán hồ sơ ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_open_watchers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.auction_sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL CHECK (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' AND char_length(email) <= 254),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Edge function notify-session-open đặt khi đã gửi (hoặc bỏ qua vì phiên huỷ).
  notified_at TIMESTAMPTZ,
  last_error  TEXT,
  CONSTRAINT session_open_watchers_session_user_key UNIQUE (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_session_open_watchers_pending
  ON public.session_open_watchers (session_id) WHERE notified_at IS NULL;

ALTER TABLE public.session_open_watchers ENABLE ROW LEVEL SECURITY;

-- Ghi chỉ qua RPC watch_session_open (kiểm phiên còn chưa mở bán). Đọc/xoá own rows.
DROP POLICY IF EXISTS "own rows" ON public.session_open_watchers;
DROP POLICY IF EXISTS "session_open_watchers_select" ON public.session_open_watchers;
CREATE POLICY "session_open_watchers_select" ON public.session_open_watchers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "session_open_watchers_delete" ON public.session_open_watchers;
CREATE POLICY "session_open_watchers_delete" ON public.session_open_watchers
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.watch_session_open(_session_id UUID, _email TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_email TEXT := lower(btrim(COALESCE(_email, '')));
  s       RECORD;
  v_id    UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' OR char_length(v_email) > 254 THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  SELECT id, status, registration_start_at INTO s
    FROM public.auction_sessions WHERE id = _session_id;
  IF s.id IS NULL OR s.status <> 'published' THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF s.registration_start_at IS NULL OR s.registration_start_at <= now() THEN
    RAISE EXCEPTION 'already_open';
  END IF;

  INSERT INTO public.session_open_watchers (session_id, user_id, email)
  VALUES (_session_id, v_uid, v_email)
  ON CONFLICT (session_id, user_id)
    DO UPDATE SET email = EXCLUDED.email, notified_at = NULL, last_error = NULL
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'email', v_email, 'opens_at', s.registration_start_at);
END; $$;

REVOKE EXECUTE ON FUNCTION public.watch_session_open(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.watch_session_open(UUID, TEXT) TO authenticated;
