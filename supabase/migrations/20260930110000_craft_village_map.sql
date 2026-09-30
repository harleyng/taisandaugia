-- Bản đồ làng nghề (/lang-nghe) — dữ liệu từ luồng Số hoá của CHỦ TÀI SẢN.
--
--  • Loại chủ tài sản mới: tổ chức org_type = 'craft_village' ("Làng nghề / HTX làng nghề").
--    Trigger duyệt KYC map org_type → asset_owners.owner_kind rơi vào ELSE 'other'.
--  • Mỗi hồ sơ số hoá của không gian làng nghề có thể được chủ bật "Công khai lên bản đồ".
--    Lên bản đồ khi: chủ bật  VÀ  admin đã duyệt hồ sơ (review_status = 'approved').
--    Sửa hồ sơ ⇒ về chờ duyệt ⇒ tự rơi khỏi bản đồ (RPC công khai lọc lúc đọc).
--  • VR = đơn VR tour của đối tác (asset_vr_tour_orders attached + published_at).
--
-- Bảng phụ thay vì cột trên asset_postings: review guard đẩy hồ sơ đã duyệt về chờ duyệt
-- khi đổi BẤT KỲ cột nào (cùng lý do với 3D/VR/giám định). Ghi CHỈ qua RPC.

-- ─── 1. Loại tổ chức "Làng nghề" ───────────────────────────────────────────────
ALTER TABLE public.asset_owner_org_kyc
  DROP CONSTRAINT asset_owner_org_kyc_org_type_check,
  ADD CONSTRAINT asset_owner_org_kyc_org_type_check
    CHECK (org_type IN ('bank_credit','amc','enforcement','state_agency','administrator','craft_village'));

-- ─── 2. Công khai hồ sơ lên bản đồ ─────────────────────────────────────────────
CREATE TABLE public.craft_village_publications (
  asset_posting_id UUID PRIMARY KEY REFERENCES public.asset_postings(id) ON DELETE CASCADE,
  -- Hộp bao lãnh thổ + Hoàng Sa/Trường Sa; chặn nhập nhầm thứ tự lat/lng.
  latitude         NUMERIC(9,6) NOT NULL CHECK (latitude BETWEEN 7 AND 24),
  longitude        NUMERIC(9,6) NOT NULL CHECK (longitude BETWEEN 102 AND 118),
  product          TEXT        NOT NULL CHECK (length(btrim(product)) BETWEEN 1 AND 80),
  is_published     BOOLEAN     NOT NULL DEFAULT false,
  published_at     TIMESTAMPTZ,
  updated_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT craft_pub_published_shape CHECK (is_published = (published_at IS NOT NULL))
);

CREATE INDEX idx_craft_village_publications_published
  ON public.craft_village_publications (published_at DESC) WHERE is_published;

CREATE TRIGGER craft_village_publications_updated_at
  BEFORE UPDATE ON public.craft_village_publications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.craft_village_publications ENABLE ROW LEVEL SECURITY;

-- Ai đọc được hồ sơ (RLS của asset_postings: chủ/thành viên/admin) thì đọc được dòng này.
CREATE POLICY "craft_village_publications_read" ON public.craft_village_publications
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.asset_postings p WHERE p.id = asset_posting_id));
-- Không có policy ghi: chỉ owner_set_craft_map_publication (SECURITY DEFINER).
REVOKE INSERT, UPDATE, DELETE ON public.craft_village_publications FROM anon, authenticated;

-- ─── 3. Helper: không gian có phải làng nghề ───────────────────────────────────
CREATE FUNCTION public._is_craft_village_workspace(_workspace_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.asset_owner_workspaces w
      JOIN public.asset_owner_org_kyc k ON k.id = w.org_kyc_id
     WHERE w.id = _workspace_id AND k.org_type = 'craft_village')
$$;
REVOKE EXECUTE ON FUNCTION public._is_craft_village_workspace(UUID) FROM PUBLIC, anon, authenticated;

