-- Phiên đấu giá: tổ chức đấu giá gom nhiều tài sản vào một phiên và tự công bố ra sàn.
--
-- TRƯỚC ĐÂY "phiên" không phải thực thể — chỉ là một dòng `listings` với mốc thời
-- gian nằm trong custom_attributes. Bảng này KHÔNG thay thế cách cũ (listings +
-- sessionStatusOf vẫn giữ nguyên), nó là lối ghi đầu tiên của tổ chức.
--
-- HAI KHÁI NIỆM TRẠNG THÁI, ĐỪNG TRỘN:
--   • auction_sessions.status  = vòng đời CÔNG BỐ: draft → published → cancelled.
--   • giai đoạn phiên (đang bán hồ sơ / sắp diễn ra / đang diễn ra / đã kết thúc)
--     = SUY DIỄN từ mốc thời gian ở client (src/lib/auctionSessions/phase.ts),
--     KHÔNG lưu cột, KHÔNG có bản SQL.
--
-- VÌ SAO LÔ TÀI SẢN CHỤP ẢNH (snapshot) TRƯỜNG HIỂN THỊ:
--   Tổ chức không đọc được asset_postings (RLS owner-only) — chỉ thấy bản chiếu
--   org_service_requests() đã giấu danh tính chủ / số nhà / giấy tờ. Trang công
--   khai vì vậy đọc snapshot, không JOIN sang nguồn. FK nguồn là SET NULL: tin bị
--   xoá hay chủ tài sản xoá hồ sơ thì lô đã công bố vẫn còn.
--
-- RLS lọc DÒNG, không giấu CỘT ⇒ mọi cột của 2 bảng này phải an toàn khi công
-- khai. ĐỪNG thêm cột ghi chú nội bộ vào đây.
--
-- KHÔNG ghi gì vào asset_postings (guard duyệt nuốt thay đổi của mọi caller).

-- ─── 1. Bảng phiên ──────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.auction_session_code_seq START 1;

CREATE TABLE IF NOT EXISTS public.auction_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Cầu sang danh bạ công khai. Trigger tự điền từ organizations.auction_org_id.
  auction_org_id        UUID REFERENCES public.auction_organizations(id) ON DELETE SET NULL,
  code                  TEXT UNIQUE,
  title                 TEXT NOT NULL CHECK (length(btrim(title)) >= 3),
  description           TEXT,
  auction_format        TEXT NOT NULL DEFAULT 'truc_tiep'
                          CHECK (auction_format IN ('truc_tiep', 'truc_tuyen', 'ca_hai')),
  venue                 TEXT,
  province              TEXT,
  registration_start_at TIMESTAMPTZ,
  registration_end_at   TIMESTAMPTZ,
  viewing_start_at      TIMESTAMPTZ,
  viewing_end_at        TIMESTAMPTZ,
  starts_at             TIMESTAMPTZ NOT NULL,
  ends_at               TIMESTAMPTZ NOT NULL,
  -- "Số người đăng ký tối đa" do tổ chức khai. Chưa có bảng đăng ký ⇒ đây chỉ là
  -- trần, KHÔNG có số đếm đi kèm.
  max_registrants       INT CHECK (max_registrants IS NULL OR max_registrants > 0),
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'published', 'cancelled')),
  published_at          TIMESTAMPTZ,
  cancelled_reason      TEXT,
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT auction_sessions_ends_after_start CHECK (ends_at > starts_at),
  CONSTRAINT auction_sessions_registration_before_start
    CHECK (registration_end_at IS NULL OR registration_end_at <= starts_at),
  CONSTRAINT auction_sessions_registration_order
    CHECK (registration_start_at IS NULL OR registration_end_at IS NULL
           OR registration_start_at <= registration_end_at),
  CONSTRAINT auction_sessions_viewing_order
    CHECK (viewing_start_at IS NULL OR viewing_end_at IS NULL OR viewing_start_at <= viewing_end_at),
  CONSTRAINT auction_sessions_cancel_reason
    CHECK (status <> 'cancelled' OR length(btrim(COALESCE(cancelled_reason, ''))) > 0)
);

