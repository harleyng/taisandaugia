-- Chủ tài sản tự khai kết quả phiên — Phase 6 của docs/owner-control-tower-plan.md (§A3, §A4).
--
-- 1. Bảng owner_asset_outcomes (đúng §A4) + trigger bảo vệ + RLS theo thành viên.
-- 2. Bucket PRIVATE owner-outcome-evidence cho biên bản đấu giá.
-- 3. owner_asset_outcomes_resolved nhận thêm nguồn "đơn vị tự khai" và đủ 5 nhãn
--    của §A3 (thêm reconciled / owner_evidence). Chữ ký giữ nguyên.
--
-- Số tự khai KHÔNG BAO GIỜ tự chảy ra /listings hay báo cáo thị trường công khai:
-- chỉ RPC của chính không gian đọc bảng này.

-- ─── 1. Bảng ────────────────────────────────────────────────────────────────

CREATE TABLE public.owner_asset_outcomes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  branch_id        UUID REFERENCES public.workspace_branches(id) ON DELETE SET NULL,
  listing_id       UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  asset_posting_id UUID REFERENCES public.asset_postings(id) ON DELETE SET NULL,
  asset_title      TEXT,                 -- tài sản NGOÀI sàn (Phase 8)
  asset_category   TEXT,
  round_no         INT  NOT NULL DEFAULT 1,
  auction_date     DATE NOT NULL,
  auction_org_id   UUID REFERENCES public.auction_organizations(id) ON DELETE SET NULL,
  outcome          TEXT NOT NULL CHECK (outcome IN ('sold','unsold','postponed','cancelled','withdrawn')),
  failure_reason   TEXT,
  starting_price   NUMERIC(18,0),
  winning_price    NUMERIC(18,0),
  participants     INT,
  payment_status   TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','partial','paid','defaulted')),
  paid_amount      NUMERIC(18,0),
  paid_at          DATE,
  auction_fee      NUMERIC(18,0),
  -- Tên cột theo §A4 nhưng chứa ĐƯỜNG DẪN trong bucket private, không phải URL
  -- (getPublicUrl của bucket private luôn 400 — mở bằng createSignedUrl).
  evidence_urls    TEXT[] NOT NULL DEFAULT '{}',
  source           TEXT NOT NULL DEFAULT 'owner_manual' CHECK (source IN ('owner_manual','owner_import')),
  share_to_market  BOOLEAN NOT NULL DEFAULT false,
  reported_by      UUID NOT NULL REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT outcome_sold_needs_price CHECK (outcome <> 'sold' OR winning_price IS NOT NULL),
  CONSTRAINT outcome_needs_asset CHECK (listing_id IS NOT NULL OR asset_posting_id IS NOT NULL OR asset_title IS NOT NULL)
);

CREATE UNIQUE INDEX owner_outcomes_listing_round_uq
  ON public.owner_asset_outcomes (workspace_id, listing_id, round_no) WHERE listing_id IS NOT NULL;

CREATE INDEX idx_owner_outcomes_listing   ON public.owner_asset_outcomes (listing_id);
CREATE INDEX idx_owner_outcomes_branch    ON public.owner_asset_outcomes (branch_id);
CREATE INDEX idx_owner_outcomes_ws_date   ON public.owner_asset_outcomes (workspace_id, auction_date DESC);

CREATE TRIGGER owner_asset_outcomes_updated_at
  BEFORE UPDATE ON public.owner_asset_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 2. Trigger bảo vệ ──────────────────────────────────────────────────────
-- SECURITY DEFINER: đọc claim/chi nhánh/storage.objects không phụ thuộc RLS của
-- người gọi. Chạy TRƯỚC khi RLS WITH CHECK được xét ⇒ branch_id suy ra ở đây
-- chính là giá trị owner_ws_branch_ok nhìn thấy.

