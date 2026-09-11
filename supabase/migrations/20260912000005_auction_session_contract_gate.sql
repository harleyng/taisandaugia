-- Phiên đấu giá: tài sản ký gửi chỉ vào phiên khi hợp đồng dịch vụ ĐÃ KÝ
--
-- Tổ chức không được đấu giá tài sản khi chưa có hợp đồng dịch vụ đấu giá với
-- người có tài sản. Trước đây chỉ cần chủ tài sản "đã chọn" tổ chức.
-- Hai chỗ chặn:
--   • auction_session_items_validate (INSERT lô) — chép pg_get_functiondef() đang
--     chạy, chỉ đổi nhánh posting.
--   • auction_sessions_guard (draft → published) — trigger lô chỉ chạy lúc INSERT,
--     nên phiên nháp đã có lô từ trước khi có cổng này vẫn phải bị chặn lúc công bố.

CREATE OR REPLACE FUNCTION public.auction_session_items_validate()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s          RECORD;
  v_org      UUID;
  v_status   TEXT;
  v_req      UUID;
  v_contract TEXT;
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
    SELECT r.id, c.status INTO v_req, v_contract
      FROM public.asset_service_requests r
      LEFT JOIN public.consignment_contracts c ON c.service_request_id = r.id
     WHERE r.asset_posting_id = NEW.asset_posting_id
       AND r.auction_org_id   = s.auction_org_id
       AND r.status           = 'selected'
     LIMIT 1;
    IF v_req IS NULL THEN
      RAISE EXCEPTION 'Chỉ đưa được tài sản ký gửi mà chủ tài sản đã chọn tổ chức của bạn.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF v_contract IS DISTINCT FROM 'signed' THEN
      RAISE EXCEPTION 'Hợp đồng dịch vụ với chủ tài sản chưa được hai bên xác nhận ký — chưa đưa tài sản này vào phiên được.'
        USING ERRCODE = 'check_violation';
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

CREATE OR REPLACE FUNCTION public.auction_sessions_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_kyc      TEXT;
  v_conflict RECORD;
  v_unsigned TEXT;
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

    SELECT i.title INTO v_unsigned
      FROM public.auction_session_items i
      LEFT JOIN public.consignment_contracts c ON c.service_request_id = i.service_request_id
     WHERE i.session_id = NEW.id
       AND i.source = 'posting'
       AND c.status IS DISTINCT FROM 'signed'
     LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'Tài sản ký gửi "%" chưa ký hợp đồng dịch vụ với chủ tài sản — chưa công bố được phiên.', v_unsigned
        USING ERRCODE = 'check_violation';
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
