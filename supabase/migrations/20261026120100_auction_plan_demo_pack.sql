-- ─────────────────────────────────────────────────────────────────────────────
-- Bộ demo "Kế hoạch đấu giá" — Phase 9, mục 3 của khối nhiệm vụ.
--
-- Một tỉnh minh hoạ (hình A) với 4 xã/phường, kế hoạch năm ĐÃ DUYỆT ~20 tài
-- sản đủ mọi trạng thái sức khoẻ, vài tài sản gắn hồ sơ số hoá + kết quả thật,
-- và một ĐỢT BỔ SUNG đang mở. Trạm mang `is_demo = true` (cùng cờ của
-- `20261002170000_owner_mkt_demo_pack`) nên cổng chủ tài sản hiện nhãn
-- "Dữ liệu minh hoạ" trên mọi màn.
--
-- ⚠️ VÌ SAO BỘ DEMO KHÔNG GHI THẲNG `status = 'approved'`
-- Phase 2 khoá vòng trạng thái bằng HAI lớp: quyền CỘT và cờ giao dịch
-- `auction_plan.rpc` kiểm trong `auction_plans_guard`. Cờ đó chỉ các RPC luồng
-- duyệt bật, nên một `UPDATE ... SET status='approved'` từ migration bị chặn
-- NGAY CẢ khi chạy bằng `postgres`. `auction_plan_baselines` còn chặn mọi UPDATE.
-- Đó là thiết kế đúng và bộ demo KHÔNG được làm yếu nó.
--
-- Cách làm: GIẢ DANH người dùng thật rồi gọi ĐÚNG các RPC của sản phẩm
-- (`set_config('request.jwt.claims', …, true)` — `auth.uid()` đọc từ đó), nên
-- trạng thái, bản mốc đóng băng và nhật ký đều do CÙNG đoạn mã chạy ở production
-- sinh ra:
--   • người quản trị sàn  → `admin_province_rollout`, `admin_province_bulk_invite`
--   • cán bộ xã (được mời) → `owner_ws_accept_invite`, `auction_plan_submit`
--   • tỉnh (Trưởng đơn vị) → `auction_plan_cycle_open/_set_units/_close`,
--                            `auction_plan_record_approval`
-- Không trigger nào bị gỡ, bị DISABLE hay bị nới; không quyền nào được cấp thêm.
--
-- ⚠️ Hàm này là CÔNG CỤ VẬN HÀNH, không phải RPC: nó giả danh người dùng, nên
-- bị REVOKE khỏi mọi role (kể cả `service_role`). Chỉ superuser / chủ schema gọi
-- được — tức là migration này và người vận hành chạy psql.
--
-- CHẠY LẠI ĐƯỢC: khởi tạo tỉnh + mời theo lô vốn đã không sinh trùng; phần kế
-- hoạch bị BỎ QUA nếu Trạm demo đã có kế hoạch. KHÔNG có đường "dọn sạch": xoá
-- một kế hoạch đã duyệt bị `auction_plans_delete_guard` chặn (đúng ý), nên muốn
-- dựng lại từ đầu thì phải tạo Trạm demo khác.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auction_plan_demo_pack(
  p_province_code TEXT DEFAULT '24',
  p_admin_email   TEXT DEFAULT 'harleyngx@gmail.com',
  p_officer_email TEXT DEFAULT 'secsosoo@gmail.com',
  p_year          INT  DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = public
AS $fn$
DECLARE
  -- 4 xã/phường của Tỉnh Bắc Ninh (mã chính thức 2025). Phần tử ĐẦU là xã của
  -- cán bộ thật — dùng để chứng minh "cán bộ xã chỉ thấy xã mình".
  c_codes CONSTANT TEXT[] := ARRAY['09169', '07210', '07777', '07339'];
  c_rev   CONSTANT NUMERIC[] := ARRAY[48000000000, 36000000000, 72000000000, 24000000000];
  c_cnt   CONSTANT INT[]     := ARRAY[6, 5, 7, 4];

  _today    DATE := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE;
  _year     INT;
  _m        INT;
  _admin    UUID;
  _officer  UUID;
  _res      JSONB;
  _ws       UUID;
  _prov     TEXT;
  _branch   UUID;
  _unit     TEXT;
  _token    TEXT;
  _cycle    UUID;
  _supp     UUID;
  _plans    UUID[] := '{}';
  _plan     UUID;
  _item     UUID;
  _posting  UUID;
  _outcome  UUID;
  _s        RECORD;
  _mon      DATE;
  _n_items  INT := 0;
  _invites  JSONB;
  _skipped  BOOLEAN := false;
BEGIN
  _year := COALESCE(p_year, EXTRACT(YEAR FROM _today)::INT);
  _m    := EXTRACT(MONTH FROM _today)::INT;

  SELECT id INTO _admin FROM public.profiles WHERE lower(email) = lower(p_admin_email);
  IF _admin IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'admin_not_found', 'email', p_admin_email);
  END IF;
  SELECT id INTO _officer FROM public.profiles WHERE lower(email) = lower(p_officer_email);

  SELECT name INTO _prov FROM public.admin_units WHERE code = p_province_code;

  -- ── 1. Khởi tạo tỉnh, với tư cách NGƯỜI QUẢN TRỊ SÀN ──────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin)::TEXT, true);

  _res := public.admin_province_rollout(p_province_code, c_codes, _admin);
  IF COALESCE((_res ->> 'ok')::BOOLEAN, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rollout_failed', 'detail', _res);
  END IF;
  _ws := (_res ->> 'workspace_id')::UUID;

  UPDATE public.asset_owner_workspaces
     SET is_demo = true
   WHERE id = _ws AND NOT is_demo;

  -- ── 2. Mời cán bộ 4 xã theo lô (xã đầu = tài khoản thật) ──────────────────
  _invites := public.admin_province_bulk_invite(_ws, (
    SELECT jsonb_agg(jsonb_build_object(
             'email', CASE WHEN t.i = 1 AND _officer IS NOT NULL
                           THEN lower(p_officer_email)
                           ELSE 'demo.canbo.' || c_codes[t.i] || '@example.com' END,
             'admin_unit_code', c_codes[t.i],
             'role', 'staff'))
      FROM generate_subscripts(c_codes, 1) AS t(i)));

  -- Cán bộ xã NHẬN lời mời bằng đúng RPC của sản phẩm ⇒ thành viên có
  -- `branch_scope = {chi nhánh xã đó}`, không phải một dòng ghi tay.
  IF _officer IS NOT NULL THEN
    SELECT i.token INTO _token
      FROM public.asset_owner_workspace_invites i
     WHERE i.workspace_id = _ws AND i.email = lower(p_officer_email)
       AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
     ORDER BY i.created_at DESC LIMIT 1;
    IF _token IS NOT NULL THEN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', _officer)::TEXT, true);
      _res := public.owner_ws_accept_invite(_token);
      IF COALESCE((_res ->> 'ok')::BOOLEAN, false) IS NOT TRUE THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'accept_failed', 'detail', _res);
      END IF;
    END IF;
  END IF;

  -- ── 3. Kế hoạch — chỉ dựng một lần ────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM public.auction_plans WHERE workspace_id = _ws) THEN
    _skipped := true;
  ELSE
    -- Từ đây: TỈNH (Trưởng đơn vị của Trạm, không bị giới hạn chi nhánh).
    PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin)::TEXT, true);

    _res := public.auction_plan_cycle_open(
              _ws, _year, 'annual', make_date(_year - 1, 12, 15),
              'Đề nghị UBND các xã, phường lập và trình kế hoạch đấu giá quyền sử dụng đất năm '
              || _year || ' trước ngày 15/12. Chỉ tiêu thu từ đấu giá đất giao theo từng đơn vị.');
    IF COALESCE((_res ->> 'ok')::BOOLEAN, false) IS NOT TRUE THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'cycle_failed', 'detail', _res);
    END IF;
    _cycle := (_res ->> 'cycle_id')::UUID;

    _res := public.auction_plan_cycle_set_units(_cycle, (
      SELECT jsonb_agg(jsonb_build_object(
               'admin_unit_code', c_codes[t.i],
               'branch_id', (SELECT b.id FROM public.workspace_branches b
                              WHERE b.workspace_id = _ws AND b.admin_unit_code = c_codes[t.i]),
               'assigned_revenue', c_rev[t.i],
               'assigned_count', c_cnt[t.i]))
        FROM generate_subscripts(c_codes, 1) AS t(i)));
    IF COALESCE((_res ->> 'ok')::BOOLEAN, false) IS NOT TRUE THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'units_failed', 'detail', _res);
    END IF;

    -- Một kế hoạch năm cho mỗi xã, đúng thứ tự của `c_codes`.
    FOR _s IN SELECT t.i FROM generate_subscripts(c_codes, 1) AS t(i) ORDER BY t.i LOOP
      SELECT b.id, b.display_name INTO _branch, _unit
        FROM public.workspace_branches b
       WHERE b.workspace_id = _ws AND b.admin_unit_code = c_codes[_s.i];

      INSERT INTO public.auction_plans
        (workspace_id, branch_id, cycle_id, plan_year, kind, title, level, legal_basis, notes)
      VALUES (_ws, _branch, _cycle, _year, 'annual',
              'Kế hoạch đấu giá QSDĐ năm ' || _year || ' · ' || _unit,
              'commune',
              'Luật Đất đai 2024; Luật Đấu giá tài sản (sửa đổi 2024); Nghị định 102/2024/NĐ-CP',
              'Dữ liệu minh hoạ phục vụ trình diễn.')
      RETURNING id INTO _plan;
      _plans := _plans || _plan;
    END LOOP;

    -- ── 20 tài sản, đủ 6 trạng thái sức khoẻ của A5 ─────────────────────────
    -- `off` = lệch tháng so với tháng hiện tại (kẹp trong năm kế hoạch), nên bộ
    -- demo vẫn đúng "trễ / đúng tiến độ" dù chạy ở thời điểm nào.
    FOR _s IN
      SELECT * FROM (VALUES
        -- u, tiêu đề, số lô, số thửa, tờ BĐ, thửa, vị trí, m², đ/m², off, hình thức, sắc thái
        (1, 'Khu dân cư mới Vũ Ninh — lô LK1',        'LK1-01→08', 8, '12', '45',  'Mặt đường Nguyễn Trãi, phường Vũ Ninh', 960.0,   28000000, -4, 'truc_tiep_loi_noi', 'done'),
        (1, 'Khu dân cư mới Vũ Ninh — lô LK2',        'LK2-01→06', 6, '12', '46',  'Sau Trường THCS Vũ Ninh',               720.0,   24000000, -5, 'truc_tiep_loi_noi', 'late'),
        (1, 'Đất ở xen kẹp tổ 4 Vũ Ninh',             'XK-01→03',  3, '14', '112', 'Tổ 4, phường Vũ Ninh',                  345.5,   21000000, -3, 'bo_phieu_truc_tiep', 'failed'),
        (1, 'Khu đấu giá Đồng Mạ — đợt 1',            'DM-01→10', 10, '21', '08',  'Cánh đồng Đồng Mạ, phường Vũ Ninh',    1250.0,   19000000,  1, 'truc_tuyen',         'on_track'),
        (1, 'Khu đấu giá Đồng Mạ — đợt 2',            'DM-11→18',  8, '21', '09',  'Cánh đồng Đồng Mạ, phường Vũ Ninh',    1010.0,   19000000,  2, 'truc_tuyen',         'at_risk'),

        (2, 'Khu dân cư Bắc Giang — lô A',            'A-01→12',  12, '07', '15',  'Đường Xương Giang, phường Bắc Giang',  1440.0,   32000000, -4, 'truc_tiep_loi_noi', 'done'),
        (2, 'Khu dân cư Bắc Giang — lô B',            'B-01→05',   5, '07', '16',  'Ngõ 24 Lê Lợi, phường Bắc Giang',       520.0,   30000000, -2, 'bo_phieu_gian_tiep', 'late'),
        (2, 'Đất ở Thọ Xương',                        'TX-01→04',  4, '09', '77',  'Khu Thọ Xương, phường Bắc Giang',       430.0,   26000000,  1, 'truc_tiep_loi_noi', 'on_track'),
        (2, 'Khu tái định cư Dĩnh Kế — phần còn lại', 'DK-05→09',  5, '11', '31',  'Khu Dĩnh Kế, phường Bắc Giang',         600.0,   23000000,  2, 'truc_tuyen',         'at_risk'),
        (2, 'Đất ở Đa Mai (chuyển sang năm sau)',     'DMai-01',   1, '15', '04',  'Tổ dân phố 3, phường Bắc Giang',        180.0,   20000000, -1, 'chua_xac_dinh',      'dropped'),

        (3, 'Khu dân cư Việt Yên — lô C',             'C-01→09',   9, '03', '22',  'Quốc lộ 37, phường Việt Yên',          1080.0,   27000000, -5, 'truc_tiep_loi_noi', 'late'),
        (3, 'Khu dân cư Việt Yên — lô D',             'D-01→07',   7, '03', '23',  'Thôn Tự, phường Việt Yên',              840.0,   22000000, -4, 'truc_tuyen',         'failed'),
        (3, 'Đất ở Bích Động',                        'BD-01→06',  6, '05', '51',  'Phố Bích Động, phường Việt Yên',        690.0,   34000000, -3, 'bo_phieu_truc_tiep', 'done'),
        (3, 'Khu đấu giá Nếnh — đợt 1',               'N-01→11',  11, '08', '13',  'Khu Nếnh, phường Việt Yên',            1320.0,   25000000,  1, 'truc_tiep_loi_noi', 'on_track'),
        (3, 'Khu đấu giá Nếnh — đợt 2',               'N-12→20',   9, '08', '14',  'Khu Nếnh, phường Việt Yên',            1150.0,   25000000,  2, 'truc_tuyen',         'at_risk'),
        (3, 'Nhà làm việc cũ UBND phường (tài sản công)', NULL,  NULL, NULL, NULL, 'Số 12 phố Chũ, phường Việt Yên',        320.0,  18000000,  2, 'bo_phieu_gian_tiep', 'public_asset'),

        (4, 'Khu dân cư Tân Yên — lô E',              'E-01→06',   6, '02', '19',  'Thôn Hồng Lạc, xã Tân Yên',             700.0,   16000000, -5, 'truc_tiep_loi_noi', 'late'),
        (4, 'Đất ở Ngọc Thiện',                       'NT-01→05',  5, '04', '62',  'Thôn Ngọc Thiện, xã Tân Yên',           560.0,   15000000, -3, 'truc_tuyen',         'done'),
        (4, 'Khu đấu giá Cao Thượng',                 'CT-01→08',  8, '06', '27',  'Khu Cao Thượng, xã Tân Yên',            920.0,   17000000,  1, 'truc_tiep_loi_noi', 'on_track'),
        (4, 'Đất ở Quang Tiến',                       'QT-01→03',  3, '10', '88',  'Thôn Quang Tiến, xã Tân Yên',           330.0,   14000000,  2, 'bo_phieu_truc_tiep', 'at_risk')
      ) AS t(u, title, lots, lot_count, sheet, parcel, loc, area, price, off, method, flavour)
    LOOP
      _mon := make_date(_year, LEAST(12, GREATEST(1, _m + _s.off)), 1);

      INSERT INTO public.auction_plan_items
        (plan_id, asset_type, title, lot_labels, lot_count, map_sheet, parcel_no, location,
         area_m2, land_use_code, allocation_form, unit_start_price, planned_month,
         planned_method, executing_unit)
      VALUES (_plans[_s.u],
              CASE WHEN _s.flavour = 'public_asset' THEN 'public_asset' ELSE 'land_use_right' END,
              _s.title, _s.lots, _s.lot_count, _s.sheet, _s.parcel, _s.loc,
              _s.area, CASE WHEN _s.flavour = 'public_asset' THEN NULL ELSE 'ODT' END,
              CASE WHEN _s.flavour = 'public_asset' THEN 'khac' ELSE 'giao_co_thu_tien' END,
              _s.price, _mon, _s.method, 'Phòng Kinh tế')
      RETURNING id INTO _item;
      _n_items := _n_items + 1;

      SELECT b.id, COALESCE(b.display_name, '') INTO _branch, _unit
        FROM public.workspace_branches b
       WHERE b.workspace_id = _ws AND b.admin_unit_code = c_codes[_s.u];

      -- Mốc công việc: ngày dự kiến rải quanh tháng dự kiến.
      UPDATE public.auction_plan_item_steps
         SET planned_date = _mon - ((10 - sort_order) * 12)
       WHERE item_id = _item;

      IF _s.flavour = 'dropped' THEN
        -- Bỏ khỏi kế hoạch — chỉ làm được khi kế hoạch còn nháp (A4.6).
        UPDATE public.auction_plan_items
           SET exec_status = 'dropped',
               exec_note = 'Chưa hoàn thiện hồ sơ pháp lý, chuyển sang kế hoạch năm sau.'
         WHERE id = _item;

      ELSIF _s.flavour IN ('done', 'failed') THEN
        INSERT INTO public.asset_postings
          (user_id, workspace_id, branch_id, parent_slug, child_slug, title, status,
           review_status, province, ward)
        VALUES (_admin, _ws, _branch, 'bat-dong-san', 'dat-o', _s.title, 'active',
                'approved', _prov, _unit)
        RETURNING id INTO _posting;

        UPDATE public.auction_plan_items SET asset_posting_id = _posting WHERE id = _item;

        IF _s.flavour = 'done' THEN
          UPDATE public.auction_plan_item_steps
             SET done_on = LEAST(_today, GREATEST(_mon - 30, _mon) + (sort_order * 6))
           WHERE item_id = _item;

          -- ⚠️ `paid_amount` / `paid_at` / `payment_status` KHÔNG ghi tay được:
          -- `owner_asset_outcomes_money` dựng chúng từ SỔ THU CHI. Ghi một khoản
          -- thu vào `owner_cash_events` rồi trigger tự kết luận "đã thu".
          INSERT INTO public.owner_asset_outcomes
            (workspace_id, branch_id, asset_posting_id, asset_title, asset_category, round_no,
             auction_date, outcome, starting_price, winning_price, participants,
             source, reported_by)
          VALUES (_ws, _branch, _posting, _s.title, 'bat-dong-san', 1,
                  LEAST(_today, _mon + 14), 'sold',
                  round(_s.area * _s.price), round(_s.area * _s.price * 1.18), 9,
                  'owner_manual', _admin)
          RETURNING id INTO _outcome;

          INSERT INTO public.owner_cash_events
            (workspace_id, outcome_id, kind, amount, occurred_on, note)
          VALUES (_ws, _outcome, 'payment', round(_s.area * _s.price * 1.18),
                  LEAST(_today, _mon + 34), 'Người trúng nộp đủ tiền sử dụng đất');
        ELSE
          UPDATE public.auction_plan_item_steps
             SET done_on = LEAST(_today, _mon + (sort_order * 4))
           WHERE item_id = _item AND sort_order <= 7;

          INSERT INTO public.owner_asset_outcomes
            (workspace_id, branch_id, asset_posting_id, asset_title, asset_category, round_no,
             auction_date, outcome, failure_reason, starting_price, participants,
             source, reported_by)
          VALUES (_ws, _branch, _posting, _s.title, 'bat-dong-san', 1,
                  LEAST(_today, _mon + 12), 'unsold',
                  'Không có người đăng ký tham gia', round(_s.area * _s.price), 0,
                  'owner_manual', _admin);
        END IF;

      ELSIF _s.flavour = 'late' THEN
        -- Tháng dự kiến đã qua, mới xong vài mốc đầu ⇒ "Trễ kế hoạch".
        UPDATE public.auction_plan_item_steps
           SET done_on = LEAST(_today, _mon - 20)
         WHERE item_id = _item AND sort_order <= 2;

      ELSIF _s.flavour = 'at_risk' THEN
        -- Tháng dự kiến còn ở tương lai nhưng đã lùi dự kiến ⇒ "Nguy cơ trễ".
        UPDATE public.auction_plan_items
           SET forecast_month = _mon + INTERVAL '3 months',
               forecast_reason = 'Chờ phê duyệt giá khởi điểm, dự kiến lùi một quý.'
         WHERE id = _item;
        UPDATE public.auction_plan_item_steps
           SET planned_date = _today - 9
         WHERE item_id = _item AND sort_order = 1;

      ELSE
        -- on_track / public_asset: xong các mốc đầu, chưa tới hạn mốc nào.
        UPDATE public.auction_plan_item_steps
           SET done_on = LEAST(_today, _today - 15)
         WHERE item_id = _item AND sort_order <= 2;
        UPDATE public.auction_plan_item_steps
           SET planned_date = GREATEST(_today + 5, _mon - ((10 - sort_order) * 12))
         WHERE item_id = _item AND sort_order > 2;
      END IF;
    END LOOP;

    -- ── Trình & ghi nhận phê duyệt — ĐÚNG luồng hai cấp ────────────────────
    -- Xã đầu do CÁN BỘ XÃ trình (thành viên bị giới hạn chi nhánh, có
    -- `finalize`); các xã còn lại do tỉnh trình thay (demo chỉ có một tài khoản
    -- cán bộ thật). Ghi nhận phê duyệt LUÔN là việc của tỉnh.
    FOR _s IN SELECT t.i FROM generate_subscripts(c_codes, 1) AS t(i) ORDER BY t.i LOOP
      _plan := _plans[_s.i];

      IF _s.i = 1 AND _officer IS NOT NULL THEN
        PERFORM set_config('request.jwt.claims', json_build_object('sub', _officer)::TEXT, true);
      ELSE
        PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin)::TEXT, true);
      END IF;
      _res := public.auction_plan_submit(_plan);
      IF COALESCE((_res ->> 'ok')::BOOLEAN, false) IS NOT TRUE THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'submit_failed',
                                  'plan_id', _plan, 'detail', _res);
      END IF;

      PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin)::TEXT, true);
      _res := public.auction_plan_record_approval(
                _plan,
                'QĐ-' || (1200 + _s.i)::TEXT || '/QĐ-UBND',
                LEAST(_today, make_date(_year - 1, 12, 28)),
                '{}'::TEXT[]);
      IF COALESCE((_res ->> 'ok')::BOOLEAN, false) IS NOT TRUE THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'approval_failed',
                                  'plan_id', _plan, 'detail', _res);
      END IF;
    END LOOP;

    -- Đợt năm đã xong việc ⇒ đóng; mở ĐỢT BỔ SUNG đang chờ các xã trình.
    PERFORM public.auction_plan_cycle_close(_cycle);

    _res := public.auction_plan_cycle_open(
              _ws, _year, 'supplement', _today + 21,
              'Đợt lập kế hoạch BỔ SUNG năm ' || _year
              || ': các xã, phường rà soát quỹ đất phát sinh và trình bổ sung trước hạn.');
    IF COALESCE((_res ->> 'ok')::BOOLEAN, false) IS NOT TRUE THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'supplement_failed', 'detail', _res);
    END IF;
    _supp := (_res ->> 'cycle_id')::UUID;

    _res := public.auction_plan_cycle_set_units(_supp, (
      SELECT jsonb_agg(jsonb_build_object(
               'admin_unit_code', c_codes[t.i],
               'branch_id', (SELECT b.id FROM public.workspace_branches b
                              WHERE b.workspace_id = _ws AND b.admin_unit_code = c_codes[t.i]),
               'assigned_revenue', round(c_rev[t.i] * 0.25),
               'assigned_count', 2))
        FROM generate_subscripts(c_codes, 1) AS t(i)));
    IF COALESCE((_res ->> 'ok')::BOOLEAN, false) IS NOT TRUE THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'supplement_units_failed', 'detail', _res);
    END IF;
  END IF;

  PERFORM set_config('request.jwt.claims', '', true);

  RETURN jsonb_build_object(
    'ok', true,
    'workspace_id', _ws,
    'province_code', p_province_code,
    'province_name', _prov,
    'plan_year', _year,
    'plans_skipped', _skipped,
    'items_created', _n_items,
    'annual_cycle_id', _cycle,
    'supplement_cycle_id', _supp,
    'invites', _invites,
    'units', to_jsonb(c_codes));