-- ─── 4. Trạng thái cho thẻ "Công khai lên bản đồ làng nghề" ở chi tiết hồ sơ ───
CREATE FUNCTION public.owner_craft_map_state(_posting_id UUID)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_p   public.asset_postings%ROWTYPE;
  v_pub public.craft_village_publications%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO v_p FROM public.asset_postings
   WHERE id = _posting_id AND public.owner_posting_can(id, 'read');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_p.workspace_id IS NULL OR NOT public._is_craft_village_workspace(v_p.workspace_id) THEN
    RETURN jsonb_build_object('ok', true, 'eligible', false);
  END IF;

  SELECT * INTO v_pub FROM public.craft_village_publications WHERE asset_posting_id = _posting_id;
  RETURN jsonb_build_object(
    'ok', true,
    'eligible', true,
    'can_edit', public.owner_posting_can(_posting_id, 'so-hoa', 'update'),
    'review_status', v_p.review_status,
    'has_vr', EXISTS (SELECT 1 FROM public.asset_vr_tour_orders o
                       WHERE o.asset_posting_id = _posting_id
                         AND o.status = 'attached' AND o.published_at IS NOT NULL),
    'has_image', COALESCE(cardinality(v_p.image_urls), 0) > 0,
    'publication', CASE WHEN v_pub.asset_posting_id IS NULL THEN NULL ELSE jsonb_build_object(
      'latitude', v_pub.latitude, 'longitude', v_pub.longitude, 'product', v_pub.product,
      'is_published', v_pub.is_published, 'published_at', v_pub.published_at) END
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.owner_craft_map_state(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.owner_craft_map_state(UUID) FROM anon;

-- ─── 5. Chủ bật/tắt công khai + vị trí + sản phẩm ─────────────────────────────
CREATE FUNCTION public.owner_set_craft_map_publication(
  _posting_id UUID, _published BOOLEAN, _latitude NUMERIC, _longitude NUMERIC, _product TEXT)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_p       public.asset_postings%ROWTYPE;
  v_old     public.craft_village_publications%ROWTYPE;
  v_product TEXT := btrim(COALESCE(_product, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO v_p FROM public.asset_postings
   WHERE id = _posting_id AND public.owner_posting_can(id, 'so-hoa', 'update');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_p.workspace_id IS NULL OR NOT public._is_craft_village_workspace(v_p.workspace_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_craft_village');
  END IF;
  IF _latitude IS NULL OR _longitude IS NULL
     OR _latitude NOT BETWEEN 7 AND 24 OR _longitude NOT BETWEEN 102 AND 118 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_location');
  END IF;
  IF length(v_product) NOT BETWEEN 1 AND 80 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_product');
  END IF;
  IF COALESCE(_published, false) AND v_p.review_status IS DISTINCT FROM 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_approved');
  END IF;
  IF COALESCE(_published, false) AND v_p.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'posting_closed');
  END IF;

  SELECT * INTO v_old FROM public.craft_village_publications WHERE asset_posting_id = _posting_id FOR UPDATE;

  INSERT INTO public.craft_village_publications
    (asset_posting_id, latitude, longitude, product, is_published, published_at, updated_by)
  VALUES
    (_posting_id, round(_latitude, 6), round(_longitude, 6), v_product, COALESCE(_published, false),
     CASE WHEN COALESCE(_published, false) THEN now() END, auth.uid())
  ON CONFLICT (asset_posting_id) DO UPDATE
     SET latitude     = EXCLUDED.latitude,
         longitude    = EXCLUDED.longitude,
         product      = EXCLUDED.product,
         is_published = EXCLUDED.is_published,
         -- Giữ mốc công khai đầu tiên khi chỉ sửa vị trí/sản phẩm.
         published_at = CASE WHEN EXCLUDED.is_published
                             THEN COALESCE(v_old.published_at, now()) END,
         updated_by   = auth.uid();

  RETURN jsonb_build_object('ok', true, 'is_published', COALESCE(_published, false));
END;
$$;
GRANT EXECUTE ON FUNCTION public.owner_set_craft_map_publication(UUID, BOOLEAN, NUMERIC, NUMERIC, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.owner_set_craft_map_publication(UUID, BOOLEAN, NUMERIC, NUMERIC, TEXT) FROM anon;

-- ─── 6. Bản đồ công khai: chỉ các cột an toàn ─────────────────────────────────
-- RLS lọc DÒNG không lọc CỘT ⇒ không mở asset_postings cho anon; RPC trả tập cột tối thiểu
-- (không địa chỉ chi tiết, không pháp lý, không giá). Mô tả + ảnh + VR là thứ chủ đồng ý công khai.
CREATE FUNCTION public.public_craft_villages()
RETURNS TABLE (
  posting_id   UUID,
  title        TEXT,
  description  TEXT,
  province     TEXT,
  product      TEXT,
  latitude     NUMERIC,
  longitude    NUMERIC,
  image_urls   TEXT[],
  village_name TEXT,
  vr_url       TEXT,
  published_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.title, p.description, p.province, c.product, c.latitude, c.longitude,
         COALESCE(p.image_urls[1:6], ARRAY[]::text[]), w.primary_name, v.vr_url, c.published_at
    FROM public.craft_village_publications c
    JOIN public.asset_postings p          ON p.id = c.asset_posting_id
    JOIN public.asset_owner_workspaces w  ON w.id = p.workspace_id
    JOIN public.asset_owner_org_kyc k     ON k.id = w.org_kyc_id
    LEFT JOIN public.asset_vr_tour_orders v
           ON v.asset_posting_id = p.id AND v.status = 'attached' AND v.published_at IS NOT NULL
   WHERE c.is_published
     AND p.review_status = 'approved'
     AND p.status <> 'cancelled'
     AND k.org_type = 'craft_village'
   ORDER BY c.published_at DESC
$$;
GRANT EXECUTE ON FUNCTION public.public_craft_villages() TO anon, authenticated;
