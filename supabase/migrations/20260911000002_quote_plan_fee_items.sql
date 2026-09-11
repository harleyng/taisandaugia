-- Báo giá ký gửi: phương án tổ chức đấu giá + chi phí theo khoản mục
--
-- Trước migration này một báo giá chỉ có 4 con số rời (thù lao, phí dịch vụ, giá
-- khởi điểm, số ngày) + một ô ghi chú tự do. Chủ tài sản không so sánh được hai
-- tổ chức theo cùng một khung: cách tổ chức phiên nằm trong văn xuôi hoặc trong
-- tệp PDF đính kèm.
--
-- Hai cột JSONB chứ KHÔNG bảng con: báo giá đã được cố ý denormalize lên chính
-- dòng yêu cầu (một báo giá / tổ chức / hồ sơ, ghi đè nguyên khối cho tới khi
-- chủ tài sản chốt). Các dòng phí không bao giờ được truy vấn độc lập nên bảng
-- con chỉ thêm RLS + vòng đời xoá/ghi lại mà không đổi lấy được gì.
--
-- QUY TẮC QUAN TRỌNG — hai cột cũ trở thành GIÁ TRỊ DẪN XUẤT, tính ở server:
--   quote_service_fee    = tổng các khoản phí BẮT BUỘC trong quote_fee_items
--   quote_lead_time_days = mốc 'mo_phien' trong quote_plan.milestones
-- Tính ở đây chứ không ở client vì owner_select_service_quote lấy
-- quote_service_fee làm opportunities.gross_amount — con số CRM phải đúng bằng
-- con số chủ tài sản nhìn thấy. Nhờ vậy QuoteComparison, báo cáo doanh thu và
-- hoa hồng không phải sửa gì.

-- ─── 1. Hai cột mới ──────────────────────────────────────────────────────────

ALTER TABLE public.asset_service_requests
  ADD COLUMN IF NOT EXISTS quote_plan      JSONB,
  ADD COLUMN IF NOT EXISTS quote_fee_items JSONB;

COMMENT ON COLUMN public.asset_service_requests.quote_plan IS
  'Phương án tổ chức đấu giá: {auction_format, price_step, deposit_mode, deposit_value, venue, channels[], channels_other, milestones{}, scope_included[], scope_excluded[]}. Danh mục key ở src/constants/quote-plan.ts';
COMMENT ON COLUMN public.asset_service_requests.quote_fee_items IS
  'Các dòng chi phí: [{key, label, amount, optional}] — tổng khoản KHÔNG optional = quote_service_fee';

-- ─── 2. Hộp thư tổ chức: trả thêm hai cột ────────────────────────────────────
-- Đổi RETURNS TABLE nên bắt buộc DROP trước (CREATE OR REPLACE không đổi được
-- kiểu trả về). Phần còn lại giữ nguyên 20260906100001 — đặc biệt là việc CỐ Ý
-- không trả address / ward / giấy tờ sở hữu / danh tính chủ tài sản.

DROP FUNCTION IF EXISTS public.org_service_requests(UUID);

