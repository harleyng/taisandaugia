-- Ký gửi đấu giá (cổng chủ tài sản) — dữ liệu cho thiết kế "Ky Gui Dau Gia - Danh
-- sach & Chi tiet": mã hồ sơ, hạn phản hồi của tổ chức, hiệu lực báo giá, ngày
-- dự kiến có báo giá khi nhờ sàn, chuyên viên sàn phụ trách, thành tích tổ chức.
--
-- Tương thích ngược với frontend đang chạy (production đọc cùng DB): chỉ THÊM
-- cột có mặc định, thêm cột ở CUỐI kết quả org_service_requests, hiệu lực báo
-- giá không bắt buộc ở server (form bắt buộc — bản cũ không gửi trường này).

-- ─── 0. Ngày làm việc (bỏ thứ 7, CN; chưa tính lễ) ─────────────────────────────

CREATE OR REPLACE FUNCTION public.vn_today()
RETURNS date
LANGUAGE sql STABLE
AS $$ SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date $$;

CREATE OR REPLACE FUNCTION public.add_business_days(_from date, _days int)
RETURNS date
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  d date := _from;
  n int := 0;
BEGIN
  WHILE n < _days LOOP
    d := d + 1;
    IF extract(isodow FROM d) < 6 THEN n := n + 1; END IF;
  END LOOP;
  RETURN d;
END;
$$;

-- ─── 1. Mã hồ sơ HS-0001… (theo thứ tự tạo, bất biến) ─────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.asset_posting_code_seq;

CREATE OR REPLACE FUNCTION public.format_asset_posting_code(_n bigint)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$ SELECT 'HS-' || lpad(_n::text, greatest(4, length(_n::text)), '0') $$;

-- SECURITY DEFINER: người tạo hồ sơ (authenticated) không cần quyền USAGE trên sequence.
CREATE OR REPLACE FUNCTION public.next_asset_posting_code()
RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.format_asset_posting_code(nextval('public.asset_posting_code_seq')) $$;

ALTER TABLE public.asset_postings ADD COLUMN IF NOT EXISTS code text;

-- Backfill với trigger TẮT: review guard đẩy hồ sơ đã duyệt về 'pending' khi
-- caller không có quyền duyệt (migration = auth.uid() NULL), và set_updated_at
-- sẽ làm mọi hồ sơ "vừa cập nhật".
ALTER TABLE public.asset_postings DISABLE TRIGGER USER;
WITH o AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS n
    FROM public.asset_postings
   WHERE code IS NULL
)
UPDATE public.asset_postings p
   SET code = public.format_asset_posting_code(
                o.n + COALESCE((SELECT max(substring(code FROM 4)::bigint)
                                  FROM public.asset_postings
                                 WHERE code ~ '^HS-[0-9]+$'), 0))
  FROM o
 WHERE p.id = o.id;
ALTER TABLE public.asset_postings ENABLE TRIGGER USER;

SELECT setval(
  'public.asset_posting_code_seq',
  GREATEST(COALESCE((SELECT max(substring(code FROM 4)::bigint)
                       FROM public.asset_postings WHERE code ~ '^HS-[0-9]+$'), 0), 1),
  EXISTS (SELECT 1 FROM public.asset_postings WHERE code IS NOT NULL)
);

ALTER TABLE public.asset_postings ALTER COLUMN code SET DEFAULT public.next_asset_posting_code();
ALTER TABLE public.asset_postings ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS asset_postings_code_key ON public.asset_postings (code);

-- Bất biến: chạy TRƯỚC review guard (tên xếp trước theo alphabet) nên guard
-- không bao giờ thấy mã đổi.
CREATE OR REPLACE FUNCTION public.asset_postings_code_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.code := OLD.code;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS asset_postings_code_immutable ON public.asset_postings;
CREATE TRIGGER asset_postings_code_immutable
  BEFORE UPDATE OF code ON public.asset_postings
  FOR EACH ROW EXECUTE FUNCTION public.asset_postings_code_immutable();

