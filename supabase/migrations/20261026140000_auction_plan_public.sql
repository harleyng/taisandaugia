-- ─────────────────────────────────────────────────────────────────────────────
-- Kế hoạch đấu giá — CÔNG KHAI "Sắp đấu giá" + người mua "Theo dõi"
-- Phase 10 của docs/owner-auction-planning-plan.md (quyết định D6 = BẬT).
--
-- ⚠️ ĐÂY LÀ PHA DUY NHẤT CỦA MODULE MỞ DỮ LIỆU KẾ HOẠCH CHO `anon`.
-- Mọi thứ khác của module nằm sau đăng nhập + RLS theo chi nhánh. Luật ở đây:
--
--  1. `anon` KHÔNG có một quyền bảng nào trên `auction_plan_*` (Phase 2 đã
--     REVOKE sạch, giữ nguyên). Cửa duy nhất là RPC `get_public_plan_items` /
--     `get_public_plan_units` — SECURITY DEFINER, `search_path` cố định,
--     REVOKE ALL rồi GRANT EXECUTE đúng vai.
--  2. RPC chỉ trả dòng của kế hoạch VỪA `status = 'approved'` VỪA được bật
--     `public_opt_in`. Nháp / đã trình / bị trả lại / đang điều chỉnh / đã đóng
--     ⇒ KHÔNG hiện (đang điều chỉnh cũng ẩn: bản mốc đang bị sửa).
--  3. Trường được trả: `title`, `lot_labels`, `area_m2`, `land_use_code`,
--     QUÝ dự kiến (suy ra — không bao giờ trả `planned_month`), tên xã/phường.
--     Giá CHỈ trả khi bật riêng `public_show_prices` (mặc định TẮT).
--     KHÔNG có id nội bộ nào: không plan_id, item_id, workspace_id, branch_id,
--     asset_posting_id, listing_id, responsible_user_id.
--  4. Tay nắm công khai của một tài sản là `auction_plan_items.public_code` —
--     32 hex SINH NGẪU NHIÊN (`gen_random_uuid`), KHÔNG suy ra từ bất kỳ dữ
--     liệu nội bộ nào, nên không dò được và không nối lại được về id thật.
--  5. Bật / tắt công khai là một lệnh GHI, chỉ cấp duyệt (hình A: cùng Trạm;
--     hình B: Trạm cha) hoặc Trưởng đơn vị làm được — đi qua RPC
--     `auction_plan_set_public`, KHÔNG qua quyền cột (người bị giới hạn chi
--     nhánh không bao giờ có `approve` hiệu lực, xem `auction_plan_can_approve`).
--
-- Nguồn số liệu công khai = BẢN MỐC mới nhất (`auction_plan_baselines.payload`),
-- không phải danh mục đang sống: cái công khai phải là cam kết ĐÃ ĐƯỢC DUYỆT, và
-- bản mốc vốn đã loại tài sản `dropped` lúc đóng băng. Dòng sống chỉ dùng để lấy
-- `public_code` và để LOẠI ra: tài sản đã bỏ, tài sản đã có tin niêm yết trên sàn
-- (tránh hiện hai lần cùng một thứ ở `/listings`) và tài sản đã tổ chức đấu giá.
--
-- Cờ giao dịch RIÊNG `auction_plan.public_optin` (bài học 2026-10-26: một cờ =
-- một ý nghĩa). Không dùng `auction_plan.rpc` vì cờ đó làm trigger nhật ký BỎ
-- QUA dòng — ở đây ta MUỐN `owner_audit_log` ghi lại ai đã công khai danh mục.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. CỜ + CỘT
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auction_plan_in_public_optin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
SET search_path = public
AS $$ SELECT COALESCE(current_setting('auction_plan.public_optin', true), '') = 'on' $$;

REVOKE ALL ON FUNCTION public.auction_plan_in_public_optin() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.auction_plans
  ADD COLUMN IF NOT EXISTS public_opt_in      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_show_prices BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.auction_plans.public_opt_in IS
  'Công khai danh mục dự kiến của kế hoạch ĐÃ DUYỆT ra trang tìm tài sản (Phase 10). '
  'Chỉ RPC auction_plan_set_public ghi được (cấp duyệt / Trưởng đơn vị).';
