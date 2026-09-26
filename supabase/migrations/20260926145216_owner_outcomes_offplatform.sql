-- Kết quả phiên — Phase 8 của docs/owner-control-tower-plan.md.
--
-- 1. Tài sản NGOÀI sàn: định danh = title_key (tên chuẩn hoá) trong không gian;
--    mỗi lượt của một tài sản ngoài sàn là duy nhất.
-- 2. Trigger owner_asset_outcomes_guard_scope (RIÊNG, không thay guard của P6):
--    vá lỗ chi nhánh (P6 chỉ suy branch_id khi client gửi NULL ⇒ cán bộ bị giới
--    hạn chi nhánh gửi branch_id của mình cho tin của chi nhánh khác vẫn lọt RLS),
--    đóng dấu / tự huỷ quyết định xử lý lệch.
-- 3. owner_asset_outcomes_resolved: CHỮ KÝ GIỮ NGUYÊN; thêm "bỏ qua nguồn" theo
--    quyết định xử lý lệch của đơn vị và các khoá fp/dismissed/in_round/disagrees
--    trong sources.
-- 4. RPC owner_outcomes_overview (mỗi tài sản có kết quả một dòng, trên + ngoài
--    sàn), owner_import_outcomes (nhập Excel, lỗi theo từng dòng),
--    owner_outcome_resolve_conflict ("Giữ số của tôi" / "Dùng số của tổ chức").
--
-- Số tự khai vẫn KHÔNG chảy ra /listings hay báo cáo công khai.

-- ─── 1. Cột + ràng buộc ─────────────────────────────────────────────────────

ALTER TABLE public.owner_asset_outcomes
  -- NBSP (U+00A0) hay lẫn trong ô Excel; "Đất  Q7 " và "đất q7" là cùng tài sản.
  -- Giới hạn đã biết: "hoà" và "hòa" là hai chuỗi khác nhau ⇒ hai tài sản.
  ADD COLUMN title_key TEXT GENERATED ALWAYS AS (
    lower(normalize(btrim(regexp_replace(asset_title, '[\s ]+', ' ', 'g')), NFC))
  ) STORED,
  -- Quyết định xử lý "Lệch số liệu" của đơn vị trên LƯỢT NÀY:
  -- {choice: 'keep_mine'|'use_source', at, by, adopted: {fp, kind}|null, dismissed: [fp…]}
  ADD COLUMN conflict_resolution JSONB,
  ADD CONSTRAINT outcome_title_len
    CHECK (asset_title IS NULL OR char_length(btrim(asset_title)) BETWEEN 3 AND 300);

CREATE UNIQUE INDEX owner_outcomes_offplatform_round_uq
  ON public.owner_asset_outcomes (workspace_id, title_key, round_no)
  WHERE listing_id IS NULL AND asset_posting_id IS NULL;

-- ─── 2. Hàm phụ (dùng chung cho mọi RPC — luật lệch chỉ viết MỘT chỗ) ───────

-- Dấu vân tay của một nguồn: đổi kết quả/giá ⇒ đổi dấu ⇒ quyết định cũ hết hiệu lực.
CREATE OR REPLACE FUNCTION public.owner_outcome_source_fp(
  p_kind TEXT, p_ref_id TEXT, p_outcome TEXT, p_price NUMERIC)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT concat_ws('|', p_kind, COALESCE(p_ref_id, '-'), COALESCE(p_outcome, '-'),
                   COALESCE(trim_scale(p_price)::text, '-'))
$$;

-- Hai nguồn "lệch": cùng lượt (ngày ≤ 7 ngày, hoặc thiếu ngày) và khác kết quả,
-- hoặc cùng "đã bán" mà giá lệch > 1%. Đúng luật has_conflict của Phase 5.
CREATE OR REPLACE FUNCTION public.owner_outcome_disagrees(
  o1 TEXT, p1 NUMERIC, d1 DATE, o2 TEXT, p2 NUMERIC, d2 DATE)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT (d1 IS NULL OR d2 IS NULL OR abs(d1 - d2) <= 7)
     AND (o1 IS DISTINCT FROM o2
          OR (o1 = 'sold' AND p1 IS NOT NULL AND p2 IS NOT NULL
              AND abs(p1 - p2) > 0.01 * greatest(p1, p2)))