CREATE OR REPLACE FUNCTION public.owner_asset_outcomes_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _prefix TEXT;
  _path   TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
      RAISE EXCEPTION 'Không thể chuyển kết quả sang không gian khác';
    END IF;
    NEW.reported_by := OLD.reported_by;
  ELSIF auth.uid() IS NOT NULL THEN
    -- Người khai là người đang đăng nhập, không phải giá trị client gửi lên.
    NEW.reported_by := auth.uid();
  END IF;

  -- Tin đăng phải là tài sản ĐANG thuộc danh mục của không gian. Chỉ kiểm khi
  -- tin đổi: claim bị từ chối sau này không được khoá việc cập nhật thanh toán.
  IF NEW.listing_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.listing_id IS DISTINCT FROM OLD.listing_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.asset_owner_claims c
        WHERE c.workspace_id = NEW.workspace_id
          AND c.listing_id = NEW.listing_id
          AND c.status IN ('auto_claimed', 'pending_confirmation', 'confirmed')
     ) THEN
    RAISE EXCEPTION 'Tài sản này không thuộc danh mục của đơn vị';
  END IF;

  -- Chi nhánh suy từ claim (claim.asset_owner_id ↔ workspace_branches.asset_owner_id).
  IF NEW.branch_id IS NULL AND NEW.listing_id IS NOT NULL THEN
    SELECT wb.id INTO NEW.branch_id
      FROM public.asset_owner_claims c
      JOIN public.workspace_branches wb
        ON wb.workspace_id = c.workspace_id AND wb.asset_owner_id = c.asset_owner_id
     WHERE c.workspace_id = NEW.workspace_id
       AND c.listing_id = NEW.listing_id
     LIMIT 1;
  END IF;

  IF NEW.branch_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.branch_id IS DISTINCT FROM OLD.branch_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.workspace_branches wb
        WHERE wb.id = NEW.branch_id AND wb.workspace_id = NEW.workspace_id
     ) THEN
    RAISE EXCEPTION 'Chi nhánh không thuộc đơn vị này';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.auction_org_id IS NULL AND NEW.listing_id IS NOT NULL THEN
    SELECT l.auction_org_id INTO NEW.auction_org_id
      FROM public.listings l WHERE l.id = NEW.listing_id;
  END IF;

  -- Nhãn "có biên bản" chỉ được có khi tệp THẬT nằm đúng thư mục của bản ghi.
  IF TG_OP = 'INSERT' OR NEW.evidence_urls IS DISTINCT FROM OLD.evidence_urls THEN
    _prefix := NEW.workspace_id::text || '/' || NEW.id::text || '/';
    FOREACH _path IN ARRAY NEW.evidence_urls LOOP
      IF left(_path, length(_prefix)) <> _prefix
         OR NOT EXISTS (
           SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = 'owner-outcome-evidence' AND o.name = _path
         ) THEN
        RAISE EXCEPTION 'Biên bản đính kèm không hợp lệ';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_asset_outcomes_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER owner_asset_outcomes_guard
  BEFORE INSERT OR UPDATE ON public.owner_asset_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.owner_asset_outcomes_guard();

-- ─── 3. RLS ─────────────────────────────────────────────────────────────────
-- Đọc: mọi thành viên. Ghi: owner/staff, staff bị giới hạn chi nhánh thì chỉ
-- trong phạm vi (bản ghi branch_id NULL chỉ người không bị giới hạn mới đụng).

ALTER TABLE public.owner_asset_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_asset_outcomes_read" ON public.owner_asset_outcomes
  FOR SELECT TO authenticated
  USING (public.owner_ws_can(workspace_id, 'read'));

CREATE POLICY "owner_asset_outcomes_insert" ON public.owner_asset_outcomes
  FOR INSERT TO authenticated
  WITH CHECK (public.owner_ws_can(workspace_id, 'write')
              AND public.owner_ws_branch_ok(workspace_id, branch_id));

CREATE POLICY "owner_asset_outcomes_update" ON public.owner_asset_outcomes
  FOR UPDATE TO authenticated
  USING      (public.owner_ws_can(workspace_id, 'write')
              AND public.owner_ws_branch_ok(workspace_id, branch_id))
  WITH CHECK (public.owner_ws_can(workspace_id, 'write')
              AND public.owner_ws_branch_ok(workspace_id, branch_id));

CREATE POLICY "owner_asset_outcomes_delete" ON public.owner_asset_outcomes
  FOR DELETE TO authenticated
  USING (public.owner_ws_can(workspace_id, 'write')
         AND public.owner_ws_branch_ok(workspace_id, branch_id));

