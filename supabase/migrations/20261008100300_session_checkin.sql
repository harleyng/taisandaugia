-- Điểm danh (check-in), số báo danh ngẫu nhiên, chốt danh sách — W0/M4
-- (docs/bidder-ekyc-checkin-plan.md §2.4, E1–E5 + F1–F3).
--
-- ĐỦ ĐIỀU KIỆN điểm danh = hồ sơ paid + approved + tiền đặt trước received + phiên
-- published, trong cửa sổ [starts_at − checkin_lead_minutes, starts_at + checkin_grace_minutes].
-- Kênh suy từ hình thức phiên: truc_tiep ⇒ nhân viên điểm danh tại chỗ (onsite);
-- truc_tuyen ⇒ người mua tự điểm danh + OTP (online); ca_hai ⇒ format_unsupported
-- (tạm bỏ hình thức này — dữ liệu cũ vẫn giữ, KHÔNG bị chốt danh sách tự động).
--
-- SỐ BÁO DANH cấp NGẪU NHIÊN lúc điểm danh (không còn cấp tay sau khi nhận đặt
-- trước). Điểm danh lại không đổi số.
--
-- CHỐT DANH SÁCH: cron mỗi phút đóng mọi phiên đã quá starts_at + grace; ai đủ điều
-- kiện mà chưa điểm danh ⇒ VẮNG ⇒ tiền đặt trước 'forfeited' (sổ tiền đặt trước
-- ghi qua trigger — KHÔNG INSERT tay). Đấu giá viên miễn trừ được (giả định F1-b,
-- chưa chốt với người dùng) ⇒ 'pending_refund'.
--
-- Các RPC điểm danh trả { ok:false, reason } cho thất bại DỰ KIẾN (như engine đấu
-- giá) — bắt buộc với OTP: RAISE sẽ rollback luôn lần đếm sai mã.
--
-- ⚠️ OTP là MÔ PHỎNG: request_checkin_otp trả demo_code cho client. Seam thật =
-- Edge Function gửi SMS rồi bỏ trường đó.

-- ─── 1. Cột phiên ─────────────────────────────────────────────────────────
ALTER TABLE public.auction_sessions
  ADD COLUMN IF NOT EXISTS checkin_lead_minutes  INT NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS checkin_grace_minutes INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS roster_closed_at      TIMESTAMPTZ;

ALTER TABLE public.auction_sessions
  DROP CONSTRAINT IF EXISTS auction_sessions_checkin_lead_check,
  DROP CONSTRAINT IF EXISTS auction_sessions_checkin_grace_check,
  DROP CONSTRAINT IF EXISTS auction_sessions_roster_shape;

ALTER TABLE public.auction_sessions
  ADD CONSTRAINT auction_sessions_checkin_lead_check CHECK (checkin_lead_minutes BETWEEN 15 AND 1440),
  ADD CONSTRAINT auction_sessions_checkin_grace_check CHECK (checkin_grace_minutes BETWEEN 0 AND 60),
  -- Phiên nháp (kể cả lúc INSERT) không thể "đã chốt danh sách".
  ADD CONSTRAINT auction_sessions_roster_shape CHECK (roster_closed_at IS NULL OR status <> 'draft');

COMMENT ON COLUMN public.auction_sessions.checkin_lead_minutes IS 'Mở điểm danh trước giờ bắt đầu bao nhiêu phút.';
COMMENT ON COLUMN public.auction_sessions.checkin_grace_minutes IS 'Còn nhận điểm danh sau giờ bắt đầu bao nhiêu phút.';
COMMENT ON COLUMN public.auction_sessions.roster_closed_at IS 'Lúc chốt danh sách điểm danh (server ghi — client không sửa được).';

-- ─── 2. Cột hồ sơ ─────────────────────────────────────────────────────────
ALTER TABLE public.auction_bidding_contracts
  ADD COLUMN IF NOT EXISTS checkin_token      UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS checked_in_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_in_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checkin_channel    TEXT,
  ADD COLUMN IF NOT EXISTS checkin_attendee   TEXT,
  ADD COLUMN IF NOT EXISTS checkin_note       TEXT,
  ADD COLUMN IF NOT EXISTS absent_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS absence_excused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS absence_excused_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS absence_note       TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_abc_checkin_token ON public.auction_bidding_contracts (checkin_token);

COMMENT ON COLUMN public.auction_bidding_contracts.checkin_token IS
  'Nội dung mã QR trên phiếu dự phiên. Nhân viên quét ⇒ org_checkin_lookup.';
COMMENT ON COLUMN public.auction_bidding_contracts.checked_in_by IS 'NULL = người mua tự điểm danh (online).';

-- Backfill TRƯỚC ràng buộc: hồ sơ đã có số báo danh (cấp tay kiểu cũ) coi như đã
-- điểm danh — demo PDG000012/13/14 + 20260914000003 vẫn vào được phòng.
UPDATE public.auction_bidding_contracts c
   SET checked_in_at    = COALESCE(c.bidder_no_assigned_at, c.paid_at, c.created_at),
       checkin_channel  = CASE WHEN s.auction_format = 'truc_tiep' THEN 'onsite' ELSE 'online' END,
       checkin_attendee = 'principal'
  FROM public.auction_sessions s
 WHERE s.id = c.session_id AND c.bidder_no IS NOT NULL AND c.checked_in_at IS NULL;

