-- ─────────────────────────────────────────────────────────────────────────────
-- Bộ demo Phase 10: công khai danh mục của các kế hoạch đã duyệt trong Trạm DEMO
--
-- Chỉ chạm vào Trạm có `is_demo = true` (Trạm "UBND tỉnh Bắc Ninh" do
-- `auction_plan_demo_pack` dựng ở Phase 9) để trang công khai
-- "Sắp đấu giá theo kế hoạch" có dữ liệu mà nghiệm thu được.
--
-- Giá vẫn ẨN (`public_show_prices = false`) — đúng mặc định của quyết định D6.
-- Chạy lại vô hại. Dữ liệu thật của khách hàng KHÔNG bị bật công khai ở đây:
-- việc đó phải do cấp duyệt tự bấm trong tab "Phê duyệt & lịch sử".
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  _n INT;
BEGIN
  PERFORM set_config('auction_plan.public_optin', 'on', true);

  UPDATE public.auction_plans p
     SET public_opt_in      = true,
         public_show_prices = false
   WHERE p.status = 'approved'
     AND NOT p.public_opt_in
     AND EXISTS (SELECT 1 FROM public.asset_owner_workspaces w
                  WHERE w.id = p.workspace_id AND w.is_demo);
  GET DIAGNOSTICS _n = ROW_COUNT;

  PERFORM set_config('auction_plan.public_optin', 'off', true);
  RAISE NOTICE 'Phase 10 demo: đã công khai % kế hoạch của Trạm demo', _n;
END
$$;
