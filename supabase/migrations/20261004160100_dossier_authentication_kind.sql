-- Giám định tách khỏi Thẩm định giá: mục hồ sơ hoàn chỉnh có thêm kind 'authentication'
-- (kết quả giám định của ĐỐI TÁC RIÊNG — kết luận + số chứng thư + tệp minh chứng).
--
-- Trước đây kind 'appraisal' gánh cả hai: source 'external_partner' = giá trị thẩm định của
-- đối tác riêng, source 'marketplace' = đặt GIÁM ĐỊNH qua sàn. Nay:
--   appraisal      → thẩm định giá (đối tác riêng | đơn asset_valuation_orders của sàn)
--   authentication → giám định     (đối tác riêng | đơn asset_authentication_orders của sàn)
-- Dòng appraisal/marketplace cũ mang nghĩa giám định ⇒ chuyển sang authentication.
--
-- Kết luận của đối tác riêng KHÔNG thoả BR-GD-03 (bắt buộc giám định chỉ nhận chứng thư của
-- sàn) và không vào mức xác minh. _dossier_trust_compute (UI đã gỡ) giữ nguyên.

ALTER TABLE public.asset_posting_dossier_items DROP CONSTRAINT asset_posting_dossier_items_kind_check;
ALTER TABLE public.asset_posting_dossier_items ADD CONSTRAINT asset_posting_dossier_items_kind_check
  CHECK (kind IN ('appraisal', 'legal', 'auction', 'authentication'));

ALTER TABLE public.asset_posting_dossier_items
  ADD COLUMN auth_verdict   TEXT CHECK (auth_verdict IN ('authentic', 'inconclusive', 'suspected_fake')),
  ADD COLUMN certificate_no TEXT CHECK (length(certificate_no) <= 200);

ALTER TABLE public.asset_posting_dossier_items
  ADD CONSTRAINT ext_auth_verdict
    CHECK (kind <> 'authentication' OR source <> 'external_partner' OR auth_verdict IS NOT NULL),
  ADD CONSTRAINT auth_verdict_kind_only
    CHECK (auth_verdict IS NULL OR kind = 'authentication');

COMMENT ON COLUMN public.asset_posting_dossier_items.auth_verdict IS
  'Chỉ kind=authentication: kết luận giám định của đối tác riêng (tham khảo, không thay chứng thư của sàn).';

ALTER TABLE public.owner_partners DROP CONSTRAINT owner_partners_kind_check;
ALTER TABLE public.owner_partners ADD CONSTRAINT owner_partners_kind_check
  CHECK (kind IN ('appraisal', 'legal', 'auction', 'authentication'));

-- Dữ liệu: appraisal/marketplace cũ = giám định qua sàn. Không ghi nhật ký (đổi kỹ thuật).
ALTER TABLE public.asset_posting_dossier_items DISABLE TRIGGER owner_audit;
UPDATE public.asset_posting_dossier_items d
   SET kind = 'authentication'
 WHERE d.kind = 'appraisal' AND d.source = 'marketplace'
   AND NOT EXISTS (SELECT 1 FROM public.asset_posting_dossier_items x
                    WHERE x.posting_id = d.posting_id AND x.kind = 'authentication');
ALTER TABLE public.asset_posting_dossier_items ENABLE TRIGGER owner_audit;