CREATE INDEX IF NOT EXISTS idx_auction_sessions_org
  ON public.auction_sessions (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_sessions_auction_org
  ON public.auction_sessions (auction_org_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_auction_sessions_public
  ON public.auction_sessions (status, ends_at);

-- ─── 2. Bảng lô tài sản (đa hình: tin công khai | ký gửi đã trúng) ──────────
CREATE TABLE IF NOT EXISTS public.auction_session_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL REFERENCES public.auction_sessions(id) ON DELETE CASCADE,
  -- DEFAULT 0 chỉ để client khỏi gửi: trigger LUÔN gán max+1 lúc INSERT.
  lot_no             INT NOT NULL DEFAULT 0 CHECK (lot_no > 0),
  source             TEXT NOT NULL CHECK (source IN ('listing', 'posting')),
  listing_id         UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  asset_posting_id   UUID REFERENCES public.asset_postings(id) ON DELETE SET NULL,
  -- Bằng chứng tổ chức đã thắng báo giá. Trigger tự điền, client không gửi.
  service_request_id UUID REFERENCES public.asset_service_requests(id) ON DELETE SET NULL,

  -- Snapshot — toàn bộ đều công khai được.
  title              TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  category_slug      TEXT,
  province           TEXT,
  district           TEXT,
  image_url          TEXT,
  starting_price     NUMERIC(18,0) CHECK (starting_price IS NULL OR starting_price >= 0),
  deposit_amount     NUMERIC(18,0) CHECK (deposit_amount IS NULL OR deposit_amount >= 0),
  bid_step           NUMERIC(18,0) CHECK (bid_step IS NULL OR bid_step >= 0),
  max_registrants    INT CHECK (max_registrants IS NULL OR max_registrants > 0),

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- FK nguồn có thể về NULL (nguồn bị xoá) nhưng không bao giờ lệch `source`.
  CONSTRAINT auction_session_items_one_source CHECK (
    (source = 'listing' AND asset_posting_id IS NULL AND service_request_id IS NULL)
    OR (source = 'posting' AND listing_id IS NULL)
  ),
  -- DEFERRABLE: đánh lại số lô sau khi xoá là MỘT câu UPDATE dịch cả dải — bản
  -- non-deferrable sẽ đụng trùng giữa chừng tuỳ thứ tự dòng.
  CONSTRAINT auction_session_items_lot_uq UNIQUE (session_id, lot_no) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_auction_session_items_listing
  ON public.auction_session_items (session_id, listing_id) WHERE listing_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_auction_session_items_posting
  ON public.auction_session_items (session_id, asset_posting_id) WHERE asset_posting_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auction_session_items_listing
  ON public.auction_session_items (listing_id) WHERE listing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auction_session_items_posting
  ON public.auction_session_items (asset_posting_id) WHERE asset_posting_id IS NOT NULL;

-- ─── 3. Helper nội bộ ───────────────────────────────────────────────────────
-- Mã phiên đang giữ tài sản này ở trạng thái đã công bố (chưa kết thúc), NULL nếu
-- không có. Dùng chung cho thêm lô vào phiên đã công bố và cổng công bố.
CREATE OR REPLACE FUNCTION public.auction_session_asset_conflict(
  _session_id UUID, _listing_id UUID, _posting_id UUID
) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.code
    FROM public.auction_session_items i
    JOIN public.auction_sessions s ON s.id = i.session_id
   WHERE s.id <> _session_id
     AND s.status = 'published'
     AND s.ends_at >= now()
     AND (   (_listing_id IS NOT NULL AND i.listing_id = _listing_id)
          OR (_posting_id IS NOT NULL AND i.asset_posting_id = _posting_id))
   LIMIT 1
$$;
-- Chỉ trigger gọi. PostgREST phơi mọi hàm mà authenticated EXECUTE được.
REVOKE EXECUTE ON FUNCTION public.auction_session_asset_conflict(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- ─── 4. Trigger phiên ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auction_sessions_fill()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Phiên luôn sinh ra ở dạng nháp; công bố đi qua cổng ở auction_sessions_guard.
  IF NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'Phiên mới phải ở trạng thái nháp.' USING ERRCODE = 'check_violation';
  END IF;

  -- Luôn lấy từ tổ chức, bỏ qua giá trị client gửi: đây là thứ quyết định phiên
  -- hiện trên trang tổ chức nào.
  SELECT o.auction_org_id INTO NEW.auction_org_id
    FROM public.organizations o WHERE o.id = NEW.organization_id;

  NEW.code         := 'PDG' || lpad(nextval('public.auction_session_code_seq')::text, 6, '0');
  NEW.created_by   := COALESCE(auth.uid(), NEW.created_by);
  NEW.published_at := NULL;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS auction_sessions_fill ON public.auction_sessions;
CREATE TRIGGER auction_sessions_fill
  BEFORE INSERT ON public.auction_sessions
  FOR EACH ROW EXECUTE FUNCTION public.auction_sessions_fill();

CREATE OR REPLACE FUNCTION public.auction_sessions_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_kyc      TEXT;
  v_conflict RECORD;
BEGIN
  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'Phiên đã huỷ — không thể chỉnh sửa.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.organization_id <> OLD.organization_id THEN
    RAISE EXCEPTION 'Không thể chuyển phiên sang tổ chức khác.' USING ERRCODE = 'check_violation';
  END IF;

  -- Cột do server quản lý: client không gửi, giữ nguyên.
  NEW.code           := OLD.code;
  NEW.created_by     := OLD.created_by;
  NEW.auction_org_id := COALESCE(OLD.auction_org_id, NEW.auction_org_id);

  IF NEW.status = OLD.status THEN
    NEW.published_at := OLD.published_at;
    RETURN NEW;
  END IF;

  IF OLD.status = 'draft' AND NEW.status = 'published' THEN
    IF NOT EXISTS (SELECT 1 FROM public.auction_session_items WHERE session_id = NEW.id) THEN
      RAISE EXCEPTION 'Phiên cần ít nhất 1 tài sản trước khi công bố.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.starts_at <= now() THEN
      RAISE EXCEPTION 'Thời gian đấu giá phải ở tương lai mới công bố được.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.auction_org_id IS NULL THEN
      RAISE EXCEPTION 'Tổ chức chưa liên kết với danh bạ tổ chức đấu giá.' USING ERRCODE = 'check_violation';
    END IF;
    SELECT o.kyc_status::text INTO v_kyc FROM public.organizations o WHERE o.id = NEW.organization_id;
    IF v_kyc IS DISTINCT FROM 'APPROVED' THEN
      RAISE EXCEPTION 'Tổ chức chưa được duyệt KYC nên chưa công bố được phiên.' USING ERRCODE = 'check_violation';
    END IF;

    SELECT i.title, public.auction_session_asset_conflict(NEW.id, i.listing_id, i.asset_posting_id) AS code
      INTO v_conflict
      FROM public.auction_session_items i
     WHERE i.session_id = NEW.id
       AND public.auction_session_asset_conflict(NEW.id, i.listing_id, i.asset_posting_id) IS NOT NULL
     LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'Tài sản "%" đang nằm trong phiên % đã công bố.', v_conflict.title, v_conflict.code
        USING ERRCODE = 'check_violation';
    END IF;

    NEW.published_at := now();
    RETURN NEW;
  END IF;

  IF OLD.status = 'published' AND NEW.status = 'cancelled' THEN
    RETURN NEW;  -- lý do bắt buộc đã do CHECK auction_sessions_cancel_reason lo
  END IF;

  RAISE EXCEPTION 'Không thể chuyển phiên từ "%" sang "%".', OLD.status, NEW.status
    USING ERRCODE = 'check_violation';
END; $$;

DROP TRIGGER IF EXISTS auction_sessions_guard ON public.auction_sessions;
CREATE TRIGGER auction_sessions_guard
  BEFORE UPDATE ON public.auction_sessions
  FOR EACH ROW EXECUTE FUNCTION public.auction_sessions_guard();

DROP TRIGGER IF EXISTS auction_sessions_updated_at ON public.auction_sessions;
CREATE TRIGGER auction_sessions_updated_at
  BEFORE UPDATE ON public.auction_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 5. Trigger lô tài sản ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auction_session_items_validate()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s          RECORD;
  v_org      UUID;
  v_status   TEXT;
  v_req      UUID;
  v_conflict TEXT;
BEGIN
  SELECT id, status, auction_org_id INTO s
    FROM public.auction_sessions WHERE id = NEW.session_id;
  IF s.id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy phiên đấu giá.' USING ERRCODE = 'no_data_found';
  END IF;
  IF s.status = 'cancelled' THEN
    RAISE EXCEPTION 'Phiên đã huỷ — không thể thay đổi danh sách tài sản.' USING ERRCODE = 'check_violation';
  END IF;
  IF s.auction_org_id IS NULL THEN
    RAISE EXCEPTION 'Tổ chức chưa liên kết với danh bạ tổ chức đấu giá.' USING ERRCODE = 'check_violation';
  END IF;

  -- Số lô do server cấp, bỏ qua giá trị client gửi.
  SELECT COALESCE(max(lot_no), 0) + 1 INTO NEW.lot_no
    FROM public.auction_session_items WHERE session_id = NEW.session_id;

  IF NEW.source = 'listing' THEN
    IF NEW.listing_id IS NULL THEN
      RAISE EXCEPTION 'Thiếu tin đấu giá nguồn.' USING ERRCODE = 'check_violation';
    END IF;
    SELECT l.auction_org_id, l.status::text INTO v_org, v_status
      FROM public.listings l WHERE l.id = NEW.listing_id;
    IF v_org IS DISTINCT FROM s.auction_org_id THEN
      RAISE EXCEPTION 'Tin này không thuộc tổ chức của bạn.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF v_status IS DISTINCT FROM 'ACTIVE' THEN
      RAISE EXCEPTION 'Chỉ đưa được tin đang hoạt động vào phiên.' USING ERRCODE = 'check_violation';
    END IF;
    NEW.service_request_id := NULL;
  ELSE
    IF NEW.asset_posting_id IS NULL THEN
      RAISE EXCEPTION 'Thiếu hồ sơ tài sản ký gửi nguồn.' USING ERRCODE = 'check_violation';
    END IF;
    SELECT r.id INTO v_req
      FROM public.asset_service_requests r
     WHERE r.asset_posting_id = NEW.asset_posting_id
       AND r.auction_org_id   = s.auction_org_id
       AND r.status           = 'selected'
     LIMIT 1;
    IF v_req IS NULL THEN
      RAISE EXCEPTION 'Chỉ đưa được tài sản ký gửi mà chủ tài sản đã chọn tổ chức của bạn.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    NEW.service_request_id := v_req;
  END IF;

  IF s.status = 'published' THEN
    v_conflict := public.auction_session_asset_conflict(NEW.session_id, NEW.listing_id, NEW.asset_posting_id);
    IF v_conflict IS NOT NULL THEN
      RAISE EXCEPTION 'Tài sản này đang nằm trong phiên % đã công bố.', v_conflict
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS auction_session_items_validate ON public.auction_session_items;
CREATE TRIGGER auction_session_items_validate
  BEFORE INSERT ON public.auction_session_items
  FOR EACH ROW EXECUTE FUNCTION public.auction_session_items_validate();

CREATE OR REPLACE FUNCTION public.auction_session_items_guard_update()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- pg_trigger_depth() > 1 = UPDATE do HỆ THỐNG sinh ra: FK nguồn về NULL khi tin /
  -- hồ sơ bị xoá (ON DELETE SET NULL chạy như trigger), hoặc đánh lại số lô sau
  -- khi xoá. Không được chặn những cái đó, kể cả trên phiên đã huỷ.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.auction_sessions WHERE id = OLD.session_id AND status = 'cancelled') THEN
    RAISE EXCEPTION 'Phiên đã huỷ — không thể thay đổi danh sách tài sản.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.session_id <> OLD.session_id
     OR NEW.source <> OLD.source
     OR NEW.listing_id IS DISTINCT FROM OLD.listing_id
     OR NEW.asset_posting_id IS DISTINCT FROM OLD.asset_posting_id
     OR NEW.service_request_id IS DISTINCT FROM OLD.service_request_id THEN
    RAISE EXCEPTION 'Không thể đổi tài sản nguồn của lô — hãy xoá lô và thêm lại.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS auction_session_items_guard_update ON public.auction_session_items;
CREATE TRIGGER auction_session_items_guard_update
  BEFORE UPDATE ON public.auction_session_items
  FOR EACH ROW EXECUTE FUNCTION public.auction_session_items_guard_update();

DROP TRIGGER IF EXISTS auction_session_items_updated_at ON public.auction_session_items;
CREATE TRIGGER auction_session_items_updated_at
  BEFORE UPDATE ON public.auction_session_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.auction_session_items_guard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_status TEXT;
BEGIN
  -- Xoá dây chuyền từ phiên cha: dòng cha đã biến mất ⇒ v_status NULL ⇒ cho qua.
  SELECT status INTO v_status FROM public.auction_sessions WHERE id = OLD.session_id;
  IF v_status = 'cancelled' THEN
    RAISE EXCEPTION 'Phiên đã huỷ — không thể thay đổi danh sách tài sản.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_status = 'published'
     AND NOT EXISTS (SELECT 1 FROM public.auction_session_items
                      WHERE session_id = OLD.session_id AND id <> OLD.id) THEN
    RAISE EXCEPTION 'Phiên đã công bố phải còn ít nhất 1 tài sản.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS auction_session_items_guard_delete ON public.auction_session_items;
CREATE TRIGGER auction_session_items_guard_delete
  BEFORE DELETE ON public.auction_session_items
  FOR EACH ROW EXECUTE FUNCTION public.auction_session_items_guard_delete();

CREATE OR REPLACE FUNCTION public.auction_session_items_renumber()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.auction_sessions WHERE id = OLD.session_id) THEN
    UPDATE public.auction_session_items
       SET lot_no = lot_no - 1
     WHERE session_id = OLD.session_id AND lot_no > OLD.lot_no;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS auction_session_items_renumber ON public.auction_session_items;
CREATE TRIGGER auction_session_items_renumber
  AFTER DELETE ON public.auction_session_items
  FOR EACH ROW EXECUTE FUNCTION public.auction_session_items_renumber();

-- ─── 6. RLS ─────────────────────────────────────────────────────────────────
-- Khuôn 20260805000030_org_auctioneers.sql. Chủ sở hữu (owner_id) là lưới an toàn
-- cho tổ chức cũ chưa có membership.
CREATE OR REPLACE FUNCTION public.can_manage_auction_sessions(_org_id UUID, _action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.org_has_permission(_org_id, 'phien-dau-gia', _action)
      OR EXISTS (SELECT 1 FROM public.organizations o
                  WHERE o.id = _org_id AND o.owner_id = auth.uid())
$$;

-- Quyền trên lô đi qua phiên cha. SECURITY DEFINER để không phụ thuộc RLS của
-- auction_sessions khi đánh giá policy.
CREATE OR REPLACE FUNCTION public.can_manage_auction_session_items(_session_id UUID, _action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auction_sessions s
     WHERE s.id = _session_id
       AND public.can_manage_auction_sessions(s.organization_id, _action)
  )
$$;

CREATE OR REPLACE FUNCTION public.auction_session_is_public(_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auction_sessions s
     WHERE s.id = _session_id AND s.status IN ('published', 'cancelled')
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_auction_sessions(UUID, TEXT)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_auction_session_items(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auction_session_is_public(UUID)              TO anon, authenticated;

ALTER TABLE public.auction_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auction_sessions_public_read" ON public.auction_sessions;
-- Phiên đã huỷ vẫn công khai (kèm lý do) để link đã chia sẻ không chết.
CREATE POLICY "auction_sessions_public_read" ON public.auction_sessions
  FOR SELECT TO anon, authenticated
  USING (status IN ('published', 'cancelled'));

DROP POLICY IF EXISTS "auction_sessions_select" ON public.auction_sessions;
CREATE POLICY "auction_sessions_select" ON public.auction_sessions
  FOR SELECT TO authenticated
  USING (public.can_manage_auction_sessions(organization_id, 'view'));

DROP POLICY IF EXISTS "auction_sessions_insert" ON public.auction_sessions;
CREATE POLICY "auction_sessions_insert" ON public.auction_sessions
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_auction_sessions(organization_id, 'create') AND status = 'draft');

DROP POLICY IF EXISTS "auction_sessions_update" ON public.auction_sessions;
CREATE POLICY "auction_sessions_update" ON public.auction_sessions
  FOR UPDATE TO authenticated
  USING      (public.can_manage_auction_sessions(organization_id, 'update'))
  WITH CHECK (public.can_manage_auction_sessions(organization_id, 'update'));

-- Chỉ xoá được nháp. Phiên đã công bố thì huỷ (để lại dấu vết + lý do).
DROP POLICY IF EXISTS "auction_sessions_delete" ON public.auction_sessions;
CREATE POLICY "auction_sessions_delete" ON public.auction_sessions
  FOR DELETE TO authenticated
  USING (public.can_manage_auction_sessions(organization_id, 'delete') AND status = 'draft');

DROP POLICY IF EXISTS "auction_sessions_admin_all" ON public.auction_sessions;
CREATE POLICY "auction_sessions_admin_all" ON public.auction_sessions
  FOR ALL
  USING      (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

ALTER TABLE public.auction_session_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auction_session_items_public_read" ON public.auction_session_items;
CREATE POLICY "auction_session_items_public_read" ON public.auction_session_items
  FOR SELECT TO anon, authenticated
  USING (public.auction_session_is_public(session_id));

DROP POLICY IF EXISTS "auction_session_items_select" ON public.auction_session_items;
CREATE POLICY "auction_session_items_select" ON public.auction_session_items
  FOR SELECT TO authenticated
  USING (public.can_manage_auction_session_items(session_id, 'view'));

-- Thêm / sửa / xoá lô = SỬA phiên ⇒ cả ba cần action 'update'.
DROP POLICY IF EXISTS "auction_session_items_insert" ON public.auction_session_items;
CREATE POLICY "auction_session_items_insert" ON public.auction_session_items
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_auction_session_items(session_id, 'update'));

DROP POLICY IF EXISTS "auction_session_items_update" ON public.auction_session_items;
CREATE POLICY "auction_session_items_update" ON public.auction_session_items
  FOR UPDATE TO authenticated
  USING      (public.can_manage_auction_session_items(session_id, 'update'))
  WITH CHECK (public.can_manage_auction_session_items(session_id, 'update'));

DROP POLICY IF EXISTS "auction_session_items_delete" ON public.auction_session_items;
CREATE POLICY "auction_session_items_delete" ON public.auction_session_items
  FOR DELETE TO authenticated
  USING (public.can_manage_auction_session_items(session_id, 'update'));

DROP POLICY IF EXISTS "auction_session_items_admin_all" ON public.auction_session_items;
CREATE POLICY "auction_session_items_admin_all" ON public.auction_session_items
  FOR ALL
  USING      (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ─── 7. Mã quyền tổ chức `phien-dau-gia` ────────────────────────────────────
-- Backfill CẢ MANAGER lẫn AGENT đang có (bài học 20260906100002: chỉ backfill
-- MANAGER thì tổ chức cũ và mới ra hai hành vi). OWNER không cần dòng nào.
INSERT INTO public.org_role_permissions (role_id, module, action)
SELECT r.id, 'phien-dau-gia', v.action
FROM public.org_roles r
JOIN (VALUES
  ('MANAGER', 'view'), ('MANAGER', 'create'), ('MANAGER', 'update'), ('MANAGER', 'delete'),
  ('AGENT',   'view')
) AS v(code, action) ON v.code = r.code
ON CONFLICT (role_id, module, action) DO NOTHING;

-- Preset cho tổ chức tạo mới — chép từ bản mới nhất ở 20260906100001, chỉ thêm
-- các dòng phien-dau-gia.
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
    ('AGENT','tin-dang','view'),               ('AGENT','tin-dang','create')
  ) AS v(code, module, action) ON v.code = r.code
  WHERE r.organization_id = _org_id
  ON CONFLICT (role_id, module, action) DO NOTHING;

  RETURN _owner_role_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.org_seed_default_roles(UUID) TO authenticated;