ALTER TABLE public.auction_bidding_contracts
  DROP CONSTRAINT IF EXISTS abc_checkin_channel_check,
  DROP CONSTRAINT IF EXISTS abc_checkin_attendee_check,
  DROP CONSTRAINT IF EXISTS abc_checkin_shape,
  DROP CONSTRAINT IF EXISTS abc_absence_shape;

ALTER TABLE public.auction_bidding_contracts
  ADD CONSTRAINT abc_checkin_channel_check CHECK (checkin_channel IS NULL OR checkin_channel IN ('onsite', 'online')),
  ADD CONSTRAINT abc_checkin_attendee_check CHECK (checkin_attendee IS NULL OR checkin_attendee IN ('principal', 'proxy')),
  -- Một chiều có chủ ý: seed cũ chạy lại sinh hồ sơ có số mà chưa điểm danh ⇒
  -- không trả giá được (place_bid chặn), thay vì vỡ seed (sửa seed ở S7).
  ADD CONSTRAINT abc_checkin_shape CHECK (
    checked_in_at IS NULL
    OR (bidder_no IS NOT NULL AND checkin_channel IS NOT NULL AND checkin_attendee IS NOT NULL
        AND (checkin_attendee = 'principal' OR has_proxy))
  ),
  ADD CONSTRAINT abc_absence_shape CHECK (
    (absent_at IS NULL OR checked_in_at IS NULL)
    AND (absence_excused_at IS NULL OR absent_at IS NOT NULL)
  );

-- Phiên đã qua giờ trước khi có điểm danh: chốt danh sách NGAY, KHÔNG đánh vắng
-- ai (không phạt hồi tố). ca_hai cũng được đóng để không ai bị chốt sau này.
UPDATE public.auction_sessions s
   SET roster_closed_at = now()
 WHERE s.status = 'published' AND s.roster_closed_at IS NULL
   AND s.starts_at + make_interval(mins => s.checkin_grace_minutes) < now();