END;
$fn$;

COMMENT ON FUNCTION public.auction_plan_demo_pack(TEXT, TEXT, TEXT, INT) IS
  'Bộ demo Kế hoạch đấu giá (Phase 9): một tỉnh + 4 xã, kế hoạch năm đã duyệt đủ mọi trạng thái sức khoẻ, đợt bổ sung đang mở. Giả danh người dùng thật rồi gọi ĐÚNG các RPC của sản phẩm — không làm yếu guard nào. CÔNG CỤ VẬN HÀNH: chỉ superuser gọi được.';

-- Giả danh người dùng ⇒ KHÔNG phơi ra PostgREST, không cho cả service_role.
REVOKE ALL ON FUNCTION public.auction_plan_demo_pack(TEXT, TEXT, TEXT, INT)
  FROM PUBLIC, anon, authenticated, service_role;

-- ═════════════════════════════════════════════════════════════════════════════
-- Dựng bộ demo ngay trong migration
-- ═════════════════════════════════════════════════════════════════════════════
DO $run$
DECLARE
  _r JSONB;
BEGIN
  _r := public.auction_plan_demo_pack();
  IF COALESCE((_r ->> 'ok')::BOOLEAN, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'P9 demo pack thất bại: %', _r::TEXT;
  END IF;
  RAISE NOTICE 'P9 demo pack: %', _r::TEXT;
END;
$run$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Tự kiểm
-- ═════════════════════════════════════════════════════════════════════════════
DO $check$
DECLARE
  _ws  UUID;
  _n   INT;
BEGIN
  IF has_function_privilege('authenticated', 'public.auction_plan_demo_pack(text,text,text,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.auction_plan_demo_pack(text,text,text,integer)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.auction_plan_demo_pack(text,text,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'P9: hàm giả danh người dùng không được cấp cho role nào.';
  END IF;

  SELECT id INTO _ws FROM public.asset_owner_workspaces
   WHERE admin_unit_code = '24' AND is_demo ORDER BY created_at LIMIT 1;
  IF _ws IS NULL THEN
    RAISE EXCEPTION 'P9: không tìm thấy Trạm demo của tỉnh.';
  END IF;

  SELECT count(*) INTO _n FROM public.auction_plans
   WHERE workspace_id = _ws AND status = 'approved' AND baseline_version = 1;
  IF _n <> 4 THEN
    RAISE EXCEPTION 'P9: cần 4 kế hoạch đã duyệt, có %.', _n;
  END IF;

  SELECT count(*) INTO _n FROM public.auction_plan_baselines WHERE workspace_id = _ws;
  IF _n <> 4 THEN
    RAISE EXCEPTION 'P9: cần 4 bản mốc đóng băng, có %.', _n;
  END IF;

  SELECT count(*) INTO _n FROM public.auction_plan_items WHERE workspace_id = _ws;
  IF _n < 20 THEN
    RAISE EXCEPTION 'P9: cần ít nhất 20 tài sản trong kế hoạch, có %.', _n;
  END IF;

  SELECT count(*) INTO _n FROM public.auction_plan_cycles
   WHERE workspace_id = _ws AND kind = 'supplement' AND status = 'open';
  IF _n <> 1 THEN
    RAISE EXCEPTION 'P9: cần đúng 1 đợt bổ sung đang mở, có %.', _n;
  END IF;

  SELECT count(*) INTO _n FROM public.owner_audit_log
   WHERE workspace_id = _ws AND module = 'ke-hoach';
  IF _n < 8 THEN
    RAISE EXCEPTION 'P9: nhật ký kế hoạch quá ít (%) — RPC chưa chạy đúng đường.', _n;
  END IF;
END;
$check$;
