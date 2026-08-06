-- Chặn nhân đôi lead nguồn 'market_data' ở mức DB.
--
-- admin_sync_prospect_leads chạy khi admin mở tab. Hai admin (hoặc hai tab) mở
-- cùng lúc thì cả hai đều thấy NOT EXISTS đúng và cùng insert — kiểm tra ở tầng
-- câu lệnh không đủ. Thêm unique index từng phần trên TÊN ĐÃ CHUẨN HOÁ, rồi đổi
-- RPC sang ON CONFLICT DO NOTHING để lần chạy thua cuộc bỏ qua thay vì vỡ.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_leads_market_data_name
  ON public.leads (public.normalize_org_name(COALESCE(company_name, name)))
  WHERE source = 'market_data';

CREATE OR REPLACE FUNCTION public.admin_sync_prospect_leads(p_kind TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created INT := 0;
  v_total   INT := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_kind IS NOT NULL AND p_kind NOT IN ('asset_owner', 'auction_org') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;

  WITH src AS (
    SELECT o.id, o.name, o.normalized_name, 'asset_owner'::TEXT AS lead_type
    FROM public.asset_owners o
    WHERE (p_kind IS NULL OR p_kind = 'asset_owner')
      AND EXISTS (SELECT 1 FROM public.listings l WHERE l.asset_owner_id = o.id)
    UNION ALL
    SELECT a.id, a.name, public.normalize_org_name(a.name), 'auction_company'::TEXT
    FROM public.auction_organizations a
    WHERE (p_kind IS NULL OR p_kind = 'auction_org')
      AND EXISTS (SELECT 1 FROM public.listings l WHERE l.auction_org_id = a.id)
  ),
  -- Gộp trước theo tên chuẩn hoá: một pháp nhân có thể xuất hiện ở cả hai vế
  -- (vừa là chủ tài sản vừa là tổ chức đấu giá) — nếu không gộp thì cùng một
  -- câu INSERT sẽ đụng unique index với chính nó, ON CONFLICT không cứu được.
  deduped AS (
    SELECT DISTINCT ON (s.normalized_name) s.*
    FROM src s
    ORDER BY s.normalized_name, s.lead_type
  ),
  enriched AS (
    SELECT
      d.*,
      (SELECT count(*) FROM public.listings l
        WHERE (d.lead_type = 'asset_owner'     AND l.asset_owner_id = d.id)
           OR (d.lead_type = 'auction_company' AND l.auction_org_id = d.id)) AS n_listings,
      (SELECT COALESCE(sum(l.price), 0) FROM public.listings l
        WHERE (d.lead_type = 'asset_owner'     AND l.asset_owner_id = d.id)
           OR (d.lead_type = 'auction_company' AND l.auction_org_id = d.id)) AS sum_price,
      (SELECT l.address->>'province' FROM public.listings l
        WHERE (d.lead_type = 'asset_owner'     AND l.asset_owner_id = d.id)
           OR (d.lead_type = 'auction_company' AND l.auction_org_id = d.id)
        GROUP BY l.address->>'province'
        ORDER BY count(*) DESC NULLS LAST
        LIMIT 1) AS top_province
    FROM deduped d
  ),
  ins AS (
    INSERT INTO public.leads
      (name, company_name, lead_type, source, status, province, note, created_by)
    SELECT
      e.name, e.name, e.lead_type, 'market_data', 'new', e.top_province,
      format(
        'Tự đồng bộ từ dữ liệu sàn: %s tài sản, tổng giá khởi điểm %s₫.',
        e.n_listings, to_char(e.sum_price, 'FM999,999,999,999,999')
      ),
      auth.uid()
    FROM enriched e
    WHERE NOT EXISTS (
      SELECT 1 FROM public.leads ld
      WHERE public.normalize_org_name(COALESCE(ld.company_name, ld.name)) = e.normalized_name
         OR public.normalize_org_name(ld.name) = e.normalized_name
    )
    ON CONFLICT ((public.normalize_org_name(COALESCE(company_name, name))))
      WHERE source = 'market_data'
      DO NOTHING
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM ins), (SELECT count(*) FROM enriched)
    INTO v_created, v_total;

  RETURN jsonb_build_object(
    'created', v_created,
    'skipped', v_total - v_created,
    'total',   v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_sync_prospect_leads(TEXT) TO authenticated;
