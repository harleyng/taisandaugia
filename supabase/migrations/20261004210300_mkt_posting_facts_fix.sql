-- Sửa owner_mkt_posting_facts (20261004210200): hồ sơ CHƯA có phiên công bố ⇒ record `o` chưa
-- được gán ⇒ "record "o" is not assigned yet" khi lưu chiến dịch có hồ sơ đó. Luôn SELECT INTO o.

-- Hồ sơ số hoá: giá / hạn CHỈ khi hồ sơ là lô của một phiên đã công bố còn hạn.
CREATE OR REPLACE FUNCTION public.owner_mkt_posting_facts(p_posting_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p     public.asset_postings%ROWTYPE;
  s     RECORD;
  o     RECORD;
  _src  TEXT;
  _df   JSONB;
BEGIN
  SELECT * INTO p FROM public.asset_postings WHERE id = p_posting_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  _df := COALESCE(p.delta_fields, '{}'::JSONB);

  SELECT ss.id, ss.code, ss.starts_at, ss.registration_start_at, ss.registration_end_at,
         ss.viewing_start_at, ss.viewing_end_at, ss.venue, ss.dossier_fee, ss.auction_format,
         ss.auction_org_id, i.lot_no, i.starting_price, i.deposit_amount, i.bid_step
    INTO s
    FROM public.auction_session_items i
    JOIN public.auction_sessions ss ON ss.id = i.session_id
   WHERE i.asset_posting_id = p_posting_id
     AND ss.status = 'published'
     AND now() <= ss.ends_at
   ORDER BY ss.starts_at
   LIMIT 1;
  IF FOUND THEN
    _src := 'session';
  END IF;
  -- Luôn SELECT INTO (không có phiên ⇒ o toàn NULL) — record chưa gán thì đọc o.name sẽ lỗi.
  SELECT a.name, a.phone, a.address INTO o FROM public.auction_organizations a WHERE a.id = s.auction_org_id;

  RETURN jsonb_build_object(
    'asset_id', p.id,
    'kind', 'posting',
    'listing_id', NULL,
    'posting_code', p.code,
    'title', p.title,
    'category_slug', p.child_slug,
    'province', p.province,
    'district', p.district,
    'area', COALESCE(public.owner_mkt_try_num(_df ->> 'area'), public.owner_mkt_try_num(_df ->> 'land_area'),
                     public.owner_mkt_try_num(_df ->> 'floor_area')),
    'image_url', p.image_urls[1],
    'announced', _src IS NOT NULL,
    'source', _src,
    'session_code', s.code,
    'lot_no', s.lot_no,
    'starting_price', s.starting_price,
    'deposit', s.deposit_amount,
    'bid_step', s.bid_step,
    'dossier_fee', s.dossier_fee,
    'auction_at', s.starts_at,
    'registration_start_at', s.registration_start_at,
    'registration_end_at', s.registration_end_at,
    'viewing_start_at', s.viewing_start_at,
    'viewing_end_at', s.viewing_end_at,
    'venue', s.venue,
    'auction_format', s.auction_format,
    'org_name', o.name,
    'org_phone', o.phone,
    'org_address', o.address
  );
END;
$$;
