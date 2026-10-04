-- Truyền thông của chủ tài sản — Phase M5 (docs/owner-marketing-plan.md): phễu + báo cáo định kỳ.
--
--   1. Ghi nhận nguồn — lần chạm cuối trong 30 ngày (cookie mkt_link_id do /l/:code đặt, M1):
--      • analytics_events + mkt_link_id, listing_id. Sự kiện 'save_asset' chỉ GIỮ link khi trigger
--        xác nhận: người lưu đã đăng nhập, đang thật sự lưu đúng tin của link, không phải thành viên
--        Trạm, và chưa từng được ghi nhận lưu tin đó. Không đạt ⇒ vẫn ghi sự kiện, bỏ link.
--        Có link thì listing_id do SERVER ghi theo link.
--      • auction_bidding_contracts.mkt_link_id — người mua gọi mkt_attribute_bidding_contract ngay
--        sau start_bidding_contract (không đổi chữ ký RPC cũ). Đăng ký chỉ TÍNH khi hồ sơ đã thanh toán.
--   2. owner_mkt_funnel(ws, từ, đến, tài sản) → phễu B5 theo kênh, theo nguồn, theo tài sản.
--      Mọi phép tính ở owner_mkt_funnel_core (nội bộ) — tab "Hiệu quả", lọc một tài sản và báo cáo
--      định kỳ dùng CHUNG một hàm ⇒ cùng kỳ thì cùng số.
--   3. owner_build_report_payload thêm phần 'marketing' (đóng băng khi chốt); owner_report_public_payload
--      cho phần này qua link /r/:token. Không có dữ liệu cá nhân: chỉ số đếm theo link / gói / tài sản.
--
-- Không xác định nguồn: lượt lưu / đăng ký của tài sản đang truyền thông nhưng KHÔNG mang link
-- (khách tự tìm, link của sàn, đăng ký ngoài sàn…). Gửi / mở / bấm của gói sàn làm (M4) lấy từ
-- bộ đếm chiến dịch email / banner — không gắn được tới từng lượt lưu / đăng ký.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1a. Lượt lưu tài sản mang link (analytics_events)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.analytics_events
  ADD COLUMN mkt_link_id UUID REFERENCES public.owner_mkt_links(id) ON DELETE SET NULL,
  ADD COLUMN listing_id  UUID REFERENCES public.listings(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.analytics_events.mkt_link_id IS
  'Link theo dõi đã đưa khách tới (Phase M5). Chỉ giữ trên save_asset đã được trigger analytics_events_mkt_guard xác nhận.';
COMMENT ON COLUMN public.analytics_events.listing_id IS
  'Tin của sự kiện tính năng (save_asset…). Có mkt_link_id thì server ghi theo link.';

CREATE INDEX analytics_events_mkt_link_idx ON public.analytics_events (mkt_link_id, created_at)
  WHERE mkt_link_id IS NOT NULL;
CREATE INDEX analytics_events_listing_feature_idx ON public.analytics_events (listing_id, feature_key, user_id)
  WHERE listing_id IS NOT NULL;

CREATE FUNCTION public.analytics_events_mkt_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _link public.owner_mkt_links%ROWTYPE;
BEGIN
  IF NEW.mkt_link_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _link FROM public.owner_mkt_links WHERE id = NEW.mkt_link_id;
  IF NOT FOUND
     OR NEW.event_type <> 'feature'
     OR NEW.feature_key IS DISTINCT FROM 'save_asset'
     OR NEW.user_id IS NULL
     OR NEW.user_id IS DISTINCT FROM auth.uid()
     -- Vào bằng link của tài sản A rồi lưu tài sản B ⇒ B không nhờ link A.
     OR (NEW.listing_id IS NOT NULL AND NEW.listing_id <> _link.listing_id)
     OR NOT EXISTS (SELECT 1 FROM public.user_asset_actions a
                     WHERE a.user_id = NEW.user_id AND a.listing_id = _link.listing_id AND a.is_saved)
     -- Thành viên Trạm tự lưu tài sản của mình không tính (như owner_mkt_track_hit).
     OR public.owner_ws_can(_link.workspace_id, 'read')
     -- Bỏ lưu rồi lưu lại không tính thêm lần nữa.
     OR EXISTS (SELECT 1 FROM public.analytics_events e
                 WHERE e.listing_id = _link.listing_id AND e.feature_key = 'save_asset'
                   AND e.user_id = NEW.user_id AND e.mkt_link_id IS NOT NULL) THEN
    NEW.mkt_link_id := NULL;
    RETURN NEW;
  END IF;

  NEW.listing_id := _link.listing_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER analytics_events_mkt_guard
  BEFORE INSERT ON public.analytics_events
  FOR EACH ROW EXECUTE FUNCTION public.analytics_events_mkt_guard();

-- ═══════════════════════════════════════════════════════════════════════════
-- 1b. Hồ sơ tham gia mang link (auction_bidding_contracts)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.auction_bidding_contracts
  ADD COLUMN mkt_link_id UUID REFERENCES public.owner_mkt_links(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.auction_bidding_contracts.mkt_link_id IS
  'Link theo dõi đã đưa người mua tới (Phase M5). Chỉ ghi qua mkt_attribute_bidding_contract; tính là đăng ký khi status = paid.';

CREATE INDEX auction_bidding_contracts_mkt_link_idx ON public.auction_bidding_contracts (mkt_link_id)
  WHERE mkt_link_id IS NOT NULL;

-- Người mua gắn link vào hồ sơ CỦA MÌNH vừa tạo. Lần gắn đầu thắng (gọi lại khi gia hạn giữ chỗ
-- không đổi nguồn). Link phải thuộc một tài sản có trong phiên của hồ sơ.
-- Lỗi: not_authenticated · not_found · invalid_status · link_not_found · not_in_session · member.
CREATE FUNCTION public.mkt_attribute_bidding_contract(p_contract_id UUID, p_link_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c    public.auction_bidding_contracts%ROWTYPE;
  _link public.owner_mkt_links%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO _c FROM public.auction_bidding_contracts WHERE id = p_contract_id FOR UPDATE;
  IF NOT FOUND OR _c.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF _c.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;
  IF _c.mkt_link_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  SELECT * INTO _link FROM public.owner_mkt_links WHERE id = p_link_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'link_not_found');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.auction_session_items i
                  WHERE i.session_id = _c.session_id AND i.listing_id = _link.listing_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_in_session');
  END IF;
  IF public.owner_ws_can(_link.workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'member');
  END IF;

  UPDATE public.auction_bidding_contracts SET mkt_link_id = _link.id WHERE id = _c.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Phễu
-- ═══════════════════════════════════════════════════════════════════════════

-- Nội bộ (không cấp cho client). p_viewer_scope = lọc theo phạm vi chi nhánh của người gọi
-- (truyen-thong:view); báo cáo định kỳ đã tự kiểm phạm vi nên truyền false.
--
-- Tài sản "đang truyền thông" = tin Trạm đã nhận có ít nhất một link tạo trước cuối kỳ hoặc một
-- đơn "Giao việc cho sàn" đã trả trước cuối kỳ. Mọi số chỉ tính trên tập này.
--   Gửi        = email sàn gửi + lượt hiển thị banner (gói sàn làm)
--   Mở          = email được mở
--   Bấm         = lượt mở link theo dõi + lượt bấm email / banner
--   Xem tài sản = người mở link (số phiên trình duyệt khác nhau, theo từng link) + lượt bấm email / banner
--   Lưu         = lượt lưu mang link · Đăng ký = hồ sơ đã thanh toán mang link
--   Người tham gia / Kết quả = của tài sản đang truyền thông có kết quả trong kỳ (không quy nguồn)
CREATE FUNCTION public.owner_mkt_funnel_core(
  p_workspace_id UUID,
  p_from         DATE,
  p_to           DATE,
  p_listing_id   UUID,
  p_branch_id    UUID,
  p_viewer_scope BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_from TIMESTAMPTZ := p_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_to   TIMESTAMPTZ := (p_to + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_out  JSONB;
BEGIN
  WITH
  br AS (
    SELECT wb.id, wb.asset_owner_id,
           COALESCE(NULLIF(btrim(wb.display_name), ''), ao.name, 'Chi nhánh chưa đặt tên') AS name
      FROM public.workspace_branches wb
      LEFT JOIN public.asset_owners ao ON ao.id = wb.asset_owner_id
     WHERE wb.workspace_id = p_workspace_id
  ),
  -- Tin Trạm đã nhận (cùng luật với owner_mkt_links_prepare); chi nhánh suy từ claim.
  claimed AS (
    SELECT DISTINCT ON (c.listing_id) c.listing_id AS lid, br.id AS bid, br.name AS branch_name
      FROM public.asset_owner_claims c
      LEFT JOIN br ON br.asset_owner_id = c.asset_owner_id
     WHERE c.workspace_id = p_workspace_id
       AND c.status IN ('auto_claimed', 'confirmed')
       AND c.listing_id IS NOT NULL
       AND (p_listing_id IS NULL OR c.listing_id = p_listing_id)
     ORDER BY c.listing_id, c.created_at
  ),
  scoped AS (
    SELECT cl.*
      FROM claimed cl
     WHERE (p_branch_id IS NULL OR cl.bid = p_branch_id)
       AND (NOT p_viewer_scope OR public.owner_ws_has_in(p_workspace_id, 'truyen-thong', 'view', cl.bid))
  ),
  lk AS MATERIALIZED (
    SELECT k.id, k.listing_id AS lid, k.channel,
           CASE WHEN k.campaign_id IS NULL THEN 'own_links' ELSE 'self_serve' END AS source
      FROM public.owner_mkt_links k
      JOIN scoped s ON s.lid = k.listing_id
     WHERE k.workspace_id = p_workspace_id
       AND k.created_at < v_to
  ),
  ord AS MATERIALIZED (
    SELECT o.id, o.listing_id AS lid, o.variant_key, o.marketing_campaign_id, o.advertisement_id,
           o.paid_at, o.completed_at
      FROM public.owner_mkt_orders o
      JOIN scoped s ON s.lid = o.listing_id
     WHERE o.workspace_id = p_workspace_id
       AND o.status IN ('paid', 'in_progress', 'completed')
       AND o.paid_at < v_to
  ),
  mk AS MATERIALIZED (
    SELECT s.lid, s.bid, s.branch_name, l.title
      FROM scoped s
      JOIN public.listings l ON l.id = s.lid
     WHERE EXISTS (SELECT 1 FROM lk WHERE lk.lid = s.lid)
        OR EXISTS (SELECT 1 FROM ord WHERE ord.lid = s.lid)
  ),

  -- ─── Kênh riêng của đơn vị (link theo dõi) ────────────────────────────────
  link_hits AS (
    SELECT h.link_id,
           count(*)::int AS hits,
           count(DISTINCT COALESCE(h.session_id, 'h' || h.id::text))::int AS visitors
      FROM public.owner_mkt_link_hits h
      JOIN lk ON lk.id = h.link_id
     WHERE h.created_at >= v_from AND h.created_at < v_to
     GROUP BY h.link_id
  ),
  link_saves AS (
    SELECT e.mkt_link_id AS link_id, count(DISTINCT e.user_id)::int AS saves
      FROM public.analytics_events e
      JOIN lk ON lk.id = e.mkt_link_id
     WHERE e.feature_key = 'save_asset'
       AND e.created_at >= v_from AND e.created_at < v_to
     GROUP BY e.mkt_link_id
  ),
  link_regs AS (
    SELECT b.mkt_link_id AS link_id, count(*)::int AS regs
      FROM public.auction_bidding_contracts b
      JOIN lk ON lk.id = b.mkt_link_id
     WHERE b.status = 'paid'
       AND b.paid_at >= v_from AND b.paid_at < v_to
     GROUP BY b.mkt_link_id
  ),
  per_link AS (
    SELECT lk.id, lk.lid, lk.channel, lk.source,
           COALESCE(h.hits, 0)     AS hits,
           COALESCE(h.visitors, 0) AS visitors,
           COALESCE(s.saves, 0)    AS saves,
           COALESCE(r.regs, 0)     AS regs
      FROM lk
      LEFT JOIN link_hits h  ON h.link_id = lk.id
      LEFT JOIN link_saves s ON s.link_id = lk.id
      LEFT JOIN link_regs r  ON r.link_id = lk.id
  ),

  -- ─── Gói sàn làm (Giao việc cho sàn) — bộ đếm chiến dịch email / banner ───
  -- Đơn còn sống trong kỳ: trả trước cuối kỳ, chưa hoàn tất trước đầu kỳ. Email tính theo ngày gửi;
  -- banner tính khi lịch hiển thị chạm kỳ (bộ đếm banner là cộng dồn cả đời banner).
  per_order AS (
    SELECT o.id, o.lid, o.variant_key,
           (COALESCE(c.sent_count, 0) + COALESCE(a.view_count, 0))::int     AS sent,
           COALESCE(c.opened_count, 0)::int                                 AS opened,
           (COALESCE(c.clicked_count, 0) + COALESCE(a.click_count, 0))::int AS clicks
      FROM ord o
      LEFT JOIN public.marketing_campaigns c
             ON c.id = o.marketing_campaign_id
            AND c.sent_at >= v_from AND c.sent_at < v_to
      LEFT JOIN public.advertisements a
             ON a.id = o.advertisement_id
            AND COALESCE(a.start_at, a.created_at) < v_to
            AND (a.end_at IS NULL OR a.end_at >= v_from)
     WHERE o.completed_at IS NULL OR o.completed_at >= v_from
  ),

  -- ─── Không xác định nguồn ────────────────────────────────────────────────
  all_saves AS (
    SELECT a.listing_id AS lid, count(*)::int AS n
      FROM public.user_asset_actions a
      JOIN mk ON mk.lid = a.listing_id
     WHERE a.is_saved AND a.created_at >= v_from AND a.created_at < v_to
     GROUP BY a.listing_id
  ),
  -- Hồ sơ đã thanh toán trong kỳ của các phiên có tài sản đang truyền thông.
  sess_regs AS (
    SELECT DISTINCT i.listing_id AS lid, b.id, b.mkt_link_id
      FROM public.auction_session_items i
      JOIN mk ON mk.lid = i.listing_id
      JOIN public.auction_bidding_contracts b ON b.session_id = i.session_id
     WHERE b.status = 'paid' AND b.paid_at >= v_from AND b.paid_at < v_to
  ),

  -- ─── Kết quả phiên của tài sản đang truyền thông ─────────────────────────
  res AS (
    SELECT o.listing_id AS lid, o.resolved_outcome, o.resolved_price, o.resolved_date,
           o.starting_price, o.best_kind,
           CASE
             WHEN o.best_kind = 'platform' THEN (
               SELECT count(DISTINCT b.id)::int
                 FROM public.auction_session_items i
                 JOIN public.auction_lot_states ls ON ls.lot_id = i.id AND ls.status = 'closed'
                 JOIN public.auction_bidding_contracts b
                   ON b.session_id = i.session_id AND b.status = 'paid' AND b.bidder_no IS NOT NULL
                WHERE i.listing_id = o.listing_id
                  AND (COALESCE(ls.closed_at, ls.updated_at) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = o.resolved_date)
             ELSE (SELECT oo.participants FROM public.owner_asset_outcomes oo WHERE oo.id = o.own_outcome_id)
           END AS participants
      FROM public.owner_outcomes_overview_core(p_workspace_id) o
      JOIN mk ON mk.lid = o.listing_id
     WHERE o.resolved_date BETWEEN p_from AND p_to
  ),

  -- ─── Theo tài sản ────────────────────────────────────────────────────────
  asset_rows AS (
    SELECT mk.lid, mk.title, mk.branch_name,
           (SELECT count(*) FROM lk WHERE lk.lid = mk.lid)::int                        AS links,
           (SELECT count(*) FROM per_order po WHERE po.lid = mk.lid)::int              AS orders,
           COALESCE((SELECT sum(po.sent) FROM per_order po WHERE po.lid = mk.lid), 0)::int   AS sent,
           COALESCE((SELECT sum(po.opened) FROM per_order po WHERE po.lid = mk.lid), 0)::int AS opened,
           COALESCE((SELECT sum(pl.hits) FROM per_link pl WHERE pl.lid = mk.lid), 0)::int
             + COALESCE((SELECT sum(po.clicks) FROM per_order po WHERE po.lid = mk.lid), 0)::int AS clicks,
           COALESCE((SELECT sum(pl.visitors) FROM per_link pl WHERE pl.lid = mk.lid), 0)::int
             + COALESCE((SELECT sum(po.clicks) FROM per_order po WHERE po.lid = mk.lid), 0)::int AS visitors,
           COALESCE((SELECT sum(pl.saves) FROM per_link pl WHERE pl.lid = mk.lid), 0)::int     AS saves,
           COALESCE((SELECT n FROM all_saves x WHERE x.lid = mk.lid), 0)                       AS saves_all,
           COALESCE((SELECT sum(pl.regs) FROM per_link pl WHERE pl.lid = mk.lid), 0)::int      AS regs,
           (SELECT count(*) FROM sess_regs sr WHERE sr.lid = mk.lid)::int                      AS regs_all,
           r.resolved_outcome, r.resolved_price, r.resolved_date, r.starting_price, r.participants
      FROM mk
      LEFT JOIN res r ON r.lid = mk.lid
  ),

  -- ─── Theo kênh / theo nguồn ──────────────────────────────────────────────
  channel_rows AS (
    SELECT 'link'::text AS kind, pl.channel AS key,
           count(*)::int AS items, 0 AS sent, 0 AS opened,
           sum(pl.hits)::int AS clicks, sum(pl.visitors)::int AS visitors,
           sum(pl.saves)::int AS saves, sum(pl.regs)::int AS regs
      FROM per_link pl
     GROUP BY pl.channel
    UNION ALL
    SELECT 'platform'::text, po.variant_key,
           count(*)::int, sum(po.sent)::int, sum(po.opened)::int,
           sum(po.clicks)::int, sum(po.clicks)::int, 0, 0
      FROM per_order po
     GROUP BY po.variant_key
  ),
  source_rows AS (
    SELECT pl.source AS key, count(*)::int AS items, 0 AS sent, 0 AS opened,
           sum(pl.hits)::int AS clicks, sum(pl.visitors)::int AS visitors,
           sum(pl.saves)::int AS saves, sum(pl.regs)::int AS regs
      FROM per_link pl
     GROUP BY pl.source
    UNION ALL
    SELECT 'platform', count(*)::int, COALESCE(sum(po.sent), 0)::int, COALESCE(sum(po.opened), 0)::int,
           COALESCE(sum(po.clicks), 0)::int, COALESCE(sum(po.clicks), 0)::int, 0, 0
      FROM per_order po
    HAVING count(*) > 0
  ),
  unknown AS (
    SELECT COALESCE(sum(greatest(0, a.saves_all - a.saves)), 0)::int AS saves,
           (SELECT count(DISTINCT sr.id) FROM sess_regs sr
             WHERE sr.mkt_link_id IS NULL OR NOT EXISTS (SELECT 1 FROM lk WHERE lk.id = sr.mkt_link_id))::int AS regs
      FROM asset_rows a
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'attribution_days', 30,
    'totals', (
      SELECT jsonb_build_object(
               'assets',        count(*),
               'links',         COALESCE(sum(a.links), 0),
               'orders',        COALESCE(sum(a.orders), 0),
               'sent',          COALESCE(sum(a.sent), 0),
               'opened',        COALESCE(sum(a.opened), 0),
               'clicks',        COALESCE(sum(a.clicks), 0),
               'visitors',      COALESCE(sum(a.visitors), 0),
               'saves',         COALESCE(sum(a.saves), 0),
               'registrations', COALESCE(sum(a.regs), 0),
               'participants',  COALESCE(sum(a.participants) FILTER (WHERE a.resolved_outcome IS NOT NULL), 0),
               'outcomes',      count(*) FILTER (WHERE a.resolved_outcome IS NOT NULL),
               'sold',          count(*) FILTER (WHERE a.resolved_outcome = 'sold'),
               'sold_value',    COALESCE(sum(a.resolved_price) FILTER (WHERE a.resolved_outcome = 'sold'), 0),
               -- Tỷ lệ giá trúng / giá khởi điểm chỉ trên tài sản có đủ cả hai giá.
               'priced_sold_value',     COALESCE(sum(a.resolved_price) FILTER (
                                          WHERE a.resolved_outcome = 'sold' AND a.resolved_price > 0 AND a.starting_price > 0), 0),
               'priced_starting_value', COALESCE(sum(a.starting_price) FILTER (
                                          WHERE a.resolved_outcome = 'sold' AND a.resolved_price > 0 AND a.starting_price > 0), 0))
        FROM asset_rows a
    ),
    'unattributed', (SELECT jsonb_build_object('saves', u.saves, 'registrations', u.regs) FROM unknown u),
    'by_channel', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'kind', c.kind, 'key', c.key, 'items', c.items, 'sent', c.sent, 'opened', c.opened,
               'clicks', c.clicks, 'visitors', c.visitors, 'saves', c.saves, 'registrations', c.regs
             ) ORDER BY c.kind, c.regs DESC, c.clicks DESC, c.key), '[]'::jsonb)
        FROM channel_rows c
    ),
    'by_source', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'key', s.key, 'items', s.items, 'sent', s.sent, 'opened', s.opened,
               'clicks', s.clicks, 'visitors', s.visitors, 'saves', s.saves, 'registrations', s.regs
             ) ORDER BY array_position(ARRAY['self_serve', 'platform', 'own_links'], s.key)), '[]'::jsonb)
        FROM source_rows s
    ),
    'by_asset', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'listing_id',                 a.lid,
               'asset_code',                 upper(left(a.lid::text, 8)),
               'title',                      a.title,
               'branch_name',                a.branch_name,
               'links',                      a.links,
               'orders',                     a.orders,
               'sent',                       a.sent,
               'opened',                     a.opened,
               'clicks',                     a.clicks,
               'visitors',                   a.visitors,
               'saves',                      a.saves,
               'saves_unattributed',         greatest(0, a.saves_all - a.saves),
               'registrations',              a.regs,
               'registrations_unattributed', greatest(0, a.regs_all - a.regs),
               'participants',               a.participants,
               'outcome',                    a.resolved_outcome,
               'outcome_date',               a.resolved_date,
               'price',                      a.resolved_price,
               'starting_price',             a.starting_price
             ) ORDER BY a.regs DESC, a.clicks DESC, a.title), '[]'::jsonb)
        FROM asset_rows a
    )
  )
  INTO v_out;

  RETURN v_out;