-- Tệp minh chứng: thêm thư mục authentication (chép bản LIVE).
CREATE OR REPLACE FUNCTION public.posting_dossier_evidence_ok(_name text, _action text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_posting UUID;
BEGIN
  BEGIN
    v_posting := split_part(_name, '/', 1)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;
  IF split_part(_name, '/', 2) NOT IN ('appraisal','legal','auction','authentication')
     OR split_part(_name, '/', 3) = '' THEN
    RETURN false;
  END IF;

  IF _action = 'read' THEN
    RETURN public.owner_posting_can(v_posting, 'read')
        OR public.admin_has_permission('tai-san-tu-nguyen', 'view');
  ELSIF _action = 'write' THEN
    RETURN public.owner_posting_can(v_posting, 'so-hoa', 'update');
  END IF;
  RETURN false;
END;
$function$


;

-- Bảng điểm đối tác: mang thêm auth_verdict trong asset_list (chép bản LIVE, RETURNS giữ nguyên).
CREATE OR REPLACE FUNCTION public.owner_partner_scorecard(p_workspace_id uuid)
 RETURNS TABLE(kind text, partner_key text, partner_org_id uuid, partner_name text, assets integer, assets_with_outcome integer, sold_assets integer, median_deviation numeric, unsold_2plus_rate numeric, legal_issue_assets integer, success_rate numeric, avg_rounds_to_sell numeric, avg_participants numeric, asset_list jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_full  BOOLEAN;
  v_scope UUID[];
BEGIN
  IF NOT public.owner_ws_can(p_workspace_id, 'read') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- Thành viên trực tiếp: vai trò hệ thống hoặc không giới hạn ⇒ thấy hết; còn lại theo branch_scope.
  -- Không phải thành viên trực tiếp mà qua được owner_ws_can ⇒ Trạm cha (vai trò hệ thống) ⇒ thấy hết.
  SELECT r.is_system OR m.branch_scope IS NULL, m.branch_scope
    INTO v_full, v_scope
    FROM public.asset_owner_workspace_members m
    JOIN public.owner_ws_roles r ON r.id = m.role_id AND r.workspace_id = m.workspace_id
   WHERE m.workspace_id = p_workspace_id
     AND m.user_id = auth.uid()
     AND m.status = 'active';
  IF NOT FOUND THEN
    v_full := true;
  END IF;

  RETURN QUERY
  WITH posts AS (
    SELECT p.id, p.code, p.title
      FROM public.asset_postings p
     WHERE p.workspace_id = p_workspace_id
       AND (v_full OR p.branch_id = ANY (v_scope))
  ),
  partners AS (
    SELECT d.posting_id                                          AS pid,
           d.kind                                                AS pkind,
           d.partner_org_id                                      AS org_id,
           CASE WHEN d.partner_org_id IS NOT NULL THEN 'org:' || d.partner_org_id::text
                ELSE 'name:' || public.partner_name_key(d.partner_name) END AS pkey,
           COALESCE(ao.name, regexp_replace(btrim(d.partner_name), '\s+', ' ', 'g')) AS pname,
           d.appraised_value                                     AS appraised,
           d.auth_verdict                                        AS auth_verdict
      FROM public.asset_posting_dossier_items d
      JOIN posts ps ON ps.id = d.posting_id
      LEFT JOIN public.auction_organizations ao ON ao.id = d.partner_org_id
     WHERE d.source = 'external_partner'
       AND (d.partner_org_id IS NOT NULL OR public.partner_name_key(d.partner_name) IS NOT NULL)
  ),
  events AS (
    -- Phiên trên sàn: mỗi lô đã đóng / rút của hồ sơ = một lượt.
    SELECT i.asset_posting_id                                    AS pid,
           1                                                     AS prio,
           CASE WHEN s.status = 'cancelled'  THEN 'cancelled'
                WHEN ls.status = 'withdrawn' THEN 'withdrawn'
                ELSE ls.result END                               AS outcome,
           CASE WHEN s.status = 'published' AND ls.result = 'sold'
                THEN COALESCE(sc.price, ls.winning_amount) END   AS price,
           (COALESCE(ls.closed_at, ls.updated_at) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS odate,
           CASE WHEN ls.status = 'closed' THEN
             (SELECT count(DISTINCT b.bidder_no)::int FROM public.auction_bids b
               WHERE b.lot_id = i.id AND b.withdrawn_at IS NULL) END AS participants,
           COALESCE(ls.withdraw_reason, s.cancelled_reason)      AS reason,
           NULL::int                                             AS round_no
      FROM public.auction_session_items i
      JOIN posts ps                       ON ps.id = i.asset_posting_id
      JOIN public.auction_sessions s      ON s.id = i.session_id
                                         AND s.status IN ('published', 'cancelled')
      JOIN public.auction_lot_states ls   ON ls.lot_id = i.id
                                         AND ls.status IN ('closed', 'withdrawn')
      LEFT JOIN public.auction_sale_contracts sc ON sc.lot_id = i.id AND sc.status <> 'cancelled'
    UNION ALL
    -- Đơn vị tự khai cho hồ sơ.
    SELECT o.asset_posting_id, 2, o.outcome,
           CASE WHEN o.outcome = 'sold' THEN o.winning_price END,
           o.auction_date, o.participants, o.failure_reason, o.round_no
      FROM public.owner_asset_outcomes o
      JOIN posts ps ON ps.id = o.asset_posting_id
     WHERE o.workspace_id = p_workspace_id
  ),
  ev AS (
    SELECT e.*,
           e.outcome IN ('sold', 'unsold')                                      AS held,
           bool_or(e.prio = 1 AND e.outcome IN ('sold', 'unsold')) OVER (PARTITION BY e.pid) AS has_platform
      FROM events e
  ),
  per_post AS (
    -- Cùng một lượt có thể vừa có lô trên sàn vừa được đơn vị tự khai ⇒ KHÔNG cộng hai nguồn:
    -- số lượt lấy nguồn nhiều hơn; giá bán và số người tham gia ưu tiên phiên trên sàn.
    SELECT e.pid,
           bool_or(e.outcome IN ('sold', 'unsold', 'cancelled', 'withdrawn'))   AS has_outcome,
           bool_or(e.outcome = 'sold')                                          AS sold,
           greatest(count(*) FILTER (WHERE e.held AND e.prio = 1),
                    count(*) FILTER (WHERE e.held AND e.prio = 2),
                    COALESCE(max(e.round_no) FILTER (WHERE e.held), 0))::int    AS rounds,
           (array_agg(e.price ORDER BY e.prio, e.odate DESC NULLS LAST)
              FILTER (WHERE e.outcome = 'sold'))[1]                             AS sold_price,
           (array_agg(e.outcome ORDER BY e.odate DESC NULLS LAST, e.prio))[1]   AS last_outcome,
           max(e.odate)                                                         AS last_date,
           bool_or(e.outcome <> 'sold' AND public.outcome_reason_is_legal(e.reason)) AS legal_issue,
           sum(e.participants)   FILTER (WHERE e.held AND (e.prio = 1 OR NOT e.has_platform)) AS part_sum,
           count(e.participants) FILTER (WHERE e.held AND (e.prio = 1 OR NOT e.has_platform)) AS part_n
      FROM ev e
     GROUP BY e.pid
  ),
  joined AS (
    SELECT pa.pkind, pa.pkey, pa.org_id, pa.pname, pa.appraised, pa.auth_verdict, ps.id AS pid, ps.code, ps.title,
           COALESCE(pp.has_outcome, false)                       AS has_outcome,
           COALESCE(pp.sold, false)                              AS sold,
           COALESCE(pp.rounds, 0)                                AS rounds,
           -- Đã bán thì lượt bán không tính là "không thành".
           greatest(COALESCE(pp.rounds, 0) - CASE WHEN pp.sold THEN 1 ELSE 0 END, 0) AS unsold_rounds,
           pp.sold_price,
           CASE WHEN pp.sold THEN 'sold' ELSE pp.last_outcome END AS outcome,
           pp.last_date,
           COALESCE(pp.legal_issue, false)                       AS legal_issue,
           COALESCE(pp.part_sum, 0)                              AS part_sum,
           COALESCE(pp.part_n, 0)                                AS part_n
      FROM partners pa
      JOIN posts ps          ON ps.id = pa.pid
      LEFT JOIN per_post pp  ON pp.pid = pa.pid
  )
  SELECT j.pkind,
         j.pkey,
         (array_agg(j.org_id))[1],
         -- Tên hiển thị: ưu tiên cách viết hoa thường ("Công ty …" hơn "công ty …" / "CÔNG TY …").
         (array_agg(j.pname ORDER BY j.pname IN (lower(j.pname), upper(j.pname)), j.pname))[1],
         count(*)::int,
         count(*) FILTER (WHERE j.has_outcome)::int,
         count(*) FILTER (WHERE j.sold)::int,
         round(percentile_cont(0.5) WITHIN GROUP (
                 ORDER BY abs(j.sold_price - j.appraised) / j.appraised)
               FILTER (WHERE j.sold AND j.sold_price IS NOT NULL AND j.appraised > 0)::numeric, 4),
         round(count(*) FILTER (WHERE j.has_outcome AND j.unsold_rounds >= 2)::numeric
               / NULLIF(count(*) FILTER (WHERE j.has_outcome), 0), 4),
         count(*) FILTER (WHERE j.legal_issue)::int,
         round(count(*) FILTER (WHERE j.sold)::numeric
               / NULLIF(count(*) FILTER (WHERE j.has_outcome), 0), 4),
         round(avg(j.rounds) FILTER (WHERE j.sold AND j.rounds > 0), 2),
         round(sum(j.part_sum)::numeric / NULLIF(sum(j.part_n), 0), 2),
         jsonb_agg(jsonb_build_object(
           'posting_id',      j.pid,
           'code',            j.code,
           'title',           j.title,
           'outcome',         j.outcome,
           'rounds',          j.rounds,
           'sold_price',      j.sold_price,
           'appraised_value', j.appraised,
           'last_date',       j.last_date,
           'legal_issue',     j.legal_issue,
           'auth_verdict',    j.auth_verdict
         ) ORDER BY j.last_date DESC NULLS LAST, j.code)
    FROM joined j
   GROUP BY j.pkind, j.pkey
   ORDER BY j.pkind, count(*) FILTER (WHERE j.has_outcome) DESC, count(*) DESC, 4;
END;
$function$


;
