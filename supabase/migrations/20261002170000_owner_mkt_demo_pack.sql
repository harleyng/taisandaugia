-- Truyền thông của chủ tài sản — Phase M6 (docs/owner-marketing-plan.md): bộ demo cho ngân hàng.
--
--   1. asset_owner_workspaces.is_demo — Trạm chứa DỮ LIỆU MINH HOẠ (seed scripts/seed-mkt-demo.py).
--      Cổng chủ tài sản hiện nhãn "Dữ liệu minh hoạ" trên mọi màn của Trạm này. Chỉ server đổi
--      được: authenticated chỉ có quyền UPDATE theo CỘT (primary_name, abbreviations,
--      branch_names) và bảng không có policy INSERT — tự kiểm ở cuối file.
--   2. owner_listing_registrations(ws) — số hồ sơ tham gia ĐÃ THANH TOÁN theo tài sản, chỉ cho
--      tài sản đang nằm trong phiên đã công bố trên sàn. Nguồn của việc "Đẩy truyền thông" trên
--      Tổng quan (B7: < 3 đăng ký khi còn 5 ngày tới hạn). Chỉ số đếm — không tên, không id
--      người mua. Tài sản không có phiên trên sàn ⇒ không có dòng (đăng ký ngoài sàn không biết).
--      Hồ sơ mua theo PHIÊN nên mọi lô của một phiên cùng số — như sess_regs của owner_mkt_funnel_core.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Cờ Trạm demo
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.asset_owner_workspaces
  ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.asset_owner_workspaces.is_demo IS
  'Trạm chứa dữ liệu minh hoạ (Phase M6) — cổng hiện nhãn "Dữ liệu minh hoạ". Chỉ server đổi được.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Số đăng ký trên sàn theo tài sản
-- ═══════════════════════════════════════════════════════════════════════════

CREATE FUNCTION public.owner_listing_registrations(p_workspace_id UUID)
RETURNS TABLE (listing_id UUID, registrations INTEGER)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_workspace_id IS NULL OR NOT public.owner_ws_can(p_workspace_id, 'read') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT i.listing_id, count(DISTINCT b.id)::INTEGER
    FROM public.asset_owner_claims c
    JOIN public.auction_session_items i ON i.listing_id = c.listing_id
    JOIN public.auction_sessions s
      ON s.id = i.session_id
     AND s.status = 'published'
     AND s.finalized_at IS NULL
     AND now() <= s.ends_at
    LEFT JOIN public.auction_bidding_contracts b
      ON b.session_id = s.id AND b.status = 'paid'
   WHERE c.workspace_id = p_workspace_id
     AND c.status IN ('auto_claimed', 'confirmed')
   GROUP BY i.listing_id;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_listing_registrations(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_listing_registrations(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Tự kiểm
-- ═══════════════════════════════════════════════════════════════════════════

DO $check$
BEGIN
  IF EXISTS (SELECT 1 FROM public.asset_owner_workspaces WHERE is_demo) THEN
    RAISE EXCEPTION 'M6: không Trạm nào được là demo ngay khi thêm cột.';
  END IF;
  IF has_column_privilege('authenticated', 'public.asset_owner_workspaces', 'is_demo', 'UPDATE') THEN
    RAISE EXCEPTION 'M6: người dùng không được tự đổi is_demo.';
  END IF;
  IF has_function_privilege('anon', 'public.owner_listing_registrations(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'M6: anon không được gọi owner_listing_registrations.';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.owner_listing_registrations(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'M6: authenticated phải gọi được owner_listing_registrations.';
  END IF;
END;
$check$;