$$;

REVOKE ALL ON FUNCTION public.owner_outcome_source_fp(TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_outcome_disagrees(TEXT, NUMERIC, DATE, TEXT, NUMERIC, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_outcome_source_fp(TEXT, TEXT, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_outcome_disagrees(TEXT, NUMERIC, DATE, TEXT, NUMERIC, DATE) TO authenticated;

-- ─── 3. Trigger phạm vi (chạy SAU owner_asset_outcomes_guard theo thứ tự tên) ──
-- Thứ tự BEFORE trigger theo tên: _guard → _guard_scope → _updated_at. RLS
-- WITH CHECK xét SAU mọi BEFORE trigger ⇒ thấy branch_id đã suy lại ở đây.

CREATE OR REPLACE FUNCTION public.owner_asset_outcomes_guard_scope()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _res JSONB;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.asset_title IS DISTINCT FROM OLD.asset_title THEN
    NEW.asset_title := NULLIF(btrim(regexp_replace(NEW.asset_title, '[\s ]+', ' ', 'g')), '');
  END IF;

  -- Chi nhánh của tin LUÔN suy từ claim, bỏ qua giá trị client gửi. Chỉ tính
  -- lại khi tin/chi nhánh đổi: claim bị từ chối sau này không khoá cập nhật thanh toán.
  IF NEW.listing_id IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR NEW.listing_id IS DISTINCT FROM OLD.listing_id
          OR NEW.branch_id IS DISTINCT FROM OLD.branch_id) THEN
    NEW.branch_id := (
      SELECT wb.id
        FROM public.asset_owner_claims c
        JOIN public.workspace_branches wb
          ON wb.workspace_id = c.workspace_id AND wb.asset_owner_id = c.asset_owner_id
       WHERE c.workspace_id = NEW.workspace_id
         AND c.listing_id = NEW.listing_id
       LIMIT 1
    );
  END IF;

  -- Quyết định xử lý lệch: server đóng dấu người/lúc; sửa số mà không kèm quyết
  -- định mới ⇒ quyết định cũ hết hiệu lực (lệch hiện lại nếu còn lệch).
  IF (TG_OP = 'INSERT' AND NEW.conflict_resolution IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.conflict_resolution IS NOT NULL
         AND NEW.conflict_resolution IS DISTINCT FROM OLD.conflict_resolution) THEN
    _res := NEW.conflict_resolution;
    IF jsonb_typeof(_res) <> 'object'
       OR COALESCE(_res->>'choice', '') NOT IN ('keep_mine', 'use_source')
       OR jsonb_typeof(COALESCE(_res->'dismissed', '[]'::jsonb)) <> 'array'
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(_res->'dismissed', '[]'::jsonb)) e
                   WHERE jsonb_typeof(e) <> 'string') THEN
      RAISE EXCEPTION 'Quyết định xử lý lệch không hợp lệ';
    END IF;
    NEW.conflict_resolution := _res || jsonb_build_object('at', now(), 'by', auth.uid());
  ELSIF TG_OP = 'UPDATE'
        AND NEW.conflict_resolution IS NOT DISTINCT FROM OLD.conflict_resolution
        AND (NEW.outcome, NEW.winning_price, NEW.round_no, NEW.auction_date)
            IS DISTINCT FROM (OLD.outcome, OLD.winning_price, OLD.round_no, OLD.auction_date) THEN
    NEW.conflict_resolution := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_asset_outcomes_guard_scope() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER owner_asset_outcomes_guard_scope
  BEFORE INSERT OR UPDATE ON public.owner_asset_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.owner_asset_outcomes_guard_scope();