-- ─── 4. Bucket biên bản (private) ───────────────────────────────────────────
-- Đường dẫn {workspace_id}/{outcome_id}/{tệp}. Kiểm CẢ hai segment: kết quả ở
-- segment 2 phải thuộc đúng không gian ở segment 1 — nếu không, thành viên
-- không gian A ghi được vào thư mục của không gian B. Vì vậy thứ tự ghi là:
-- tạo bản ghi → tải tệp → cập nhật evidence_urls.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('owner-outcome-evidence', 'owner-outcome-evidence', false, 10485760,
        ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- _action: 'read' | 'write'. Trả false (không ném lỗi) với đường dẫn rác.
CREATE OR REPLACE FUNCTION public.owner_outcome_evidence_ok(_name TEXT, _action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws      UUID;
  v_outcome UUID;
  v_branch  UUID;
BEGIN
  BEGIN
    v_ws      := split_part(_name, '/', 1)::uuid;
    v_outcome := split_part(_name, '/', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;

  SELECT o.branch_id INTO v_branch
    FROM public.owner_asset_outcomes o
   WHERE o.id = v_outcome AND o.workspace_id = v_ws;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF _action = 'read' THEN
    RETURN public.owner_ws_can(v_ws, 'read');
  ELSIF _action = 'write' THEN
    RETURN public.owner_ws_can(v_ws, 'write') AND public.owner_ws_branch_ok(v_ws, v_branch);
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_outcome_evidence_ok(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_outcome_evidence_ok(TEXT, TEXT) TO authenticated;

DROP POLICY IF EXISTS owner_outcome_evidence_select ON storage.objects;
CREATE POLICY owner_outcome_evidence_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'owner-outcome-evidence'
         AND public.owner_outcome_evidence_ok(name, 'read'));

DROP POLICY IF EXISTS owner_outcome_evidence_insert ON storage.objects;
CREATE POLICY owner_outcome_evidence_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'owner-outcome-evidence'
              AND public.owner_outcome_evidence_ok(name, 'write'));

-- Không có policy UPDATE: biên bản chỉ thêm hoặc xoá, không ghi đè.
DROP POLICY IF EXISTS owner_outcome_evidence_delete ON storage.objects;
CREATE POLICY owner_outcome_evidence_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'owner-outcome-evidence'
         AND public.owner_outcome_evidence_ok(name, 'write'));

-- ─── 5. Giá trúng hợp nhất: thêm nguồn "đơn vị tự khai" ─────────────────────
--
-- Nguồn (§A3):
--   1 platform       "Sàn xác nhận"           lô mới nhất trên sàn của tin
--   2 reconciled     "Đã đối chiếu"           đơn vị tự khai KHỚP báo cáo tổ chức (cùng lượt, cùng kết quả, giá lệch ≤ 1%)
--   3 owner_evidence "Tự khai · có biên bản"  đơn vị tự khai có biên bản
--   4 self_reported  "Tự khai"                đơn vị tự khai / org_auction_records (CRAWLED ⇒ hạ xuống 5)
--   5 estimated      "Ước tính"               tin cào
--
-- Đơn vị tự khai chỉ góp LƯỢT MỚI NHẤT của mỗi tin (round_no lớn nhất): lượt cũ
-- là lịch sử. Nếu không, lượt 1 "không thành" có biên bản (hạng 3) sẽ đè lượt 2
-- "thành" không biên bản (hạng 4).
--
-- Chọn nguồn thắng theo LƯỢT HIỆN TẠI trước rồi mới tới hạng: lượt hiện tại =
-- mọi ứng viên cách ngày mới nhất của tin ≤ 7 ngày (hoặc thiếu ngày). Trong lượt
-- đó: hạng nhỏ thắng, rồi ngày mới hơn, rồi thứ tự nguồn platform → owner_report
-- → crawled → org_report (giữ đúng thứ tự hoà của Phase 5 giữa crawled và
-- org_report; số của chính đơn vị thắng khi hoà hạng 4 cùng ngày). Đo trên dữ
-- liệu thật lúc viết: 0 kết quả hiện có bị đổi.
--
-- has_conflict: giữ nguyên luật Phase 5.
-- Không bao giờ trả danh tính người trúng, internal_notes, details, hay đường
-- dẫn biên bản.

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
  -- 2–4. Đơn vị tự khai: chỉ lượt mới nhất của mỗi tin.
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
           o.auction_org_id                    AS org_id
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
        -- Đối chiếu với báo cáo THẬT của tổ chức (không phải bản cào), cùng lượt
        -- theo đúng luật has_conflict: thiếu ngày thì coi như cùng lượt.
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
    UNION ALL SELECT * FROM owner_report
    UNION ALL SELECT * FROM org_report
    UNION ALL SELECT * FROM crawled
  ),
  latest AS (
    SELECT c.lid, max(c.odate) AS last_date FROM cand c GROUP BY c.lid
  ),
  ranked AS (
    SELECT c.*,
           row_number() OVER (
             PARTITION BY c.lid
             ORDER BY (c.odate IS NULL OR lt.last_date IS NULL OR c.odate >= lt.last_date - 7) DESC,
                      c.rnk,
                      c.odate DESC NULLS LAST,
                      CASE c.kind WHEN 'platform'     THEN 1
                                  WHEN 'owner_report' THEN 2
                                  WHEN 'crawled'      THEN 3
                                  ELSE 4 END
           ) AS pos
      FROM cand c
      JOIN latest lt ON lt.lid = c.lid
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

-- ─── 6. Tự kiểm ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT (SELECT c.relrowsecurity FROM pg_class c
           WHERE c.oid = 'public.owner_asset_outcomes'::regclass) THEN
    RAISE EXCEPTION 'owner_asset_outcomes self-check: chưa bật RLS';
  END IF;

  IF (SELECT count(*) FROM pg_proc
       WHERE proname = 'owner_asset_outcomes_resolved'
         AND pronamespace = 'public'::regnamespace) <> 1 THEN
    RAISE EXCEPTION 'owner_asset_outcomes self-check: owner_asset_outcomes_resolved phải có đúng 1 bản';
  END IF;

  IF has_function_privilege('anon', 'public.owner_asset_outcomes_resolved(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.owner_outcome_evidence_ok(text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'owner_asset_outcomes self-check: hàm đang mở cho anon';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.owner_outcome_evidence_ok(text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'owner_asset_outcomes self-check: authenticated không gọi được helper storage (policy sẽ vỡ)';
  END IF;

  IF (SELECT b.public FROM storage.buckets b WHERE b.id = 'owner-outcome-evidence') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'owner_asset_outcomes self-check: bucket biên bản phải private';
  END IF;
END;
$$;