END;
$$;

-- Tab "Hiệu quả" (cả đơn vị hoặc một tài sản). Cần truyen-thong:view; người bị giới hạn chi nhánh
-- chỉ thấy tài sản trong phạm vi của mình. Kỳ tối đa 366 ngày.
-- Lỗi: forbidden · invalid_period.
CREATE FUNCTION public.owner_mkt_funnel(
  p_workspace_id UUID,
  p_period_start DATE,
  p_period_end   DATE,
  p_listing_id   UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.owner_ws_has(p_workspace_id, 'truyen-thong', 'view') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_end < p_period_start
     OR p_period_end - p_period_start > 366 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_period');
  END IF;

  RETURN jsonb_build_object('ok', true)
      || public.owner_mkt_funnel_core(p_workspace_id, p_period_start, p_period_end, p_listing_id, NULL, true);
END;
$$;

REVOKE ALL ON FUNCTION public.analytics_events_mkt_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkt_attribute_bidding_contract(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_attribute_bidding_contract(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.owner_mkt_funnel_core(UUID, DATE, DATE, UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_mkt_funnel(UUID, DATE, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_mkt_funnel(UUID, DATE, DATE, UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Báo cáo định kỳ — phần "Hiệu quả truyền thông"
-- ═══════════════════════════════════════════════════════════════════════════
-- Thân hàm chép từ bản LIVE (2026-10-02); chỉ đổi câu RETURN cuối: thêm khoá 'marketing'.

CREATE OR REPLACE FUNCTION public.owner_build_report_payload(p_workspace_id uuid, p_period_type text, p_period_start date, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  c_stuck_rounds CONSTANT INT := 3;
  c_stuck_days   CONSTANT INT := 90;
  v_months     INT;
  v_end        DATE;
  v_next_start DATE;
  v_next_end   DATE;
  v_as_of      DATE := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_unit       TEXT;
  v_scope_name TEXT;
  v_result     JSONB;
BEGIN
  IF NOT public.owner_ws_can(p_workspace_id, 'read') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  v_months := CASE p_period_type WHEN 'month' THEN 1 WHEN 'quarter' THEN 3 WHEN 'year' THEN 12 END;
  IF v_months IS NULL OR p_period_start IS NULL
     OR extract(day FROM p_period_start) <> 1
     OR (p_period_type = 'quarter' AND extract(month FROM p_period_start) NOT IN (1, 4, 7, 10))
     OR (p_period_type = 'year' AND extract(month FROM p_period_start) <> 1) THEN
    RAISE EXCEPTION 'invalid_period' USING ERRCODE = '22023';
  END IF;
  v_end        := (p_period_start + make_interval(months => v_months))::date - 1;
  v_next_start := v_end + 1;
  v_next_end   := (v_next_start + make_interval(months => v_months))::date - 1;

  SELECT w.primary_name INTO v_unit FROM public.asset_owner_workspaces w WHERE w.id = p_workspace_id;

  IF p_branch_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(btrim(wb.display_name), ''), ao.name, 'Chi nhánh chưa đặt tên')
      INTO v_scope_name
      FROM public.workspace_branches wb
      LEFT JOIN public.asset_owners ao ON ao.id = wb.asset_owner_id
     WHERE wb.id = p_branch_id AND wb.workspace_id = p_workspace_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid_branch' USING ERRCODE = '22023';
    END IF;
  END IF;

  WITH
  br AS (
    SELECT wb.id, COALESCE(NULLIF(btrim(wb.display_name), ''), ao.name, 'Chi nhánh chưa đặt tên') AS name
      FROM public.workspace_branches wb
      LEFT JOIN public.asset_owners ao ON ao.id = wb.asset_owner_id
     WHERE wb.workspace_id = p_workspace_id
  ),
  -- Mọi tài sản có kết quả của phạm vi (chi nhánh suy từ claim, như trang Kết quả phiên).
  ov AS MATERIALIZED (
    SELECT o.*,
           br.name AS branch_name,
           CASE WHEN o.listing_id IS NOT NULL THEN upper(left(o.listing_id::text, 8)) END AS asset_code,
           COALESCE(rec.counted, false)  AS counted,
           COALESCE(rec.recorded, 0)     AS recorded,
           COALESCE(rec.estimated, 0)    AS estimated,
           COALESCE(rec.awaiting, 0)     AS awaiting
      FROM public.owner_outcomes_overview(p_workspace_id) o
      LEFT JOIN br ON br.id = o.branch_id
      LEFT JOIN LATERAL public.owner_report_recovery(o.resolved_price, o.payment_status, o.paid_amount) rec
             ON o.resolved_outcome = 'sold'
     WHERE p_branch_id IS NULL OR o.branch_id = p_branch_id
  ),
  per AS (
    SELECT * FROM ov WHERE resolved_date BETWEEN p_period_start AND v_end
  ),
  sold_per AS (
    SELECT * FROM per WHERE resolved_outcome = 'sold'
  ),

  -- ─── Chỉ tiêu ──────────────────────────────────────────────────────────────
  -- Báo cáo cả đơn vị: chỉ tiêu cả đơn vị + từng chi nhánh. Báo cáo chi nhánh:
  -- chỉ chỉ tiêu của chi nhánh đó. Cùng phép tính với computeTargetProgress().
  -- Chỉ tiêu nhiều tiêu chí (mig 20260927124605): báo cáo chỉ dựng
  -- 2 tiêu chí tiền thu hồi / tài sản đấu thành; chỉ tiêu không có tiêu chí nào trong
  -- 2 loại đó bị bỏ qua (tiêu chí khác chỉ hiện ở trang Chỉ tiêu).
  tg AS (
    SELECT t.id, t.branch_id, t.period_start, br.name AS branch_name,
           ca.goal       AS target_amount,
           cc.goal::int  AS target_count
      FROM public.owner_workspace_targets t
      LEFT JOIN br ON br.id = t.branch_id
      LEFT JOIN public.owner_workspace_target_criteria ca
             ON ca.target_id = t.id AND ca.metric = 'recovered_amount'
      LEFT JOIN public.owner_workspace_target_criteria cc
             ON cc.target_id = t.id AND cc.metric = 'sold_count'
     WHERE t.workspace_id = p_workspace_id
       AND t.period_type = p_period_type
       AND (p_branch_id IS NULL OR t.branch_id = p_branch_id)
       AND (ca.goal IS NOT NULL OR cc.goal IS NOT NULL)
  ),
  tg_prog AS (
    SELECT t.id, t.branch_id, t.branch_name, t.target_amount, t.target_count,
           COALESCE(sum(s.recorded), 0)  AS recorded,
           COALESCE(sum(s.estimated), 0) AS estimated,
           COALESCE(sum(s.awaiting), 0)  AS awaiting,
           count(s.row_key)::int         AS sold_count
      FROM tg t
      LEFT JOIN sold_per s ON s.counted AND (t.branch_id IS NULL OR s.branch_id = t.branch_id)
     WHERE t.period_start = p_period_start
     GROUP BY t.id, t.branch_id, t.branch_name, t.target_amount, t.target_count
  ),

  -- ─── Tồn đọng + lịch phiên sắp tới ─────────────────────────────────────────
  claimed AS (
    SELECT DISTINCT c.listing_id AS lid
      FROM public.asset_owner_claims c
     WHERE c.workspace_id = p_workspace_id
       AND c.status IN ('auto_claimed', 'pending_confirmation', 'confirmed')
       AND c.listing_id IS NOT NULL
  ),
  -- Đúng luật branch_of của owner_outcomes_overview.
  branch_of AS (
    SELECT DISTINCT ON (c.listing_id) c.listing_id AS lid, wb.id AS bid
      FROM public.asset_owner_claims c
      JOIN public.workspace_branches wb
        ON wb.workspace_id = c.workspace_id AND wb.asset_owner_id = c.asset_owner_id
     WHERE c.workspace_id = p_workspace_id AND c.listing_id IS NOT NULL
     ORDER BY c.listing_id, c.created_at
  ),
  lst AS (
    SELECT l.id AS lid, bo.bid, l.title, l.price, l.price_unit, l.auction_org_id,
           (l.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS listed_on,
           (public.try_timestamptz(COALESCE(l.custom_attributes->>'auction_time',
                                            l.custom_attributes->>'auction_date'))
              AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS ca_date
      FROM claimed cl
      JOIN public.listings l    ON l.id = cl.lid
      LEFT JOIN branch_of bo    ON bo.lid = cl.lid
     WHERE p_branch_id IS NULL OR bo.bid = p_branch_id
  ),
  sess AS (
    SELECT s.listing_id AS lid, count(*)::int AS n, min(s.session_date) AS first_date
      FROM public.listing_price_sessions s
      JOIN lst ON lst.lid = s.listing_id
     GROUP BY s.listing_id
  ),
  own AS (
    SELECT o.listing_id AS lid, max(o.round_no) AS max_round, min(o.auction_date) AS first_date
      FROM public.owner_asset_outcomes o
     WHERE o.workspace_id = p_workspace_id AND o.listing_id IS NOT NULL
     GROUP BY o.listing_id
  ),
  -- Phiên sớm nhất từ hôm nay trở đi: phiên trên sàn đã công bố, hoặc ngày phiên của tin.
  upcoming AS (
    SELECT DISTINCT ON (u.lid) u.lid, u.d, u.src, u.org_name
      FROM (
        SELECT i.listing_id AS lid,
               (s.starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS d,
               'platform'::text AS src,
               ao.name AS org_name
          FROM public.auction_session_items i
          JOIN lst                         ON lst.lid = i.listing_id
          JOIN public.auction_sessions s   ON s.id = i.session_id AND s.status = 'published'
          LEFT JOIN public.auction_organizations ao ON ao.id = s.auction_org_id
         WHERE i.source = 'listing'
           AND (s.starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= v_as_of
        UNION ALL
        SELECT lst.lid, lst.ca_date, 'listing'::text, ao.name
          FROM lst
          LEFT JOIN public.auction_organizations ao ON ao.id = lst.auction_org_id
         WHERE lst.ca_date >= v_as_of
      ) u
     ORDER BY u.lid, u.d, u.src DESC
  ),
  stuck_l AS (
    SELECT lst.lid,
           upper(left(lst.lid::text, 8)) AS asset_code,
           lst.title::text AS title,
           br.name AS branch_name,
           greatest(COALESCE(se.n, 0), COALESCE(ow.max_round, 0),
                    CASE WHEN o.resolved_outcome IS NOT NULL THEN 1 ELSE 0 END) AS rounds,
           least(se.first_date, ow.first_date, lst.listed_on) AS first_date,
           o.resolved_outcome AS last_outcome,
           o.resolved_date    AS last_date,
           o.confidence_label,
           CASE WHEN lst.price_unit::text = 'TOTAL' AND lst.price > 0 THEN lst.price END::numeric AS starting_price,
           up.d AS next_date
      FROM lst
      LEFT JOIN sess se     ON se.lid = lst.lid
      LEFT JOIN own ow      ON ow.lid = lst.lid
      LEFT JOIN ov o        ON o.listing_id = lst.lid
      LEFT JOIN br          ON br.id = lst.bid
      LEFT JOIN upcoming up ON up.lid = lst.lid
     WHERE o.resolved_outcome IS DISTINCT FROM 'sold'
       AND o.resolved_outcome IS DISTINCT FROM 'withdrawn'
  ),
  off_hist AS (
    SELECT o.title_key, max(o.round_no) AS max_round, min(o.auction_date) AS first_date
      FROM public.owner_asset_outcomes o
     WHERE o.workspace_id = p_workspace_id AND o.listing_id IS NULL AND o.asset_posting_id IS NULL
     GROUP BY o.title_key
  ),
  stuck_o AS (
    SELECT NULL::uuid AS lid,
           NULL::text AS asset_code,
           v.asset_title AS title,
           v.branch_name,
           greatest(h.max_round, 1) AS rounds,
           h.first_date,
           v.resolved_outcome AS last_outcome,
           v.resolved_date    AS last_date,
           v.confidence_label,
           v.starting_price,
           NULL::date AS next_date
      FROM ov v
      JOIN off_hist h ON h.title_key = v.title_key
     WHERE v.listing_id IS NULL
       AND v.resolved_outcome NOT IN ('sold', 'withdrawn')
  ),
  stuck AS (
    SELECT x.*, (v_as_of - x.first_date)::int AS age_days
      FROM (SELECT * FROM stuck_l UNION ALL SELECT * FROM stuck_o) x
     WHERE x.rounds >= c_stuck_rounds
        OR (x.first_date IS NOT NULL AND v_as_of - x.first_date > c_stuck_days)
  ),
  scheduled AS (
    SELECT up.lid, up.d, up.src, up.org_name,
           upper(left(lst.lid::text, 8)) AS asset_code,
           lst.title::text AS title,
           br.name AS branch_name,
           CASE WHEN lst.price_unit::text = 'TOTAL' AND lst.price > 0 THEN lst.price END::numeric AS starting_price,
           EXISTS (SELECT 1 FROM stuck s WHERE s.lid = up.lid) AS is_stuck
      FROM upcoming up
      JOIN lst       ON lst.lid = up.lid
      LEFT JOIN br   ON br.id = lst.bid
      LEFT JOIN ov o ON o.listing_id = up.lid
     WHERE up.d <= v_next_end
       AND o.resolved_outcome IS DISTINCT FROM 'sold'
       AND o.resolved_outcome IS DISTINCT FROM 'withdrawn'
  )
  SELECT jsonb_build_object(
    'version', 1,
    'meta', jsonb_build_object(
      'generated_at', now(),
      'as_of',        v_as_of,
      'period',       jsonb_build_object('type', p_period_type, 'start', p_period_start, 'end', v_end),
      'unit_name',    v_unit,
      'scope',        jsonb_build_object(
                        'kind',        CASE WHEN p_branch_id IS NULL THEN 'unit' ELSE 'branch' END,
                        'branch_name', v_scope_name)
    ),

    'targets', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'scope',            CASE WHEN t.branch_id IS NULL THEN 'unit' ELSE 'branch' END,
               'branch_name',      t.branch_name,
               'target_amount',    t.target_amount,
               'target_count',     t.target_count,
               'collected',        t.recorded + t.estimated,
               'recorded',         t.recorded,
               'estimated',        t.estimated,
               'awaiting',         t.awaiting,
               'sold_count',       t.sold_count,
               'amount_pct',       CASE WHEN t.target_amount IS NOT NULL
                                        THEN floor((t.recorded + t.estimated) * 100 / t.target_amount)::int END,
               'count_pct',        CASE WHEN t.target_count IS NOT NULL
                                        THEN floor(t.sold_count * 100.0 / t.target_count)::int END,
               'amount_remaining', CASE WHEN t.target_amount IS NOT NULL
                                        THEN greatest(0, t.target_amount - (t.recorded + t.estimated)) END,
               'count_remaining',  CASE WHEN t.target_count IS NOT NULL
                                        THEN greatest(0, t.target_count - t.sold_count) END
             ) ORDER BY t.branch_id IS NOT NULL, t.branch_name), '[]'::jsonb)
        FROM tg_prog t
    ),

    'results', jsonb_build_object(
      'totals', (
        SELECT jsonb_build_object(
                 'total',              count(*),
                 'sold',               count(*) FILTER (WHERE p.resolved_outcome = 'sold'),
                 'unsold',             count(*) FILTER (WHERE p.resolved_outcome = 'unsold'),
                 'voided',             count(*) FILTER (WHERE p.resolved_outcome IN ('postponed', 'cancelled', 'withdrawn')),
                 'conflicts',          count(*) FILTER (WHERE p.has_conflict),
                 'sold_value',         COALESCE(sum(p.resolved_price) FILTER (WHERE p.resolved_outcome = 'sold'), 0),
                 'sold_without_price', count(*) FILTER (WHERE p.resolved_outcome = 'sold' AND p.resolved_price IS NULL),
                 'defaulted',          count(*) FILTER (WHERE p.resolved_outcome = 'sold' AND p.payment_status = 'defaulted'),
                 'success_rate',       CASE WHEN count(*) > 0
                                            THEN round(count(*) FILTER (WHERE p.resolved_outcome = 'sold') * 100.0 / count(*))::int END)
          FROM per p
      ),
      'by_label', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'label', g.confidence_label, 'count', g.n, 'sold', g.sold, 'sold_value', g.sold_value
               ) ORDER BY array_position(ARRAY['platform', 'reconciled', 'owner_evidence', 'self_reported', 'estimated'],
                                         g.confidence_label)), '[]'::jsonb)
          FROM (SELECT p.confidence_label,
                       count(*)::int AS n,
                       count(*) FILTER (WHERE p.resolved_outcome = 'sold')::int AS sold,
                       COALESCE(sum(p.resolved_price) FILTER (WHERE p.resolved_outcome = 'sold'), 0) AS sold_value
                  FROM per p
                 GROUP BY p.confidence_label) g
      ),
      'items', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'asset_code',       p.asset_code,
                 'title',            p.asset_title,
                 'category',         p.asset_category,
                 'branch_name',      p.branch_name,
                 'org_name',         p.auction_org_name,
                 'date',             p.resolved_date,
                 'round_no',         p.own_round_no,
                 'outcome',          p.resolved_outcome,
                 'starting_price',   p.starting_price,
                 'price',            p.resolved_price,
                 'confidence_label', p.confidence_label,
                 'has_conflict',     p.has_conflict,
                 'payment_status',   p.payment_status
               ) ORDER BY p.resolved_date DESC, p.asset_title), '[]'::jsonb)
          FROM per p
      )
    ),

    'money', (
      SELECT jsonb_build_object(
               'collected',  COALESCE(sum(s.recorded + s.estimated), 0),
               'recorded',   COALESCE(sum(s.recorded), 0),
               'estimated',  COALESCE(sum(s.estimated), 0),
               'awaiting',   COALESCE(sum(s.awaiting), 0),
               'sold_count', count(*) FILTER (WHERE s.counted),
               'defaulted',  jsonb_build_object(
                               'count', count(*) FILTER (WHERE NOT s.counted),
                               'value', COALESCE(sum(s.resolved_price) FILTER (WHERE NOT s.counted), 0)),
               'by_label', (
                 SELECT COALESCE(jsonb_agg(jsonb_build_object(
                          'label', g.confidence_label, 'count', g.n,
                          'collected', g.collected, 'awaiting', g.awaiting
                        ) ORDER BY array_position(ARRAY['platform', 'reconciled', 'owner_evidence', 'self_reported', 'estimated'],
                                                  g.confidence_label)), '[]'::jsonb)
                   FROM (SELECT x.confidence_label,
                                count(*)::int AS n,
                                sum(x.recorded + x.estimated) AS collected,
                                sum(x.awaiting) AS awaiting
                           FROM sold_per x
                          WHERE x.counted
                          GROUP BY x.confidence_label) g
               ),
               'items', (
                 SELECT COALESCE(jsonb_agg(jsonb_build_object(
                          'asset_code',       x.asset_code,
                          'title',            x.asset_title,
                          'branch_name',      x.branch_name,
                          'date',             x.resolved_date,
                          'price',            x.resolved_price,
                          'paid_amount',      x.paid_amount,
                          'awaiting',         x.awaiting,
                          'payment_status',   x.payment_status,
                          'confidence_label', x.confidence_label
                        ) ORDER BY x.payment_status = 'defaulted', x.awaiting DESC, x.asset_title), '[]'::jsonb)
                   FROM sold_per x
                  WHERE x.payment_status IN ('pending', 'partial', 'defaulted')
               ),
               'carry_over', (
                 SELECT jsonb_build_object('count', count(*), 'awaiting', COALESCE(sum(c.awaiting), 0))
                   FROM ov c
                  WHERE c.resolved_outcome = 'sold'
                    AND c.resolved_date < p_period_start
                    AND c.payment_status IN ('pending', 'partial')
               )
             )
        FROM sold_per s
    ),

    'stuck', jsonb_build_object(
      'rule',  jsonb_build_object('min_rounds', c_stuck_rounds, 'max_days', c_stuck_days),
      'count', (SELECT count(*) FROM stuck),
      'items', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'asset_code',       s.asset_code,
                 'title',            s.title,
                 'branch_name',      s.branch_name,
                 'rounds',           s.rounds,
                 'age_days',         s.age_days,
                 'first_date',       s.first_date,
                 'last_outcome',     s.last_outcome,
                 'last_date',        s.last_date,
                 'confidence_label', s.confidence_label,
                 'starting_price',   s.starting_price,
                 'next_date',        s.next_date
               ) ORDER BY s.age_days DESC NULLS LAST, s.rounds DESC, s.title), '[]'::jsonb)
          FROM stuck s
      )
    ),

    'plan', jsonb_build_object(
      'next_period', jsonb_build_object('type', p_period_type, 'start', v_next_start, 'end', v_next_end),
      'next_targets', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'scope',         CASE WHEN t.branch_id IS NULL THEN 'unit' ELSE 'branch' END,
                 'branch_name',   t.branch_name,
                 'target_amount', t.target_amount,
                 'target_count',  t.target_count
               ) ORDER BY t.branch_id IS NOT NULL, t.branch_name), '[]'::jsonb)
          FROM tg t
         WHERE t.period_start = v_next_start
      ),
      'scheduled', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'asset_code',     s.asset_code,
                 'title',          s.title,
                 'branch_name',    s.branch_name,
                 'date',           s.d,
                 'source',         s.src,
                 'org_name',       s.org_name,
                 'starting_price', s.starting_price,
                 'is_stuck',       s.is_stuck
               ) ORDER BY s.d, s.title), '[]'::jsonb)
          FROM scheduled s
      ),
      'stuck_unscheduled', (SELECT count(*) FROM stuck s WHERE s.next_date IS NULL)
    )
  )
  INTO v_result;

  -- Phase M5: phễu truyền thông của kỳ, cùng phạm vi chi nhánh với báo cáo.
  RETURN v_result || jsonb_build_object(
    'marketing', public.owner_mkt_funnel_core(p_workspace_id, p_period_start, v_end, NULL, p_branch_id, false));
