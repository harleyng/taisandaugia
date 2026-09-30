-- Quyền lợi đầy đủ cho danh mục gói dịch vụ (2026-09-30).
--
-- Seed 20260928100000 chỉ có 5–6 dòng quyền lợi / gói; bảng so sánh trong design
-- "Goi Dich Vu Chu Tai San" có 6 nhóm (Tài sản / Báo cáo / Tiếp cận / Tổ chức / Tích hợp /
-- Hỗ trợ), gói cao nhất 23 dòng ⇒ nâng trần dòng quyền lợi 20 → 30 và điền đủ 3 gói mặc định.
--
-- Vẫn là dữ liệu GIỮ CHỖ: quyền lợi chỉ hiển thị, hệ thống không kiểm (admin sửa được).
-- Thứ tự dòng có chủ ý: 6 dòng tiêu biểu (Số hoá, Tin ưu tiên, Báo cáo thị trường, Xuất
-- PDF, Thư mời, Thành viên) đứng đầu vì thẻ gói chỉ hiện 8 dòng đầu (PLAN_CARD_MAX_LINES);
-- bảng so sánh gom theo nhóm nên thứ tự dòng trong từng nhóm vẫn khớp design.
-- Giờ phản hồi (thấp hơn = tốt hơn) viết thành chữ để benefitMagnitude không so số ngược.
-- Sức chứa (GB, mẫu, trang, lịch gửi, dashboard) KHÔNG ghi "/ tháng" như design — không
-- phải hạn mức tiêu theo tháng.

ALTER TABLE public.owner_subscription_plans DROP CONSTRAINT owner_subscription_plans_benefits_check;
ALTER TABLE public.owner_subscription_plans ADD CONSTRAINT owner_subscription_plans_benefits_check
  CHECK (jsonb_typeof(benefits) = 'array' AND jsonb_array_length(benefits) <= 30);

