-- Giá trúng hợp nhất — Phase 5 của docs/owner-control-tower-plan.md (mục A3).
--
-- Trước đây cổng chủ tài sản chỉ đọc giá trúng từ listings.custom_attributes
-- (dữ liệu cào, gần như trống) ⇒ "Tỷ lệ thành công" bỏ sót kết quả ĐÃ CÓ trong DB:
-- phiên trên sàn (auction_lot_states) và báo cáo của tổ chức đấu giá
-- (org_auction_records). Hàm này là nơi DUY NHẤT gộp các nguồn; frontend không
-- tự gộp.
--
-- Nguồn (hạng nhỏ thắng; hoà ⇒ ngày mới hơn thắng):
--   1 platform      "Sàn xác nhận"  lô mới nhất trên sàn của tin (phiên published/cancelled)
--   2 reconciled    (Phase 6)        tự khai của chủ khớp báo cáo tổ chức ≤ 1%
--   3 owner_evidence(Phase 6)        chủ tự khai có biên bản
--   4 self_reported "Tự khai"       org_auction_records (source CRAWLED ⇒ hạ xuống 5)
--   5 estimated     "Ước tính"      tin cào: winning_price/win_price hoặc status SOLD_RENTED
--
-- Kết quả/giá/ngày/tình trạng thanh toán lấy TRỌN từ một ứng viên thắng — con số
-- luôn mang nhãn của chính nguồn sinh ra nó, nguồn hạng thấp không "vá" giá.
--
-- has_conflict: một ứng viên khác cùng lượt đấu (ngày lệch ≤ 7 ngày, hoặc thiếu
-- ngày) nhưng khác kết quả, hoặc cùng "sold" mà giá lệch > 1%. Khác lượt (vd.
-- lượt 1 không thành, lượt 2 bán được) KHÔNG phải mâu thuẫn.
--
-- CHỮ KÝ ĐÓNG BĂNG: Phase 6 cắm owner_asset_outcomes vào bằng CREATE OR REPLACE
-- với đúng RETURNS TABLE này. Đổi cột trả về ⇒ phải DROP FUNCTION (CREATE OR
-- REPLACE không đổi được chữ ký) và cấp lại quyền.
--
-- Không bao giờ trả danh tính người trúng, internal_notes hay details của tổ chức.

