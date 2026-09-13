-- Đấu giá trực tuyến — engine trả giá (Bước 1 của docs/online-auction-plan.md).
--
-- Biến phiên đã công bố (hình thức trực tuyến / cả hai) thành phiên trả giá trực
-- tuyến: trạng thái lô, sổ trả giá, nhật ký, sổ tiền đặt trước, biên bản.
--
-- NGUYÊN TẮC (Luật Đấu giá tài sản sửa đổi + NĐ 172/2024 đòi ghi nhận lượt trả
-- giá chống sửa đổi; v1 là thí điểm, CHƯA phải trang đấu giá được phê duyệt):
--   • Mọi mốc thời gian lấy ở SERVER (clock_timestamp() sau khi giữ khoá lô).
--   • Sổ trả giá, nhật ký lô, sổ tiền đặt trước, biên bản là CHỈ-GHI-THÊM: trigger
--     chặn UPDATE/DELETE (ngoại lệ duy nhất: đánh dấu withdrawn_at của lượt trả giá).
--     Gỡ dữ liệu demo phải DISABLE TRIGGER như các seed khác.
--   • KHÔNG có policy ghi nào: mọi thay đổi đi qua RPC SECURITY DEFINER tự kiểm quyền.
--   • RPC trả `{ok:false, reason}` cho thất bại dự kiến (khuôn assertRpcOk ở
--     src/lib/consignment/errors.ts) — câu chữ tiếng Việt nằm ở UI.
--   • Quy tắc trả giá phía client (Bước 3) phải kiểm theo ĐÚNG thứ tự ở place_bid.
--
-- QUYẾT ĐỊNH 2026-09-12:
--   • Rút lại giá đã trả chỉ ảnh hưởng LÔ đó: giá lô quay về lượt hợp lệ trước;
--     tiền đặt trước (tính theo PHIÊN) bị tịch thu ngay ⇒ không trả giá thêm được ở
--     đâu nữa, nhưng vẫn giữ vị trí dẫn đầu đang có ở lô khác và vẫn có thể trúng.
--   • Biên bản công khai SAU KHI CHỐT phiên ⇒ bản PDF KHÔNG được chứa CCCD / địa chỉ.
--
-- Khoá lách guard: RPC bật `app.bidding_rpc` cục bộ theo transaction. Client
-- PostgREST không đặt được GUC tuỳ ý.

-- ─── 1. Cấu hình trả giá trên phiên ─────────────────────────────────────────
ALTER TABLE public.auction_sessions
  ADD COLUMN IF NOT EXISTS bidding_method    TEXT NOT NULL DEFAULT 'ascending',
  ADD COLUMN IF NOT EXISTS extension_seconds INT  NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS max_bid_steps     INT  NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS finalized_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finalized_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.auction_sessions DROP CONSTRAINT IF EXISTS auction_sessions_bidding_method_check;
ALTER TABLE public.auction_sessions
  ADD CONSTRAINT auction_sessions_bidding_method_check CHECK (bidding_method IN ('ascending'));
ALTER TABLE public.auction_sessions DROP CONSTRAINT IF EXISTS auction_sessions_extension_seconds_check;
ALTER TABLE public.auction_sessions
  ADD CONSTRAINT auction_sessions_extension_seconds_check CHECK (extension_seconds BETWEEN 0 AND 3600);
ALTER TABLE public.auction_sessions DROP CONSTRAINT IF EXISTS auction_sessions_max_bid_steps_check;
ALTER TABLE public.auction_sessions
  ADD CONSTRAINT auction_sessions_max_bid_steps_check CHECK (max_bid_steps BETWEEN 1 AND 100);

COMMENT ON COLUMN public.auction_sessions.bidding_method IS
  'Phương thức trả giá. v1 chỉ trả giá lên (ascending); đặt giá xuống / bỏ phiếu kín: sắp ra mắt.';
COMMENT ON COLUMN public.auction_sessions.extension_seconds IS
  'Lượt trả giá hợp lệ khi còn ít hơn chừng này giây ⇒ lô gia hạn tới now() + extension_seconds. 0 = không gia hạn.';
COMMENT ON COLUMN public.auction_sessions.max_bid_steps IS
  'Số bước giá tối đa được nhảy trong một lượt trả giá.';
COMMENT ON COLUMN public.auction_sessions.finalized_at IS
  'Thời điểm tổ chức chốt kết quả phiên (org_finalize_session). Chỉ RPC đặt được.';

-- Tiền đặt trước: thêm 2 trạng thái sau khi chốt phiên.
ALTER TABLE public.auction_bidding_contracts DROP CONSTRAINT IF EXISTS auction_bidding_contracts_deposit_status_check;
ALTER TABLE public.auction_bidding_contracts
  ADD CONSTRAINT auction_bidding_contracts_deposit_status_check
    CHECK (deposit_status IN ('pending', 'received', 'applied', 'pending_refund', 'refunded', 'forfeited'));

