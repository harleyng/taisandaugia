-- Bỏ tách tab "Lead" / "Từ dữ liệu sàn": nay chỉ còn MỘT danh sách lead, phân
-- biệt bằng cột Nguồn. Để từ một dòng lead mở được trang cơ cấu tài sản, lead
-- phải trỏ thẳng tới pháp nhân nguồn thay vì dò lại theo tên ở client.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS prospect_kind TEXT
    CHECK (prospect_kind IN ('asset_owner', 'auction_org')),
  ADD COLUMN IF NOT EXISTS prospect_id UUID;

COMMENT ON COLUMN public.leads.prospect_id IS
  'Pháp nhân nguồn trên sàn (asset_owners.id hoặc auction_organizations.id) khi source=market_data.';

CREATE INDEX IF NOT EXISTS idx_leads_prospect ON public.leads (prospect_kind, prospect_id)
  WHERE prospect_id IS NOT NULL;

-- ─── Backfill các lead market_data đã đồng bộ trước khi có 2 cột này ─────────

UPDATE public.leads ld
   SET prospect_kind = 'asset_owner', prospect_id = o.id
  FROM public.asset_owners o
 WHERE ld.source = 'market_data'
   AND ld.prospect_id IS NULL
   AND o.normalized_name = public.normalize_org_name(COALESCE(ld.company_name, ld.name));

UPDATE public.leads ld
   SET prospect_kind = 'auction_org', prospect_id = a.id
  FROM public.auction_organizations a
 WHERE ld.source = 'market_data'
   AND ld.prospect_id IS NULL
   AND public.normalize_org_name(a.name) = public.normalize_org_name(COALESCE(ld.company_name, ld.name));

-- ─── Sync ghi luôn con trỏ ───────────────────────────────────────────────────

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
    SELECT o.id, o.name, o.normalized_name,
           'asset_owner'::TEXT AS lead_type, 'asset_owner'::TEXT AS prospect_kind
    FROM public.asset_owners o
    WHERE (p_kind IS NULL OR p_kind = 'asset_owner')
      AND EXISTS (SELECT 1 FROM public.listings l WHERE l.asset_owner_id = o.id)
    UNION ALL
    SELECT a.id, a.name, public.normalize_org_name(a.name),
           'auction_company'::TEXT, 'auction_org'::TEXT
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
        WHERE (d.prospect_kind = 'asset_owner' AND l.asset_owner_id = d.id)
           OR (d.prospect_kind = 'auction_org' AND l.auction_org_id = d.id)) AS n_listings,
      (SELECT COALESCE(sum(l.price), 0) FROM public.listings l
        WHERE (d.prospect_kind = 'asset_owner' AND l.asset_owner_id = d.id)
           OR (d.prospect_kind = 'auction_org' AND l.auction_org_id = d.id)) AS sum_price,
      (SELECT l.address->>'province' FROM public.listings l
        WHERE (d.prospect_kind = 'asset_owner' AND l.asset_owner_id = d.id)
           OR (d.prospect_kind = 'auction_org' AND l.auction_org_id = d.id)
        GROUP BY l.address->>'province'
        ORDER BY count(*) DESC NULLS LAST
        LIMIT 1) AS top_province
    FROM deduped d
  ),
  ins AS (
    INSERT INTO public.leads
      (name, company_name, lead_type, source, status, province, note,
       prospect_kind, prospect_id, created_by)
    SELECT
      e.name, e.name, e.lead_type, 'market_data', 'new', e.top_province,
      format(
        'Tự đồng bộ từ dữ liệu sàn: %s tài sản, tổng giá khởi điểm %s₫.',
        e.n_listings, to_char(e.sum_price, 'FM999,999,999,999,999')
      ),
      e.prospect_kind, e.id, auth.uid()
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