CREATE OR REPLACE FUNCTION public.owner_asset_outcomes_resolved(p_workspace_id UUID)
RETURNS TABLE (
  listing_id       UUID,
  resolved_outcome TEXT,
  resolved_price   NUMERIC,
  resolved_date    DATE,
  payment_status   TEXT,
  confidence_label TEXT,
  has_conflict     BOOLEAN,
  sources          JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.owner_ws_can(p_workspace_id, 'read') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH claimed AS (
    SELECT DISTINCT c.listing_id AS lid
      FROM public.asset_owner_claims c
     WHERE c.workspace_id = p_workspace_id
       AND c.status IN ('auto_claimed', 'pending_confirmation', 'confirmed')
       AND c.listing_id IS NOT NULL
  ),
  -- 1. Sàn: lô mới nhất của tin. Không có dòng lot_states = lô chưa mở ⇒ chưa có gì.
  platform AS (
    SELECT DISTINCT ON (i.listing_id)
           i.listing_id                                         AS lid,
           'platform'::text                                     AS kind,
           1                                                    AS rnk,
           'platform'::text                                     AS label,
           CASE
             WHEN s.status = 'cancelled'   THEN 'cancelled'
             WHEN ls.status = 'withdrawn'  THEN 'withdrawn'
             ELSE ls.result
           END                                                  AS outcome,
           CASE WHEN s.status = 'published' AND ls.result = 'sold'
                THEN COALESCE(sc.price, ls.winning_amount) END  AS price,
           (COALESCE(ls.closed_at, ls.updated_at) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS odate,
           CASE WHEN s.status = 'published' AND ls.result = 'sold'
                THEN ls.payment_status END                      AS pay,
           jsonb_build_object(
             'ref_id',          i.id,
             'org_name',        ao.name,
             'session_code',    s.code,
             'contract_code',   sc.code,
             'contract_status', sc.status
           )                                                    AS ref
      FROM public.auction_session_items i
      JOIN claimed cl                     ON cl.lid = i.listing_id
      JOIN public.auction_sessions s      ON s.id = i.session_id
                                         AND s.status IN ('published', 'cancelled')
      JOIN public.auction_lot_states ls   ON ls.lot_id = i.id
                                         AND ls.status IN ('closed', 'withdrawn')
      LEFT JOIN public.auction_sale_contracts sc ON sc.lot_id = i.id AND sc.status <> 'cancelled'
      LEFT JOIN public.auction_organizations ao  ON ao.id = s.auction_org_id
     WHERE i.source = 'listing'
     ORDER BY i.listing_id, COALESCE(ls.closed_at, ls.updated_at) DESC
  ),
  -- 4. Tổ chức đấu giá tự khai (có thể nhiều tổ chức cho cùng một tin).
  org_report AS (
    SELECT r.listing_id                                         AS lid,
           'org_report'::text                                   AS kind,
           CASE WHEN r.source = 'CRAWLED' THEN 5 ELSE 4 END     AS rnk,
           CASE WHEN r.source = 'CRAWLED' THEN 'estimated' ELSE 'self_reported' END AS label,
           CASE WHEN r.is_successful THEN 'sold' ELSE 'unsold' END AS outcome,
           CASE WHEN r.is_successful THEN r.winning_price END   AS price,
           r.auction_date                                       AS odate,
           NULL::text                                           AS pay,
           jsonb_build_object(
             'ref_id',   r.id,
             'org_name', COALESCE(ao.name, o.name)
           )                                                    AS ref
      FROM public.org_auction_records r
      JOIN claimed cl                           ON cl.lid = r.listing_id
      LEFT JOIN public.auction_organizations ao ON ao.id = r.auction_org_id
      LEFT JOIN public.organizations o          ON o.id = r.organization_id
     WHERE r.is_successful IS NOT NULL
  ),
  -- 5. Dữ liệu cào. Chỉ thành ứng viên khi nó thật sự nói "đã bán".
  crawled AS (
    SELECT l.id                                                 AS lid,
           'crawled'::text                                      AS kind,
           5                                                    AS rnk,
           'estimated'::text                                    AS label,
           'sold'::text                                         AS outcome,
           p.price                                              AS price,
           (public.try_timestamptz(COALESCE(l.custom_attributes->>'auction_time',
                                            l.custom_attributes->>'auction_date'))
              AT TIME ZONE 'Asia/Ho_Chi_Minh')::date            AS odate,
           NULL::text                                           AS pay,
           jsonb_build_object(
             'ref_id',         l.id,
             'listing_status', l.status
           )                                                    AS ref
      FROM public.listings l
      JOIN claimed cl ON cl.lid = l.id
      CROSS JOIN LATERAL (
        -- "1,500,000" ⇒ 1500000; "1.500.000" hay rác ⇒ NULL (không đoán).
        SELECT NULLIF(CASE WHEN t.v ~ '^[0-9]+(\.[0-9]+)?$' THEN t.v::numeric END, 0) AS price
          FROM (SELECT regexp_replace(
                         COALESCE(l.custom_attributes->>'winning_price',
                                  l.custom_attributes->>'win_price'),
                         '[^0-9.]', '', 'g') AS v) t
      ) p
     WHERE p.price IS NOT NULL OR l.status = 'SOLD_RENTED'
  ),
  cand AS (
    SELECT * FROM platform
    UNION ALL SELECT * FROM org_report
    UNION ALL SELECT * FROM crawled
  ),
  ranked AS (
    SELECT c.*,
           row_number() OVER (PARTITION BY c.lid
                              ORDER BY c.rnk, c.odate DESC NULLS LAST, c.kind) AS pos
      FROM cand c
  ),
  best AS (
    SELECT * FROM ranked WHERE pos = 1
  ),
  conflict AS (
    SELECT b.lid,
           bool_or(
             -- cùng lượt đấu: thiếu ngày thì coi như cùng lượt
             (o.odate IS NULL OR b.odate IS NULL OR abs(o.odate - b.odate) <= 7)
             AND (
               o.outcome IS DISTINCT FROM b.outcome
               OR (b.outcome = 'sold'
                   AND b.price IS NOT NULL AND o.price IS NOT NULL
                   AND abs(o.price - b.price) > 0.01 * greatest(o.price, b.price))
             )
           ) AS conflicted
      FROM best b
      JOIN ranked o ON o.lid = b.lid AND o.pos > 1
     GROUP BY b.lid
  ),
  src AS (
    SELECT r.lid,
           jsonb_agg(
             jsonb_build_object(
               'kind',           r.kind,
               'label',          r.label,
               'outcome',        r.outcome,
               'price',          r.price,
               'date',           r.odate,
               'payment_status', r.pay
             ) || r.ref
             ORDER BY r.pos
           ) AS list
      FROM ranked r
     GROUP BY r.lid
  )
  SELECT cl.lid,
         b.outcome,
         b.price,
         b.odate,
         b.pay,
         b.label,
         COALESCE(cf.conflicted, false),
         COALESCE(s.list, '[]'::jsonb)
    FROM claimed cl
    LEFT JOIN best b      ON b.lid = cl.lid
    LEFT JOIN conflict cf ON cf.lid = cl.lid
    LEFT JOIN src s       ON s.lid = cl.lid;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_asset_outcomes_resolved(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_asset_outcomes_resolved(UUID) TO authenticated;

-- ─── Tự kiểm ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF (SELECT count(*) FROM pg_proc
       WHERE proname = 'owner_asset_outcomes_resolved'
         AND pronamespace = 'public'::regnamespace) <> 1 THEN
    RAISE EXCEPTION 'owner_asset_outcomes_resolved self-check: phải có đúng 1 bản (nạp chồng ⇒ PGRST203)';
  END IF;

  IF has_function_privilege('anon', 'public.owner_asset_outcomes_resolved(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'owner_asset_outcomes_resolved self-check: đang mở cho anon';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.owner_asset_outcomes_resolved(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'owner_asset_outcomes_resolved self-check: authenticated không gọi được';
  END IF;
END;
$$;
