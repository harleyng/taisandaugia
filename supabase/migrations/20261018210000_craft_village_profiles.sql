-- Bản đồ làng nghề: thực thể trên bản đồ là LÀNG (Trạm loại craft_village), không phải từng hồ sơ.
--
--  • craft_village_profiles: thông tin chung của làng — vị trí, tỉnh, sản phẩm chính, giới thiệu,
--    hồ sơ làm ảnh bìa, công khai. Sửa ở trang /chu-tai-san/lang-nghe (quyền chi-nhanh:update).
--  • craft_village_publications nay chỉ là cờ "hồ sơ hiện trong trang làng" (chủ tự bật từng hồ sơ,
--    hồ sơ phải đã duyệt). Bỏ vị trí/sản phẩm theo từng hồ sơ.
--  • Làng lên bản đồ khi: làng công khai  VÀ  có ≥ 1 hồ sơ hiện (đã bật + đã duyệt + chưa huỷ).
--  • Chuyển dữ liệu: 101 làng hiện mỗi làng đúng 1 hồ sơ công khai ⇒ chép vị trí/sản phẩm lên làng.

-- ─── 1. Hồ sơ làng ────────────────────────────────────────────────────────────
CREATE TABLE public.craft_village_profiles (
  workspace_id     UUID PRIMARY KEY REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  latitude         NUMERIC(9,6) NOT NULL CHECK (latitude BETWEEN 7 AND 24),
  longitude        NUMERIC(9,6) NOT NULL CHECK (longitude BETWEEN 102 AND 118),
  province         TEXT        CHECK (province IS NULL OR length(btrim(province)) BETWEEN 1 AND 60),
  product          TEXT        NOT NULL CHECK (length(btrim(product)) BETWEEN 1 AND 80),
  intro            TEXT        CHECK (intro IS NULL OR length(intro) <= 2000),
  cover_posting_id UUID        REFERENCES public.asset_postings(id) ON DELETE SET NULL,
  is_published     BOOLEAN     NOT NULL DEFAULT false,
  published_at     TIMESTAMPTZ,
  updated_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT craft_village_published_shape CHECK (is_published = (published_at IS NOT NULL))
);

CREATE TRIGGER craft_village_profiles_updated_at
  BEFORE UPDATE ON public.craft_village_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- Nhật ký: owner_audit_row không biết bảng này (nhánh ELSE bỏ qua) ⇒ ghi thẳng trong
-- owner_set_craft_village_profile thay vì sửa hàm trigger dùng chung.

ALTER TABLE public.craft_village_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "craft_village_profiles_member_read" ON public.craft_village_profiles
  FOR SELECT TO authenticated USING (public.owner_ws_can(workspace_id, 'read'));
-- Không có policy ghi: chỉ owner_set_craft_village_profile (SECURITY DEFINER).
REVOKE INSERT, UPDATE, DELETE ON public.craft_village_profiles FROM anon, authenticated;

-- ─── 2. Chuyển dữ liệu: vị trí/sản phẩm của hồ sơ công khai sớm nhất mỗi làng ───
INSERT INTO public.craft_village_profiles
  (workspace_id, latitude, longitude, province, product, cover_posting_id, is_published, published_at, updated_by)
SELECT DISTINCT ON (p.workspace_id)
       p.workspace_id, c.latitude, c.longitude, NULLIF(btrim(p.province), ''), c.product, p.id,
       bool_or(c.is_published) OVER (PARTITION BY p.workspace_id),
       min(c.published_at)     OVER (PARTITION BY p.workspace_id),
       c.updated_by
  FROM public.craft_village_publications c
  JOIN public.asset_postings p ON p.id = c.asset_posting_id
 WHERE p.workspace_id IS NOT NULL
 ORDER BY p.workspace_id, c.is_published DESC, c.published_at NULLS LAST, c.created_at;

-- ─── 3. Cờ hiện từng hồ sơ: bỏ vị trí/sản phẩm theo hồ sơ ─────────────────────
-- Hàm cũ tham chiếu các cột này ⇒ gỡ trước.
DROP FUNCTION public.owner_set_craft_map_publication(UUID, BOOLEAN, NUMERIC, NUMERIC, TEXT);
DROP FUNCTION public.owner_craft_map_state(UUID);
DROP FUNCTION public.public_craft_villages();

