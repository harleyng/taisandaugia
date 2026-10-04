-- Hồ sơ online hợp nhất — phần 2: chuyển link theo dõi /l/:code cũ (owner_mkt_links) thành link
-- Hồ sơ online, GIỮ NGUYÊN id.
--
--   • Giữ id ⇒ analytics_events.mkt_link_id / auction_bidding_contracts.mkt_link_id và cookie
--     mkt_link_id 30 ngày đang nằm trong trình duyệt khách vẫn đúng; chỉ dời khoá ngoại.
--   • Mỗi lượt mở cũ (owner_mkt_link_hits) thành một sự kiện 'view'. visitor_id = session cũ nếu
--     hợp lệ, không thì 'lg' || md5(...) — giữ đúng số người khác nhau như phễu cũ đếm.
--   • /l/<mã cũ> ⇒ resolve_legacy_share_link ⇒ /hs/<mã mới>. owner_mkt_track_hit (client cũ chưa
--     cập nhật) vẫn chạy: ghi lượt mở vào posting_share_events và trả tin như trước.
--   • owner_mkt_links / owner_mkt_link_hits thành KHO LƯU TRỮ chỉ đọc (client hết quyền ghi).

LOCK TABLE public.owner_mkt_links, public.owner_mkt_link_hits IN SHARE ROW EXCLUSIVE MODE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Chép link + lượt mở
-- ═══════════════════════════════════════════════════════════════════════════

-- Không ghi nhật ký từng dòng chép (đã có dòng tạo link gốc trong module truyen-thong).
ALTER TABLE public.posting_share_links DISABLE TRIGGER owner_audit;

INSERT INTO public.posting_share_links (
  id, listing_id, workspace_id, branch_id, campaign_id, channel, label, code, legacy_code,
  show_price, show_exact_address, show_sender_contact,
  view_count, unique_view_count, last_viewed_at, created_by, created_at, updated_at)
SELECT k.id, k.listing_id, k.workspace_id, k.branch_id, k.campaign_id, k.channel, left(btrim(k.label), 80),
       public.posting_share_new_code(), k.code,
       false, false, false,
       k.hit_count, k.unique_hit_count, k.last_hit_at, k.created_by, k.created_at, k.updated_at
  FROM public.owner_mkt_links k
 WHERE NOT EXISTS (SELECT 1 FROM public.posting_share_links s WHERE s.id = k.id);

ALTER TABLE public.posting_share_links ENABLE TRIGGER owner_audit;

INSERT INTO public.posting_share_events (link_id, event, visitor_id, device, created_at)
SELECT h.link_id, 'view',
       CASE WHEN h.session_id ~ '^[A-Za-z0-9_-]{8,64}$' THEN h.session_id
            ELSE 'lg' || md5(COALESCE(h.session_id, 'h' || h.id::TEXT)) END,
       public.posting_share_device(h.device), h.created_at
  FROM public.owner_mkt_link_hits h;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Ghi nhận nguồn trỏ sang bảng mới
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.analytics_events
  DROP CONSTRAINT analytics_events_mkt_link_id_fkey,
  ADD CONSTRAINT analytics_events_mkt_link_id_fkey
    FOREIGN KEY (mkt_link_id) REFERENCES public.posting_share_links(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.analytics_events VALIDATE CONSTRAINT analytics_events_mkt_link_id_fkey;

ALTER TABLE public.auction_bidding_contracts
  DROP CONSTRAINT auction_bidding_contracts_mkt_link_id_fkey,
  ADD CONSTRAINT auction_bidding_contracts_mkt_link_id_fkey
    FOREIGN KEY (mkt_link_id) REFERENCES public.posting_share_links(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.auction_bidding_contracts VALIDATE CONSTRAINT auction_bidding_contracts_mkt_link_id_fkey;

-- Lưu tài sản trên sàn chỉ nhờ được link trỏ TIN đó (link hồ sơ ghi nhận qua theo dõi hồ sơ).
CREATE OR REPLACE FUNCTION public.analytics_events_mkt_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _link public.posting_share_links%ROWTYPE;
BEGIN
  IF NEW.mkt_link_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _link FROM public.posting_share_links WHERE id = NEW.mkt_link_id;
  IF NOT FOUND
     OR _link.listing_id IS NULL
     OR NEW.event_type <> 'feature'
     OR NEW.feature_key IS DISTINCT FROM 'save_asset'
     OR NEW.user_id IS NULL
     OR NEW.user_id IS DISTINCT FROM auth.uid()
     -- Vào bằng link của tài sản A rồi lưu tài sản B ⇒ B không nhờ link A.
     OR (NEW.listing_id IS NOT NULL AND NEW.listing_id <> _link.listing_id)
     OR NOT EXISTS (SELECT 1 FROM public.user_asset_actions a
                     WHERE a.user_id = NEW.user_id AND a.listing_id = _link.listing_id AND a.is_saved)
     -- Thành viên Trạm tự lưu tài sản của mình không tính.
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

-- Hồ sơ tham gia nhờ link: phiên phải chứa ĐÚNG tài sản của link (tin hoặc hồ sơ).
CREATE OR REPLACE FUNCTION public.mkt_attribute_bidding_contract(p_contract_id UUID, p_link_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _c    public.auction_bidding_contracts%ROWTYPE;
  _link public.posting_share_links%ROWTYPE;
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

  SELECT * INTO _link FROM public.posting_share_links WHERE id = p_link_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'link_not_found');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.auction_session_items i
                  WHERE i.session_id = _c.session_id
                    AND ((_link.listing_id IS NOT NULL AND i.listing_id = _link.listing_id)
                      OR (_link.posting_id IS NOT NULL AND i.asset_posting_id = _link.posting_id))) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_in_session');
  END IF;
  IF public.posting_share_is_member(_link) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'member');
  END IF;

  UPDATE public.auction_bidding_contracts SET mkt_link_id = _link.id WHERE id = _c.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. /l/:code cũ
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.resolve_legacy_share_link(p_code TEXT)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object('ok', true, 'code', l.code)
       FROM public.posting_share_links l
      WHERE p_code ~ '^[a-z0-9]{8}$' AND l.legacy_code = p_code),
    jsonb_build_object('ok', false, 'reason', 'not_found'))