COMMENT ON COLUMN public.auction_plans.public_show_prices IS
  'Công tắc RIÊNG cho giá khởi điểm dự kiến trên trang công khai. Mặc định TẮT: '
  'get_public_plan_items không trả giá khi cột này là false.';

-- Tay nắm công khai: 32 hex ngẫu nhiên, KHÔNG suy ra từ id nội bộ. DEFAULT là
-- hàm VOLATILE nên ADD COLUMN viết lại bảng và cấp cho mỗi dòng cũ một mã riêng
-- (DDL ⇒ không bắn trigger dòng, không làm rác nhật ký).
ALTER TABLE public.auction_plan_items
  ADD COLUMN IF NOT EXISTS public_code TEXT NOT NULL
    DEFAULT replace(gen_random_uuid()::TEXT, '-', '');

COMMENT ON COLUMN public.auction_plan_items.public_code IS
  'Mã công khai 32 hex (Phase 10) — sinh ngẫu nhiên, không suy ra từ id nào. '
  'Là thứ DUY NHẤT trang công khai và RPC Theo dõi dùng để chỉ một tài sản.';

CREATE UNIQUE INDEX IF NOT EXISTS auction_plan_items_public_code_key
  ON public.auction_plan_items (public_code);

-- Lọc công khai đi theo (mã ĐVHC, năm) trên các kế hoạch đã duyệt + đã bật.
CREATE INDEX IF NOT EXISTS auction_plans_public_idx
  ON public.auction_plans (admin_unit_code, plan_year)
  WHERE public_opt_in AND status = 'approved';

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. GIỮ GIÁ TRỊ: hai cột công khai và mã công khai không ai sửa tay được
-- ═════════════════════════════════════════════════════════════════════════════
-- Quyền cột đã là lớp chặn thứ nhất (client không có UPDATE trên các cột này),
-- đây là lớp thứ hai — chặn cả service_role và migration sau này sửa nhầm.

CREATE OR REPLACE FUNCTION public.auction_plan_public_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.auction_plan_in_public_optin()
     AND (NEW.public_opt_in      IS DISTINCT FROM OLD.public_opt_in
       OR NEW.public_show_prices IS DISTINCT FROM OLD.public_show_prices) THEN
    RAISE EXCEPTION 'Công khai danh mục chỉ đổi qua thao tác "Công khai danh mục dự kiến"';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_public_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auction_plan_public_guard ON public.auction_plans;
CREATE TRIGGER auction_plan_public_guard
  BEFORE UPDATE ON public.auction_plans
  FOR EACH ROW EXECUTE FUNCTION public.auction_plan_public_guard();

CREATE OR REPLACE FUNCTION public.auction_plan_item_code_keep()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.public_code := OLD.public_code;   -- bất biến suốt đời dòng
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_item_code_keep() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auction_plan_item_code_keep ON public.auction_plan_items;
CREATE TRIGGER auction_plan_item_code_keep
  BEFORE UPDATE ON public.auction_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.auction_plan_item_code_keep();

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. NGƯỜI MUA THEO DÕI MỘT TÀI SẢN TRONG KẾ HOẠCH
-- ═════════════════════════════════════════════════════════════════════════════
-- KHÔNG dùng lại `user_demand_subscriptions` / `src/components/demand/`: đó là
-- GÓI THEO DÕI NHU CẦU có trả credit theo bậc, còn đây là cú bấm MIỄN PHÍ vào
-- một lô đất cụ thể để đơn vị thấy nhu cầu. Gộp hai thứ sẽ làm hỏng cả hai.