-- ─── 4. Giá trúng hợp nhất: "bỏ qua nguồn" theo quyết định của đơn vị ───────
--
-- Giữ nguyên mọi luật của Phase 5/6 (xem 20260926140659). Thêm:
--   * Nguồn bị đơn vị "bỏ qua" = dấu vân tay nằm trong conflict_resolution.dismissed
--     của LƯỢT MỚI NHẤT của đơn vị. Nguồn sàn và bản ghi của chính đơn vị KHÔNG
--     bao giờ bị bỏ qua.
--   * Nguồn bị bỏ qua không tính vào "ngày mới nhất" (không kéo lệch cửa sổ lượt
--     hiện tại) và xếp SAU mọi nguồn cùng lượt khi chọn nguồn thắng — nếu không,
--     tổ chức khai ngày mới hơn vẫn thắng sau khi đơn vị chọn "Giữ số của tôi".
--   * Không tính vào has_conflict.
--   * sources có thêm fp / dismissed / in_round / disagrees (so với nguồn thắng)
--     để giao diện chỉ hiển thị điều server đã tính.

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
  owner_latest AS (
    SELECT DISTINCT ON (o.listing_id)
           o.id                                AS oid,
           o.listing_id                        AS lid,
           o.round_no                          AS rno,
           o.auction_date                      AS odate,
           o.outcome                           AS outcome,
           o.winning_price                     AS price,
           o.payment_status                    AS pay,
           cardinality(o.evidence_urls) > 0    AS has_evidence,
           o.auction_org_id                    AS org_id,
           COALESCE(o.conflict_resolution->'dismissed', '[]'::jsonb) AS dismissed_fps
      FROM public.owner_asset_outcomes o
      JOIN claimed cl ON cl.lid = o.listing_id
     WHERE o.workspace_id = p_workspace_id
     ORDER BY o.listing_id, o.round_no DESC, o.auction_date DESC, o.updated_at DESC
  ),
  owner_report AS (
    SELECT ol.lid                                               AS lid,
           'owner_report'::text                                 AS kind,
           CASE WHEN rec.ok THEN 2 WHEN ol.has_evidence THEN 3 ELSE 4 END AS rnk,
           CASE WHEN rec.ok THEN 'reconciled'
                WHEN ol.has_evidence THEN 'owner_evidence'
                ELSE 'self_reported' END                        AS label,
           ol.outcome                                           AS outcome,
           CASE WHEN ol.outcome = 'sold' THEN ol.price END      AS price,
           ol.odate                                             AS odate,
           CASE WHEN ol.outcome = 'sold' THEN ol.pay END        AS pay,
           jsonb_build_object(
             'ref_id',   ol.oid,
             'org_name', ao.name,
             'round_no', ol.rno
           )                                                    AS ref
      FROM owner_latest ol
      LEFT JOIN public.auction_organizations ao ON ao.id = ol.org_id
      CROSS JOIN LATERAL (
        SELECT EXISTS (
          SELECT 1 FROM org_report r
           WHERE r.lid = ol.lid
             AND r.rnk = 4
             AND (r.odate IS NULL OR abs(r.odate - ol.odate) <= 7)
             AND r.outcome = ol.outcome
             AND (ol.outcome <> 'sold'
                  OR (r.price IS NOT NULL AND ol.price IS NOT NULL
                      AND abs(r.price - ol.price) <= 0.01 * greatest(r.price, ol.price)))
        ) AS ok
      ) rec
  ),
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
        SELECT NULLIF(CASE WHEN t.v ~ '^[0-9]+(\.[0-9]+)?$' THEN t.v::numeric END, 0) AS price
          FROM (SELECT regexp_replace(
                         COALESCE(l.custom_attributes->>'winning_price',
                                  l.custom_attributes->>'win_price'),
                         '[^0-9.]', '', 'g') AS v) t
      ) p
     WHERE p.price IS NOT NULL OR l.status = 'SOLD_RENTED'
  ),
  cand0 AS (
    SELECT * FROM platform
    UNION ALL SELECT * FROM owner_report
    UNION ALL SELECT * FROM org_report
    UNION ALL SELECT * FROM crawled
  ),
  cand AS (
    SELECT c.*,
           public.owner_outcome_source_fp(c.kind, c.ref->>'ref_id', c.outcome, c.price) AS fp,
           (c.kind NOT IN ('platform', 'owner_report')
            AND COALESCE(ol.dismissed_fps, '[]'::jsonb)
                ? public.owner_outcome_source_fp(c.kind, c.ref->>'ref_id', c.outcome, c.price)) AS dismissed
      FROM cand0 c
      LEFT JOIN owner_latest ol ON ol.lid = c.lid
  ),
  latest AS (
    SELECT c.lid, max(c.odate) AS last_date
      FROM cand c
     WHERE NOT c.dismissed
     GROUP BY c.lid
  ),
  ranked AS (
    SELECT c.*,
           (c.odate IS NULL OR lt.last_date IS NULL OR c.odate >= lt.last_date - 7) AS in_round,
           row_number() OVER (
             PARTITION BY c.lid
             ORDER BY (c.odate IS NULL OR lt.last_date IS NULL OR c.odate >= lt.last_date - 7) DESC,
                      c.dismissed,
                      c.rnk,
                      c.odate DESC NULLS LAST,
                      CASE c.kind WHEN 'platform'     THEN 1
                                  WHEN 'owner_report' THEN 2
                                  WHEN 'crawled'      THEN 3
                                  ELSE 4 END
           ) AS pos
      FROM cand c
      LEFT JOIN latest lt ON lt.lid = c.lid
  ),
  best AS (
    SELECT * FROM ranked WHERE pos = 1
  ),
  conflict AS (
    SELECT b.lid,
           bool_or(public.owner_outcome_disagrees(o.outcome, o.price, o.odate,
                                                  b.outcome, b.price, b.odate)) AS conflicted
      FROM best b
      JOIN ranked o ON o.lid = b.lid AND o.pos > 1 AND NOT o.dismissed
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
               'payment_status', r.pay,
               'fp',             r.fp,
               'dismissed',      r.dismissed,
               'in_round',       r.in_round,
               'disagrees',      (r.pos > 1 AND public.owner_outcome_disagrees(
                                    r.outcome, r.price, r.odate, b.outcome, b.price, b.odate))
             ) || r.ref
             ORDER BY r.pos
           ) AS list
      FROM ranked r
      JOIN best b ON b.lid = r.lid
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