-- ─── 2. Hạn phản hồi của tổ chức: 7 ngày kể từ khi gửi ───────────────────────

-- Cột thêm KHÔNG mặc định trước, backfill theo ngày gửi thật, rồi mới đặt mặc
-- định — chạy lại migration không ghi đè gì.
ALTER TABLE public.asset_service_requests
  ADD COLUMN IF NOT EXISTS respond_by date,
  ADD COLUMN IF NOT EXISTS quote_valid_until date;

-- Trigger tắt: asr_updated_at sẽ đẩy "Cập nhật" của mọi hồ sơ về hôm nay.
ALTER TABLE public.asset_service_requests DISABLE TRIGGER USER;
UPDATE public.asset_service_requests
   SET respond_by = (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 7
 WHERE respond_by IS NULL;
ALTER TABLE public.asset_service_requests ENABLE TRIGGER USER;

ALTER TABLE public.asset_service_requests ALTER COLUMN respond_by SET DEFAULT (public.vn_today() + 7);
ALTER TABLE public.asset_service_requests ALTER COLUMN respond_by SET NOT NULL;

COMMENT ON COLUMN public.asset_service_requests.respond_by IS
  'Hạn tổ chức phản hồi (báo giá / từ chối) — 7 ngày kể từ khi gửi, giờ Việt Nam.';
COMMENT ON COLUMN public.asset_service_requests.quote_valid_until IS
  'Báo giá có hiệu lực đến hết ngày này. Tổ chức nhập khi báo giá; NULL = báo giá cũ trước khi có trường này.';

-- ─── 3. Ngày dự kiến có báo giá khi nhờ sàn: 5 ngày làm việc ──────────────────

ALTER TABLE public.asset_broker_requests ADD COLUMN IF NOT EXISTS expected_quote_by date;

ALTER TABLE public.asset_broker_requests DISABLE TRIGGER USER;
UPDATE public.asset_broker_requests
   SET expected_quote_by = public.add_business_days((created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 5)
 WHERE expected_quote_by IS NULL;
ALTER TABLE public.asset_broker_requests ENABLE TRIGGER USER;

ALTER TABLE public.asset_broker_requests
  ALTER COLUMN expected_quote_by SET DEFAULT public.add_business_days(public.vn_today(), 5);

COMMENT ON COLUMN public.asset_broker_requests.expected_quote_by IS
  'Ngày sàn dự kiến có báo giá đầu tiên — mặc định 5 ngày làm việc, admin sửa được.';

-- ─── 4. Báo giá lưu hiệu lực ─────────────────────────────────────────────────
-- Thân hàm lấy từ bản đang chạy (pg_get_functiondef), chỉ thêm quote_valid_until.

CREATE OR REPLACE FUNCTION public.org_respond_service_request(_request_id uuid, _action text, _quote jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  PERFORM public.lock_asset_posting_consignment(v_req.asset_posting_id);
  SELECT * INTO v_req FROM public.asset_service_requests WHERE id = _request_id FOR UPDATE;

  IF v_req.status IN ('selected', 'not_selected', 'withdrawn', 'contract_cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'request_closed');
  END IF;

  IF _action = 'quote' AND public.asset_posting_selection_locked(v_req.asset_posting_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'posting_already_selected');
  END IF;

  -- Hiệu lực đã qua thì báo giá chết ngay khi gửi.
  IF _action = 'quote'
     AND NULLIF(_quote->>'valid_until', '') IS NOT NULL
     AND (_quote->>'valid_until')::date < public.vn_today() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quote_validity_past');
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

  ELSE
    -- Công thức nhân bản ở src/lib/quotePlan.ts (feeTotalRequired).
    v_fee := CASE
      WHEN jsonb_typeof(_quote->'fee_items') = 'array' THEN (
        SELECT COALESCE(SUM((i->>'amount')::numeric), 0)
          FROM jsonb_array_elements(_quote->'fee_items') i
         WHERE COALESCE((i->>'optional')::boolean, false) = false
      )
      ELSE (_quote->>'service_fee')::numeric
    END;

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
           quote_valid_until    = NULLIF(_quote->>'valid_until', '')::date,
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
$function$;

-- ─── 5. Hộp thư tổ chức: thêm hạn phản hồi + hiệu lực (cột ở CUỐI) ───────────
-- Đổi RETURNS TABLE ⇒ phải DROP. Thân lấy từ bản đang chạy.

DROP FUNCTION IF EXISTS public.org_service_requests(uuid);
CREATE FUNCTION public.org_service_requests(_auction_org_id uuid)
 RETURNS TABLE(id uuid, status text, origin text, message text, match_score numeric, created_at timestamp with time zone, seen_at timestamp with time zone, quoted_at timestamp with time zone, decline_reason text, quote_commission_pct numeric, quote_service_fee numeric, quote_starting_price numeric, quote_lead_time_days integer, quote_note text, quote_doc_path text, quote_plan jsonb, quote_fee_items jsonb, reopened_at timestamp with time zone, contract_id uuid, contract_code text, contract_status text, posting_id uuid, title text, parent_slug text, child_slug text, description text, province text, district text, pricing_mode text, starting_price numeric, auction_format text, commission_pct numeric, expected_timeline text, delta_fields jsonb, image_urls text[], has_dispute boolean, has_mortgage boolean, is_seized boolean, right_to_sell boolean, respond_by date, quote_valid_until date, posting_code text)
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
         r.respond_by, r.quote_valid_until, p.code
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

-- ─── 6. Chuyên viên sàn phụ trách yêu cầu "nhờ sàn" ──────────────────────────
-- Chủ tài sản không đọc được profiles của admin ⇒ chỉ trả TÊN, và chỉ cho người
-- đọc được hồ sơ. assigned_admin_id được gán khi admin gửi hồ sơ đi.

CREATE OR REPLACE FUNCTION public.owner_broker_assignee(_posting_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(btrim(pr.name), '')
    FROM public.asset_broker_requests b
    JOIN public.profiles pr ON pr.id = b.assigned_admin_id
   WHERE b.asset_posting_id = _posting_id
     AND b.status <> 'cancelled'
     AND public.owner_posting_can(_posting_id, 'read')
   ORDER BY b.created_at DESC
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.owner_broker_assignee(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_broker_assignee(uuid) TO authenticated;

-- ─── 7. Thành tích tổ chức (số tài sản đưa ra đấu giá · tỷ lệ thành công) ────
-- CÙNG luật với tab "Tài sản" của trang tổ chức (CompanyListingsTab): tin
-- ACTIVE/SOLD_RENTED; thành công = SOLD_RENTED hoặc win_price là số khác 0
-- (caNumber: bỏ ký tự ngoài [0-9.-] rồi Number()). INVOKER — đọc đúng những
-- tin trang công khai đọc được.

CREATE OR REPLACE FUNCTION public.auction_org_track_records(_org_ids uuid[])
RETURNS TABLE(auction_org_id uuid, total integer, successful integer)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH l AS (
    SELECT l.auction_org_id, l.status,
           l.custom_attributes->'win_price' AS wp,
           regexp_replace(l.custom_attributes->>'win_price', '[^0-9.-]', '', 'g') AS wp_s
      FROM public.listings l
     WHERE l.auction_org_id = ANY(_org_ids)
       AND l.status IN ('ACTIVE', 'SOLD_RENTED')
  )
  SELECT l.auction_org_id,
         count(*)::int,
         count(*) FILTER (
           WHERE l.status = 'SOLD_RENTED'
              OR (jsonb_typeof(l.wp) = 'number' AND (l.wp #>> '{}')::numeric <> 0)
              OR (jsonb_typeof(l.wp) = 'string'
                  AND l.wp_s ~ '^-?([0-9]+\.?[0-9]*|\.[0-9]+)$'
                  AND l.wp_s::numeric <> 0)
         )::int
    FROM l
   GROUP BY l.auction_org_id
$$;
GRANT EXECUTE ON FUNCTION public.auction_org_track_records(uuid[]) TO anon, authenticated;