END;
$function$;

-- Link chia sẻ /r/:token: danh sách trắng thêm 'marketing' (owner_report_strip_private vẫn bỏ mọi khoá *_id).
CREATE OR REPLACE FUNCTION public.owner_report_public_payload(p jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT public.owner_report_strip_private(COALESCE(
    (SELECT jsonb_object_agg(e.key, e.value)
       FROM jsonb_each(p) e
      WHERE e.key IN ('version', 'meta', 'targets', 'results', 'money', 'stuck', 'plan', 'marketing',
                      'notes', 'people', 'finalized_at')),
    '{}'::jsonb))
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Tự kiểm
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  _p JSONB;
BEGIN
  IF has_function_privilege('anon', 'public.owner_mkt_funnel(uuid, date, date, uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.owner_mkt_funnel(uuid, date, date, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'self-check: owner_mkt_funnel chỉ cho authenticated';
  END IF;
  IF has_function_privilege('anon', 'public.owner_mkt_funnel_core(uuid, date, date, uuid, uuid, boolean)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.owner_mkt_funnel_core(uuid, date, date, uuid, uuid, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'self-check: client gọi được owner_mkt_funnel_core';
  END IF;
  IF has_function_privilege('anon', 'public.mkt_attribute_bidding_contract(uuid, uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.mkt_attribute_bidding_contract(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'self-check: mkt_attribute_bidding_contract chỉ cho authenticated';
  END IF;

  -- Phần marketing qua được link chia sẻ, khoá *_id thì không.
  _p := public.owner_report_public_payload(jsonb_build_object(
          'marketing', jsonb_build_object('by_asset', jsonb_build_array(
                         jsonb_build_object('listing_id', gen_random_uuid(), 'title', 'x'))),
          'secret', 1));
  IF _p ? 'secret' OR NOT _p ? 'marketing'
     OR (_p #> '{marketing,by_asset,0}') ? 'listing_id' THEN
    RAISE EXCEPTION 'self-check: owner_report_public_payload lọc sai phần marketing';
  END IF;

  -- Phễu của một Trạm không tồn tại: rỗng nhưng đủ khung.
  _p := public.owner_mkt_funnel_core(gen_random_uuid(), DATE '2026-09-01', DATE '2026-09-30', NULL, NULL, false);
  IF (_p #>> '{totals,assets}')::int <> 0 OR jsonb_typeof(_p -> 'by_asset') <> 'array'
     OR NOT (_p ? 'unattributed') THEN
    RAISE EXCEPTION 'self-check: khung owner_mkt_funnel_core sai: %', _p;
  END IF;
END;
$$;
