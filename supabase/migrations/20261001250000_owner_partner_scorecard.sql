-- "Đối tác của tôi" — bảng điểm đối tác (docs/owner-dossier-plan.md Phase 5, §A7).
--
--  • Đối tác = phần dịch vụ chủ TỰ NHẬP (asset_posting_dossier_items.source = 'external_partner').
--    Gom theo partner_org_id; không có thì theo tên chuẩn hoá (trim + lower + unaccent + gộp
--    khoảng trắng) ⇒ "Công ty Định giá A" và "cong ty dinh gia  a" là MỘT đối tác.
--  • Kết quả gom THEO HỒ SƠ (dossier gắn asset_postings, không gắn tin listings):
--    owner_asset_outcomes_resolved chỉ phủ tin đã khớp (asset_owner_claims) và KHÔNG có cầu
--    hồ sơ → tin, nên lấy hai nguồn có asset_posting_id:
--      - phiên trên sàn: lô của auction_session_items.asset_posting_id (phiên published/cancelled,
--        lô closed/withdrawn) — cùng cách đọc nhánh 'platform' của owner_asset_outcomes_resolved;
--      - đơn vị tự khai: owner_asset_outcomes.asset_posting_id.
--    Lượt "đã đấu" = sold / unsold. Số lượt = max(lượt trên sàn, lượt tự khai, round_no lớn nhất
--    tự khai) — không cộng hai nguồn; giá bán và số người tham gia ưu tiên phiên trên sàn.
--  • Tính hết các chỉ số, kèm assets_with_outcome ⇒ UI tự ẩn khi < 3 ("Chưa đủ dữ liệu").
--  • D3: bảng điểm KHÔNG đổi điểm tin cậy hồ sơ (asset_posting_dossier_trust không đọc hàm này).
--  • Phạm vi: thành viên Trạm (owner_ws_can 'read'); cán bộ có branch_scope chỉ thấy hồ sơ
--    thuộc chi nhánh mình (hồ sơ không gắn chi nhánh coi như ngoài phạm vi, giống luật ghi).

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- ─── 1. Chuẩn hoá tên đối tác tự gõ ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.partner_name_key(p_name TEXT)
RETURNS TEXT LANGUAGE sql STABLE SET search_path = public, extensions
AS $$
  SELECT NULLIF(regexp_replace(lower(extensions.unaccent(btrim(COALESCE(p_name, '')))), '\s+', ' ', 'g'), '')
$$;
GRANT EXECUTE ON FUNCTION public.partner_name_key(TEXT) TO authenticated;

-- ─── 2. Lý do huỷ / hoãn / không thành có phải vì pháp lý? ───────────────────
-- failure_reason / withdraw_reason / cancelled_reason là chữ tự do (trừ vài mã UNSOLD_REASONS
-- không liên quan pháp lý) ⇒ so từ khoá trên chuỗi đã bỏ dấu.
CREATE OR REPLACE FUNCTION public.outcome_reason_is_legal(p_reason TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path = public, extensions
AS $$
  SELECT COALESCE(
    lower(extensions.unaccent(p_reason))
      ~ '(phap ly|tranh chap|thi hanh an|ke bien|phong toa|ngan chan|toa an|khieu nai|khoi kien|giay to|so huu|so do|so hong|giay chung nhan|quyen su dung|the chap|bao dam)',
    false)
$$;
GRANT EXECUTE ON FUNCTION public.outcome_reason_is_legal(TEXT) TO authenticated;

-- ─── 3. Bảng điểm ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_partner_scorecard(p_workspace_id UUID)
RETURNS TABLE (
  kind                TEXT,     -- appraisal | legal | auction
  partner_key         TEXT,     -- 'org:<uuid>' | 'name:<tên chuẩn hoá>'
  partner_org_id      UUID,
  partner_name        TEXT,
  assets              INT,      -- số hồ sơ dùng đối tác này
  assets_with_outcome INT,      -- số hồ sơ đã có kết quả (sold/unsold/cancelled/withdrawn)
  sold_assets         INT,
  -- Thẩm định giá
  median_deviation    NUMERIC,  -- trung vị |giá trúng − giá thẩm định| / giá thẩm định (tài sản đã bán)
  unsold_2plus_rate   NUMERIC,  -- tỉ lệ hồ sơ có ≥ 2 lượt không thành / hồ sơ có kết quả
  -- Pháp lý
  legal_issue_assets  INT,      -- hồ sơ bị huỷ / hoãn / không thành vì lý do pháp lý
  -- Tổ chức đấu giá
  success_rate        NUMERIC,  -- đã bán / hồ sơ có kết quả
  avg_rounds_to_sell  NUMERIC,  -- trung bình số lượt tới khi bán (tài sản đã bán)
  avg_participants    NUMERIC,  -- trung bình người tham gia mỗi lượt đã đấu
  asset_list          JSONB     -- [{posting_id, code, title, outcome, rounds, sold_price, appraised_value, last_date, legal_issue}]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
           d.appraised_value                                     AS appraised
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
    SELECT pa.pkind, pa.pkey, pa.org_id, pa.pname, pa.appraised, ps.id AS pid, ps.code, ps.title,
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
           'legal_issue',     j.legal_issue
         ) ORDER BY j.last_date DESC NULLS LAST, j.code)
    FROM joined j
   GROUP BY j.pkind, j.pkey
   ORDER BY j.pkind, count(*) FILTER (WHERE j.has_outcome) DESC, count(*) DESC, 4;
END;
$$;
REVOKE ALL ON FUNCTION public.owner_partner_scorecard(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_partner_scorecard(UUID) TO authenticated;

-- ─── 4. Tự kiểm ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF public.partner_name_key('  Công ty  Thẩm định ĐẤT Việt ') <> 'cong ty tham dinh dat viet' THEN
    RAISE EXCEPTION 'owner_partner_scorecard self-check: partner_name_key chuẩn hoá sai (%)',
      public.partner_name_key('  Công ty  Thẩm định ĐẤT Việt ');
  END IF;
  IF NOT public.outcome_reason_is_legal('Hoãn để bổ sung hồ sơ pháp lý')
     OR public.outcome_reason_is_legal('single_bidder') THEN
    RAISE EXCEPTION 'owner_partner_scorecard self-check: outcome_reason_is_legal nhận sai';
  END IF;
  IF has_function_privilege('anon', 'public.owner_partner_scorecard(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'owner_partner_scorecard self-check: đang mở cho anon';
  END IF;
END;
$$;
