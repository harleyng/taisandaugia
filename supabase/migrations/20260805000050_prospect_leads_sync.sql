-- Khách hàng tiềm năng của sàn nay LÀ lead thật, phân biệt bằng Nguồn.
--
-- Trước đây tab "Từ dữ liệu sàn" là view ảo và admin phải bấm "Tạo lead" từng
-- dòng. Nay mỗi pháp nhân có tài sản trên sàn được đồng bộ thành một bản ghi
-- leads với source='market_data', nên giao việc / gắn cơ hội / theo dõi trạng
-- thái dùng được ngay như mọi lead khác.

-- ─── 1. Nguồn mới: dữ liệu sàn ───────────────────────────────────────────────

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_source_check CHECK (
  source = ANY (ARRAY[
    'contact_form','partnership_form','hotline','email','referral',
    'event','ads','tool_marketplace','market_data','other'
  ])
);

-- ─── 2. Đồng bộ prospect → leads (idempotent) ────────────────────────────────
--
-- Khớp trùng theo TÊN ĐÃ CHUẨN HOÁ trên cả company_name lẫn name, để lead đã
-- nhập tay trước đó (dù gõ khác dấu / khác hình thức pháp nhân) không bị nhân đôi.

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
    -- Chủ tài sản có ít nhất 1 tài sản trên sàn
    SELECT o.id, o.name, o.normalized_name, 'asset_owner'::TEXT AS lead_type
    FROM public.asset_owners o
    WHERE (p_kind IS NULL OR p_kind = 'asset_owner')
      AND EXISTS (SELECT 1 FROM public.listings l WHERE l.asset_owner_id = o.id)
    UNION ALL
    -- Công ty đấu giá có ít nhất 1 tài sản trên sàn
    SELECT a.id, a.name, public.normalize_org_name(a.name), 'auction_company'::TEXT
    FROM public.auction_organizations a
    WHERE (p_kind IS NULL OR p_kind = 'auction_org')
      AND EXISTS (SELECT 1 FROM public.listings l WHERE l.auction_org_id = a.id)
  ),
  enriched AS (
    SELECT
      s.*,
      (SELECT count(*) FROM public.listings l
        WHERE (s.lead_type = 'asset_owner'    AND l.asset_owner_id = s.id)
           OR (s.lead_type = 'auction_company' AND l.auction_org_id = s.id)) AS n_listings,
      (SELECT COALESCE(sum(l.price), 0) FROM public.listings l
        WHERE (s.lead_type = 'asset_owner'    AND l.asset_owner_id = s.id)
           OR (s.lead_type = 'auction_company' AND l.auction_org_id = s.id)) AS sum_price,
      (SELECT l.address->>'province' FROM public.listings l
        WHERE (s.lead_type = 'asset_owner'    AND l.asset_owner_id = s.id)
           OR (s.lead_type = 'auction_company' AND l.auction_org_id = s.id)
        GROUP BY l.address->>'province'
        ORDER BY count(*) DESC NULLS LAST
        LIMIT 1) AS top_province
    FROM src s
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