$$;
GRANT EXECUTE ON FUNCTION public.resolve_legacy_share_link(TEXT) TO anon, authenticated;

-- Client cũ (trước khi frontend lên bản mới): vẫn trả tin để chuyển hướng, lượt mở ghi vào
-- posting_share_events cùng luật đếm của get_shared_posting.
CREATE OR REPLACE FUNCTION public.owner_mkt_track_hit(p_code TEXT, p_session_id TEXT, p_device TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  l public.posting_share_links%ROWTYPE;
BEGIN
  IF p_code IS NULL OR p_code !~ '^[a-z0-9]{8}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  SELECT * INTO l FROM public.posting_share_links WHERE legacy_code = p_code;
  IF NOT FOUND OR l.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF p_session_id ~ '^[A-Za-z0-9_-]{8,64}$' AND NOT public.posting_share_is_member(l)
     AND NOT EXISTS (SELECT 1 FROM public.posting_share_events e
                      WHERE e.link_id = l.id AND e.visitor_id = p_session_id AND e.event = 'view'
                        AND e.created_at > now() - interval '1 minute') THEN
    UPDATE public.posting_share_links
       SET view_count        = view_count + 1,
           unique_view_count = unique_view_count + CASE WHEN EXISTS (
                                 SELECT 1 FROM public.posting_share_events e
                                  WHERE e.link_id = l.id AND e.visitor_id = p_session_id AND e.event = 'view')
                               THEN 0 ELSE 1 END,
           last_viewed_at    = now()
     WHERE id = l.id;
    INSERT INTO public.posting_share_events (link_id, event, visitor_id, device)
    VALUES (l.id, 'view', p_session_id, public.posting_share_device(p_device));
  END IF;

  RETURN jsonb_build_object('ok', true, 'link_id', l.id, 'listing_id', l.listing_id,
                            'channel', l.channel, 'code', p_code);
END;
$$;

-- Kho lưu trữ: client hết quyền ghi (đọc vẫn theo policy cũ).
REVOKE INSERT, UPDATE, DELETE ON public.owner_mkt_links FROM authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Tự kiểm
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  n_old   INT;
  n_new   INT;
  n_hits  INT;
  n_ev    INT;
BEGIN
  SELECT count(*) INTO n_old FROM public.owner_mkt_links;
  SELECT count(*) INTO n_new FROM public.posting_share_links WHERE legacy_code IS NOT NULL;
  IF n_old <> n_new THEN
    RAISE EXCEPTION 'self-check: chép link lệch (% cũ, % mới)', n_old, n_new;
  END IF;
  IF EXISTS (SELECT 1 FROM public.owner_mkt_links k
               JOIN public.posting_share_links s ON s.id = k.id
              WHERE s.legacy_code IS DISTINCT FROM k.code OR s.listing_id IS DISTINCT FROM k.listing_id
                 OR s.view_count <> k.hit_count OR s.unique_view_count <> k.unique_hit_count) THEN
    RAISE EXCEPTION 'self-check: dòng link chép sai';
  END IF;

  SELECT count(*) INTO n_hits FROM public.owner_mkt_link_hits;
  SELECT count(*) INTO n_ev FROM public.posting_share_events e
    JOIN public.posting_share_links s ON s.id = e.link_id AND s.legacy_code IS NOT NULL;
  IF n_hits <> n_ev THEN
    RAISE EXCEPTION 'self-check: chép lượt mở lệch (% cũ, % mới)', n_hits, n_ev;
  END IF;

  -- Số người khác nhau mỗi link giữ nguyên như phễu cũ đếm.
  IF EXISTS (
    SELECT 1 FROM (
      SELECT h.link_id, count(DISTINCT COALESCE(h.session_id, 'h' || h.id::TEXT)) AS n
        FROM public.owner_mkt_link_hits h GROUP BY h.link_id) o
      JOIN (SELECT e.link_id, count(DISTINCT e.visitor_id) AS n
              FROM public.posting_share_events e WHERE e.event = 'view' GROUP BY e.link_id) x
        ON x.link_id = o.link_id
     WHERE o.n <> x.n) THEN
    RAISE EXCEPTION 'self-check: số người mở lệch sau khi chép';
  END IF;

  IF has_table_privilege('authenticated', 'public.owner_mkt_links', 'INSERT') THEN
    RAISE EXCEPTION 'self-check: owner_mkt_links còn ghi được';
  END IF;
END;
$$;
