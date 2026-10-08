-- org_service_requests: trả thêm updated_at của yêu cầu.
--
-- Trang chi tiết "Yêu cầu ký gửi" của tổ chức dựng "Lịch sử thao tác" từ mốc
-- thời gian của yêu cầu; từ chối (declined) và "chủ tài sản chọn tổ chức khác"
-- (not_selected) không có cột thời điểm riêng — đó là lần đổi trạng thái cuối,
-- tức updated_at (trigger asr_updated_at). Đổi RETURNS TABLE ⇒ phải DROP trước.
-- Thân hàm chép từ bản LIVE (pg_get_functiondef), chỉ thêm một cột cuối.

DROP FUNCTION IF EXISTS public.org_service_requests(uuid);

CREATE FUNCTION public.org_service_requests(_auction_org_id uuid)
 RETURNS TABLE(id uuid, status text, origin text, message text, match_score numeric, created_at timestamp with time zone, seen_at timestamp with time zone, quoted_at timestamp with time zone, decline_reason text, quote_commission_pct numeric, quote_service_fee numeric, quote_starting_price numeric, quote_lead_time_days integer, quote_note text, quote_doc_path text, quote_plan jsonb, quote_fee_items jsonb, reopened_at timestamp with time zone, contract_id uuid, contract_code text, contract_status text, posting_id uuid, title text, parent_slug text, child_slug text, description text, province text, district text, pricing_mode text, starting_price numeric, auction_format text, commission_pct numeric, expected_timeline text, delta_fields jsonb, image_urls text[], has_dispute boolean, has_mortgage boolean, is_seized boolean, right_to_sell boolean, respond_by date, quote_valid_until date, posting_code text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
         r.reopened_at, c.id, c.code, c.status,
         p.id, p.title, p.parent_slug, p.child_slug, p.description,
         p.province, p.district,          -- KHÔNG trả address / ward
         p.pricing_mode, p.starting_price, p.auction_format,
         p.commission_pct, p.expected_timeline, p.delta_fields, p.image_urls,
         p.has_dispute, p.has_mortgage, p.is_seized, p.right_to_sell,
         r.respond_by, r.quote_valid_until, p.code, r.updated_at
    FROM public.asset_service_requests r
    JOIN public.asset_postings p ON p.id = r.asset_posting_id
    LEFT JOIN public.consignment_contracts c ON c.service_request_id = r.id
   WHERE r.auction_org_id = _auction_org_id
     AND r.status <> 'withdrawn'
   ORDER BY r.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.org_service_requests(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_service_requests(uuid) TO authenticated;