-- ─── 3. Bảng OTP (chỉ RPC chạm vào) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auction_checkin_otps (
  contract_id UUID PRIMARY KEY REFERENCES public.auction_bidding_contracts(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.auction_checkin_otps ENABLE ROW LEVEL SECURITY;
-- CỐ Ý không có policy nào.

-- ─── 4. Guard phiên: roster_closed_at do server quản lý ─────────────────────
-- Vá bản LIVE của auction_sessions_bidding_guard (20260913000001).
DO $$
DECLARE
  v_def TEXT := pg_get_functiondef('public.auction_sessions_bidding_guard()'::regprocedure);
  v_old TEXT := 'NEW.finalized_by := OLD.finalized_by;';
  v_new TEXT := 'NEW.finalized_by := OLD.finalized_by;
  -- Chốt danh sách điểm danh chỉ đi qua close_session_roster (20261008100300).
  NEW.roster_closed_at := OLD.roster_closed_at;
  IF (NEW.checkin_lead_minutes, NEW.checkin_grace_minutes)
       IS DISTINCT FROM (OLD.checkin_lead_minutes, OLD.checkin_grace_minutes)
     AND OLD.roster_closed_at IS NOT NULL THEN
    RAISE EXCEPTION ''Phiên đã chốt danh sách điểm danh — không đổi được thời gian điểm danh.''
      USING ERRCODE = ''check_violation'';
  END IF;';
BEGIN
  IF position('NEW.roster_closed_at := OLD.roster_closed_at' IN v_def) > 0 THEN
    RAISE NOTICE 'auction_sessions_bidding_guard đã có roster_closed_at';
    RETURN;
  END IF;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'Không tìm thấy mốc vá trong auction_sessions_bidding_guard LIVE — vá tay.';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $$;

-- ─── 5. Khoá duyệt sau khi điểm danh / chốt danh sách ─────────────────────
CREATE OR REPLACE FUNCTION public.auction_bidding_contracts_review_lock()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.review_status IS NOT DISTINCT FROM OLD.review_status THEN
    RETURN NEW;
  END IF;
  IF OLD.checked_in_at IS NOT NULL THEN
    RAISE EXCEPTION 'Người tham gia đã điểm danh — không đổi kết quả duyệt hồ sơ được nữa.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.auction_sessions s
              WHERE s.id = OLD.session_id AND s.roster_closed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Phiên đã chốt danh sách điểm danh — không đổi kết quả duyệt hồ sơ được nữa.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS auction_bidding_contracts_review_lock ON public.auction_bidding_contracts;
CREATE TRIGGER auction_bidding_contracts_review_lock
  BEFORE UPDATE OF review_status ON public.auction_bidding_contracts
  FOR EACH ROW EXECUTE FUNCTION public.auction_bidding_contracts_review_lock();

-- ─── 6. Lõi: vì sao chưa điểm danh được ───────────────────────────────────
-- _channel NULL = không xét kênh (tra cứu / hiển thị). 'already_checked_in' và
-- 'absent' là trạng thái, không phải lỗi — nơi gọi tự quyết.
CREATE OR REPLACE FUNCTION public._checkin_block_reason(_contract_id UUID, _channel TEXT, _at TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c RECORD;
  s RECORD;
BEGIN
  SELECT * INTO c FROM public.auction_bidding_contracts WHERE id = _contract_id;
  IF c.id IS NULL THEN RETURN 'not_found'; END IF;
  SELECT * INTO s FROM public.auction_sessions WHERE id = c.session_id;

  IF c.status = 'refunded' THEN RETURN 'review_rejected'; END IF;
  IF c.status <> 'paid' THEN RETURN 'not_paid'; END IF;
  IF s.status <> 'published' THEN RETURN 'session_not_published'; END IF;
  IF s.auction_format NOT IN ('truc_tiep', 'truc_tuyen') THEN RETURN 'format_unsupported'; END IF;
  IF (_channel = 'onsite' AND s.auction_format <> 'truc_tiep')
     OR (_channel = 'online' AND s.auction_format <> 'truc_tuyen') THEN
    RETURN 'wrong_channel';
  END IF;
  IF c.checked_in_at IS NOT NULL THEN RETURN 'already_checked_in'; END IF;
  IF c.absent_at IS NOT NULL THEN RETURN 'absent'; END IF;
  IF s.roster_closed_at IS NOT NULL THEN RETURN 'roster_closed'; END IF;
  IF c.review_status = 'pending' THEN RETURN 'review_pending'; END IF;
  IF c.review_status = 'needs_info' THEN RETURN 'review_needs_info'; END IF;
  IF c.review_status <> 'approved' THEN RETURN 'review_rejected'; END IF;
  IF c.deposit_status <> 'received' THEN RETURN 'deposit_not_received'; END IF;
  IF _at < s.starts_at - make_interval(mins => s.checkin_lead_minutes) THEN RETURN 'window_not_open'; END IF;
  IF _at > s.starts_at + make_interval(mins => s.checkin_grace_minutes) THEN RETURN 'window_closed'; END IF;
  RETURN NULL;
END; $$;

REVOKE ALL ON FUNCTION public._checkin_block_reason(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._checkin_window_json(_session_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'opens_at',  s.starts_at - make_interval(mins => s.checkin_lead_minutes),
    'closes_at', s.starts_at + make_interval(mins => s.checkin_grace_minutes))
    FROM public.auction_sessions s WHERE s.id = _session_id
$$;

REVOKE ALL ON FUNCTION public._checkin_window_json(UUID) FROM PUBLIC, anon, authenticated;

-- Số ngẫu nhiên chưa dùng trong 1..greatest(99, 3 × số hồ sơ có thể có số).
-- Nơi gọi PHẢI giữ khoá tư vấn 'bidding:'||session_id. Đã có số ⇒ giữ nguyên.
CREATE OR REPLACE FUNCTION public._assign_random_bidder_no(_contract_id UUID)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c     RECORD;
  v_max INT;
  v_no  INT;
BEGIN
  SELECT id, session_id, bidder_no INTO c FROM public.auction_bidding_contracts WHERE id = _contract_id;
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ.' USING ERRCODE = 'no_data_found';
  END IF;
  IF c.bidder_no IS NOT NULL THEN
    RETURN c.bidder_no;
  END IF;

  SELECT greatest(99, 3 * count(*)::int) INTO v_max
    FROM public.auction_bidding_contracts
   WHERE session_id = c.session_id AND status = 'paid' AND review_status = 'approved';

  SELECT n INTO v_no
    FROM generate_series(1, v_max) AS n
   WHERE NOT EXISTS (SELECT 1 FROM public.auction_bidding_contracts x
                      WHERE x.session_id = c.session_id AND x.bidder_no = n)
   ORDER BY random()
   LIMIT 1;
  IF v_no IS NULL THEN
    SELECT COALESCE(max(bidder_no), 0) + 1 INTO v_no
      FROM public.auction_bidding_contracts WHERE session_id = c.session_id;
  END IF;

  UPDATE public.auction_bidding_contracts
     SET bidder_no = v_no, bidder_no_assigned_at = now()
   WHERE id = c.id;
  RETURN v_no;
END; $$;

REVOKE ALL ON FUNCTION public._assign_random_bidder_no(UUID) FROM PUBLIC, anon, authenticated;

-- ─── 7. Tổ chức: tra cứu + điểm danh tại chỗ ──────────────────────────────
CREATE OR REPLACE FUNCTION public._checkin_contract_json(_c public.auction_bidding_contracts)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', _c.id, 'code', _c.code, 'session_id', _c.session_id,
    'buyer_kind', _c.buyer_kind, 'org_name', _c.org_name, 'org_tax_code', _c.org_tax_code,
    'full_name', _c.full_name, 'id_type', _c.id_type, 'id_number', _c.id_number,
    'date_of_birth', _c.date_of_birth, 'phone', _c.phone,
    'id_front_path', _c.id_front_path, 'id_back_path', _c.id_back_path,
    'id_edited_fields', to_jsonb(_c.id_edited_fields),
    'has_proxy', _c.has_proxy, 'proxy_full_name', _c.proxy_full_name,
    'proxy_id_type', _c.proxy_id_type, 'proxy_id_number', _c.proxy_id_number,
    'proxy_date_of_birth', _c.proxy_date_of_birth,
    'proxy_id_front_path', _c.proxy_id_front_path, 'proxy_id_back_path', _c.proxy_id_back_path,
    'proxy_id_edited_fields', to_jsonb(_c.proxy_id_edited_fields), 'poa_doc_path', _c.poa_doc_path,
    'review_status', _c.review_status, 'deposit_status', _c.deposit_status,
    'bidder_no', _c.bidder_no, 'checked_in_at', _c.checked_in_at,
    'checkin_channel', _c.checkin_channel, 'checkin_attendee', _c.checkin_attendee,
    'absent_at', _c.absent_at, 'absence_excused_at', _c.absence_excused_at,
    'block_reason', public._checkin_block_reason(_c.id, NULL, now())
  )
$$;

REVOKE ALL ON FUNCTION public._checkin_contract_json(public.auction_bidding_contracts) FROM PUBLIC, anon, authenticated;

-- _query: token QR (uuid) HOẶC mã hồ sơ / số giấy tờ / họ tên / tên tổ chức.
CREATE OR REPLACE FUNCTION public.org_checkin_lookup(_session_id UUID, _query TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s       RECORD;
  v_q     TEXT := btrim(COALESCE(_query, ''));
  v_up    TEXT;
  v_like  TEXT;
  c       public.auction_bidding_contracts;
  v_rows  JSONB;
BEGIN
  SELECT id, organization_id INTO s FROM public.auction_sessions WHERE id = _session_id;
  IF s.id IS NULL OR NOT public.can_manage_bidding_contracts(s.organization_id, 'checkin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  IF v_q ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO c FROM public.auction_bidding_contracts
     WHERE checkin_token = v_q::uuid AND status IN ('paid', 'refunded');
    IF c.id IS NULL THEN
      RETURN jsonb_build_object('ok', true, 'by_token', true, 'matches', '[]'::jsonb);
    END IF;
    IF c.session_id <> _session_id THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'wrong_session');
    END IF;
    RETURN jsonb_build_object('ok', true, 'by_token', true,
                              'matches', jsonb_build_array(public._checkin_contract_json(c)));
  END IF;

  IF length(v_q) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'query_too_short');
  END IF;

  v_up   := upper(regexp_replace(v_q, '\s', '', 'g'));
  v_like := '%' || lower(extensions.unaccent(v_q)) || '%';

  -- Chọn cả dòng (x AS rec) để giữ đúng kiểu auction_bidding_contracts cho hàm JSON.
  SELECT COALESCE(jsonb_agg(public._checkin_contract_json(t.rec) ORDER BY (t.rec).full_name), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT x AS rec FROM public.auction_bidding_contracts x
       WHERE x.session_id = _session_id
         AND x.status IN ('paid', 'refunded')
         AND (upper(x.code) LIKE v_up || '%'
              OR x.id_number = v_up
              OR x.proxy_id_number = v_up
              OR lower(extensions.unaccent(x.full_name)) LIKE v_like
              OR lower(extensions.unaccent(COALESCE(x.proxy_full_name, ''))) LIKE v_like
              OR lower(extensions.unaccent(COALESCE(x.org_name, ''))) LIKE v_like)
       ORDER BY x.full_name
       LIMIT 20
    ) t;

  RETURN jsonb_build_object('ok', true, 'by_token', false, 'matches', v_rows);
END; $$;

REVOKE ALL ON FUNCTION public.org_checkin_lookup(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_checkin_lookup(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.org_check_in(
  _contract_id UUID,
  _attendee    TEXT DEFAULT 'principal',
  _note        TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sid    UUID;
  v_org    UUID;
  c        RECORD;
  v_reason TEXT;
  v_att    TEXT := COALESCE(NULLIF(_attendee, ''), 'principal');
  v_no     INT;
BEGIN
  SELECT session_id, organization_id INTO v_sid, v_org
    FROM public.auction_bidding_contracts WHERE id = _contract_id;
  IF v_sid IS NULL OR NOT public.can_manage_bidding_contracts(v_org, 'checkin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('bidding:' || v_sid::text, 0));
  SELECT * INTO c FROM public.auction_bidding_contracts WHERE id = _contract_id FOR UPDATE;

  v_reason := public._checkin_block_reason(_contract_id, 'onsite', now());
  IF v_reason = 'already_checked_in' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'bidder_no', c.bidder_no,
                              'attendee', c.checkin_attendee, 'checked_in_at', c.checked_in_at);
  END IF;
  IF v_reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_reason) || public._checkin_window_json(v_sid);
  END IF;
  IF v_att NOT IN ('principal', 'proxy') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_attendee');
  END IF;
  IF v_att = 'proxy' AND NOT c.has_proxy THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_proxy');
  END IF;

  PERFORM public._bidding_ctx(NULL, NULL);
  v_no := public._assign_random_bidder_no(c.id);
  UPDATE public.auction_bidding_contracts
     SET checked_in_at    = now(),
         checked_in_by    = auth.uid(),
         checkin_channel  = 'onsite',
         checkin_attendee = v_att,
         checkin_note     = NULLIF(btrim(COALESCE(_note, '')), '')
   WHERE id = c.id;
  PERFORM public._bidding_ctx_clear();

  RETURN jsonb_build_object('ok', true, 'already', false, 'bidder_no', v_no,
                            'attendee', v_att, 'checked_in_at', now());
END; $$;

REVOKE ALL ON FUNCTION public.org_check_in(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_check_in(UUID, TEXT, TEXT) TO authenticated;

-- ─── 8. Người mua: tự điểm danh + OTP (phiên trực tuyến) ──────────────────
CREATE OR REPLACE FUNCTION public.request_checkin_otp(_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  c        RECORD;
  v_reason TEXT;
  v_prev   RECORD;
  v_bytes  BYTEA;
  v_code   TEXT;
  v_exp    TIMESTAMPTZ := now() + interval '5 minutes';
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT id, session_id, phone INTO c
    FROM public.auction_bidding_contracts WHERE id = _contract_id AND user_id = v_uid;
  IF c.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  v_reason := public._checkin_block_reason(_contract_id, 'online', now());
  IF v_reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_reason) || public._checkin_window_json(c.session_id);
  END IF;

  SELECT * INTO v_prev FROM public.auction_checkin_otps WHERE contract_id = _contract_id;
  IF v_prev.contract_id IS NOT NULL AND v_prev.created_at > now() - interval '30 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'otp_too_soon',
                              'retry_at', v_prev.created_at + interval '30 seconds');
  END IF;

  v_bytes := extensions.gen_random_bytes(3);
  v_code  := lpad(((get_byte(v_bytes, 0) * 65536 + get_byte(v_bytes, 1) * 256 + get_byte(v_bytes, 2)) % 1000000)::text, 6, '0');

  INSERT INTO public.auction_checkin_otps (contract_id, code_hash, expires_at, attempts, created_at)
  VALUES (_contract_id, extensions.crypt(v_code, extensions.gen_salt('bf', 6)), v_exp, 0, now())
  ON CONFLICT (contract_id) DO UPDATE
    SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at,
        attempts = 0, created_at = EXCLUDED.created_at;

  RETURN jsonb_build_object(
    'ok', true,
    'expires_at', v_exp,
    'sent_to', regexp_replace(c.phone, '^(\d{3})\d{4}(\d{3})$', '\1****\2'),
    -- ⚠️ MÔ PHỎNG — bỏ khi gửi SMS thật.
    'demo_code', v_code
  );
END; $$;

REVOKE ALL ON FUNCTION public.request_checkin_otp(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_checkin_otp(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.self_check_in(_contract_id UUID, _code TEXT, _attendee TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_sid    UUID;
  c        RECORD;
  o        RECORD;
  v_reason TEXT;
  v_att    TEXT;
  v_no     INT;
  v_max    CONSTANT INT := 5;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT session_id INTO v_sid
    FROM public.auction_bidding_contracts WHERE id = _contract_id AND user_id = v_uid;
  IF v_sid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('bidding:' || v_sid::text, 0));
  SELECT * INTO c FROM public.auction_bidding_contracts WHERE id = _contract_id FOR UPDATE;

  v_reason := public._checkin_block_reason(_contract_id, 'online', now());
  IF v_reason = 'already_checked_in' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'bidder_no', c.bidder_no,
                              'attendee', c.checkin_attendee, 'checked_in_at', c.checked_in_at);
  END IF;
  IF v_reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_reason) || public._checkin_window_json(v_sid);
  END IF;

  SELECT * INTO o FROM public.auction_checkin_otps WHERE contract_id = _contract_id FOR UPDATE;
  IF o.contract_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'otp_missing');
  END IF;
  IF o.attempts >= v_max THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'otp_locked');
  END IF;
  IF o.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'otp_expired');
  END IF;
  IF extensions.crypt(btrim(COALESCE(_code, '')), o.code_hash) <> o.code_hash THEN
    UPDATE public.auction_checkin_otps SET attempts = attempts + 1 WHERE contract_id = _contract_id;
    RETURN jsonb_build_object('ok', false,
                              'reason', CASE WHEN o.attempts + 1 >= v_max THEN 'otp_locked' ELSE 'otp_invalid' END,
                              'attempts_left', greatest(v_max - o.attempts - 1, 0));
  END IF;

  v_att := COALESCE(NULLIF(_attendee, ''), CASE WHEN c.has_proxy THEN 'proxy' ELSE 'principal' END);
  IF v_att NOT IN ('principal', 'proxy') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_attendee');
  END IF;
  IF v_att = 'proxy' AND NOT c.has_proxy THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_proxy');
  END IF;

  DELETE FROM public.auction_checkin_otps WHERE contract_id = _contract_id;

  PERFORM public._bidding_ctx(NULL, NULL);
  v_no := public._assign_random_bidder_no(c.id);
  UPDATE public.auction_bidding_contracts
     SET checked_in_at    = now(),
         checked_in_by    = NULL,
         checkin_channel  = 'online',
         checkin_attendee = v_att
   WHERE id = c.id;
  PERFORM public._bidding_ctx_clear();

  RETURN jsonb_build_object('ok', true, 'already', false, 'bidder_no', v_no,
                            'attendee', v_att, 'checked_in_at', now());
END; $$;

REVOKE ALL ON FUNCTION public.self_check_in(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.self_check_in(UUID, TEXT, TEXT) TO authenticated;

-- ─── 9. Chốt danh sách + vắng mặt ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.close_session_roster(_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s        RECORD;
  v_absent INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('bidding:' || _session_id::text, 0));
  SELECT id, status, roster_closed_at INTO s FROM public.auction_sessions WHERE id = _session_id FOR UPDATE;
  IF s.id IS NULL OR s.status <> 'published' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_published');
  END IF;
  IF s.roster_closed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'roster_closed');
  END IF;

  PERFORM public._bidding_ctx('Vắng mặt — không điểm danh', NULL);

  UPDATE public.auction_sessions SET roster_closed_at = now() WHERE id = _session_id;

  UPDATE public.auction_bidding_contracts
     SET absent_at                 = now(),
         deposit_status            = 'forfeited',
         deposit_status_changed_at = now(),
         deposit_note              = 'Vắng mặt — không điểm danh',
         deposit_updated_by        = auth.uid()
   WHERE session_id = _session_id
     AND status = 'paid' AND review_status = 'approved' AND deposit_status = 'received'
     AND checked_in_at IS NULL AND absent_at IS NULL;
  GET DIAGNOSTICS v_absent = ROW_COUNT;

  PERFORM public._bidding_ctx_clear();

  RETURN jsonb_build_object('ok', true, 'absent', v_absent);
END; $$;

REVOKE ALL ON FUNCTION public.close_session_roster(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.close_due_rosters()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r       RECORD;
  v_count INT := 0;
BEGIN
  FOR r IN
    SELECT s.id
      FROM public.auction_sessions s
     WHERE s.status = 'published'
       AND s.roster_closed_at IS NULL
       AND s.auction_format IN ('truc_tiep', 'truc_tuyen')
       AND now() > s.starts_at + make_interval(mins => s.checkin_grace_minutes)
     ORDER BY s.starts_at
  LOOP
    BEGIN
      PERFORM public.close_session_roster(r.id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'close_due_rosters: phiên % lỗi: %', r.id, SQLERRM;
    END;
  END LOOP;
  RETURN v_count;
END; $$;

REVOKE ALL ON FUNCTION public.close_due_rosters() FROM PUBLIC, anon, authenticated;

-- Job có tên ⇒ schedule lại là cập nhật, không nhân đôi.
SELECT cron.schedule('close_due_rosters', '* * * * *', $cron$SELECT public.close_due_rosters()$cron$);

-- Đấu giá viên chốt sớm (cắt bớt thời gian ân hạn) — chỉ khi phiên đã bắt đầu.
CREATE OR REPLACE FUNCTION public.org_close_roster_now(_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE s RECORD;
BEGIN
  SELECT id, status, auction_format, starts_at, roster_closed_at INTO s
    FROM public.auction_sessions WHERE id = _session_id;
  IF s.id IS NULL OR NOT public.can_run_auction_session(_session_id, 'operate') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  IF s.status <> 'published' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_published');
  END IF;
  IF s.auction_format NOT IN ('truc_tiep', 'truc_tuyen') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'format_unsupported');
  END IF;
  IF s.roster_closed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'roster_closed');
  END IF;
  IF now() < s.starts_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_early', 'starts_at', s.starts_at);
  END IF;
  RETURN public.close_session_roster(_session_id);
END; $$;

REVOKE ALL ON FUNCTION public.org_close_roster_now(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_close_roster_now(UUID) TO authenticated;

-- (F1-b — GIẢ ĐỊNH chưa chốt) miễn trừ vắng mặt ⇒ tiền đặt trước chờ hoàn trả.
CREATE OR REPLACE FUNCTION public.org_excuse_absence(_contract_id UUID, _note TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c      RECORD;
  v_note TEXT := NULLIF(btrim(COALESCE(_note, '')), '');
BEGIN
  SELECT id, organization_id, absent_at, absence_excused_at, deposit_status INTO c
    FROM public.auction_bidding_contracts WHERE id = _contract_id FOR UPDATE;
  IF c.id IS NULL OR NOT public.can_manage_bidding_contracts(c.organization_id, 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  IF length(COALESCE(v_note, '')) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;
  IF c.absent_at IS NULL OR c.absence_excused_at IS NOT NULL OR c.deposit_status <> 'forfeited' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;

  PERFORM public._bidding_ctx('Miễn trừ vắng mặt: ' || v_note, NULL);
  UPDATE public.auction_bidding_contracts
     SET absence_excused_at        = now(),
         absence_excused_by        = auth.uid(),
         absence_note              = v_note,
         deposit_status            = 'pending_refund',
         deposit_status_changed_at = now(),
         deposit_updated_by        = auth.uid(),
         deposit_note              = 'Miễn trừ vắng mặt: ' || v_note
   WHERE id = _contract_id;
  PERFORM public._bidding_ctx_clear();

  RETURN jsonb_build_object('ok', true);
END; $$;

REVOKE ALL ON FUNCTION public.org_excuse_absence(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_excuse_absence(UUID, TEXT) TO authenticated;

-- Công khai: chỉ số đếm (cảnh báo < 2 người có mặt) + cửa sổ điểm danh.
CREATE OR REPLACE FUNCTION public.auction_session_checkin_summary(_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s RECORD;
  r RECORD;
BEGIN
  SELECT id, auction_format, roster_closed_at INTO s
    FROM public.auction_sessions
   WHERE id = _session_id AND status IN ('published', 'cancelled');
  IF s.id IS NULL THEN RETURN NULL; END IF;

  SELECT count(*) FILTER (WHERE c.checked_in_at IS NOT NULL)                            AS checked_in,
         count(*) FILTER (WHERE c.checked_in_at IS NULL AND c.absent_at IS NULL
                            AND c.review_status = 'approved' AND c.deposit_status = 'received') AS awaiting,
         count(*) FILTER (WHERE c.absent_at IS NOT NULL)                                AS absent,
         count(*) FILTER (WHERE c.absence_excused_at IS NOT NULL)                       AS excused
    INTO r
    FROM public.auction_bidding_contracts c
   WHERE c.session_id = _session_id AND c.status = 'paid';

  RETURN jsonb_build_object(
    'eligible',        r.checked_in + r.awaiting,
    'checked_in',      r.checked_in,
    'awaiting',        r.awaiting,
    'absent',          r.absent,
    'excused',         r.excused,
    'roster_closed_at', s.roster_closed_at,
    'channel',         CASE s.auction_format WHEN 'truc_tiep' THEN 'onsite'
                                             WHEN 'truc_tuyen' THEN 'online' END
  ) || public._checkin_window_json(_session_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.auction_session_checkin_summary(UUID) TO anon, authenticated;

-- ─── 10. Số báo danh tay: chỉ còn để ĐỔI số của người đã điểm danh ─────────
CREATE OR REPLACE FUNCTION public.org_assign_bidder_no(_contract_id UUID, _bidder_no INT DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sid UUID;
  v_org UUID;
  c     RECORD;
  v_no  INT;
BEGIN
  SELECT session_id, organization_id INTO v_sid, v_org
    FROM public.auction_bidding_contracts WHERE id = _contract_id;
  IF v_sid IS NULL OR NOT public.can_manage_bidding_contracts(v_org, 'update') THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ, hoặc bạn không có quyền cập nhật.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('bidding:' || v_sid::text, 0));

  SELECT x.*, s.status AS session_status INTO c
    FROM public.auction_bidding_contracts x
    JOIN public.auction_sessions s ON s.id = x.session_id
   WHERE x.id = _contract_id
   FOR UPDATE OF x;

  IF c.status <> 'paid' THEN
    RAISE EXCEPTION 'Chỉ cấp số báo danh cho hồ sơ đã thanh toán.' USING ERRCODE = 'check_violation';
  END IF;
  IF c.session_status = 'cancelled' THEN
    RAISE EXCEPTION 'Phiên đã huỷ — không cấp số báo danh.' USING ERRCODE = 'check_violation';
  END IF;
  IF c.checked_in_at IS NULL THEN
    RAISE EXCEPTION 'Số báo danh được cấp tự động khi người tham gia điểm danh.' USING ERRCODE = 'check_violation';
  END IF;
  IF c.deposit_status <> 'received' THEN
    RAISE EXCEPTION 'Chỉ đổi số báo danh khi tiền đặt trước đang ở trạng thái đã nhận.' USING ERRCODE = 'check_violation';
  END IF;

  IF _bidder_no IS NULL THEN
    RETURN c.bidder_no;
  END IF;
  IF _bidder_no <= 0 THEN
    RAISE EXCEPTION 'Số báo danh phải là số nguyên dương.' USING ERRCODE = 'check_violation';
  END IF;
  v_no := _bidder_no;

  IF EXISTS (SELECT 1 FROM public.auction_bidding_contracts
              WHERE session_id = c.session_id AND bidder_no = v_no AND id <> c.id) THEN
    RAISE EXCEPTION 'Số báo danh % đã cấp cho hồ sơ khác trong phiên.', v_no USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.auction_bidding_contracts
     SET bidder_no = v_no, bidder_no_assigned_at = now()
   WHERE id = c.id;
  RETURN v_no;
END; $$;

REVOKE ALL ON FUNCTION public.org_assign_bidder_no(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_assign_bidder_no(UUID, INT) TO authenticated;

-- ─── 11. Tiền đặt trước: thêm chốt cho từ chối / điểm danh / vắng mặt ──────
-- Chép bản LIVE (20260911000005, chưa đổi từ đó), thêm 3 chốt.
CREATE OR REPLACE FUNCTION public.org_set_contract_deposit(
  _contract_id UUID,
  _status      TEXT,
  _amount      NUMERIC DEFAULT NULL,
  _note        TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c        RECORD;
  v_ok     BOOLEAN;
  v_amount NUMERIC;
BEGIN
  SELECT x.*, s.status AS session_status INTO c
    FROM public.auction_bidding_contracts x
    JOIN public.auction_sessions s ON s.id = x.session_id
   WHERE x.id = _contract_id
   FOR UPDATE OF x;
  IF c.id IS NULL OR NOT public.can_manage_bidding_contracts(c.organization_id, 'update') THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ, hoặc bạn không có quyền cập nhật.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.status = 'refunded' OR c.review_status = 'rejected' THEN
    RAISE EXCEPTION 'Hồ sơ đã bị từ chối — không ghi nhận tiền đặt trước.' USING ERRCODE = 'check_violation';
  END IF;
  IF c.status <> 'paid' THEN
    RAISE EXCEPTION 'Chỉ cập nhật tiền đặt trước cho hồ sơ đã thanh toán.' USING ERRCODE = 'check_violation';
  END IF;
  IF c.absent_at IS NOT NULL THEN
    RAISE EXCEPTION 'Người tham gia vắng mặt — dùng "Miễn trừ vắng mặt" nếu có lý do chính đáng.' USING ERRCODE = 'check_violation';
  END IF;
  IF _status NOT IN ('pending', 'received', 'refunded', 'forfeited') THEN
    RAISE EXCEPTION 'Trạng thái tiền đặt trước không hợp lệ.' USING ERRCODE = 'check_violation';
  END IF;
  IF _status = 'pending' AND c.checked_in_at IS NOT NULL THEN
    RAISE EXCEPTION 'Người tham gia đã điểm danh — không lùi tiền đặt trước về "chưa nhận" được.' USING ERRCODE = 'check_violation';
  END IF;

  v_ok := (_status = c.deposit_status AND _status = 'received')
       OR (c.deposit_status = 'pending'  AND _status = 'received')
       OR (c.deposit_status = 'received' AND _status IN ('pending', 'refunded', 'forfeited'))
       OR (c.deposit_status IN ('refunded', 'forfeited') AND _status = 'received');
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Không thể chuyển tiền đặt trước từ "%" sang "%".', c.deposit_status, _status
      USING ERRCODE = 'check_violation';
  END IF;

  IF c.session_status = 'cancelled' AND NOT (c.deposit_status = 'received' AND _status = 'refunded') THEN
    RAISE EXCEPTION 'Phiên đã huỷ — chỉ ghi nhận hoàn trả tiền đặt trước.' USING ERRCODE = 'check_violation';
  END IF;

  v_amount := CASE WHEN _status = 'pending' THEN NULL ELSE COALESCE(_amount, c.deposit_amount_received) END;
  IF _status <> 'pending' AND COALESCE(v_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Nhập số tiền đặt trước đã nhận.' USING ERRCODE = 'check_violation';
  END IF;
  IF _status = 'forfeited' AND btrim(COALESCE(_note, '')) = '' THEN
    RAISE EXCEPTION 'Nhập lý do không hoàn trả tiền đặt trước.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.auction_bidding_contracts
     SET deposit_status            = _status,
         deposit_amount_received   = v_amount,
         deposit_received_at       = CASE
                                       WHEN _status = 'pending' THEN NULL
                                       WHEN c.deposit_status = 'pending' THEN now()
                                       ELSE deposit_received_at
                                     END,
         deposit_status_changed_at = now(),
         deposit_note              = CASE WHEN _note IS NULL THEN deposit_note ELSE NULLIF(btrim(_note), '') END,
         deposit_updated_by        = auth.uid(),
         bidder_no                 = CASE WHEN _status = 'pending' THEN NULL ELSE bidder_no END,
         bidder_no_assigned_at     = CASE WHEN _status = 'pending' THEN NULL ELSE bidder_no_assigned_at END
   WHERE id = c.id;
END; $$;

REVOKE ALL ON FUNCTION public.org_set_contract_deposit(UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_set_contract_deposit(UUID, TEXT, NUMERIC, TEXT) TO authenticated;

-- ─── 12. Engine: chỉ người ĐÃ điểm danh mới trả giá được ───────────────────
-- Vá bản LIVE của place_bid (cùng chữ ký ⇒ CREATE OR REPLACE an toàn).
DO $$
DECLARE
  v_def TEXT := pg_get_functiondef('public.place_bid(uuid, numeric, text)'::regprocedure);
  v_old TEXT := $s$IF c.id IS NULL OR c.bidder_no IS NULL OR c.deposit_status <> 'received' THEN$s$;
  v_new TEXT := $s$IF c.id IS NULL OR c.bidder_no IS NULL OR c.deposit_status <> 'received'
     OR c.checked_in_at IS NULL THEN$s$;
BEGIN
  IF position('c.checked_in_at IS NULL' IN v_def) > 0 THEN
    RAISE NOTICE 'place_bid đã chặn người chưa điểm danh';
    RETURN;
  END IF;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'Không tìm thấy chốt not_eligible trong place_bid LIVE — vá tay.';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $$;

-- ─── 13. Kiểm chứng ────────────────────────────────────────────────────────
DO $$
DECLARE v_bad TEXT; v_n INT;
BEGIN
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_bad
    FROM pg_proc p
   CROSS JOIN unnest(ARRAY['anon', 'authenticated']) AS r
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('_checkin_block_reason', '_checkin_window_json', '_assign_random_bidder_no',
                       '_checkin_contract_json', 'close_session_roster', 'close_due_rosters')
     AND has_function_privilege(r, p.oid, 'EXECUTE');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Hàm nội bộ vẫn gọi được bởi vai thường: %', v_bad;
  END IF;

  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_bad
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('org_checkin_lookup', 'org_check_in', 'request_checkin_otp', 'self_check_in',
                       'org_close_roster_now', 'org_excuse_absence')
     AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'RPC điểm danh vẫn gọi được bởi anon: %', v_bad;
  END IF;

  SELECT count(*) INTO v_n FROM public.auction_bidding_contracts
   WHERE bidder_no IS NOT NULL AND checked_in_at IS NULL;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'Còn % hồ sơ có số báo danh mà chưa backfill điểm danh', v_n;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'close_due_rosters') THEN
    RAISE EXCEPTION 'Chưa lên lịch cron close_due_rosters';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'auction_checkin_otps') THEN
    RAISE EXCEPTION 'auction_checkin_otps không được có policy';
  END IF;

  RAISE NOTICE 'OK: M4 điểm danh + số báo danh ngẫu nhiên + chốt danh sách';
END $$;