CREATE TABLE IF NOT EXISTS public.auction_plan_item_follows (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    UUID NOT NULL REFERENCES public.auction_plan_items(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT auction_plan_item_follows_uniq UNIQUE (item_id, user_id)
);

CREATE INDEX IF NOT EXISTS auction_plan_item_follows_item_idx
  ON public.auction_plan_item_follows (item_id);

COMMENT ON TABLE public.auction_plan_item_follows IS
  'Người mua đã đăng nhập theo dõi một tài sản trong kế hoạch đấu giá (Phase 10). '
  'Dữ liệu theo người ⇒ RLS "own rows". Đơn vị CHỈ thấy SỐ ĐẾM (hàm tổng hợp), '
  'không bao giờ thấy ai đang theo dõi.';

ALTER TABLE public.auction_plan_item_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own rows" ON public.auction_plan_item_follows;
CREATE POLICY "own rows" ON public.auction_plan_item_follows
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ⚠️ Supabase có ALTER DEFAULT PRIVILEGES cấp ALL cho anon + authenticated trên
-- MỌI bảng mới trong schema public ⇒ phải thu hồi sạch, nếu không policy trên
-- chỉ là trang trí. Bảng này KHÔNG cấp lại quyền nào: cả đọc lẫn ghi đi qua RPC
-- (client chỉ có `public_code`, không có `item_id`). Policy giữ lại làm lớp
-- phòng vệ thứ hai cho mọi đường đọc về sau.
REVOKE ALL ON public.auction_plan_item_follows FROM PUBLIC, anon, authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. RPC CÔNG KHAI (anon)
-- ═════════════════════════════════════════════════════════════════════════════
-- Trả SETOF JSONB chứ không RETURNS TABLE: cột giá khi bị ẩn phải KHÔNG CÓ
-- TRONG PHẢN HỒI (jsonb_strip_nulls), không phải "có khoá, giá trị null".

CREATE OR REPLACE FUNCTION public.get_public_plan_items(
  p_admin_unit_code TEXT,
  p_year            INT DEFAULT NULL)
RETURNS SETOF JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH scope AS (
    -- Nhận mã TỈNH (trả cả tỉnh) hoặc mã XÃ (trả một xã).
    SELECT au.code, au.name
      FROM public.admin_units au
     WHERE au.is_active
       AND au.level = 'commune'
       AND (au.code = p_admin_unit_code OR au.parent_code = p_admin_unit_code)
  ),
  pub AS (
    SELECT p.id AS plan_id, p.admin_unit_code, p.public_show_prices,
           (SELECT b.payload
              FROM public.auction_plan_baselines b
             WHERE b.plan_id = p.id
             ORDER BY b.version DESC
             LIMIT 1) AS payload
      FROM public.auction_plans p
     WHERE p.status = 'approved'           -- CHỈ kế hoạch đã duyệt
       AND p.public_opt_in                 -- VÀ đã bật công khai
       AND (p_year IS NULL OR p.plan_year = p_year)
       AND p.admin_unit_code IN (SELECT code FROM scope)
  ),
  rows AS (
    SELECT pub.plan_id, pub.public_show_prices,
           s.code AS commune_code, s.name AS commune_name,
           it.value AS bi
      FROM pub
      JOIN scope s ON s.code = pub.admin_unit_code
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pub.payload -> 'items', '[]'::JSONB)) it(value)
  )
  SELECT jsonb_strip_nulls(jsonb_build_object(
           'code',          i.public_code,
           'commune_code',  r.commune_code,
           'commune_name',  r.commune_name,
           'title',         NULLIF(btrim(COALESCE(r.bi ->> 'title', '')), ''),
           'lot_labels',    NULLIF(btrim(COALESCE(r.bi ->> 'lot_labels', '')), ''),
           'area_m2',       (r.bi ->> 'area_m2')::NUMERIC,
           'land_use_code', NULLIF(btrim(COALESCE(r.bi ->> 'land_use_code', '')), ''),
           -- QUÝ dự kiến, không bao giờ là tháng.
           'planned_quarter', CASE WHEN (r.bi ->> 'planned_month') IS NOT NULL THEN
               to_char((r.bi ->> 'planned_month')::DATE, 'YYYY') || '-Q'
                 || EXTRACT(QUARTER FROM (r.bi ->> 'planned_month')::DATE)::INT::TEXT END,
           -- Giá: chỉ khi công tắc riêng được bật.
           'unit_start_price',
             CASE WHEN r.public_show_prices THEN (r.bi ->> 'unit_start_price')::NUMERIC END,
           'expected_start_value',
             CASE WHEN r.public_show_prices THEN (r.bi ->> 'expected_start_value')::NUMERIC END,
           -- Tổng hợp, không danh tính.
           'follow_count', (SELECT COUNT(*) FROM public.auction_plan_item_follows f
                             WHERE f.item_id = i.id),
           'followed', CASE WHEN auth.uid() IS NULL THEN false
                            ELSE EXISTS (SELECT 1 FROM public.auction_plan_item_follows f
                                          WHERE f.item_id = i.id AND f.user_id = auth.uid()) END))
    FROM rows r
    JOIN public.auction_plan_items i
      ON i.plan_id = r.plan_id
     AND i.item_code = (r.bi ->> 'item_code')
   WHERE i.exec_status = 'active'          -- tài sản đã bỏ: không bao giờ công khai
     AND i.listing_id IS NULL              -- đã có tin niêm yết ⇒ đã nằm ở /listings
     AND NOT EXISTS (SELECT 1 FROM public.auction_plan_item_steps st
                      WHERE st.item_id = i.id
                        AND st.step = 'auction_held'
                        AND st.done_on IS NOT NULL)   -- đã đấu rồi, không còn "sắp"
   ORDER BY (r.bi ->> 'planned_month') NULLS LAST, r.commune_name, (r.bi ->> 'item_code');