-- ─── 5. Tổng quan "Kết quả phiên": mỗi tài sản CÓ KẾT QUẢ một dòng ─────────
-- Trên sàn: đọc từ owner_asset_outcomes_resolved (không gộp nguồn lần hai).
-- Ngoài sàn: lượt mới nhất theo title_key. KHÔNG join asset_postings (chưa có
-- workspace_id tới Phase 4 ⇒ hàm DEFINER có thể lộ tên tin của người khác).
-- Claim bị từ chối sau này ⇒ tài sản trên sàn rời khỏi danh sách (cùng luật resolved).

CREATE OR REPLACE FUNCTION public.owner_outcomes_overview(p_workspace_id UUID)
RETURNS TABLE (
  row_key          TEXT,
  listing_id       UUID,
  title_key        TEXT,
  own_outcome_id   UUID,
  own_round_no     INT,
  rounds_reported  INT,
  asset_title      TEXT,
  asset_category   TEXT,
  branch_id        UUID,
  auction_org_name TEXT,
  starting_price   NUMERIC,
  resolved_outcome TEXT,
  resolved_price   NUMERIC,
  resolved_date    DATE,
  payment_status   TEXT,
  paid_amount      NUMERIC,
  best_kind        TEXT,
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
  WITH res AS (
    SELECT x.* FROM public.owner_asset_outcomes_resolved(p_workspace_id) x
     WHERE x.resolved_outcome IS NOT NULL
  ),
  own_src AS (
    -- Bản ghi của chính đơn vị = nguồn owner_report (chỉ có lượt mới nhất).
    SELECT r.listing_id                       AS lid,
           (e->>'ref_id')::uuid               AS oid,
           (e->>'round_no')::int              AS rno,
           COALESCE((e->>'in_round')::boolean, false) AS in_round
      FROM res r
      CROSS JOIN LATERAL jsonb_array_elements(r.sources) e
     WHERE e->>'kind' = 'owner_report'
  ),
  own_count AS (
    SELECT o.listing_id AS lid, count(*)::int AS n
      FROM public.owner_asset_outcomes o
     WHERE o.workspace_id = p_workspace_id AND o.listing_id IS NOT NULL
     GROUP BY o.listing_id
  ),
  branch_of AS (
    SELECT DISTINCT ON (c.listing_id) c.listing_id AS lid, wb.id AS bid
      FROM public.asset_owner_claims c
      JOIN public.workspace_branches wb
        ON wb.workspace_id = c.workspace_id AND wb.asset_owner_id = c.asset_owner_id
     WHERE c.workspace_id = p_workspace_id AND c.listing_id IS NOT NULL
     ORDER BY c.listing_id, c.created_at
  ),
  off_all AS (
    SELECT o.*
      FROM public.owner_asset_outcomes o
     WHERE o.workspace_id = p_workspace_id
       AND o.listing_id IS NULL
       AND o.asset_posting_id IS NULL
  ),
  off_latest AS (
    SELECT DISTINCT ON (o.title_key) o.*
      FROM off_all o
     ORDER BY o.title_key, o.round_no DESC, o.auction_date DESC, o.updated_at DESC
  ),
  off_count AS (
    SELECT o.title_key AS tk, count(*)::int AS n FROM off_all o GROUP BY o.title_key
  )
  SELECT ('l:' || r.listing_id::text)::text,
         r.listing_id,
         NULL::text,
         os.oid,
         os.rno,
         COALESCE(oc.n, 0)::int,
         l.title::text,
         l.property_type_slug::text,
         bo.bid,
         COALESCE(r.sources->0->>'org_name', ao.name)::text,
         (CASE WHEN l.price_unit::text = 'TOTAL' AND l.price > 0 THEN l.price END)::numeric,
         r.resolved_outcome,
         r.resolved_price::numeric,
         r.resolved_date,
         r.payment_status,
         (CASE WHEN os.in_round THEN oo.paid_amount END)::numeric,
         (r.sources->0->>'kind')::text,
         r.confidence_label,
         r.has_conflict,
         r.sources
    FROM res r
    JOIN public.listings l                    ON l.id = r.listing_id
    LEFT JOIN own_src os                      ON os.lid = r.listing_id
    LEFT JOIN public.owner_asset_outcomes oo  ON oo.id = os.oid
    LEFT JOIN own_count oc                    ON oc.lid = r.listing_id
    LEFT JOIN branch_of bo                    ON bo.lid = r.listing_id
    LEFT JOIN public.auction_organizations ao ON ao.id = l.auction_org_id
  UNION ALL
  SELECT ('t:' || f.title_key)::text,
         NULL::uuid,
         f.title_key,
         f.id,
         f.round_no,
         COALESCE(fc.n, 0)::int,
         f.asset_title,
         f.asset_category,
         f.branch_id,
         ao.name::text,
         f.starting_price::numeric,
         f.outcome,
         (CASE WHEN f.outcome = 'sold' THEN f.winning_price END)::numeric,
         f.auction_date,
         CASE WHEN f.outcome = 'sold' THEN f.payment_status END,
         (CASE WHEN f.outcome = 'sold' THEN f.paid_amount END)::numeric,
         'owner_report'::text,
         lbl.label,
         false,
         jsonb_build_array(jsonb_build_object(
           'kind',           'owner_report',
           'label',          lbl.label,
           'outcome',        f.outcome,
           'price',          CASE WHEN f.outcome = 'sold' THEN f.winning_price END,
           'date',           f.auction_date,
           'payment_status', CASE WHEN f.outcome = 'sold' THEN f.payment_status END,
           'fp',             public.owner_outcome_source_fp('owner_report', f.id::text, f.outcome,
                                CASE WHEN f.outcome = 'sold' THEN f.winning_price END),
           'dismissed',      false,
           'in_round',       true,
           'disagrees',      false,
           'ref_id',         f.id,
           'org_name',       ao.name,
           'round_no',       f.round_no
         ))
    FROM off_latest f
    LEFT JOIN off_count fc                    ON fc.tk = f.title_key
    LEFT JOIN public.auction_organizations ao ON ao.id = f.auction_org_id
    CROSS JOIN LATERAL (
      SELECT CASE WHEN cardinality(f.evidence_urls) > 0 THEN 'owner_evidence' ELSE 'self_reported' END::text AS label
    ) lbl;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_outcomes_overview(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_outcomes_overview(UUID) TO authenticated;

-- ─── 6. Nhập Excel: mỗi dòng một savepoint, lỗi dòng nào báo dòng đó ────────
-- SECURITY INVOKER: RLS + cả hai trigger guard áp đúng như khai tay. Tối đa 500
-- dòng (mỗi dòng một subtransaction). Tin trên sàn: chi nhánh/tên/loại luôn NULL
-- (suy từ claim), tránh hai định danh cho cùng tài sản.

CREATE OR REPLACE FUNCTION public.owner_import_outcomes(p_workspace_id UUID, p_rows JSONB)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_row     JSONB;
  v_ord     BIGINT;
  v_listing UUID;
  v_id      UUID;
  v_out     JSONB := '[]'::jsonb;
  v_state   TEXT;
  v_msg     TEXT;
  v_con     TEXT;
BEGIN
  IF NOT public.owner_ws_can(p_workspace_id, 'write') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'rows_must_be_array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_rows) > 500 THEN
    RAISE EXCEPTION 'too_many_rows' USING ERRCODE = '22023';
  END IF;

  FOR v_row, v_ord IN
    SELECT t.e, t.ord FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(e, ord)
  LOOP
    BEGIN
      v_listing := NULLIF(v_row->>'listing_id', '')::uuid;
      INSERT INTO public.owner_asset_outcomes (
        workspace_id, listing_id, asset_title, asset_category, branch_id,
        round_no, auction_date, auction_org_id, outcome, failure_reason,
        starting_price, winning_price, participants,
        source, evidence_urls, share_to_market, reported_by
      ) VALUES (
        p_workspace_id,
        v_listing,
        CASE WHEN v_listing IS NULL THEN v_row->>'asset_title' END,
        CASE WHEN v_listing IS NULL THEN NULLIF(v_row->>'asset_category', '') END,
        CASE WHEN v_listing IS NULL THEN NULLIF(v_row->>'branch_id', '')::uuid END,
        COALESCE(NULLIF(v_row->>'round_no', '')::int, 1),
        (v_row->>'auction_date')::date,
        NULLIF(v_row->>'auction_org_id', '')::uuid,
        v_row->>'outcome',
        NULLIF(v_row->>'failure_reason', ''),
        NULLIF(v_row->>'starting_price', '')::numeric,
        NULLIF(v_row->>'winning_price', '')::numeric,
        NULLIF(v_row->>'participants', '')::int,
        'owner_import', '{}', false, auth.uid()
      )
      RETURNING id INTO v_id;
      v_out := v_out || jsonb_build_array(jsonb_build_object('idx', v_ord - 1, 'ok', true, 'id', v_id));
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT, v_con = CONSTRAINT_NAME;
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'idx', v_ord - 1, 'ok', false, 'code', v_state, 'message', v_msg,
        'constraint', NULLIF(v_con, '')));
    END;
  END LOOP;

  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_import_outcomes(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_import_outcomes(UUID, JSONB) TO authenticated;

-- ─── 7. Xử lý "Lệch số liệu" ────────────────────────────────────────────────
-- SECURITY INVOKER: đọc nguồn qua RPC DEFINER ở trên, GHI bản ghi của chính đơn
-- vị dưới RLS (write + phạm vi chi nhánh). Không báo cho tổ chức đấu giá.
--   keep_mine : cần bản ghi của đơn vị ở lượt hiện tại và sàn không nói khác;
--               bỏ qua mọi nguồn (không phải sàn) đang lệch với số của đơn vị.
--   use_source: lấy kết quả/giá của nguồn p_source_fp (phải còn nguyên — nguồn đổi
--               thì báo "source_changed"); sửa bản ghi lượt hiện tại hoặc thêm lượt
--               mới; bỏ qua các nguồn còn lại đang lệch với số vừa lấy.
-- Trả {ok, reason?, id?}.

CREATE OR REPLACE FUNCTION public.owner_outcome_resolve_conflict(
  p_workspace_id UUID,
  p_listing_id   UUID,
  p_choice       TEXT,
  p_source_fp    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_sources  JSONB;
  v_own      JSONB;
  v_platform JSONB;
  v_pick     JSONB;
  v_dismiss  JSONB;
  v_res      JSONB;
  v_n        INT;
  v_round    INT;
  v_id       UUID;
BEGIN
  IF NOT public.owner_ws_can(p_workspace_id, 'write') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  IF p_choice IS NULL OR p_choice NOT IN ('keep_mine', 'use_source') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_choice');
  END IF;

  SELECT r.sources INTO v_sources
    FROM public.owner_asset_outcomes_resolved(p_workspace_id) r
   WHERE r.listing_id = p_listing_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_in_portfolio');
  END IF;

  SELECT e INTO v_own FROM jsonb_array_elements(v_sources) e
   WHERE e->>'kind' = 'owner_report' AND (e->>'in_round')::boolean
   LIMIT 1;
  SELECT e INTO v_platform FROM jsonb_array_elements(v_sources) e
   WHERE e->>'kind' = 'platform' AND (e->>'in_round')::boolean
   LIMIT 1;

  IF p_choice = 'keep_mine' THEN
    IF v_own IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'no_own_record');
    END IF;
    IF v_platform IS NOT NULL AND public.owner_outcome_disagrees(
         v_own->>'outcome', (v_own->>'price')::numeric, (v_own->>'date')::date,
         v_platform->>'outcome', (v_platform->>'price')::numeric, (v_platform->>'date')::date) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'platform_disagrees');
    END IF;
    v_pick := v_own;
  ELSE
    SELECT e INTO v_pick FROM jsonb_array_elements(v_sources) e
     WHERE e->>'fp' = p_source_fp AND e->>'kind' <> 'owner_report'
     LIMIT 1;
    IF v_pick IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'source_changed');
    END IF;
    IF COALESCE(v_pick->>'outcome', '') NOT IN ('sold', 'unsold', 'postponed', 'cancelled', 'withdrawn') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'bad_source');
    END IF;
    IF v_pick->>'outcome' = 'sold' AND v_pick->>'price' IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'source_has_no_price');
    END IF;
    IF v_pick->>'kind' <> 'platform' AND v_platform IS NOT NULL AND public.owner_outcome_disagrees(
         v_pick->>'outcome', (v_pick->>'price')::numeric, (v_pick->>'date')::date,
         v_platform->>'outcome', (v_platform->>'price')::numeric, (v_platform->>'date')::date) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'platform_disagrees');
    END IF;
  END IF;

  -- Bỏ qua: nguồn không phải sàn / không phải đơn vị, lệch với số được giữ.
  SELECT COALESCE(jsonb_agg(DISTINCT e->>'fp'), '[]'::jsonb) INTO v_dismiss
    FROM jsonb_array_elements(v_sources) e
   WHERE e->>'kind' NOT IN ('platform', 'owner_report')
     AND e->>'fp' IS DISTINCT FROM p_source_fp
     AND public.owner_outcome_disagrees(
           e->>'outcome', (e->>'price')::numeric, (e->>'date')::date,
           v_pick->>'outcome', (v_pick->>'price')::numeric,
           COALESCE((v_pick->>'date')::date, (v_own->>'date')::date));

  v_res := jsonb_build_object(
    'choice',    p_choice,
    'adopted',   CASE WHEN p_choice = 'use_source'
                      THEN jsonb_build_object('fp', p_source_fp, 'kind', v_pick->>'kind') END,
    'dismissed', v_dismiss
  );

  BEGIN
    IF p_choice = 'keep_mine' THEN
      UPDATE public.owner_asset_outcomes o
         SET conflict_resolution = v_res
       WHERE o.id = (v_own->>'ref_id')::uuid AND o.workspace_id = p_workspace_id;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_id := (v_own->>'ref_id')::uuid;
    ELSIF v_own IS NOT NULL THEN
      UPDATE public.owner_asset_outcomes o
         SET outcome             = v_pick->>'outcome',
             winning_price       = CASE WHEN v_pick->>'outcome' = 'sold' THEN (v_pick->>'price')::numeric END,
             failure_reason      = CASE WHEN v_pick->>'outcome' = 'sold' THEN NULL ELSE o.failure_reason END,
             conflict_resolution = v_res
       WHERE o.id = (v_own->>'ref_id')::uuid AND o.workspace_id = p_workspace_id;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_id := (v_own->>'ref_id')::uuid;
    ELSE
      SELECT COALESCE(max(o.round_no), 0) + 1 INTO v_round
        FROM public.owner_asset_outcomes o
       WHERE o.workspace_id = p_workspace_id AND o.listing_id = p_listing_id;
      INSERT INTO public.owner_asset_outcomes (
        workspace_id, listing_id, round_no, auction_date, outcome, winning_price,
        source, reported_by, conflict_resolution
      ) VALUES (
        p_workspace_id, p_listing_id, v_round,
        COALESCE((v_pick->>'date')::date, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date),
        v_pick->>'outcome',
        CASE WHEN v_pick->>'outcome' = 'sold' THEN (v_pick->>'price')::numeric END,
        'owner_manual', auth.uid(), v_res
      )
      RETURNING id INTO v_id;
      v_n := 1;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END;

  IF v_n = 0 THEN
    -- RLS lọc mất dòng: ngoài phạm vi chi nhánh.
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.owner_outcome_resolve_conflict(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_outcome_resolve_conflict(UUID, UUID, TEXT, TEXT) TO authenticated;

-- ─── 8. Tự kiểm ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  _fn OID;
BEGIN
  IF NOT (SELECT c.relrowsecurity FROM pg_class c
           WHERE c.oid = 'public.owner_asset_outcomes'::regclass) THEN
    RAISE EXCEPTION 'owner_outcomes_offplatform self-check: chưa bật RLS';
  END IF;

  IF (SELECT count(*) FROM pg_proc
       WHERE proname = 'owner_asset_outcomes_resolved'
         AND pronamespace = 'public'::regnamespace) <> 1 THEN
    RAISE EXCEPTION 'owner_outcomes_offplatform self-check: owner_asset_outcomes_resolved phải có đúng 1 bản';
  END IF;

  _fn := 'public.owner_asset_outcomes_resolved(uuid)'::regprocedure;
  IF pg_get_function_result(_fn) <> 'TABLE(listing_id uuid, resolved_outcome text, resolved_price numeric, resolved_date date, payment_status text, confidence_label text, has_conflict boolean, sources jsonb)' THEN
    RAISE EXCEPTION 'owner_outcomes_offplatform self-check: chữ ký owner_asset_outcomes_resolved đã đổi';
  END IF;
  IF (SELECT prosrc FROM pg_proc WHERE oid = _fn) NOT LIKE '%owner_outcome_source_fp%' THEN
    RAISE EXCEPTION 'owner_outcomes_offplatform self-check: thân owner_asset_outcomes_resolved chưa có luật bỏ qua nguồn';
  END IF;

  IF has_function_privilege('anon', 'public.owner_asset_outcomes_resolved(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.owner_outcomes_overview(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.owner_import_outcomes(uuid, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.owner_outcome_resolve_conflict(uuid, uuid, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'owner_outcomes_offplatform self-check: hàm đang mở cho anon';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgrelid = 'public.owner_asset_outcomes'::regclass
                    AND tgname = 'owner_asset_outcomes_guard_scope') THEN
    RAISE EXCEPTION 'owner_outcomes_offplatform self-check: thiếu trigger guard_scope';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname = 'public' AND indexname = 'owner_outcomes_offplatform_round_uq') THEN
    RAISE EXCEPTION 'owner_outcomes_offplatform self-check: thiếu unique index lượt ngoài sàn';
  END IF;
END;
$$;