CREATE FUNCTION public.org_service_requests(_auction_org_id UUID)
RETURNS TABLE (
  id                   UUID,
  status               TEXT,
  origin               TEXT,
  message              TEXT,
  match_score          NUMERIC,
  created_at           TIMESTAMPTZ,
  seen_at              TIMESTAMPTZ,
  quoted_at            TIMESTAMPTZ,
  decline_reason       TEXT,
  quote_commission_pct NUMERIC,
  quote_service_fee    NUMERIC,
  quote_starting_price NUMERIC,
  quote_lead_time_days INTEGER,
  quote_note           TEXT,
  quote_doc_path       TEXT,
  quote_plan           JSONB,
  quote_fee_items      JSONB,
  posting_id           UUID,
  title                TEXT,
  parent_slug          TEXT,
  child_slug           TEXT,
  description          TEXT,
  province             TEXT,
  district             TEXT,
  pricing_mode         TEXT,
  starting_price       NUMERIC,
  auction_format       TEXT,
  commission_pct       NUMERIC,
  expected_timeline    TEXT,
  delta_fields         JSONB,
  image_urls           TEXT[],
  has_dispute          BOOLEAN,
  has_mortgage         BOOLEAN,
  is_seized            BOOLEAN,
  right_to_sell        BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.user_in_auction_org(_auction_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT r.id, r.status, r.origin, r.message, r.match_score, r.created_at,
         r.seen_at, r.quoted_at, r.decline_reason,
         r.quote_commission_pct, r.quote_service_fee, r.quote_starting_price,
         r.quote_lead_time_days, r.quote_note, r.quote_doc_path,
         r.quote_plan, r.quote_fee_items,
         p.id, p.title, p.parent_slug, p.child_slug, p.description,
         p.province, p.district,          -- KHÔNG trả address / ward
         p.pricing_mode, p.starting_price, p.auction_format,
         p.commission_pct, p.expected_timeline, p.delta_fields, p.image_urls,
         p.has_dispute, p.has_mortgage, p.is_seized, p.right_to_sell
    FROM public.asset_service_requests r
    JOIN public.asset_postings p ON p.id = r.asset_posting_id
   WHERE r.auction_org_id = _auction_org_id
     AND r.status <> 'withdrawn'
   ORDER BY r.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.org_service_requests(UUID) TO authenticated;

-- ─── 3. Tổ chức trả lời: ghi phương án + dòng phí ────────────────────────────
-- Giữ nguyên toàn bộ cổng quyền của 20260906100001; chỉ nhánh 'quote' đổi.

CREATE OR REPLACE FUNCTION public.org_respond_service_request(
  _request_id UUID,
  _action     TEXT,
  _quote      JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_req  public.asset_service_requests%ROWTYPE;
  v_org  UUID;
  v_fee  NUMERIC;
  v_lead INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Vui lòng đăng nhập' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _action NOT IN ('seen', 'quote', 'decline') THEN
    RAISE EXCEPTION 'invalid_action' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_req FROM public.asset_service_requests WHERE id = _request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy yêu cầu' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public.user_in_auction_org(v_req.auction_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id INTO v_org FROM public.organizations
   WHERE auction_org_id = v_req.auction_org_id AND kyc_status = 'APPROVED' LIMIT 1;

  IF _action <> 'seen' AND NOT public.org_has_permission(v_org, 'yeu-cau-ky-gui', 'update') THEN
    RAISE EXCEPTION 'Bạn không có quyền trả lời yêu cầu ký gửi'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Chủ tài sản đã chốt (hoặc thu hồi) thì tổ chức không lật ngược được nữa.
  IF v_req.status IN ('selected', 'not_selected', 'withdrawn') THEN
    RAISE EXCEPTION 'Yêu cầu đã kết thúc' USING ERRCODE = 'check_violation';
  END IF;

  IF _action = 'seen' THEN
    UPDATE public.asset_service_requests
       SET status = CASE WHEN status = 'sent' THEN 'seen' ELSE status END,
           seen_at = COALESCE(seen_at, now())
     WHERE id = _request_id;

  ELSIF _action = 'decline' THEN
    UPDATE public.asset_service_requests
       SET status = 'declined',
           decline_reason = NULLIF(_quote->>'decline_reason', ''),
           responded_by = auth.uid(),
           organization_id = v_org
     WHERE id = _request_id;

  ELSE -- quote (ghi đè được: tổ chức sửa lại báo giá trước khi chủ tài sản chốt)

    -- Phí dịch vụ = TỔNG các khoản BẮT BUỘC. Khoản optional là lựa chọn thêm
    -- của chủ tài sản nên không nằm trong con số đem đi so sánh / vào CRM.
    -- Công thức này được nhân bản ở src/lib/quotePlan.ts (feeTotalRequired) —
    -- sửa một bên phải sửa bên kia.
    v_fee := CASE
      WHEN jsonb_typeof(_quote->'fee_items') = 'array' THEN (
        SELECT COALESCE(SUM((i->>'amount')::numeric), 0)
          FROM jsonb_array_elements(_quote->'fee_items') i
         WHERE COALESCE((i->>'optional')::boolean, false) = false
      )
      ELSE (_quote->>'service_fee')::numeric   -- dòng cũ / seed chưa có fee_items
    END;

    -- Thời gian dự kiến là mốc 'mở phiên' trong phương án, không phải một ô rời:
    -- hai con số cạnh nhau sẽ lệch nhau ngay lần sửa đầu tiên.
    v_lead := COALESCE(
      NULLIF(_quote #>> '{plan,milestones,mo_phien}', '')::int,
      (_quote->>'lead_time_days')::int
    );

    UPDATE public.asset_service_requests
       SET status = 'quoted',
           quote_commission_pct = (_quote->>'commission_pct')::numeric,
           quote_service_fee    = v_fee,
           quote_starting_price = (_quote->>'starting_price')::numeric,
           quote_lead_time_days = v_lead,
           quote_plan           = CASE WHEN jsonb_typeof(_quote->'plan') = 'object'
                                       THEN _quote->'plan' END,
           quote_fee_items      = CASE WHEN jsonb_typeof(_quote->'fee_items') = 'array'
                                       THEN _quote->'fee_items' END,
           quote_note           = NULLIF(_quote->>'note', ''),
           quote_doc_path       = NULLIF(_quote->>'doc_path', ''),
           quoted_at            = now(),
           responded_by         = auth.uid(),
           organization_id      = v_org
     WHERE id = _request_id;

    UPDATE public.asset_broker_requests
       SET status = 'quoted'
     WHERE id = v_req.broker_request_id AND status IN ('pending', 'sourcing');
  END IF;

  RETURN jsonb_build_object('ok', true, 'action', _action);
END;
$$;

GRANT EXECUTE ON FUNCTION public.org_respond_service_request(UUID, TEXT, JSONB) TO authenticated;

-- ─── 4. Đếm cho badge "yêu cầu mới" ở sidebar ────────────────────────────────
-- Hàm đếm riêng thay vì tái dùng org_service_requests: sidebar render trên MỌI
-- trang portal, không nên kéo về cả projection hồ sơ + mảng ảnh cho một con số.

CREATE OR REPLACE FUNCTION public.org_service_request_counts(_auction_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.user_in_auction_org(_auction_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
             'new',    COUNT(*) FILTER (WHERE status = 'sent'),
             'quoted', COUNT(*) FILTER (WHERE status = 'quoted')
           )
      FROM public.asset_service_requests
     WHERE auction_org_id = _auction_org_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.org_service_request_counts(UUID) TO authenticated;