-- ─── 2. Bảng ────────────────────────────────────────────────────────────────
-- Trạng thái sống của lô (1:1 với auction_session_items). Dòng tạo lười ở
-- org_open_lot / org_withdraw_lot; client coi "không có dòng" = pending.
CREATE TABLE IF NOT EXISTS public.auction_lot_states (
  lot_id               UUID PRIMARY KEY REFERENCES public.auction_session_items(id) ON DELETE CASCADE,
  -- Phi chuẩn hoá cho RLS + bộ lọc realtime `session_id=eq.…`.
  session_id           UUID NOT NULL REFERENCES public.auction_sessions(id) ON DELETE CASCADE,
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'open', 'paused', 'closed', 'withdrawn')),
  opened_at            TIMESTAMPTZ,
  paused_at            TIMESTAMPTZ,
  closed_at            TIMESTAMPTZ,
  -- Mốc kết thúc thật của lô: dời khi gia hạn / tiếp tục sau tạm dừng.
  ends_at              TIMESTAMPTZ,
  pause_reason         TEXT,
  withdraw_reason      TEXT,
  current_price        NUMERIC(18,0),
  current_bid_id       UUID,
  leading_bidder_no    INT,
  bid_count            INT NOT NULL DEFAULT 0 CHECK (bid_count >= 0),
  extension_count      INT NOT NULL DEFAULT 0 CHECK (extension_count >= 0),
  result               TEXT CHECK (result IS NULL OR result IN ('sold', 'unsold')),
  winner_contract_id   UUID REFERENCES public.auction_bidding_contracts(id) ON DELETE RESTRICT,
  winning_amount       NUMERIC(18,0),
  payment_due_at       TIMESTAMPTZ,
  payment_status       TEXT CHECK (payment_status IS NULL OR payment_status IN ('pending', 'paid', 'defaulted')),
  payment_confirmed_at TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT als_live_shape CHECK (status NOT IN ('open', 'paused') OR (opened_at IS NOT NULL AND ends_at IS NOT NULL)),
  CONSTRAINT als_paused_shape CHECK (
    status <> 'paused' OR (paused_at IS NOT NULL AND length(btrim(COALESCE(pause_reason, ''))) > 0)
  ),
  CONSTRAINT als_result_shape CHECK ((status = 'closed') = (result IS NOT NULL)),
  CONSTRAINT als_sold_shape CHECK (
    result IS DISTINCT FROM 'sold'
    OR (winner_contract_id IS NOT NULL AND winning_amount IS NOT NULL
        AND payment_due_at IS NOT NULL AND payment_status IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_auction_lot_states_session ON public.auction_lot_states (session_id);
CREATE INDEX IF NOT EXISTS idx_auction_lot_states_due ON public.auction_lot_states (ends_at) WHERE status = 'open';

DROP TRIGGER IF EXISTS auction_lot_states_updated_at ON public.auction_lot_states;
CREATE TRIGGER auction_lot_states_updated_at
  BEFORE UPDATE ON public.auction_lot_states
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sổ trả giá — chỉ ghi thêm. FK đều RESTRICT: bằng chứng không được biến mất theo
-- dây chuyền xoá lô / phiên / hồ sơ.
CREATE TABLE IF NOT EXISTS public.auction_bids (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id       UUID NOT NULL REFERENCES public.auction_session_items(id) ON DELETE RESTRICT,
  session_id   UUID NOT NULL REFERENCES public.auction_sessions(id) ON DELETE RESTRICT,
  contract_id  UUID NOT NULL REFERENCES public.auction_bidding_contracts(id) ON DELETE RESTRICT,
  -- Phi chuẩn hoá: bảng tin công khai không bao giờ phải JOIN sang hồ sơ (chứa CCCD).
  bidder_no    INT NOT NULL CHECK (bidder_no > 0),
  seq          INT NOT NULL CHECK (seq > 0),
  amount       NUMERIC(18,0) NOT NULL CHECK (amount > 0),
  placed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Gửi lại cùng nonce (mất mạng, bấm lại) trả về đúng lượt đã ghi.
  client_nonce TEXT NOT NULL CHECK (length(client_nonce) BETWEEN 8 AND 100),
  -- Thay đổi DUY NHẤT được phép, qua withdraw_bid.
  withdrawn_at TIMESTAMPTZ,
  CONSTRAINT auction_bids_lot_seq_uq UNIQUE (lot_id, seq),
  CONSTRAINT auction_bids_nonce_uq UNIQUE (contract_id, client_nonce)
);

CREATE INDEX IF NOT EXISTS idx_auction_bids_session ON public.auction_bids (session_id, placed_at);
CREATE INDEX IF NOT EXISTS idx_auction_bids_contract ON public.auction_bids (contract_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auction_lot_states_current_bid_fkey') THEN
    ALTER TABLE public.auction_lot_states
      ADD CONSTRAINT auction_lot_states_current_bid_fkey
      FOREIGN KEY (current_bid_id) REFERENCES public.auction_bids(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- actor_id / issued_by KHÔNG có FK sang auth.users: ON DELETE SET NULL là một
-- UPDATE và sẽ bị guard chỉ-ghi-thêm chặn ⇒ không xoá được tài khoản.
CREATE TABLE IF NOT EXISTS public.auction_lot_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL cho sự kiện cấp phiên (finalize, minutes).
  lot_id     UUID REFERENCES public.auction_session_items(id) ON DELETE RESTRICT,
  session_id UUID NOT NULL REFERENCES public.auction_sessions(id) ON DELETE RESTRICT,
  kind       TEXT NOT NULL CHECK (kind IN (
               'open', 'pause', 'resume', 'bid', 'bid_rejected', 'extend', 'withdraw_bid',
               'close', 'withdraw_lot', 'finalize', 'minutes', 'payment')),
  actor_id   UUID,
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  at         TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_auction_lot_events_session ON public.auction_lot_events (session_id, at);
CREATE INDEX IF NOT EXISTS idx_auction_lot_events_lot ON public.auction_lot_events (lot_id, at) WHERE lot_id IS NOT NULL;

-- Sổ tiền đặt trước — cờ auction_bidding_contracts.deposit_status là trạng thái
-- hiện tại, sổ này là lịch sử. Ghi bằng TRIGGER trên cờ (mục 4) nên mọi đường ghi
-- (RPC cũ org_set_contract_deposit, RPC mới, seed) đều vào sổ.
CREATE TABLE IF NOT EXISTS public.auction_deposit_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.auction_bidding_contracts(id) ON DELETE RESTRICT,
  session_id  UUID NOT NULL REFERENCES public.auction_sessions(id) ON DELETE RESTRICT,
  -- 'reversed' = tổ chức lùi "đã nhận" về "chờ" để sửa nhầm.
  kind        TEXT NOT NULL CHECK (kind IN ('received', 'applied', 'pending_refund', 'refunded', 'forfeited', 'reversed')),
  amount      NUMERIC(18,0),
  reason      TEXT,
  lot_id      UUID REFERENCES public.auction_session_items(id) ON DELETE RESTRICT,
  actor_id    UUID,
  at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_auction_deposit_events_contract ON public.auction_deposit_events (contract_id, at);
CREATE INDEX IF NOT EXISTS idx_auction_deposit_events_session ON public.auction_deposit_events (session_id, at);

CREATE TABLE IF NOT EXISTS public.auction_session_minutes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES public.auction_sessions(id) ON DELETE RESTRICT,
  sequence_no  INT NOT NULL CHECK (sequence_no > 0),
  pdf_path     TEXT NOT NULL UNIQUE,
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  issued_by    UUID,
  issued_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT auction_session_minutes_seq_uq UNIQUE (session_id, sequence_no)
);

-- Phòng thủ nhiều lớp: không policy ghi đã chặn qua RLS, thu hồi luôn quyền bảng.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.auction_lot_states, public.auction_bids, public.auction_lot_events,
  public.auction_deposit_events, public.auction_session_minutes
  FROM anon, authenticated;

-- ─── 3. Guard chỉ-ghi-thêm ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auction_append_only_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Bảng % chỉ được ghi thêm — không sửa hay xoá dòng đã ghi.', TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END; $$;

DROP TRIGGER IF EXISTS auction_lot_events_append_only ON public.auction_lot_events;
CREATE TRIGGER auction_lot_events_append_only
  BEFORE UPDATE OR DELETE ON public.auction_lot_events
  FOR EACH ROW EXECUTE FUNCTION public.auction_append_only_guard();

DROP TRIGGER IF EXISTS auction_deposit_events_append_only ON public.auction_deposit_events;
CREATE TRIGGER auction_deposit_events_append_only
  BEFORE UPDATE OR DELETE ON public.auction_deposit_events
  FOR EACH ROW EXECUTE FUNCTION public.auction_append_only_guard();

DROP TRIGGER IF EXISTS auction_session_minutes_append_only ON public.auction_session_minutes;
CREATE TRIGGER auction_session_minutes_append_only
  BEFORE UPDATE OR DELETE ON public.auction_session_minutes
  FOR EACH ROW EXECUTE FUNCTION public.auction_append_only_guard();

CREATE OR REPLACE FUNCTION public.auction_bids_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.withdrawn_at IS NULL AND NEW.withdrawn_at IS NOT NULL
     AND (to_jsonb(NEW) - 'withdrawn_at') = (to_jsonb(OLD) - 'withdrawn_at') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Lượt trả giá đã ghi không thể sửa hay xoá.' USING ERRCODE = 'insufficient_privilege';
END; $$;

DROP TRIGGER IF EXISTS auction_bids_guard ON public.auction_bids;
CREATE TRIGGER auction_bids_guard
  BEFORE UPDATE OR DELETE ON public.auction_bids
  FOR EACH ROW EXECUTE FUNCTION public.auction_bids_guard();

-- ─── 4. Khoá cấu hình khi phiên đã bắt đầu trả giá ──────────────────────────
CREATE OR REPLACE FUNCTION public._bidding_rpc_active()
RETURNS BOOLEAN
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT COALESCE(current_setting('app.bidding_rpc', true), '') = 'on'
$$;
REVOKE EXECUTE ON FUNCTION public._bidding_rpc_active() FROM PUBLIC, anon, authenticated;

-- "Đã bắt đầu" = có ít nhất một lô rời trạng thái pending. Công khai được (trạng
-- thái lô vốn công khai) — UI điều hành dùng để khoá form quy tắc.
CREATE OR REPLACE FUNCTION public.auction_session_bidding_started(_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.auction_lot_states
                  WHERE session_id = _session_id AND status <> 'pending')
$$;
GRANT EXECUTE ON FUNCTION public.auction_session_bidding_started(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.auction_sessions_bidding_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public._bidding_rpc_active() THEN
    RETURN NEW;
  END IF;

  -- Cột do RPC chốt phiên quản lý.
  NEW.finalized_at := OLD.finalized_at;
  NEW.finalized_by := OLD.finalized_by;

  IF (NEW.bidding_method, NEW.extension_seconds, NEW.max_bid_steps, NEW.auction_format, NEW.starts_at, NEW.ends_at)
       IS DISTINCT FROM
     (OLD.bidding_method, OLD.extension_seconds, OLD.max_bid_steps, OLD.auction_format, OLD.starts_at, OLD.ends_at)
     AND public.auction_session_bidding_started(OLD.id) THEN
    RAISE EXCEPTION 'Phiên đã bắt đầu trả giá trực tuyến — không đổi được hình thức, thời gian hay quy tắc trả giá.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS auction_sessions_bidding_guard ON public.auction_sessions;
CREATE TRIGGER auction_sessions_bidding_guard
  BEFORE UPDATE ON public.auction_sessions
  FOR EACH ROW EXECUTE FUNCTION public.auction_sessions_bidding_guard();

-- Lô: không thêm / xoá / đổi giá khởi điểm, bước giá, tiền đặt trước, số lô khi
-- phiên đã bắt đầu. pg_trigger_depth() > 1 = thay đổi do hệ thống (FK SET NULL,
-- đánh lại số lô) — không chặn, giống auction_session_items_guard_update.
CREATE OR REPLACE FUNCTION public.auction_session_items_bidding_lock()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_session := NEW.session_id;
  ELSE
    v_session := OLD.session_id;
  END IF;

  IF pg_trigger_depth() > 1 OR public._bidding_rpc_active()
     OR NOT public.auction_session_bidding_started(v_session)
     OR (TG_OP = 'UPDATE'
         AND (NEW.starting_price, NEW.bid_step, NEW.deposit_amount, NEW.lot_no, NEW.session_id)
             IS NOT DISTINCT FROM
             (OLD.starting_price, OLD.bid_step, OLD.deposit_amount, OLD.lot_no, OLD.session_id)) THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Phiên đã bắt đầu trả giá — không thêm/xoá lô hay đổi giá khởi điểm, bước giá, tiền đặt trước. Hãy dùng "Rút tài sản" trong màn điều hành.'
    USING ERRCODE = 'check_violation';
END; $$;

DROP TRIGGER IF EXISTS auction_session_items_bidding_lock ON public.auction_session_items;
CREATE TRIGGER auction_session_items_bidding_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.auction_session_items
  FOR EACH ROW EXECUTE FUNCTION public.auction_session_items_bidding_lock();

-- Hồ sơ đã trả giá (hoặc phiên đã chốt): tiền đặt trước + số báo danh chỉ đổi qua
-- RPC điều hành. Nếu không, org_set_contract_deposit lùi về "chờ" sẽ xoá số báo
-- danh của người đang dẫn đầu, hoặc gỡ tịch thu của người đã rút giá.
CREATE OR REPLACE FUNCTION public.auction_bidding_contracts_bidding_lock()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public._bidding_rpc_active()
     OR (NEW.deposit_status IS NOT DISTINCT FROM OLD.deposit_status
         AND NEW.bidder_no IS NOT DISTINCT FROM OLD.bidder_no) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.auction_bids WHERE contract_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.auction_sessions WHERE id = OLD.session_id AND finalized_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Người tham gia đã trả giá hoặc phiên đã chốt kết quả — tiền đặt trước và số báo danh chỉ thay đổi qua màn điều hành đấu giá.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS auction_bidding_contracts_bidding_lock ON public.auction_bidding_contracts;
CREATE TRIGGER auction_bidding_contracts_bidding_lock
  BEFORE UPDATE OF deposit_status, bidder_no ON public.auction_bidding_contracts
  FOR EACH ROW EXECUTE FUNCTION public.auction_bidding_contracts_bidding_lock();

-- Sổ tiền đặt trước. Lý do / lô lấy từ GUC cục bộ transaction mà RPC đặt ngay
-- trước câu UPDATE; không có thì dùng deposit_note.
CREATE OR REPLACE FUNCTION public.auction_bidding_contracts_deposit_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_lot    UUID;
  v_amount NUMERIC;
BEGIN
  BEGIN
    v_lot := NULLIF(current_setting('app.deposit_lot_id', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_lot := NULL;
  END;

  v_amount := NEW.deposit_amount_received;
  IF TG_OP = 'UPDATE' THEN
    v_amount := COALESCE(NEW.deposit_amount_received, OLD.deposit_amount_received);
  END IF;

  INSERT INTO public.auction_deposit_events (contract_id, session_id, kind, amount, reason, lot_id, actor_id)
  VALUES (NEW.id, NEW.session_id,
          CASE WHEN NEW.deposit_status = 'pending' THEN 'reversed' ELSE NEW.deposit_status END,
          v_amount,
          COALESCE(NULLIF(current_setting('app.deposit_reason', true), ''), NEW.deposit_note),
          v_lot, auth.uid());
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS auction_bidding_contracts_deposit_ledger_ins ON public.auction_bidding_contracts;
CREATE TRIGGER auction_bidding_contracts_deposit_ledger_ins
  AFTER INSERT ON public.auction_bidding_contracts
  FOR EACH ROW WHEN (NEW.deposit_status <> 'pending')
  EXECUTE FUNCTION public.auction_bidding_contracts_deposit_ledger();

DROP TRIGGER IF EXISTS auction_bidding_contracts_deposit_ledger_upd ON public.auction_bidding_contracts;
CREATE TRIGGER auction_bidding_contracts_deposit_ledger_upd
  AFTER UPDATE OF deposit_status, deposit_amount_received ON public.auction_bidding_contracts
  FOR EACH ROW WHEN (OLD.deposit_status IS DISTINCT FROM NEW.deposit_status
                     OR OLD.deposit_amount_received IS DISTINCT FROM NEW.deposit_amount_received)
  EXECUTE FUNCTION public.auction_bidding_contracts_deposit_ledger();

-- Dựng sổ cho hồ sơ đã qua bước "chờ" trước migration này.
INSERT INTO public.auction_deposit_events (contract_id, session_id, kind, amount, reason, at)
SELECT c.id, c.session_id, c.deposit_status, c.deposit_amount_received,
       'Ghi nhận khi dựng sổ tiền đặt trước (20260913000001)',
       COALESCE(c.deposit_status_changed_at, c.deposit_received_at, c.updated_at)
  FROM public.auction_bidding_contracts c
 WHERE c.deposit_status <> 'pending'
   AND NOT EXISTS (SELECT 1 FROM public.auction_deposit_events e WHERE e.contract_id = c.id);

-- ─── 5. Hàm quyền ───────────────────────────────────────────────────────────
-- Nhánh owner_id là BẮT BUỘC: org_has_permission chỉ nhìn membership ACTIVE.
CREATE OR REPLACE FUNCTION public.can_run_auction(_org_id UUID, _action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.org_has_permission(_org_id, 'dieu-hanh-dau-gia', _action)
      OR EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = _org_id AND o.owner_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.can_run_auction_session(_session_id UUID, _action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auction_sessions s
     WHERE s.id = _session_id AND public.can_run_auction(s.organization_id, _action)
  )
$$;

CREATE OR REPLACE FUNCTION public.auction_session_is_finalized(_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auction_sessions s
     WHERE s.id = _session_id AND s.finalized_at IS NOT NULL AND s.status IN ('published', 'cancelled')
  )
$$;

-- Người xem sổ tiền đặt trước: chính người tham gia, người quản lý hồ sơ tham
-- gia, người điều hành phiên.
CREATE OR REPLACE FUNCTION public.auction_deposit_event_visible(_contract_id UUID, _session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auction_bidding_contracts c
     WHERE c.id = _contract_id
       AND (c.user_id = auth.uid() OR public.can_manage_bidding_contracts(c.organization_id, 'view'))
  ) OR public.can_run_auction_session(_session_id, 'view')
$$;

REVOKE EXECUTE ON FUNCTION public.can_run_auction(UUID, TEXT)                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_run_auction_session(UUID, TEXT)          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auction_deposit_event_visible(UUID, UUID)    FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_run_auction(UUID, TEXT)                  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.can_run_auction_session(UUID, TEXT)          TO authenticated;
GRANT  EXECUTE ON FUNCTION public.auction_deposit_event_visible(UUID, UUID)    TO authenticated;
GRANT  EXECUTE ON FUNCTION public.auction_session_is_finalized(UUID)           TO anon, authenticated;

-- ─── 6. RLS ─────────────────────────────────────────────────────────────────
-- Không có policy ghi nào. Admin nền tảng CHỈ ĐỌC.
ALTER TABLE public.auction_lot_states      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_lot_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_deposit_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_session_minutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auction_lot_states_public_read" ON public.auction_lot_states;
CREATE POLICY "auction_lot_states_public_read" ON public.auction_lot_states
  FOR SELECT TO anon, authenticated USING (public.auction_session_is_public(session_id));
DROP POLICY IF EXISTS "auction_lot_states_org_read" ON public.auction_lot_states;
CREATE POLICY "auction_lot_states_org_read" ON public.auction_lot_states
  FOR SELECT TO authenticated
  USING (public.can_run_auction_session(session_id, 'view')
         OR public.can_manage_auction_session_items(session_id, 'view'));
DROP POLICY IF EXISTS "auction_lot_states_admin_read" ON public.auction_lot_states;
CREATE POLICY "auction_lot_states_admin_read" ON public.auction_lot_states
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS "auction_bids_public_read" ON public.auction_bids;
CREATE POLICY "auction_bids_public_read" ON public.auction_bids
  FOR SELECT TO anon, authenticated USING (public.auction_session_is_public(session_id));
DROP POLICY IF EXISTS "auction_bids_org_read" ON public.auction_bids;
CREATE POLICY "auction_bids_org_read" ON public.auction_bids
  FOR SELECT TO authenticated
  USING (public.can_run_auction_session(session_id, 'view')
         OR public.can_manage_auction_session_items(session_id, 'view'));
DROP POLICY IF EXISTS "auction_bids_admin_read" ON public.auction_bids;
CREATE POLICY "auction_bids_admin_read" ON public.auction_bids
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS "auction_lot_events_org_read" ON public.auction_lot_events;
CREATE POLICY "auction_lot_events_org_read" ON public.auction_lot_events
  FOR SELECT TO authenticated
  USING (public.can_run_auction_session(session_id, 'view')
         OR public.can_manage_auction_session_items(session_id, 'view'));
DROP POLICY IF EXISTS "auction_lot_events_admin_read" ON public.auction_lot_events;
CREATE POLICY "auction_lot_events_admin_read" ON public.auction_lot_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS "auction_deposit_events_read" ON public.auction_deposit_events;
CREATE POLICY "auction_deposit_events_read" ON public.auction_deposit_events
  FOR SELECT TO authenticated USING (public.auction_deposit_event_visible(contract_id, session_id));
DROP POLICY IF EXISTS "auction_deposit_events_admin_read" ON public.auction_deposit_events;
CREATE POLICY "auction_deposit_events_admin_read" ON public.auction_deposit_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS "auction_session_minutes_org_read" ON public.auction_session_minutes;
CREATE POLICY "auction_session_minutes_org_read" ON public.auction_session_minutes
  FOR SELECT TO authenticated
  USING (public.can_run_auction_session(session_id, 'view')
         OR public.can_manage_auction_session_items(session_id, 'view'));
-- Quyết định 2026-09-12: biên bản công khai sau khi chốt phiên.
DROP POLICY IF EXISTS "auction_session_minutes_public_read" ON public.auction_session_minutes;
CREATE POLICY "auction_session_minutes_public_read" ON public.auction_session_minutes
  FOR SELECT TO anon, authenticated USING (public.auction_session_is_finalized(session_id));
DROP POLICY IF EXISTS "auction_session_minutes_admin_read" ON public.auction_session_minutes;
CREATE POLICY "auction_session_minutes_admin_read" ON public.auction_session_minutes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ─── 7. Storage: biên bản ───────────────────────────────────────────────────
-- Đường dẫn {organization_id}/{session_id}/{tên}.pdf. Không có policy UPDATE /
-- DELETE ⇒ tệp bất biến (upsert cũng bị chặn).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('auction-minutes', 'auction-minutes', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Phiên của object, CHỈ khi segment 1 đúng là tổ chức của phiên ở segment 2.
CREATE OR REPLACE FUNCTION public.auction_minutes_object_session(_name TEXT)
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
  RETURN (SELECT s.id FROM public.auction_sessions s
           WHERE s.id = v_session AND s.organization_id = v_org);
END; $$;

-- Công khai chỉ tệp ĐÃ phát hành thành biên bản của phiên đã chốt — tệp tải lên
-- mà chưa phát hành vẫn riêng tư.
CREATE OR REPLACE FUNCTION public.auction_minutes_object_is_public(_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auction_session_minutes m
      JOIN public.auction_sessions s ON s.id = m.session_id
     WHERE m.pdf_path = _name AND s.finalized_at IS NOT NULL
  )
$$;

REVOKE EXECUTE ON FUNCTION public.auction_minutes_object_session(TEXT)  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.auction_minutes_object_session(TEXT)  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.auction_minutes_object_is_public(TEXT) TO anon, authenticated;

DROP POLICY IF EXISTS auction_minutes_storage_select_org ON storage.objects;
CREATE POLICY auction_minutes_storage_select_org ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'auction-minutes'
         AND public.can_run_auction_session(public.auction_minutes_object_session(name), 'view'));

DROP POLICY IF EXISTS auction_minutes_storage_select_public ON storage.objects;
CREATE POLICY auction_minutes_storage_select_public ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'auction-minutes' AND public.auction_minutes_object_is_public(name));

DROP POLICY IF EXISTS auction_minutes_storage_insert ON storage.objects;
CREATE POLICY auction_minutes_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'auction-minutes'
              AND public.can_run_auction_session(public.auction_minutes_object_session(name), 'finalize'));

-- ─── 8. Helper nội bộ ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.lot_is_open(_state public.auction_lot_states, _at TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT _state.status = 'open' AND _at < _state.ends_at
$$;

CREATE OR REPLACE FUNCTION public._lot_lock(_lot_id UUID)
RETURNS VOID
LANGUAGE sql SET search_path = public
AS $$
  SELECT pg_advisory_xact_lock(hashtextextended('lot:' || _lot_id::text, 0))
$$;

CREATE OR REPLACE FUNCTION public._lot_event(_session_id UUID, _lot_id UUID, _kind TEXT, _payload JSONB DEFAULT '{}'::jsonb)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.auction_lot_events (session_id, lot_id, kind, actor_id, payload)
  VALUES (_session_id, _lot_id, _kind, auth.uid(), COALESCE(_payload, '{}'::jsonb))
$$;

-- Đặt / xoá ngữ cảnh cho trigger sổ tiền đặt trước + guard.
CREATE OR REPLACE FUNCTION public._bidding_ctx(_reason TEXT DEFAULT NULL, _lot_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE sql SET search_path = public
AS $$
  SELECT set_config('app.bidding_rpc', 'on', true),
         set_config('app.deposit_reason', COALESCE(_reason, ''), true),
         set_config('app.deposit_lot_id', COALESCE(_lot_id::text, ''), true)
$$;

CREATE OR REPLACE FUNCTION public._bidding_ctx_clear()
RETURNS VOID
LANGUAGE sql SET search_path = public
AS $$
  SELECT set_config('app.bidding_rpc', '', true),
         set_config('app.deposit_reason', '', true),
         set_config('app.deposit_lot_id', '', true)
$$;

-- Đóng lô đã đến giờ. Tự giữ khoá lô (khoá tư vấn cộng dồn được trong cùng
-- transaction) và kiểm lại ends_at SAU khi khoá: một lượt trả giá vừa gia hạn thì
-- lô chưa được đóng. Người trúng có thể đã bị tịch thu tiền đặt trước do rút giá
-- ở lô khác — vẫn trúng (quyết định 2026-09-12).
CREATE OR REPLACE FUNCTION public._close_lot(_lot_id UUID, _at TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  st       public.auction_lot_states;
  v_winner UUID;
BEGIN
  PERFORM public._lot_lock(_lot_id);
  SELECT * INTO st FROM public.auction_lot_states WHERE lot_id = _lot_id FOR UPDATE;
  IF st.lot_id IS NULL OR st.status <> 'open' OR st.ends_at > _at THEN
    RETURN false;
  END IF;

  IF st.current_bid_id IS NOT NULL THEN
    SELECT contract_id INTO v_winner FROM public.auction_bids WHERE id = st.current_bid_id;
  END IF;

  UPDATE public.auction_lot_states
     SET status             = 'closed',
         closed_at          = st.ends_at,
         result             = CASE WHEN v_winner IS NULL THEN 'unsold' ELSE 'sold' END,
         winner_contract_id = v_winner,
         winning_amount     = CASE WHEN v_winner IS NULL THEN NULL ELSE st.current_price END,
         payment_due_at     = CASE WHEN v_winner IS NULL THEN NULL ELSE st.ends_at + interval '30 days' END,
         payment_status     = CASE WHEN v_winner IS NULL THEN NULL ELSE 'pending' END
   WHERE lot_id = _lot_id;

  PERFORM public._lot_event(st.session_id, _lot_id, 'close', jsonb_build_object(
    'result',         CASE WHEN v_winner IS NULL THEN 'unsold' ELSE 'sold' END,
    'winning_amount', CASE WHEN v_winner IS NULL THEN NULL ELSE st.current_price END,
    'bidder_no',      CASE WHEN v_winner IS NULL THEN NULL ELSE st.leading_bidder_no END,
    'bid_count',      st.bid_count,
    'ends_at',        st.ends_at));
  RETURN true;
END; $$;

-- Người dẫn đầu = lượt mới nhất chưa rút, của hồ sơ chưa bị tịch thu tiền đặt trước.
CREATE OR REPLACE FUNCTION public._recompute_lot_leader(_lot_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  b RECORD;
BEGIN
  SELECT x.id, x.amount, x.bidder_no INTO b
    FROM public.auction_bids x
    JOIN public.auction_bidding_contracts c ON c.id = x.contract_id
   WHERE x.lot_id = _lot_id AND x.withdrawn_at IS NULL AND c.deposit_status <> 'forfeited'
   ORDER BY x.seq DESC
   LIMIT 1;

  UPDATE public.auction_lot_states
     SET current_bid_id    = b.id,
         current_price     = b.amount,
         leading_bidder_no = b.bidder_no
   WHERE lot_id = _lot_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.lot_is_open(public.auction_lot_states, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._lot_lock(UUID)                                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._lot_event(UUID, UUID, TEXT, JSONB)                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._bidding_ctx(TEXT, UUID)                            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._bidding_ctx_clear()                                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._close_lot(UUID, TIMESTAMPTZ)                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._recompute_lot_leader(UUID)                         FROM PUBLIC, anon, authenticated;

-- ─── 9. RPC ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.server_now()
RETURNS TIMESTAMPTZ
LANGUAGE sql VOLATILE
AS $$
  SELECT clock_timestamp()
$$;
GRANT EXECUTE ON FUNCTION public.server_now() TO anon, authenticated;

-- Trả giá. THỨ TỰ KIỂM TRA (client Bước 3 phải theo đúng):
--   not_authenticated → lot_not_found → session_not_live → lot_not_open → lot_paused
--   → lot_closed → not_eligible → already_leading → invalid_nonce → bid_too_low
--   → bid_step_mismatch → bid_too_many_steps
-- Giá tối thiểu: lượt đầu = giá khởi điểm; sau đó = giá hiện tại + 1 bước.
-- Mọi giá trả phải nằm trên lưới giá khởi điểm + k × bước giá.
CREATE OR REPLACE FUNCTION public.place_bid(_lot_id UUID, _amount NUMERIC, _nonce TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_nonce    TEXT := btrim(COALESCE(_nonce, ''));
  it         RECORD;
  c          RECORD;
  st         public.auction_lot_states;
  v_dup      RECORD;
  v_now      TIMESTAMPTZ;
  v_min      NUMERIC;
  v_max      NUMERIC;
  v_reason   TEXT;
  v_bid_id   UUID;
  v_seq      INT;
  v_ends     TIMESTAMPTZ;
  v_extended BOOLEAN := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT i.id, i.session_id, i.starting_price, i.bid_step,
         s.status AS session_status, s.auction_format, s.starts_at, s.extension_seconds, s.max_bid_steps
    INTO it
    FROM public.auction_session_items i
    JOIN public.auction_sessions s ON s.id = i.session_id
   WHERE i.id = _lot_id;
  IF it.id IS NULL OR it.session_status NOT IN ('published', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_not_found');
  END IF;

  PERFORM public._lot_lock(_lot_id);
  v_now := clock_timestamp();

  SELECT * INTO c
    FROM public.auction_bidding_contracts
   WHERE session_id = it.session_id AND user_id = v_uid AND status = 'paid';

  -- Gửi lại cùng nonce ⇒ trả đúng lượt đã ghi (kiểm sau khi khoá nên không đua).
  IF c.id IS NOT NULL AND v_nonce <> '' THEN
    SELECT b.id, b.seq, b.amount, b.lot_id INTO v_dup
      FROM public.auction_bids b WHERE b.contract_id = c.id AND b.client_nonce = v_nonce;
    IF v_dup.id IS NOT NULL THEN
      IF v_dup.lot_id <> _lot_id THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_nonce');
      END IF;
      SELECT * INTO st FROM public.auction_lot_states WHERE lot_id = _lot_id;
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'bid_id', v_dup.id, 'seq', v_dup.seq,
                                'amount', v_dup.amount, 'current_price', st.current_price,
                                'ends_at', st.ends_at, 'extended', false, 'bidder_no', c.bidder_no);
    END IF;
  END IF;

  IF it.session_status <> 'published' OR it.auction_format NOT IN ('truc_tuyen', 'ca_hai')
     OR v_now < it.starts_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_live');
  END IF;

  SELECT * INTO st FROM public.auction_lot_states WHERE lot_id = _lot_id FOR UPDATE;
  IF st.lot_id IS NULL OR st.status IN ('pending', 'withdrawn') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_not_open');
  END IF;
  IF st.status = 'paused' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_paused');
  END IF;
  IF NOT public.lot_is_open(st, v_now) THEN
    -- Đóng lười: cron có thể trễ vài giây, lượt trả giá muộn vẫn bị từ chối đúng giờ.
    PERFORM public._close_lot(_lot_id, v_now);
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_closed');
  END IF;

  IF c.id IS NULL OR c.bidder_no IS NULL OR c.deposit_status <> 'received' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_eligible');
  END IF;

  v_min := CASE WHEN st.current_price IS NULL THEN it.starting_price ELSE st.current_price + it.bid_step END;
  v_max := v_min + (it.max_bid_steps - 1) * it.bid_step;

  IF st.current_bid_id IS NOT NULL AND st.leading_bidder_no = c.bidder_no THEN
    v_reason := 'already_leading';
  ELSIF length(v_nonce) NOT BETWEEN 8 AND 100 THEN
    v_reason := 'invalid_nonce';
  ELSIF _amount IS NULL OR _amount < v_min THEN
    v_reason := 'bid_too_low';
  ELSIF _amount <> trunc(_amount) OR mod(_amount - it.starting_price, it.bid_step) <> 0 THEN
    v_reason := 'bid_step_mismatch';
  ELSIF _amount > v_max THEN
    v_reason := 'bid_too_many_steps';
  END IF;

  IF v_reason IS NOT NULL THEN
    -- Chỉ ghi nhật ký cho người đủ điều kiện — người ngoài không làm ngập sổ được.
    PERFORM public._lot_event(it.session_id, _lot_id, 'bid_rejected', jsonb_build_object(
      'reason', v_reason, 'amount', _amount, 'bidder_no', c.bidder_no, 'min_amount', v_min, 'max_amount', v_max));
    RETURN jsonb_build_object('ok', false, 'reason', v_reason, 'min_amount', v_min, 'max_amount', v_max,
                              'current_price', st.current_price);
  END IF;

  v_seq := st.bid_count + 1;
  INSERT INTO public.auction_bids (lot_id, session_id, contract_id, bidder_no, seq, amount, placed_at, client_nonce)
  VALUES (_lot_id, it.session_id, c.id, c.bidder_no, v_seq, _amount, v_now, v_nonce)
  RETURNING id INTO v_bid_id;

  v_ends := st.ends_at;
  IF it.extension_seconds > 0 AND st.ends_at - v_now < make_interval(secs => it.extension_seconds) THEN
    v_ends     := v_now + make_interval(secs => it.extension_seconds);
    v_extended := true;
  END IF;

  UPDATE public.auction_lot_states
     SET current_price     = _amount,
         current_bid_id    = v_bid_id,
         leading_bidder_no = c.bidder_no,
         bid_count         = v_seq,
         ends_at           = v_ends,
         extension_count   = extension_count + CASE WHEN v_extended THEN 1 ELSE 0 END
   WHERE lot_id = _lot_id;

  PERFORM public._lot_event(it.session_id, _lot_id, 'bid', jsonb_build_object(
    'bid_id', v_bid_id, 'seq', v_seq, 'amount', _amount, 'bidder_no', c.bidder_no));
  IF v_extended THEN
    PERFORM public._lot_event(it.session_id, _lot_id, 'extend', jsonb_build_object(
      'bid_id', v_bid_id, 'from', st.ends_at, 'to', v_ends));
  END IF;

  RETURN jsonb_build_object('ok', true, 'bid_id', v_bid_id, 'seq', v_seq, 'amount', _amount,
                            'current_price', _amount, 'ends_at', v_ends, 'extended', v_extended,
                            'bidder_no', c.bidder_no);
END; $$;

REVOKE ALL ON FUNCTION public.place_bid(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_bid(UUID, NUMERIC, TEXT) TO authenticated;

-- Rút lại giá đang dẫn đầu. Chỉ LÔ này quay về lượt hợp lệ trước; tiền đặt trước
-- của cả phiên bị tịch thu (quyết định 2026-09-12).
CREATE OR REPLACE FUNCTION public.withdraw_bid(_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  b          RECORD;
  st         public.auction_lot_states;
  v_now      TIMESTAMPTZ;
  v_forfeit  BOOLEAN := false;
  v_after    public.auction_lot_states;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT x.id, x.lot_id, x.session_id, x.contract_id, x.amount, x.bidder_no, x.withdrawn_at,
         c.user_id, i.lot_no
    INTO b
    FROM public.auction_bids x
    JOIN public.auction_bidding_contracts c ON c.id = x.contract_id
    JOIN public.auction_session_items i ON i.id = x.lot_id
   WHERE x.id = _bid_id;
  IF b.id IS NULL OR b.user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  PERFORM public._lot_lock(b.lot_id);
  v_now := clock_timestamp();

  SELECT * INTO st FROM public.auction_lot_states WHERE lot_id = b.lot_id FOR UPDATE;
  IF st.status = 'open' AND NOT public.lot_is_open(st, v_now) THEN
    PERFORM public._close_lot(b.lot_id, v_now);
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_closed');
  END IF;
  IF st.status NOT IN ('open', 'paused') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_closed');
  END IF;
  IF st.current_bid_id IS DISTINCT FROM _bid_id OR b.withdrawn_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_leading');
  END IF;

  PERFORM public._bidding_ctx('Rút lại giá đã trả tại lô ' || b.lot_no, b.lot_id);

  UPDATE public.auction_bids SET withdrawn_at = v_now WHERE id = _bid_id;

  UPDATE public.auction_bidding_contracts
     SET deposit_status = 'forfeited', deposit_status_changed_at = v_now
   WHERE id = b.contract_id AND deposit_status = 'received';
  v_forfeit := FOUND;

  PERFORM public._recompute_lot_leader(b.lot_id);
  SELECT * INTO v_after FROM public.auction_lot_states WHERE lot_id = b.lot_id;

  PERFORM public._lot_event(b.session_id, b.lot_id, 'withdraw_bid', jsonb_build_object(
    'bid_id', _bid_id, 'amount', b.amount, 'bidder_no', b.bidder_no,
    'reverted_price', v_after.current_price, 'leading_bidder_no', v_after.leading_bidder_no,
    'deposit_forfeited', v_forfeit));

  PERFORM public._bidding_ctx_clear();

  RETURN jsonb_build_object('ok', true, 'current_price', v_after.current_price,
                            'leading_bidder_no', v_after.leading_bidder_no, 'deposit_forfeited', v_forfeit);
END; $$;

REVOKE ALL ON FUNCTION public.withdraw_bid(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_bid(UUID) TO authenticated;

-- Mở lô. Mốc kết thúc ban đầu = giờ kết thúc phiên.
CREATE OR REPLACE FUNCTION public.org_open_lot(_lot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  it    RECORD;
  st    public.auction_lot_states;
  v_now TIMESTAMPTZ;
BEGIN
  SELECT i.id, i.session_id, i.starting_price, i.bid_step,
         s.organization_id, s.status AS session_status, s.auction_format, s.starts_at, s.ends_at
    INTO it
    FROM public.auction_session_items i
    JOIN public.auction_sessions s ON s.id = i.session_id
   WHERE i.id = _lot_id;
  IF it.id IS NULL OR NOT public.can_run_auction(it.organization_id, 'operate') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  PERFORM public._lot_lock(_lot_id);
  v_now := clock_timestamp();

  IF it.session_status <> 'published' OR it.auction_format NOT IN ('truc_tuyen', 'ca_hai')
     OR v_now < it.starts_at OR v_now >= it.ends_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_live');
  END IF;
  IF it.starting_price IS NULL OR it.bid_step IS NULL OR it.bid_step <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_not_configured');
  END IF;

  INSERT INTO public.auction_lot_states (lot_id, session_id) VALUES (_lot_id, it.session_id)
  ON CONFLICT (lot_id) DO NOTHING;
  SELECT * INTO st FROM public.auction_lot_states WHERE lot_id = _lot_id FOR UPDATE;
  IF st.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', st.status);
  END IF;

  UPDATE public.auction_lot_states
     SET status = 'open', opened_at = v_now, ends_at = it.ends_at
   WHERE lot_id = _lot_id;

  PERFORM public._lot_event(it.session_id, _lot_id, 'open', jsonb_build_object('ends_at', it.ends_at));
  RETURN jsonb_build_object('ok', true, 'ends_at', it.ends_at);
END; $$;

CREATE OR REPLACE FUNCTION public.org_pause_lot(_lot_id UUID, _reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org     UUID;
  v_session UUID;
  st        public.auction_lot_states;
  v_now     TIMESTAMPTZ;
  v_reason  TEXT := btrim(COALESCE(_reason, ''));
BEGIN
  SELECT s.organization_id, s.id INTO v_org, v_session
    FROM public.auction_session_items i JOIN public.auction_sessions s ON s.id = i.session_id
   WHERE i.id = _lot_id;
  IF v_org IS NULL OR NOT public.can_run_auction(v_org, 'operate') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  IF length(v_reason) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;

  PERFORM public._lot_lock(_lot_id);
  v_now := clock_timestamp();

  SELECT * INTO st FROM public.auction_lot_states WHERE lot_id = _lot_id FOR UPDATE;
  IF st.status = 'open' AND NOT public.lot_is_open(st, v_now) THEN
    PERFORM public._close_lot(_lot_id, v_now);
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_closed');
  END IF;
  IF st.lot_id IS NULL OR st.status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', st.status);
  END IF;

  UPDATE public.auction_lot_states
     SET status = 'paused', paused_at = v_now, pause_reason = v_reason
   WHERE lot_id = _lot_id;

  PERFORM public._lot_event(v_session, _lot_id, 'pause', jsonb_build_object(
    'reason', v_reason, 'remaining_seconds', round(extract(epoch FROM st.ends_at - v_now))));
  RETURN jsonb_build_object('ok', true);
END; $$;

-- Tiếp tục: cộng lại khoảng thời gian tạm dừng vào mốc kết thúc.
CREATE OR REPLACE FUNCTION public.org_resume_lot(_lot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org     UUID;
  v_session UUID;
  st        public.auction_lot_states;
  v_now     TIMESTAMPTZ;
  v_ends    TIMESTAMPTZ;
BEGIN
  SELECT s.organization_id, s.id INTO v_org, v_session
    FROM public.auction_session_items i JOIN public.auction_sessions s ON s.id = i.session_id
   WHERE i.id = _lot_id;
  IF v_org IS NULL OR NOT public.can_run_auction(v_org, 'operate') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  PERFORM public._lot_lock(_lot_id);
  v_now := clock_timestamp();

  SELECT * INTO st FROM public.auction_lot_states WHERE lot_id = _lot_id FOR UPDATE;
  IF st.lot_id IS NULL OR st.status <> 'paused' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', st.status);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.auction_sessions WHERE id = v_session AND status = 'published') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_live');
  END IF;

  v_ends := st.ends_at + (v_now - st.paused_at);
  UPDATE public.auction_lot_states
     SET status = 'open', paused_at = NULL, pause_reason = NULL, ends_at = v_ends
   WHERE lot_id = _lot_id;

  PERFORM public._lot_event(v_session, _lot_id, 'resume', jsonb_build_object(
    'paused_seconds', round(extract(epoch FROM v_now - st.paused_at)), 'ends_at', v_ends));
  RETURN jsonb_build_object('ok', true, 'ends_at', v_ends);
END; $$;

-- Rút tài sản khỏi phiên. Tiền đặt trước tính theo phiên nên không hoàn gì ở đây.
CREATE OR REPLACE FUNCTION public.org_withdraw_lot(_lot_id UUID, _reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  it       RECORD;
  st       public.auction_lot_states;
  v_now    TIMESTAMPTZ;
  v_reason TEXT := btrim(COALESCE(_reason, ''));
BEGIN
  SELECT i.id, i.session_id, s.organization_id, s.status AS session_status
    INTO it
    FROM public.auction_session_items i JOIN public.auction_sessions s ON s.id = i.session_id
   WHERE i.id = _lot_id;
  IF it.id IS NULL OR NOT public.can_run_auction(it.organization_id, 'operate') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  IF length(v_reason) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;
  IF it.session_status <> 'published' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_live');
  END IF;

  PERFORM public._lot_lock(_lot_id);
  v_now := clock_timestamp();

  INSERT INTO public.auction_lot_states (lot_id, session_id) VALUES (_lot_id, it.session_id)
  ON CONFLICT (lot_id) DO NOTHING;
  SELECT * INTO st FROM public.auction_lot_states WHERE lot_id = _lot_id FOR UPDATE;
  IF st.status = 'open' AND NOT public.lot_is_open(st, v_now) THEN
    PERFORM public._close_lot(_lot_id, v_now);
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_closed');
  END IF;
  IF st.status NOT IN ('pending', 'open', 'paused') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', st.status);
  END IF;

  UPDATE public.auction_lot_states
     SET status = 'withdrawn', closed_at = v_now, withdraw_reason = v_reason,
         paused_at = NULL, pause_reason = NULL
   WHERE lot_id = _lot_id;

  PERFORM public._lot_event(it.session_id, _lot_id, 'withdraw_lot', jsonb_build_object(
    'reason', v_reason, 'from_status', st.status, 'bid_count', st.bid_count, 'current_price', st.current_price));
  RETURN jsonb_build_object('ok', true);
END; $$;

-- pg_cron gọi mỗi 10 giây. Lô của phiên đã huỷ ⇒ rút; lô mở đã quá giờ ⇒ đóng.
CREATE OR REPLACE FUNCTION public.close_due_lots()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r           RECORD;
  v_now       TIMESTAMPTZ := clock_timestamp();
  v_closed    INT := 0;
  v_withdrawn INT := 0;
BEGIN
  FOR r IN
    SELECT st.lot_id, st.session_id
      FROM public.auction_lot_states st
      JOIN public.auction_sessions s ON s.id = st.session_id
     WHERE s.status = 'cancelled' AND st.status IN ('pending', 'open', 'paused')
     ORDER BY st.lot_id
  LOOP
    PERFORM public._lot_lock(r.lot_id);
    UPDATE public.auction_lot_states
       SET status = 'withdrawn', closed_at = v_now, withdraw_reason = 'Phiên đã bị huỷ',
           paused_at = NULL, pause_reason = NULL
     WHERE lot_id = r.lot_id AND status IN ('pending', 'open', 'paused');
    IF FOUND THEN
      PERFORM public._lot_event(r.session_id, r.lot_id, 'withdraw_lot',
                                jsonb_build_object('reason', 'session_cancelled'));
      v_withdrawn := v_withdrawn + 1;
    END IF;
  END LOOP;

  FOR r IN
    SELECT st.lot_id FROM public.auction_lot_states st
     WHERE st.status = 'open' AND st.ends_at <= v_now
     ORDER BY st.lot_id
  LOOP
    IF public._close_lot(r.lot_id, v_now) THEN
      v_closed := v_closed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('closed', v_closed, 'withdrawn', v_withdrawn);
END; $$;

REVOKE ALL ON FUNCTION public.close_due_lots() FROM PUBLIC, anon, authenticated;

-- Chốt kết quả phiên. Chỉ tiền đặt trước đang "đã nhận" đổi trạng thái; bị tịch
-- thu thì giữ nguyên.
CREATE OR REPLACE FUNCTION public.org_finalize_session(_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s          RECORD;
  r          RECORD;
  v_now      TIMESTAMPTZ;
  v_open     INT;
  v_applied  INT := 0;
  v_refund   INT := 0;
  v_summary  RECORD;
BEGIN
  SELECT * INTO s FROM public.auction_sessions WHERE id = _session_id;
  IF s.id IS NULL OR NOT public.can_run_auction(s.organization_id, 'finalize') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  -- Cùng khoá với các RPC hồ sơ tham gia ⇒ không đua với xác nhận tiền đặt trước.
  PERFORM pg_advisory_xact_lock(hashtextextended('bidding:' || _session_id::text, 0));
  SELECT * INTO s FROM public.auction_sessions WHERE id = _session_id FOR UPDATE;

  IF s.status <> 'published' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', s.status);
  END IF;
  IF s.finalized_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_finalized');
  END IF;

  FOR r IN SELECT i.id FROM public.auction_session_items i WHERE i.session_id = _session_id ORDER BY i.id LOOP
    PERFORM public._lot_lock(r.id);
  END LOOP;
  v_now := clock_timestamp();

  FOR r IN
    SELECT lot_id FROM public.auction_lot_states
     WHERE session_id = _session_id AND status = 'open' AND ends_at <= v_now
  LOOP
    PERFORM public._close_lot(r.lot_id, v_now);
  END LOOP;

  SELECT count(*) INTO v_open
    FROM public.auction_session_items i
    LEFT JOIN public.auction_lot_states st ON st.lot_id = i.id
   WHERE i.session_id = _session_id
     AND COALESCE(st.status, 'pending') NOT IN ('closed', 'withdrawn');
  IF v_open > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lots_not_closed', 'count', v_open);
  END IF;

  FOR r IN
    SELECT x.id,
           (SELECT st.lot_id FROM public.auction_lot_states st
             WHERE st.session_id = _session_id AND st.result = 'sold' AND st.winner_contract_id = x.id
             ORDER BY st.lot_id LIMIT 1) AS won_lot
      FROM public.auction_bidding_contracts x
     WHERE x.session_id = _session_id AND x.status = 'paid' AND x.deposit_status = 'received'
     ORDER BY x.id
       FOR UPDATE OF x
  LOOP
    IF r.won_lot IS NOT NULL THEN
      PERFORM public._bidding_ctx('Trúng đấu giá — tiền đặt trước chuyển thành tiền mua tài sản', r.won_lot);
      UPDATE public.auction_bidding_contracts
         SET deposit_status = 'applied', deposit_status_changed_at = v_now
       WHERE id = r.id;
      v_applied := v_applied + 1;
    ELSE
      PERFORM public._bidding_ctx('Không trúng đấu giá — chờ hoàn trả tiền đặt trước', NULL);
      UPDATE public.auction_bidding_contracts
         SET deposit_status = 'pending_refund', deposit_status_changed_at = v_now
       WHERE id = r.id;
      v_refund := v_refund + 1;
    END IF;
  END LOOP;

  PERFORM public._bidding_ctx(NULL, NULL);
  UPDATE public.auction_sessions SET finalized_at = v_now, finalized_by = auth.uid() WHERE id = _session_id;

  SELECT count(*) FILTER (WHERE result = 'sold')      AS sold,
         count(*) FILTER (WHERE result = 'unsold')    AS unsold,
         count(*) FILTER (WHERE status = 'withdrawn') AS withdrawn
    INTO v_summary
    FROM public.auction_lot_states WHERE session_id = _session_id;

  PERFORM public._lot_event(_session_id, NULL, 'finalize', jsonb_build_object(
    'applied', v_applied, 'pending_refund', v_refund,
    'sold', v_summary.sold, 'unsold', v_summary.unsold, 'withdrawn', v_summary.withdrawn));
  PERFORM public._bidding_ctx_clear();

  RETURN jsonb_build_object('ok', true, 'finalized_at', v_now, 'applied', v_applied, 'pending_refund', v_refund,
                            'sold', v_summary.sold, 'unsold', v_summary.unsold, 'withdrawn', v_summary.withdrawn);
END; $$;

-- Phát hành biên bản: tệp đã tải lên {org}/{phiên}/{tên}.pdf, số thứ tự tăng dần.
CREATE OR REPLACE FUNCTION public.org_issue_minutes(_session_id UUID, _pdf_path TEXT, _hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s      RECORD;
  v_path TEXT := btrim(COALESCE(_pdf_path, ''));
  v_hash TEXT := lower(btrim(COALESCE(_hash, '')));
  v_seq  INT;
  v_id   UUID;
BEGIN
  SELECT id, organization_id, finalized_at INTO s FROM public.auction_sessions WHERE id = _session_id;
  IF s.id IS NULL OR NOT public.can_run_auction(s.organization_id, 'finalize') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  IF s.finalized_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_finalized');
  END IF;
  IF split_part(v_path, '/', 1) <> s.organization_id::text
     OR split_part(v_path, '/', 2) <> s.id::text
     OR split_part(v_path, '/', 3) !~ '^[A-Za-z0-9._-]+\.pdf$'
     OR split_part(v_path, '/', 4) <> '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_path');
  END IF;
  IF v_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_hash');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'auction-minutes' AND o.name = v_path) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'file_missing');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('minutes:' || _session_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.auction_session_minutes WHERE pdf_path = v_path) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_path');
  END IF;

  SELECT COALESCE(max(sequence_no), 0) + 1 INTO v_seq
    FROM public.auction_session_minutes WHERE session_id = _session_id;

  INSERT INTO public.auction_session_minutes (session_id, sequence_no, pdf_path, content_hash, issued_by)
  VALUES (_session_id, v_seq, v_path, v_hash, auth.uid())
  RETURNING id INTO v_id;

  PERFORM public._lot_event(_session_id, NULL, 'minutes', jsonb_build_object(
    'minutes_id', v_id, 'sequence_no', v_seq, 'pdf_path', v_path, 'content_hash', v_hash));
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'sequence_no', v_seq);
END; $$;

-- Người trúng thanh toán (hạn 30 ngày). Không thanh toán ⇒ tịch thu tiền đặt trước.
CREATE OR REPLACE FUNCTION public.org_confirm_winner_payment(_lot_id UUID, _paid BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  it        RECORD;
  st        public.auction_lot_states;
  v_now     TIMESTAMPTZ;
  v_forfeit BOOLEAN := false;
BEGIN
  SELECT i.id, i.lot_no, i.session_id, s.organization_id, s.finalized_at
    INTO it
    FROM public.auction_session_items i JOIN public.auction_sessions s ON s.id = i.session_id
   WHERE i.id = _lot_id;
  IF it.id IS NULL OR NOT public.can_run_auction(it.organization_id, 'finalize') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  IF it.finalized_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_finalized');
  END IF;
  IF _paid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;

  PERFORM public._lot_lock(_lot_id);
  v_now := clock_timestamp();

  SELECT * INTO st FROM public.auction_lot_states WHERE lot_id = _lot_id FOR UPDATE;
  IF st.result IS DISTINCT FROM 'sold' OR st.payment_status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;

  UPDATE public.auction_lot_states
     SET payment_status = CASE WHEN _paid THEN 'paid' ELSE 'defaulted' END,
         payment_confirmed_at = v_now
   WHERE lot_id = _lot_id;

  IF NOT _paid THEN
    PERFORM public._bidding_ctx('Người trúng đấu giá không thanh toán lô ' || it.lot_no || ' đúng hạn', _lot_id);
    UPDATE public.auction_bidding_contracts
       SET deposit_status = 'forfeited', deposit_status_changed_at = v_now
     WHERE id = st.winner_contract_id AND deposit_status = 'applied';
    v_forfeit := FOUND;
    PERFORM public._bidding_ctx_clear();
  END IF;

  PERFORM public._lot_event(it.session_id, _lot_id, 'payment', jsonb_build_object(
    'paid', _paid, 'winning_amount', st.winning_amount, 'payment_due_at', st.payment_due_at,
    'deposit_forfeited', v_forfeit));
  RETURN jsonb_build_object('ok', true, 'payment_status', CASE WHEN _paid THEN 'paid' ELSE 'defaulted' END,
                            'deposit_forfeited', v_forfeit);
END; $$;

-- Hoàn trả tiền đặt trước sau chốt phiên — người quản lý hồ sơ tham gia.
CREATE OR REPLACE FUNCTION public.org_mark_deposit_refunded(_contract_id UUID, _note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c      RECORD;
  v_note TEXT := NULLIF(btrim(COALESCE(_note, '')), '');
BEGIN
  SELECT id, organization_id, deposit_status INTO c
    FROM public.auction_bidding_contracts WHERE id = _contract_id FOR UPDATE;
  IF c.id IS NULL OR NOT public.can_manage_bidding_contracts(c.organization_id, 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  IF c.deposit_status <> 'pending_refund' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', c.deposit_status);
  END IF;

  PERFORM public._bidding_ctx(COALESCE(v_note, 'Đã hoàn trả tiền đặt trước'), NULL);
  UPDATE public.auction_bidding_contracts
     SET deposit_status            = 'refunded',
         deposit_status_changed_at = now(),
         deposit_updated_by        = auth.uid(),
         deposit_note              = COALESCE(v_note, deposit_note)
   WHERE id = _contract_id;
  PERFORM public._bidding_ctx_clear();

  RETURN jsonb_build_object('ok', true);
END; $$;

REVOKE ALL ON FUNCTION public.org_open_lot(UUID)                         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_pause_lot(UUID, TEXT)                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_resume_lot(UUID)                       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_withdraw_lot(UUID, TEXT)               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_finalize_session(UUID)                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_issue_minutes(UUID, TEXT, TEXT)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_confirm_winner_payment(UUID, BOOLEAN)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_mark_deposit_refunded(UUID, TEXT)      FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_open_lot(UUID)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_pause_lot(UUID, TEXT)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_resume_lot(UUID)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_withdraw_lot(UUID, TEXT)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_finalize_session(UUID)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_issue_minutes(UUID, TEXT, TEXT)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_confirm_winner_payment(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_mark_deposit_refunded(UUID, TEXT)     TO authenticated;

-- ─── 10. Realtime + cron ────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                  WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'auction_lot_states') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_lot_states;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                  WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'auction_bids') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_bids;
  END IF;
END $$;

ALTER TABLE public.auction_lot_states REPLICA IDENTITY FULL;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Job có tên ⇒ schedule lại là cập nhật, không nhân đôi.
SELECT cron.schedule('close_due_lots', '10 seconds', $cron$SELECT public.close_due_lots()$cron$);
SELECT cron.schedule('purge_cron_history', '0 3 * * *',
  $cron$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '3 days'$cron$);

-- ─── 11. Mã quyền tổ chức `dieu-hanh-dau-gia` ───────────────────────────────
-- Backfill CẢ MANAGER lẫn AGENT (bài học 20260906100002). OWNER không cần dòng.
INSERT INTO public.org_role_permissions (role_id, module, action)
SELECT r.id, 'dieu-hanh-dau-gia', v.action
FROM public.org_roles r
JOIN (VALUES
  ('MANAGER', 'view'), ('MANAGER', 'operate'), ('MANAGER', 'finalize'),
  ('AGENT',   'view')
) AS v(code, action) ON v.code = r.code
ON CONFLICT (role_id, module, action) DO NOTHING;

-- Preset cho tổ chức tạo mới — chép nguyên bản 20260912000101, chỉ thêm dieu-hanh-dau-gia.
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
    ('MANAGER','dieu-hanh-dau-gia','view'),    ('MANAGER','dieu-hanh-dau-gia','operate'),
    ('MANAGER','dieu-hanh-dau-gia','finalize'),
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
    ('AGENT','dieu-hanh-dau-gia','view'),
    ('AGENT','hoi-dap','view'),                ('AGENT','hoi-dap','update'),
    ('AGENT','tin-dang','view'),               ('AGENT','tin-dang','create')
  ) AS v(code, module, action) ON v.code = r.code
  WHERE r.organization_id = _org_id
  ON CONFLICT (role_id, module, action) DO NOTHING;

  RETURN _owner_role_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.org_seed_default_roles(UUID) TO authenticated;

-- ─── 12. Kiểm chứng ─────────────────────────────────────────────────────────
DO $$
DECLARE
  v_leak TEXT;
BEGIN
  -- Hàm nội bộ + cron không được lọt cho vai thường.
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_leak
    FROM pg_proc p
   CROSS JOIN unnest(ARRAY['anon', 'authenticated']) AS r
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('lot_is_open', '_lot_lock', '_lot_event', '_bidding_ctx', '_bidding_ctx_clear',
                       '_close_lot', '_recompute_lot_leader', '_bidding_rpc_active', 'close_due_lots')
     AND has_function_privilege(r, p.oid, 'EXECUTE');
  IF v_leak IS NOT NULL THEN
    RAISE EXCEPTION 'Hàm nội bộ vẫn gọi được bởi vai thường: %', v_leak;
  END IF;

  -- Hàm ghi không được mở cho khách vãng lai.
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_leak
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('place_bid', 'withdraw_bid', 'org_open_lot', 'org_pause_lot', 'org_resume_lot',
                       'org_withdraw_lot', 'org_finalize_session', 'org_issue_minutes',
                       'org_confirm_winner_payment', 'org_mark_deposit_refunded')
     AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_leak IS NOT NULL THEN
    RAISE EXCEPTION 'Hàm ghi vẫn gọi được bởi anon: %', v_leak;
  END IF;

  IF (SELECT count(*) FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
         AND tablename IN ('auction_lot_states', 'auction_bids')) <> 2 THEN
    RAISE EXCEPTION 'Realtime chưa phát auction_lot_states + auction_bids';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'close_due_lots') THEN
    RAISE EXCEPTION 'Thiếu cron job close_due_lots';
  END IF;

  RAISE NOTICE 'OK: engine đấu giá trực tuyến sẵn sàng';
END $$;