-- Thân hàm giữ nguyên bản 20260928100000, chỉ đổi trần 20 → 30.
CREATE OR REPLACE FUNCTION public.admin_owner_sub_plan_upsert(
  p_plan_id UUID, p_name TEXT, p_fit_line TEXT, p_highlight_line TEXT, p_tier TEXT,
  p_monthly_price_vnd NUMERIC, p_overage_mode TEXT, p_is_featured BOOLEAN, p_is_active BOOLEAN,
  p_sort_order INTEGER, p_entitlements JSONB, p_benefits JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_id   UUID := p_plan_id;
  v_line JSONB;
  v_key  TEXT;
BEGIN
  IF v_id IS NULL AND NOT public.admin_has_permission('goi-thue-bao', 'create') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF v_id IS NOT NULL AND NOT public.admin_has_permission('goi-thue-bao', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF char_length(btrim(COALESCE(p_name, ''))) NOT BETWEEN 2 AND 60 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_name');
  END IF;
  IF p_tier NOT IN ('basic', 'standard', 'premium') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_tier');
  END IF;
  IF p_overage_mode NOT IN ('block', 'credits') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_overage');
  END IF;
  IF p_monthly_price_vnd IS NULL OR p_monthly_price_vnd < 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;
  IF char_length(COALESCE(p_fit_line, '')) > 120 OR char_length(COALESCE(p_highlight_line, '')) > 120 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_text');
  END IF;

  IF jsonb_typeof(COALESCE(p_entitlements, '[]'::jsonb)) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_entitlements');
  END IF;
  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_entitlements, '[]'::jsonb)) LOOP
    v_key := v_line->>'variant_key';
    IF v_key IS NULL OR NOT (v_key = ANY (public.owner_sub_supported_variants())) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'unsupported_variant', 'variant_key', v_key);
    END IF;
    IF jsonb_typeof(v_line->'monthly_quota') = 'number' AND (v_line->>'monthly_quota')::int <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_quota', 'variant_key', v_key);
    END IF;
  END LOOP;

  IF jsonb_typeof(COALESCE(p_benefits, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_benefits, '[]'::jsonb)) > 30 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_benefits');
  END IF;
  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_benefits, '[]'::jsonb)) LOOP
    IF jsonb_typeof(v_line) <> 'object'
       OR char_length(btrim(COALESCE(v_line->>'group', ''))) NOT BETWEEN 1 AND 40
       OR char_length(btrim(COALESCE(v_line->>'label', ''))) NOT BETWEEN 1 AND 80
       OR char_length(btrim(COALESCE(v_line->>'value', ''))) NOT BETWEEN 1 AND 60 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_benefits');
    END IF;
  END LOOP;

  IF COALESCE(p_is_featured, false) THEN
    UPDATE public.owner_subscription_plans SET is_featured = false
     WHERE is_featured AND id IS DISTINCT FROM v_id;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.owner_subscription_plans
      (name, fit_line, highlight_line, tier, monthly_price_vnd, overage_mode, is_featured,
       is_active, sort_order, benefits, created_by, updated_by)
    VALUES (btrim(p_name), NULLIF(btrim(COALESCE(p_fit_line, '')), ''),
            NULLIF(btrim(COALESCE(p_highlight_line, '')), ''), p_tier, p_monthly_price_vnd,
            p_overage_mode, COALESCE(p_is_featured, false), COALESCE(p_is_active, true),
            COALESCE(p_sort_order, 0), COALESCE(p_benefits, '[]'::jsonb), v_uid, v_uid)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.owner_subscription_plans
       SET name = btrim(p_name), fit_line = NULLIF(btrim(COALESCE(p_fit_line, '')), ''),
           highlight_line = NULLIF(btrim(COALESCE(p_highlight_line, '')), ''), tier = p_tier,
           monthly_price_vnd = p_monthly_price_vnd, overage_mode = p_overage_mode,
           is_featured = COALESCE(p_is_featured, false), is_active = COALESCE(p_is_active, true),
           sort_order = COALESCE(p_sort_order, 0), benefits = COALESCE(p_benefits, '[]'::jsonb),
           updated_by = v_uid
     WHERE id = v_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  END IF;

  DELETE FROM public.owner_subscription_plan_entitlements WHERE plan_id = v_id;
  INSERT INTO public.owner_subscription_plan_entitlements (plan_id, variant_key, monthly_quota)
  SELECT v_id, e->>'variant_key',
         CASE WHEN jsonb_typeof(e->'monthly_quota') = 'number' THEN (e->>'monthly_quota')::int END
    FROM jsonb_array_elements(COALESCE(p_entitlements, '[]'::jsonb)) e;

  RETURN jsonb_build_object('ok', true, 'plan_id', v_id, 'created', p_plan_id IS NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_owner_sub_plan_upsert(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, BOOLEAN, BOOLEAN, INTEGER, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_owner_sub_plan_upsert(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, BOOLEAN, BOOLEAN, INTEGER, JSONB, JSONB) TO authenticated;

-- ─── Quyền lợi 3 gói mặc định (khớp theo tên + hạng; gói admin đã đổi tên thì bỏ qua) ──

UPDATE public.owner_subscription_plans p
   SET benefits = s.benefits
  FROM (VALUES
  ('Cơ bản', 'basic',
   '[{"group": "Tài sản", "label": "Số hoá hồ sơ", "value": "20 hồ sơ / tháng"},
     {"group": "Tài sản", "label": "Tin đăng ưu tiên", "value": "2 tin / tháng"},
     {"group": "Báo cáo", "label": "Xuất báo cáo PDF", "value": "10 bản / tháng"},
     {"group": "Tiếp cận", "label": "Thư mời gửi nhà đầu tư", "value": "200 thư / tháng"},
     {"group": "Tổ chức", "label": "Thành viên", "value": "5 người"},
     {"group": "Tài sản", "label": "Lưu trữ tài liệu", "value": "5 GB"},
     {"group": "Tài sản", "label": "Mẫu hồ sơ tuỳ chỉnh", "value": "1 mẫu"},
     {"group": "Báo cáo", "label": "Xuất dữ liệu Excel", "value": "5 lượt / tháng"},
     {"group": "Tổ chức", "label": "Chi nhánh", "value": "1 chi nhánh"},
     {"group": "Hỗ trợ", "label": "Hỗ trợ ưu tiên", "value": "Phản hồi trong 48 giờ"}]'::jsonb),
  ('Tiêu chuẩn', 'standard',
   '[{"group": "Tài sản", "label": "Số hoá hồ sơ", "value": "50 hồ sơ / tháng"},
     {"group": "Tài sản", "label": "Tin đăng ưu tiên", "value": "5 tin / tháng"},
     {"group": "Báo cáo", "label": "Báo cáo thị trường", "value": "10 lượt xem / tháng"},
     {"group": "Báo cáo", "label": "Xuất báo cáo PDF", "value": "40 bản / tháng"},
     {"group": "Tiếp cận", "label": "Thư mời gửi nhà đầu tư", "value": "1,000 thư / tháng"},
     {"group": "Tổ chức", "label": "Thành viên", "value": "15 người"},
     {"group": "Tài sản", "label": "Tour VR 360°", "value": "3 tour / tháng"},
     {"group": "Tài sản", "label": "Lưu trữ tài liệu", "value": "20 GB"},
     {"group": "Tài sản", "label": "Mẫu hồ sơ tuỳ chỉnh", "value": "5 mẫu"},
     {"group": "Báo cáo", "label": "Dashboard theo chi nhánh", "value": "3 dashboard"},
     {"group": "Báo cáo", "label": "Xuất dữ liệu Excel", "value": "30 lượt / tháng"},
     {"group": "Báo cáo", "label": "Báo cáo định kỳ tự động", "value": "2 lịch gửi"},
     {"group": "Tiếp cận", "label": "SMS thông báo phiên", "value": "500 tin / tháng"},
     {"group": "Tiếp cận", "label": "Trang giới thiệu tổ chức", "value": "1 trang"},
     {"group": "Tổ chức", "label": "Chi nhánh", "value": "5 chi nhánh"},
     {"group": "Tổ chức", "label": "Phân quyền tuỳ chỉnh", "value": "3 vai trò"},
     {"group": "Tích hợp", "label": "API truy xuất dữ liệu", "value": "10,000 lượt gọi / tháng"},
     {"group": "Tích hợp", "label": "Webhook sự kiện", "value": "2 endpoint"},
     {"group": "Hỗ trợ", "label": "Hỗ trợ ưu tiên", "value": "Phản hồi trong 8 giờ"},
     {"group": "Hỗ trợ", "label": "Đào tạo trực tuyến", "value": "1 buổi / tháng"}]'::jsonb),
  ('Chuyên nghiệp', 'premium',
   '[{"group": "Tài sản", "label": "Số hoá hồ sơ", "value": "Không giới hạn"},
     {"group": "Tài sản", "label": "Tin đăng ưu tiên", "value": "15 tin / tháng"},
     {"group": "Báo cáo", "label": "Báo cáo thị trường", "value": "Không giới hạn"},
     {"group": "Báo cáo", "label": "Xuất báo cáo PDF", "value": "Không giới hạn"},
     {"group": "Tiếp cận", "label": "Thư mời gửi nhà đầu tư", "value": "5,000 thư / tháng"},
     {"group": "Tổ chức", "label": "Thành viên", "value": "Không giới hạn"},
     {"group": "Tài sản", "label": "Tour VR 360°", "value": "10 tour / tháng"},
     {"group": "Tài sản", "label": "Lưu trữ tài liệu", "value": "100 GB"},
     {"group": "Tài sản", "label": "Mẫu hồ sơ tuỳ chỉnh", "value": "Không giới hạn"},
     {"group": "Báo cáo", "label": "Dashboard theo chi nhánh", "value": "Không giới hạn"},
     {"group": "Báo cáo", "label": "Xuất dữ liệu Excel", "value": "Không giới hạn"},
     {"group": "Báo cáo", "label": "Báo cáo định kỳ tự động", "value": "10 lịch gửi"},
     {"group": "Tiếp cận", "label": "SMS thông báo phiên", "value": "3,000 tin / tháng"},
     {"group": "Tiếp cận", "label": "Trang giới thiệu tổ chức", "value": "5 trang"},
     {"group": "Tiếp cận", "label": "Banner trang chủ", "value": "4 lượt / tháng"},
     {"group": "Tổ chức", "label": "Chi nhánh", "value": "Không giới hạn"},
     {"group": "Tổ chức", "label": "Phân quyền tuỳ chỉnh", "value": "Không giới hạn"},
     {"group": "Tích hợp", "label": "API truy xuất dữ liệu", "value": "100,000 lượt gọi / tháng"},
     {"group": "Tích hợp", "label": "Đăng nhập SSO", "value": "1 kết nối"},
     {"group": "Tích hợp", "label": "Webhook sự kiện", "value": "10 endpoint"},
     {"group": "Hỗ trợ", "label": "Hỗ trợ ưu tiên", "value": "Phản hồi trong 2 giờ"},
     {"group": "Hỗ trợ", "label": "Chuyên viên phụ trách riêng", "value": "1 người"},
     {"group": "Hỗ trợ", "label": "Đào tạo trực tuyến", "value": "4 buổi / tháng"}]'::jsonb)
  ) AS s(name, tier, benefits)
 WHERE p.name = s.name AND p.tier = s.tier;
