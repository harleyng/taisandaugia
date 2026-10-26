-- Làm đẹp dữ liệu demo "Kế hoạch đấu giá" trước khi quay video.
--
-- Chạy:  psql "$URI" -v ON_ERROR_STOP=1 -f scripts/seed-plan-demo-polish.sql
--
-- Hai việc:
--   A. Giãn lại NGÀY DỰ KIẾN của các mốc chưa xong, để huy hiệu "Vận hành tháng"
--      đọc ra một con số tin được (~8) thay vì 72, và trang Vận hành tháng có một
--      danh sách ngắn, đọc được — thay vì đổ ra toàn bộ mốc quá hạn từ đầu năm.
--   B. Tạo MỘT kế hoạch BỔ SUNG ở trạng thái nháp cho Phường Vũ Ninh, gắn vào đợt
--      bổ sung đang mở, kèm 3 tài sản. Có nó thì buổi quay diễn được trọn chuỗi
--      Trình → Tỉnh trả lại → Mở lại → Trình lại → Ghi nhận phê duyệt mà không
--      phải dựng kế hoạch từ con số không giữa lúc đang quay.
--
-- KHÔNG đụng tới: 4 kế hoạch năm đã duyệt, các bản mốc (bất biến), kết quả đấu
-- giá, sổ tiền, dữ liệu công khai. Chạy lại được nhiều lần.
--
-- Mốc là dữ liệu THỰC HIỆN nên sửa thoải mái; THÁNG trong danh mục là trường mốc
-- của bản kế hoạch đã duyệt, đã khoá — script này cố tình không chạm vào.

\set ON_ERROR_STOP on

DO $$
DECLARE
  v_ws       UUID := 'd10ba07b-13d3-43d9-98ad-682445df74ba';
  v_owner    UUID := '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f';
  v_branch   UUID := '8e6d6935-a013-4cf6-bac3-2a341d2971f2';  -- Phường Vũ Ninh
  v_cycle    UUID := '3faa1aa7-0688-4410-932f-4e02fb88f09e';  -- đợt bổ sung 2026 (đang mở)
  v_today    DATE;
  v_plan     UUID;
  v_steps    INT;
  v_overdue  INT;