ALTER TABLE public.craft_village_publications
  DROP COLUMN latitude,
  DROP COLUMN longitude,
  DROP COLUMN product;

-- ─── 4. Helper ────────────────────────────────────────────────────────────────
-- Hồ sơ hiện trong trang làng (dùng chung cho chủ + công khai).
CREATE FUNCTION public._craft_asset_visible(_posting_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.craft_village_publications c
      JOIN public.asset_postings p ON p.id = c.asset_posting_id
     WHERE c.asset_posting_id = _posting_id AND c.is_published
       AND p.review_status = 'approved' AND p.status <> 'cancelled')
$$;
REVOKE EXECUTE ON FUNCTION public._craft_asset_visible(UUID) FROM PUBLIC, anon, authenticated;

-- ─── 5. Thẻ ở chi tiết hồ sơ: bật/tắt hiện trong trang làng ──────────────────
CREATE FUNCTION public.owner_craft_map_state(_posting_id UUID)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_p   public.asset_postings%ROWTYPE;
  v_pub public.craft_village_publications%ROWTYPE;
  v_vil public.craft_village_profiles%ROWTYPE;
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
  SELECT * INTO v_vil FROM public.craft_village_profiles WHERE workspace_id = v_p.workspace_id;
  RETURN jsonb_build_object(
    'ok', true,
    'eligible', true,
    'can_edit', public.owner_posting_can(_posting_id, 'so-hoa', 'update'),
    'review_status', v_p.review_status,
    'has_vr', EXISTS (SELECT 1 FROM public.asset_vr_tour_orders o
                       WHERE o.asset_posting_id = _posting_id
                         AND o.status = 'attached' AND o.published_at IS NOT NULL),
    'has_image', COALESCE(cardinality(v_p.image_urls), 0) > 0,
    'is_published', COALESCE(v_pub.is_published, false),
    'village', CASE WHEN v_vil.workspace_id IS NULL THEN NULL ELSE jsonb_build_object(
      'is_published', v_vil.is_published, 'is_cover', v_vil.cover_posting_id = _posting_id) END
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.owner_craft_map_state(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.owner_craft_map_state(UUID) FROM PUBLIC, anon;

CREATE FUNCTION public.owner_set_craft_asset_visibility(_posting_id UUID, _published BOOLEAN)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_p   public.asset_postings%ROWTYPE;
  v_on  BOOLEAN := COALESCE(_published, false);
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
  IF v_on AND v_p.review_status IS DISTINCT FROM 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_approved');
  END IF;
  IF v_on AND v_p.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'posting_closed');
  END IF;

  INSERT INTO public.craft_village_publications (asset_posting_id, is_published, published_at, updated_by)
  VALUES (_posting_id, v_on, CASE WHEN v_on THEN now() END, auth.uid())
  ON CONFLICT (asset_posting_id) DO UPDATE
     SET is_published = EXCLUDED.is_published,
         -- Giữ mốc công khai đầu tiên khi bật lại.
         published_at = CASE WHEN EXCLUDED.is_published
                             THEN COALESCE(public.craft_village_publications.published_at, now()) END,
         updated_by   = auth.uid();

  RETURN jsonb_build_object('ok', true, 'is_published', v_on);
END;
$$;
GRANT EXECUTE ON FUNCTION public.owner_set_craft_asset_visibility(UUID, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.owner_set_craft_asset_visibility(UUID, BOOLEAN) FROM PUBLIC, anon;

-- ─── 6. Trang "Hồ sơ làng nghề" của Trạm ─────────────────────────────────────
CREATE FUNCTION public.owner_craft_village_profile(_workspace_id UUID)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_vil public.craft_village_profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.owner_ws_can(_workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public._is_craft_village_workspace(_workspace_id) THEN
    RETURN jsonb_build_object('ok', true, 'eligible', false);
  END IF;

  SELECT * INTO v_vil FROM public.craft_village_profiles WHERE workspace_id = _workspace_id;
  RETURN jsonb_build_object(
    'ok', true,
    'eligible', true,
    'can_edit', public.owner_ws_has(_workspace_id, 'chi-nhanh', 'update'),
    'can_edit_assets', public.owner_ws_has(_workspace_id, 'so-hoa', 'update'),
    'village_name', (SELECT w.primary_name FROM public.asset_owner_workspaces w WHERE w.id = _workspace_id),
    'profile', CASE WHEN v_vil.workspace_id IS NULL THEN NULL ELSE jsonb_build_object(
      'latitude', v_vil.latitude, 'longitude', v_vil.longitude, 'province', v_vil.province,
      'product', v_vil.product, 'intro', v_vil.intro, 'cover_posting_id', v_vil.cover_posting_id,
      'is_published', v_vil.is_published, 'published_at', v_vil.published_at) END,
    'assets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'posting_id', p.id, 'code', p.code, 'title', p.title, 'image', p.image_urls[1],
               'status', p.status, 'review_status', p.review_status,
               'is_published', COALESCE(c.is_published, false),
               'visible', public._craft_asset_visible(p.id),
               'has_vr', EXISTS (SELECT 1 FROM public.asset_vr_tour_orders o
                                  WHERE o.asset_posting_id = p.id
                                    AND o.status = 'attached' AND o.published_at IS NOT NULL))
             ORDER BY p.created_at DESC)
        FROM public.asset_postings p
        LEFT JOIN public.craft_village_publications c ON c.asset_posting_id = p.id
       WHERE p.workspace_id = _workspace_id AND p.status <> 'cancelled'), '[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.owner_craft_village_profile(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.owner_craft_village_profile(UUID) FROM PUBLIC, anon;

CREATE FUNCTION public.owner_set_craft_village_profile(
  _workspace_id UUID, _published BOOLEAN, _latitude NUMERIC, _longitude NUMERIC,
  _province TEXT, _product TEXT, _intro TEXT, _cover_posting_id UUID)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_on       BOOLEAN := COALESCE(_published, false);
  v_product  TEXT := btrim(COALESCE(_product, ''));
  v_province TEXT := NULLIF(btrim(COALESCE(_province, '')), '');
  v_intro    TEXT := NULLIF(btrim(COALESCE(_intro, '')), '');
  v_old      public.craft_village_profiles%ROWTYPE;
  v_new      public.craft_village_profiles%ROWTYPE;
  v_changes  JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  PERFORM 1 FROM public.asset_owner_workspaces WHERE id = _workspace_id FOR UPDATE;
  IF NOT FOUND OR NOT public.owner_ws_has(_workspace_id, 'chi-nhanh', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public._is_craft_village_workspace(_workspace_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_craft_village');
  END IF;
  IF _latitude IS NULL OR _longitude IS NULL
     OR _latitude NOT BETWEEN 7 AND 24 OR _longitude NOT BETWEEN 102 AND 118 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_location');
  END IF;
  IF length(v_product) NOT BETWEEN 1 AND 80 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_product');
  END IF;
  IF v_province IS NOT NULL AND length(v_province) > 60 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_province');
  END IF;
  IF v_intro IS NOT NULL AND length(v_intro) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_intro');
  END IF;
  IF _cover_posting_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.asset_postings WHERE id = _cover_posting_id AND workspace_id = _workspace_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_cover');
  END IF;

  SELECT * INTO v_old FROM public.craft_village_profiles WHERE workspace_id = _workspace_id FOR UPDATE;

  INSERT INTO public.craft_village_profiles
    (workspace_id, latitude, longitude, province, product, intro, cover_posting_id,
     is_published, published_at, updated_by)
  VALUES
    (_workspace_id, round(_latitude, 6), round(_longitude, 6), v_province, v_product, v_intro, _cover_posting_id,
     v_on, CASE WHEN v_on THEN now() END, auth.uid())
  ON CONFLICT (workspace_id) DO UPDATE
     SET latitude         = EXCLUDED.latitude,
         longitude        = EXCLUDED.longitude,
         province         = EXCLUDED.province,
         product          = EXCLUDED.product,
         intro            = EXCLUDED.intro,
         cover_posting_id = EXCLUDED.cover_posting_id,
         is_published     = EXCLUDED.is_published,
         published_at     = CASE WHEN EXCLUDED.is_published THEN COALESCE(v_old.published_at, now()) END,
         updated_by       = auth.uid()
  RETURNING * INTO v_new;

  v_changes := public.owner_audit_diff(
    CASE WHEN v_old.workspace_id IS NULL THEN NULL ELSE to_jsonb(v_old) END, to_jsonb(v_new))
    - 'updated_at' - 'updated_by';
  IF v_changes <> '{}'::jsonb THEN
    PERFORM public.owner_audit_write(
      _workspace_id, NULL, NULL, 'chi-nhanh',
      CASE WHEN v_old.workspace_id IS NULL THEN 'create' ELSE 'update' END,
      'craft_village_profiles', _workspace_id::text,
      'Hồ sơ làng nghề · ' || (SELECT w.primary_name FROM public.asset_owner_workspaces w WHERE w.id = _workspace_id),
      public.owner_audit_enrich(v_changes), '{}'::jsonb, NULL);
  END IF;

  RETURN jsonb_build_object('ok', true, 'is_published', v_on);
END;
$$;
GRANT EXECUTE ON FUNCTION public.owner_set_craft_village_profile(UUID, BOOLEAN, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, UUID)
  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.owner_set_craft_village_profile(UUID, BOOLEAN, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC, anon;

-- ─── 7. Bản đồ công khai: mỗi dòng một LÀNG, kèm danh sách hồ sơ đang hiện ─────
-- RLS lọc DÒNG không lọc CỘT ⇒ RPC trả tập cột tối thiểu (không địa chỉ chi tiết, pháp lý, giá).
CREATE FUNCTION public.public_craft_villages()
RETURNS TABLE (
  workspace_id UUID,
  village_name TEXT,
  province     TEXT,
  product      TEXT,
  intro        TEXT,
  latitude     NUMERIC,
  longitude    NUMERIC,
  cover_image  TEXT,
  has_vr       BOOLEAN,
  published_at TIMESTAMPTZ,
  assets       JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH visible AS (
    SELECT p.workspace_id, p.id, p.title, p.description,
           COALESCE(p.image_urls[1:6], ARRAY[]::text[]) AS image_urls,
           c.published_at,
           (SELECT o.vr_url FROM public.asset_vr_tour_orders o
             WHERE o.asset_posting_id = p.id AND o.status = 'attached' AND o.published_at IS NOT NULL
             ORDER BY o.published_at DESC LIMIT 1) AS vr_url
      FROM public.craft_village_publications c
      JOIN public.asset_postings p ON p.id = c.asset_posting_id
     WHERE c.is_published AND p.review_status = 'approved' AND p.status <> 'cancelled'
  )
  SELECT v.workspace_id, w.primary_name, v.province, v.product, v.intro, v.latitude, v.longitude,
         -- Ảnh bìa: ảnh đầu của hồ sơ chủ chọn (nếu đang hiện), không thì hồ sơ hiện sớm nhất.
         (SELECT a.image_urls[1] FROM visible a WHERE a.workspace_id = v.workspace_id
           ORDER BY (a.id = v.cover_posting_id) DESC, a.published_at LIMIT 1),
         EXISTS (SELECT 1 FROM visible a WHERE a.workspace_id = v.workspace_id AND a.vr_url IS NOT NULL),
         v.published_at,
         (SELECT jsonb_agg(jsonb_build_object(
                   'posting_id', a.id, 'title', a.title, 'description', a.description,
                   'image_urls', to_jsonb(a.image_urls), 'vr_url', a.vr_url)
                   ORDER BY (a.id = v.cover_posting_id) DESC, a.published_at)
            FROM visible a WHERE a.workspace_id = v.workspace_id)
    FROM public.craft_village_profiles v
    JOIN public.asset_owner_workspaces w ON w.id = v.workspace_id
    JOIN public.asset_owner_org_kyc k    ON k.id = w.org_kyc_id
   WHERE v.is_published
     AND k.org_type = 'craft_village'
     AND EXISTS (SELECT 1 FROM visible a WHERE a.workspace_id = v.workspace_id)
   ORDER BY v.published_at DESC
$$;
GRANT EXECUTE ON FUNCTION public.public_craft_villages() TO anon, authenticated;
