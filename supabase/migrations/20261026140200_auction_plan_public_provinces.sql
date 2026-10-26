-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 10 — khám phá: những tỉnh/thành phố đang công khai danh mục dự kiến
--
-- Trang công khai cần một mặc định có dữ liệu, nếu không người xem mở ra chỉ
-- thấy một bộ chọn trống. Hàm trả rất ít: mã tỉnh + tên tỉnh (đã công khai ở
-- `admin_units`) + số tài sản. Không id nội bộ, không giá, không tên đơn vị lập.
--
-- Chỉ TÍNH số cho tỉnh thật sự có kế hoạch đã duyệt + đã bật công khai (EXISTS
-- rẻ, lặp lại đúng hai điều kiện của `get_public_plan_items`), rồi mới gọi hàm
-- chính để con số không bao giờ lệch với danh sách.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_public_plan_provinces()
RETURNS SETOF JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object('code', t.code, 'name', t.name, 'item_count', t.n)
    FROM (
      SELECT pr.code, pr.name,
             (SELECT COUNT(*) FROM public.get_public_plan_items(pr.code, NULL)) AS n
        FROM public.admin_units pr
       WHERE pr.level = 'province'
         AND pr.is_active
         AND EXISTS (SELECT 1
                       FROM public.auction_plans p
                       JOIN public.admin_units c ON c.code = p.admin_unit_code
                      WHERE c.parent_code = pr.code
                        AND p.status = 'approved'
                        AND p.public_opt_in)
    ) t
   WHERE t.n > 0
   ORDER BY t.name;
$$;

COMMENT ON FUNCTION public.get_public_plan_provinces() IS
  'Các tỉnh/thành phố đang công khai danh mục "Sắp đấu giá theo kế hoạch" + số tài sản (Phase 10).';

REVOKE ALL ON FUNCTION public.get_public_plan_provinces() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_plan_provinces() TO anon, authenticated;