BEGIN
  -- Chỉ chạy trên Trạm demo. Chạy nhầm vào Trạm thật thì dừng ngay.
  IF NOT EXISTS (SELECT 1 FROM public.asset_owner_workspaces
                  WHERE id = v_ws AND is_demo IS TRUE) THEN
    RAISE EXCEPTION 'Trạm % không phải dữ liệu minh hoạ — dừng', v_ws;
  END IF;

  -- Giả danh chủ tỉnh: auction_plan_item_health_rows có cổng auction_plan_read_ok,
  -- chạy bằng postgres trần sẽ trả 0 dòng.
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', v_owner)::text, true);
  v_today := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;

  ---------------------------------------------------------------- A. mốc
  WITH h AS (
    SELECT hr.item_id, hr.health
      FROM public.auction_plans p
      CROSS JOIN LATERAL public.auction_plan_item_health_rows(p.id, v_today) hr
     WHERE p.workspace_id = v_ws
  ),
  ranked AS (
    SELECT s.id, h.health,
           row_number() OVER (PARTITION BY s.item_id ORDER BY s.sort_order) AS k
      FROM public.auction_plan_item_steps s
      JOIN h ON h.item_id = s.item_id
     WHERE s.done_on IS NULL
  )
  UPDATE public.auction_plan_item_steps s
     SET planned_date = CASE
           -- đang trễ / nguy cơ trễ: đúng MỘT mốc quá hạn, mốc sau rơi vào cuối tháng này
           WHEN r.health IN ('late','at_risk') AND r.k = 1 THEN v_today - 8
           WHEN r.health IN ('late','at_risk') AND r.k = 2 THEN v_today + 4
           -- không thành, chờ đấu lại: việc kế tiếp ở đầu tháng sau
           WHEN r.health = 'failed_retry'      AND r.k = 1 THEN v_today + 9
           -- đúng tiến độ: việc kế tiếp trong tháng tới
           WHEN r.health = 'on_track'          AND r.k = 1 THEN v_today + 11
           -- đã bỏ khỏi kế hoạch: không còn hạn
           WHEN r.health = 'dropped'                       THEN NULL
           ELSE v_today + (r.k * 17)::int   -- row_number() là bigint, date + bigint không có toán tử
         END
    FROM ranked r
   WHERE s.id = r.id;
  GET DIAGNOSTICS v_steps = ROW_COUNT;

  SELECT count(*) INTO v_overdue
    FROM public.auction_plan_item_steps s
    JOIN public.auction_plans p ON p.id = s.plan_id
   WHERE p.workspace_id = v_ws
     AND s.done_on IS NULL AND s.planned_date < v_today;

  RAISE NOTICE 'A. đã giãn % mốc · còn % mốc quá hạn', v_steps, v_overdue;

  ------------------------------------------------- B. kế hoạch bổ sung nháp
  SELECT id INTO v_plan FROM public.auction_plans
   WHERE workspace_id = v_ws AND plan_year = 2026 AND kind = 'supplement';

  IF v_plan IS NULL THEN
    INSERT INTO public.auction_plans
      (workspace_id, branch_id, cycle_id, plan_year, kind, title, level, legal_basis, notes)
    VALUES
      (v_ws, v_branch, v_cycle, 2026, 'supplement',
       'Kế hoạch đấu giá QSDĐ bổ sung năm 2026 · Phường Vũ Ninh', 'commune',
       'Luật Đấu giá tài sản; Luật Đất đai — dữ liệu minh hoạ',
       'Bản nháp dùng cho video demo.')
    RETURNING id INTO v_plan;

    INSERT INTO public.auction_plan_items
      (plan_id, asset_type, title, lot_labels, lot_count, map_sheet, parcel_no,
       location, area_m2, land_use_code, allocation_form, unit_start_price,
       planned_month, planned_method, executing_unit)
    VALUES
      (v_plan, 'land_use_right', 'Khu dân cư Vũ Ninh — lô bổ sung BS1', 'BS1-01→06', 6,
       '18', '112', 'Giáp đường Nguyễn Trãi, phường Vũ Ninh', 1320.0, 'ODT',
       'giao_co_thu_tien', 28000000, DATE '2026-11-01', 'truc_tiep_loi_noi', 'Phòng Kinh tế'),
      (v_plan, 'land_use_right', 'Đất ở xen kẹp tổ 7 Vũ Ninh', 'BS2-01→03', 3,
       '18', '140', 'Ngõ 24 đường Trần Phú, phường Vũ Ninh', 540.0, 'ODT',
       'giao_co_thu_tien', 32000000, DATE '2026-12-01', 'bo_phieu_truc_tiep', 'Phòng Kinh tế'),
      (v_plan, 'land_use_right', 'Khu tái định cư Vũ Ninh — phần mở rộng', 'BS3-01→04', 4,
       '21', '58', 'Phía đông khu tái định cư Vũ Ninh', 960.0, 'ODT',
       'giao_co_thu_tien', 24500000, DATE '2026-12-01', 'truc_tuyen', 'Phòng Kinh tế');

    RAISE NOTICE 'B. đã tạo kế hoạch bổ sung NHÁP % kèm 3 tài sản', v_plan;
  ELSE
    RAISE NOTICE 'B. kế hoạch bổ sung đã có (%), bỏ qua', v_plan;
  END IF;
END $$;

\echo
\echo '=== trạng thái sau khi làm đẹp ==='
SELECT status || ' × ' || count(*) AS "kế hoạch"
  FROM auction_plans WHERE workspace_id='d10ba07b-13d3-43d9-98ad-682445df74ba'
 GROUP BY status ORDER BY 1;
SELECT count(*) AS "mốc quá hạn (huy hiệu)"
  FROM auction_plan_item_steps s JOIN auction_plans p ON p.id=s.plan_id
 WHERE p.workspace_id='d10ba07b-13d3-43d9-98ad-682445df74ba'
   AND s.done_on IS NULL
   AND s.planned_date < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
SELECT count(*) AS "mốc đến hạn trong 14 ngày tới"
  FROM auction_plan_item_steps s JOIN auction_plans p ON p.id=s.plan_id
 WHERE p.workspace_id='d10ba07b-13d3-43d9-98ad-682445df74ba'
   AND s.done_on IS NULL
   AND s.planned_date BETWEEN (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
                          AND (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 14;