$$;

COMMENT ON FUNCTION public.get_public_plan_items(TEXT, INT) IS
  'Danh mục "Sắp đấu giá theo kế hoạch" cho trang công khai (Phase 10). Nhận mã '
  'tỉnh hoặc mã xã. Chỉ kế hoạch approved + public_opt_in. Không trả id nội bộ; '
  'giá chỉ có khi public_show_prices.';

REVOKE ALL ON FUNCTION public.get_public_plan_items(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_plan_items(TEXT, INT) TO anon, authenticated;

-- Các xã/phường của một tỉnh đã công khai danh mục + số tài sản. Dựng TRÊN
-- hàm trên để hai con số không bao giờ lệch nhau.
CREATE OR REPLACE FUNCTION public.get_public_plan_units(
  p_province_code TEXT,
  p_year          INT DEFAULT NULL)
RETURNS SETOF JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object('code', t.code, 'name', t.name, 'item_count', t.n)
    FROM (SELECT x ->> 'commune_code' AS code,
                 x ->> 'commune_name' AS name,
                 COUNT(*)             AS n
            FROM public.get_public_plan_items(p_province_code, p_year) x
           GROUP BY 1, 2) t
   ORDER BY t.name;
$$;

COMMENT ON FUNCTION public.get_public_plan_units(TEXT, INT) IS
  'Các xã/phường của một tỉnh đang công khai danh mục dự kiến + số tài sản (Phase 10).';

REVOKE ALL ON FUNCTION public.get_public_plan_units(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_plan_units(TEXT, INT) TO anon, authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. THEO DÕI (người mua đã đăng nhập)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.follow_public_plan_item(
  p_code   TEXT,
  p_follow BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid  UUID := auth.uid();
  _item UUID;
  _n    INT;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;

  -- Chỉ theo dõi được tài sản ĐANG công khai: cùng bộ lọc với RPC đọc, nên một
  -- mã lấy từ nơi khác (hoặc của kế hoạch đã tắt công khai) là 'not_found'.
  SELECT i.id INTO _item
    FROM public.auction_plan_items i
    JOIN public.auction_plans p ON p.id = i.plan_id
   WHERE i.public_code = p_code
     AND p.status = 'approved'
     AND p.public_opt_in
     AND i.exec_status = 'active';
  IF _item IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;

  IF p_follow THEN
    INSERT INTO public.auction_plan_item_follows (item_id, user_id)
         VALUES (_item, _uid)
    ON CONFLICT (item_id, user_id) DO NOTHING;
  ELSE
    DELETE FROM public.auction_plan_item_follows WHERE item_id = _item AND user_id = _uid;
  END IF;

  SELECT COUNT(*) INTO _n FROM public.auction_plan_item_follows WHERE item_id = _item;
  RETURN jsonb_build_object('ok', true, 'following', p_follow, 'follow_count', _n);
END;
$$;

COMMENT ON FUNCTION public.follow_public_plan_item(TEXT, BOOLEAN) IS
  'Người mua theo dõi / bỏ theo dõi một tài sản công khai theo public_code (Phase 10).';

REVOKE ALL ON FUNCTION public.follow_public_plan_item(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.follow_public_plan_item(TEXT, BOOLEAN) TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. PHÍA ĐƠN VỊ: bật/tắt công khai, tình trạng, số người theo dõi
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auction_plan_set_public(
  p_plan_id      UUID,
  p_opt_in       BOOLEAN,
  p_show_prices  BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid  UUID := auth.uid();
  _plan public.auction_plans%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;

  SELECT * INTO _plan FROM public.auction_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;

  -- Cấp duyệt của ĐÚNG kế hoạch này (hình A / hình B) HOẶC Trưởng đơn vị của
  -- Trạm. `auction_plan_can_approve` đã chặn người bị giới hạn chi nhánh.
  IF NOT (public.auction_plan_reviewer_ok(p_plan_id)
          OR public.auction_plan_can_approve(_plan.workspace_id)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_reviewer');
  END IF;

  -- Bật chỉ khi đã duyệt (chưa duyệt thì chẳng có bản mốc nào để công khai).
  IF p_opt_in AND _plan.status <> 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', _plan.status);
  END IF;

  PERFORM set_config('auction_plan.public_optin', 'on', true);
  UPDATE public.auction_plans
     SET public_opt_in      = p_opt_in,
         public_show_prices = (p_opt_in AND COALESCE(p_show_prices, false))
   WHERE id = p_plan_id;
  PERFORM set_config('auction_plan.public_optin', 'off', true);

  -- Nhật ký do trigger `auction_plans_audit` ghi (cờ ở trên KHÔNG phải
  -- `auction_plan.rpc` nên trigger không bỏ qua dòng này).
  RETURN jsonb_build_object('ok', true, 'public_opt_in', p_opt_in,
                            'public_show_prices', (p_opt_in AND COALESCE(p_show_prices, false)));
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_set_public(UUID, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_set_public(UUID, BOOLEAN, BOOLEAN) TO authenticated;

-- Tình trạng công khai của một kế hoạch cho tab "Phê duyệt & lịch sử".
CREATE OR REPLACE FUNCTION public.auction_plan_public_state(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid    UUID := auth.uid();
  _plan   public.auction_plans%ROWTYPE;
  _count  INT;
  _follow INT;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;

  SELECT * INTO _plan FROM public.auction_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF NOT (public.auction_plan_read_ok(_plan.workspace_id, _plan.branch_id, p_plan_id)
          OR public.auction_plan_reviewer_ok(p_plan_id)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- Bao nhiêu tài sản SẼ hiện nếu công khai (tính độc lập với công tắc).
  SELECT COUNT(*) INTO _count
    FROM public.auction_plan_items i
   WHERE i.plan_id = p_plan_id
     AND i.exec_status = 'active'
     AND i.listing_id IS NULL
     AND EXISTS (SELECT 1
                   FROM public.auction_plan_baselines b,
                        LATERAL jsonb_array_elements(COALESCE(b.payload -> 'items', '[]'::JSONB)) e(v)
                  WHERE b.plan_id = p_plan_id
                    AND b.version = _plan.baseline_version
                    AND (e.v ->> 'item_code') = i.item_code)
     AND NOT EXISTS (SELECT 1 FROM public.auction_plan_item_steps st
                      WHERE st.item_id = i.id AND st.step = 'auction_held' AND st.done_on IS NOT NULL);

  SELECT COUNT(*) INTO _follow
    FROM public.auction_plan_item_follows f
    JOIN public.auction_plan_items i ON i.id = f.item_id
   WHERE i.plan_id = p_plan_id;

  RETURN jsonb_build_object(
           'ok', true,
           'public_opt_in', _plan.public_opt_in,
           'public_show_prices', _plan.public_show_prices,
           'can_manage', (public.auction_plan_reviewer_ok(p_plan_id)
                          OR public.auction_plan_can_approve(_plan.workspace_id)),
           'status', _plan.status,
           'public_item_count', _count,
           'follow_total', _follow);
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_public_state(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_public_state(UUID) TO authenticated;

-- Số người theo dõi TỪNG tài sản — chỉ SỐ ĐẾM, không bao giờ danh tính.
CREATE OR REPLACE FUNCTION public.auction_plan_item_follow_counts(p_plan_id UUID)
RETURNS TABLE(item_id UUID, follow_count INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _plan public.auction_plans%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT * INTO _plan FROM public.auction_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT (public.auction_plan_read_ok(_plan.workspace_id, _plan.branch_id, p_plan_id)
          OR public.auction_plan_reviewer_ok(p_plan_id)) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT i.id, COUNT(f.id)::INT
      FROM public.auction_plan_items i
      JOIN public.auction_plan_item_follows f ON f.item_id = i.id
     WHERE i.plan_id = p_plan_id
     GROUP BY i.id;
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_item_follow_counts(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_item_follow_counts(UUID) TO authenticated;
