-- Kế hoạch đấu giá — Phase 5: bổ sung bộ demo để tab "Tiến độ" có mốc do SÀN xác nhận.
--
-- Bộ demo của Phase 9 (`20261026120100`) đã dựng Trạm "UBND tỉnh Bắc Ninh"
-- (`is_demo`), 4 kế hoạch năm 2026 đã duyệt, 20 tài sản, 6 trong đó liên kết hồ
-- sơ số hoá và có kết quả phiên. Nhưng KHÔNG hồ sơ nào có yêu cầu dịch vụ hay
-- hợp đồng ký gửi, nên mốc 4 ("Lựa chọn tổ chức đấu giá") và mốc 5 ("Ký hợp
-- đồng dịch vụ đấu giá") không có gì để sàn xác nhận — tiêu chí nghiệm thu
-- "liên kết hồ sơ có hợp đồng đã ký ⇒ mốc 4–5 hiện Sàn xác nhận" không chứng
-- minh được trên màn hình.
--
-- Migration này vá đúng chỗ đó: với HAI hồ sơ của Trạm demo, tạo một yêu cầu
-- dịch vụ đã CHỐT tổ chức + một hợp đồng ký gửi đã KÝ (`source = 'backfill'` —
-- bản ghi lịch sử, không đi qua luồng ký trong app), rồi gọi
-- `auction_plan_sync_platform_steps` cho cả 4 kế hoạch.
--
-- Chỉ chạm Trạm có `is_demo = true`. Chạy lại KHÔNG sinh trùng.

DO $$
DECLARE
  v_ws       UUID;
  v_owner    UUID;
  v_org      UUID := 'a2222222-2222-2222-2222-222222222222';  -- Công ty Đấu giá Hợp danh Bảo Tín
  v_org_id   UUID := 'c9d00002-0000-4000-8000-000000000001';
  v_plan     UUID;
  v_posting  UUID;
  v_req      UUID;
  v_signed   DATE;
  v_n        INT := 0;
  v_res      JSONB;
BEGIN
  SELECT w.id, w.owner_user_id INTO v_ws, v_owner
    FROM public.asset_owner_workspaces w
   WHERE w.is_demo IS TRUE
     AND w.admin_unit_code = '24'
   ORDER BY w.created_at
   LIMIT 1;

  IF v_ws IS NULL THEN
    RAISE NOTICE 'Không có Trạm demo tỉnh Bắc Ninh — bỏ qua.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.auction_organizations WHERE id = v_org)
     OR NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org_id) THEN
    RAISE NOTICE 'Không có tổ chức đấu giá mẫu — bỏ qua phần hợp đồng.';
  ELSE
    -- Hai hồ sơ đầu (theo mã tài sản) của Trạm demo có liên kết hồ sơ số hoá.
    FOR v_posting, v_signed IN
      SELECT i.asset_posting_id,
             -- ký trước tháng kế hoạch một tháng
             (date_trunc('month', COALESCE(i.planned_month, DATE '2026-06-01')) - INTERVAL '12 days')::DATE
        FROM public.auction_plan_items i
        JOIN public.asset_postings ap ON ap.id = i.asset_posting_id
       WHERE i.workspace_id = v_ws
         AND i.asset_posting_id IS NOT NULL
       ORDER BY i.item_code, i.created_at
       LIMIT 2
    LOOP
      IF EXISTS (SELECT 1 FROM public.asset_service_requests r WHERE r.asset_posting_id = v_posting) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.asset_service_requests
        (asset_posting_id, auction_org_id, user_id, organization_id, status, origin,
         respond_by, quoted_at, quote_commission_pct, quote_service_fee, quote_starting_price,
         quote_lead_time_days, quote_note, updated_at)
      VALUES
        (v_posting, v_org, COALESCE(v_owner, (SELECT user_id FROM public.asset_postings WHERE id = v_posting)),
         v_org_id, 'selected', 'owner',
         v_signed - 14, (v_signed - 10)::TIMESTAMPTZ, 1.20, 12000000, NULL,
         30, '[DEMO] Báo giá dịch vụ đấu giá quyền sử dụng đất.', (v_signed - 3)::TIMESTAMPTZ)
      RETURNING id INTO v_req;

      INSERT INTO public.consignment_contracts
        (service_request_id, asset_posting_id, auction_org_id, organization_id, owner_user_id,
         status, source, terms, owner_party, org_party, asset_snapshot,
         signed_date, signed_at)
      VALUES
        (v_req, v_posting, v_org, v_org_id,
         COALESCE(v_owner, (SELECT user_id FROM public.asset_postings WHERE id = v_posting)),
         'signed', 'backfill',
         jsonb_build_object('commission_pct', 1.20, 'service_fee', 12000000, 'note', '[DEMO] Hợp đồng dịch vụ đấu giá.'),
         jsonb_build_object('name', 'UBND tỉnh Bắc Ninh'),
         jsonb_build_object('name', 'Công ty Đấu giá Hợp danh Bảo Tín'),
         jsonb_build_object('title', (SELECT title FROM public.asset_postings WHERE id = v_posting)),
         v_signed, v_signed::TIMESTAMPTZ);

      v_n := v_n + 1;
    END LOOP;
    RAISE NOTICE 'Đã thêm % hợp đồng ký gửi demo.', v_n;
  END IF;

  -- Đồng bộ mốc do sàn xác nhận, GIẢ DANH Trưởng đơn vị (hàm cần ke-hoach:update).
  IF v_owner IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims',
                       json_build_object('sub', v_owner::TEXT, 'role', 'authenticated')::TEXT, true);
    FOR v_plan IN SELECT id FROM public.auction_plans WHERE workspace_id = v_ws ORDER BY created_at LOOP
      v_res := public.auction_plan_sync_platform_steps(v_plan);
      RAISE NOTICE 'Kế hoạch % → %', v_plan, v_res;
    END LOOP;
    PERFORM set_config('request.jwt.claims', NULL, true);
  END IF;
END $$;
