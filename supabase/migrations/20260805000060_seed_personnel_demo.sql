-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DEMO — hồ sơ nhân sự CTĐG cho tài khoản harleyngx@gmail.com
--
-- Dữ liệu mẫu để chạy thử tính năng "Số hoá hồ sơ đấu giá viên / lãnh đạo".
-- Bộ roster được thiết kế để đạt TRỌN 13/13 điểm Mục IV.6-8 (TT19/2024/TT-BTP):
--   IV.6  6 ĐGV đang hoạt động (≥5)                       → 4đ
--   IV.7  Giám đốc có thẻ từ 2011 (15 năm, ≥10)           → 4đ
--   IV.8  5 người hành nghề ≥5 năm (≥4)                   → 5đ
-- Kèm 1 người đã nghỉ (badge "Ngừng") và 1 thẻ sắp hết hạn (cảnh báo <60 ngày).
--
-- AN TOÀN: toàn bộ nằm trong guard — không tìm thấy tài khoản thì lặng lẽ bỏ
-- qua, nên chạy ở môi trường khác cũng vô hại. Idempotent: xoá dữ liệu demo cũ
-- (nhận diện bằng tiền tố số thẻ 'HP-DEMO-') rồi nạp lại.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  _uid        UUID;
  _org_id     UUID;
  _auction_id UUID;
  _p          RECORD;
  _pid        UUID;
  _bal        INT;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = 'harleyngx@gmail.com';
  IF _uid IS NULL THEN
    RAISE NOTICE 'Bỏ qua seed: không có tài khoản harleyngx@gmail.com';
    RETURN;
  END IF;

  SELECT o.id, (o.license_info->>'auction_org_id')::uuid
    INTO _org_id, _auction_id
    FROM public.organizations o
   WHERE o.owner_id = _uid
   ORDER BY o.created_at DESC
   LIMIT 1;

  IF _org_id IS NULL THEN
    RAISE NOTICE 'Bỏ qua seed: tài khoản chưa có tổ chức';
    RETURN;
  END IF;

  -- Dọn dữ liệu demo cũ (con xoá theo CASCADE)
  DELETE FROM public.org_auctioneers
   WHERE organization_id = _org_id AND license_number LIKE 'HP-DEMO-%';

  -- ─── Roster ────────────────────────────────────────────────────────────────
  FOR _p IN
    SELECT * FROM (VALUES
      -- tên, chức vụ, loại HĐ, số thẻ, ngày cấp thẻ, hết hạn, vào làm, active, công khai,
      -- CCCD, ngày sinh, giới tính, quê quán, thường trú, học vấn, chuyên ngành, trường, CCHN
      ('Nguyễn Quang Đại','DIRECTOR','OFFICIAL','HP-DEMO-0112','2011-03-14'::date,NULL::date,'2011-04-01'::date,true,true,
       '031075001234','1975-06-12'::date,'MALE','Kiến An, Hải Phòng','Số 12 Lạch Tray, Ngô Quyền, Hải Phòng','Thạc sĩ','Luật Kinh tế','Đại học Luật Hà Nội','CCHN-2011-0112'),
      ('Trần Thị Bích Ngọc','DEPUTY_DIRECTOR','OFFICIAL','HP-DEMO-0347','2016-08-22'::date,NULL::date,'2016-09-15'::date,true,true,
       '031182004567','1982-11-03'::date,'FEMALE','Thuỷ Nguyên, Hải Phòng','Số 45 Tô Hiệu, Lê Chân, Hải Phòng','Cử nhân','Luật','Đại học Luật Hà Nội','CCHN-2016-0347'),
      ('Lê Văn Hùng','AUCTIONEER','OFFICIAL','HP-DEMO-0521','2018-05-09'::date,NULL::date,'2018-06-01'::date,true,true,
       '031185007788','1985-02-27'::date,'MALE','Vĩnh Bảo, Hải Phòng','Số 8 Nguyễn Bỉnh Khiêm, Hải An, Hải Phòng','Cử nhân','Quản trị kinh doanh','Đại học Hàng hải Việt Nam','CCHN-2018-0521'),
      ('Phạm Minh Tuấn','AUCTIONEER','OFFICIAL','HP-DEMO-0688','2019-11-18'::date,NULL::date,'2020-01-06'::date,true,true,
       '031188009900','1988-09-19'::date,'MALE','An Dương, Hải Phòng','Số 210 Trần Nguyên Hãn, Lê Chân, Hải Phòng','Cử nhân','Tài chính - Ngân hàng','Học viện Tài chính','CCHN-2019-0688'),
      ('Đỗ Thị Hồng Nhung','AUCTIONEER','OFFICIAL','HP-DEMO-0794','2021-02-25'::date,NULL::date,'2021-03-15'::date,true,false,
       '031191002233','1991-04-08'::date,'FEMALE','Tiên Lãng, Hải Phòng','Số 77 Cầu Đất, Ngô Quyền, Hải Phòng','Cử nhân','Luật Dân sự','Đại học Luật Hà Nội','CCHN-2021-0794'),
      -- Thẻ hết hạn sau ~40 ngày ⇒ hiện cảnh báo "sắp hết hạn"
      ('Vũ Đình Khánh','AUCTIONEER','COLLABORATOR','HP-DEMO-0913','2024-06-10'::date,(CURRENT_DATE + 40),'2024-07-01'::date,true,false,
       '031194004455','1994-12-30'::date,'MALE','Đồ Sơn, Hải Phòng','Số 3 Phạm Văn Đồng, Dương Kinh, Hải Phòng','Cử nhân','Luật','Đại học Mở Hà Nội','CCHN-2024-0913'),
      -- Đã nghỉ ⇒ hiện badge "Ngừng", không tính vào điểm
      ('Hoàng Thị Lan Anh','AUCTIONEER','OFFICIAL','HP-DEMO-0455','2017-04-12'::date,NULL::date,'2017-05-02'::date,false,false,
       '031187006611','1987-07-21'::date,'FEMALE','Kiến Thuỵ, Hải Phòng','Số 19 Hoàng Diệu, Hồng Bàng, Hải Phòng','Cử nhân','Luật','Đại học Luật Hà Nội','CCHN-2017-0455')
    ) AS t(full_name, position, contract_type, license_number, license_issued, license_expiry,
           joined, is_active, is_public, id_number, dob, gender, hometown, address,
           education, major, alma_mater, cchn)
  LOOP
    INSERT INTO public.org_auctioneers (
      organization_id, auction_org_id, source, is_verified_by_public_source,
      full_name, date_of_birth, permanent_address,
      professional_cert_number, professional_cert_issued_date,
      license_number, license_issued_date, license_expiry_date, joined_date,
      ended_date, position, contract_type, email, phone, internal_notes, is_active,
      id_number, id_type, id_issued_date, id_issued_place, hometown, ethnicity,
      nationality, gender, education_level, major, alma_mater,
      is_public_profile, dossier_updated_at
    ) VALUES (
      _org_id, _auction_id, 'MANUAL', false,
      _p.full_name, _p.dob, _p.address,
      _p.cchn, _p.license_issued - INTERVAL '2 months',
      _p.license_number, _p.license_issued, _p.license_expiry, _p.joined,
      CASE WHEN _p.is_active THEN NULL ELSE DATE '2025-12-31' END,
      _p.position, _p.contract_type,
      'dgv' || lower(right(_p.license_number, 4)) || '@dgvn-hp.vn',
      '09' || lpad((abs(hashtext(_p.license_number)) % 100000000)::text, 8, '0'),
      CASE WHEN _p.is_active THEN NULL ELSE 'Đã chuyển công tác từ 01/2026.' END,
      _p.is_active,
      _p.id_number, 'CCCD', _p.license_issued - INTERVAL '3 years',
      'Cục Cảnh sát QLHC về TTXH', _p.hometown, 'Kinh',
      'Việt Nam', _p.gender, _p.education, _p.major, _p.alma_mater,
      _p.is_public, now()
    )
    RETURNING id INTO _pid;

    -- ─── Giấy tờ hành nghề ───────────────────────────────────────────────────
    INSERT INTO public.org_auctioneer_documents
      (auctioneer_id, organization_id, doc_type, title, doc_number, issuer, issued_date, expiry_date, sort_order)
    VALUES
      (_pid, _org_id, 'DGV_CARD', 'Thẻ đấu giá viên', _p.license_number, 'Bộ Tư pháp', _p.license_issued, _p.license_expiry, 1),
      (_pid, _org_id, 'CCHN', 'Chứng chỉ hành nghề đấu giá', _p.cchn, 'Bộ Tư pháp', _p.license_issued - INTERVAL '2 months', NULL, 2),
      (_pid, _org_id, 'DEGREE', 'Bằng ' || _p.education || ' ' || _p.major, NULL, _p.alma_mater, _p.license_issued - INTERVAL '5 years', NULL, 3),
      (_pid, _org_id, 'CRIMINAL_RECORD', 'Phiếu lý lịch tư pháp số 1', NULL, 'Sở Tư pháp TP Hải Phòng', CURRENT_DATE - 120, CURRENT_DATE + 245, 4),
      (_pid, _org_id, 'LABOR_CONTRACT',
        CASE WHEN _p.contract_type = 'COLLABORATOR' THEN 'Hợp đồng cộng tác viên' ELSE 'Hợp đồng lao động không xác định thời hạn' END,
        NULL, 'Chi nhánh Công ty Đấu giá Hợp danh Việt Nam tại Hải Phòng', _p.joined, NULL, 5);

    -- ─── Quá trình công tác ──────────────────────────────────────────────────
    INSERT INTO public.org_auctioneer_events
      (auctioneer_id, organization_id, event_type, title, organization_name, role, started_on, ended_on, notes)
    VALUES
      (_pid, _org_id,'WORK','Chuyên viên pháp chế','Công ty Luật TNHH Bạch Đằng','Chuyên viên',
       _p.license_issued - INTERVAL '4 years', _p.joined - INTERVAL '1 month','Tư vấn pháp lý hợp đồng và tài sản bảo đảm.'),
      (_pid, _org_id,'WORK',
       CASE _p.position WHEN 'DIRECTOR' THEN 'Giám đốc chi nhánh'
                        WHEN 'DEPUTY_DIRECTOR' THEN 'Phó Giám đốc chi nhánh'
                        ELSE 'Đấu giá viên' END,
       'Chi nhánh Công ty Đấu giá Hợp danh Việt Nam tại Hải Phòng',
       CASE _p.position WHEN 'DIRECTOR' THEN 'Giám đốc'
                        WHEN 'DEPUTY_DIRECTOR' THEN 'Phó Giám đốc'
                        ELSE 'Đấu giá viên' END,
       _p.joined, CASE WHEN _p.is_active THEN NULL ELSE DATE '2025-12-31' END, NULL);

    -- ─── Cuộc đấu giá đã điều hành ───────────────────────────────────────────
    INSERT INTO public.org_auctioneer_events
      (auctioneer_id, organization_id, event_type, title, organization_name, role, started_on, reference_no, outcome, amount)
    VALUES
      (_pid, _org_id,'AUCTION','Quyền sử dụng đất và tài sản gắn liền với đất tại phường Anh Dũng, quận Dương Kinh',
       'Ngân hàng TMCP Công Thương Việt Nam - CN Hải Phòng','Điều hành cuộc đấu giá',
       CURRENT_DATE - 95, 'HD-2026/'||right(_p.license_number,4)||'-01','Thành', 8450000000),
      (_pid, _org_id,'AUCTION','Xe ô tô con nhãn hiệu Toyota Camry 2.5Q biển 15A-123.45',
       'Cục Thi hành án dân sự TP Hải Phòng','Điều hành cuộc đấu giá',
       CURRENT_DATE - 58, 'HD-2026/'||right(_p.license_number,4)||'-02','Thành', 985000000),
      (_pid, _org_id,'AUCTION','Lô hàng vật tư thiết bị thanh lý của Nhà máy đóng tàu Bạch Đằng',
       'Tổng công ty Công nghiệp tàu thuỷ','Điều hành cuộc đấu giá',
       CURRENT_DATE - 22, 'HD-2026/'||right(_p.license_number,4)||'-03','Không thành', NULL);

    -- ─── Bồi dưỡng nghiệp vụ ─────────────────────────────────────────────────
    INSERT INTO public.org_auctioneer_events
      (auctioneer_id, organization_id, event_type, title, organization_name, started_on, hours, outcome)
    VALUES
      (_pid, _org_id,'TRAINING','Bồi dưỡng nghiệp vụ đấu giá tài sản năm 2025',
       'Học viện Tư pháp - Bộ Tư pháp', DATE '2025-09-16', 32, 'Đạt'),
      (_pid, _org_id,'TRAINING','Tập huấn Luật Đấu giá tài sản sửa đổi 2024 và Thông tư 19/2024/TT-BTP',
       'Sở Tư pháp TP Hải Phòng', DATE '2025-04-08', 16, 'Đạt');

    -- ─── Khen thưởng (chỉ lãnh đạo và 1 ĐGV kỳ cựu) ──────────────────────────
    IF _p.position IN ('DIRECTOR','DEPUTY_DIRECTOR') OR _p.license_number = 'HP-DEMO-0521' THEN
      INSERT INTO public.org_auctioneer_events
        (auctioneer_id, organization_id, event_type, title, organization_name, started_on, reference_no, notes)
      VALUES
        (_pid, _org_id,'REWARD','Giấy khen "Đấu giá viên tiêu biểu năm 2025"',
         'Sở Tư pháp TP Hải Phòng', DATE '2026-01-20', 'QĐ-45/QĐ-STP',
         'Thành tích xuất sắc trong hoạt động đấu giá tài sản năm 2025.');
    END IF;
  END LOOP;

  -- ─── Credit để chạy thử luồng xuất hồ sơ có phí ────────────────────────────
  -- Dùng loại 'admin_grant', KHÔNG dùng 'purchase': nạp kiểu purchase sẽ kích
  -- trigger tạo đơn hàng và làm bẩn báo cáo doanh thu bằng tiền không có thật.
  SELECT balance INTO _bal FROM public.user_credits WHERE user_id = _uid;
  IF COALESCE(_bal, 0) < 200 THEN
    UPDATE public.user_credits SET balance = 500 WHERE user_id = _uid;
    INSERT INTO public.credit_transactions (user_id, type, description, credit_delta)
    VALUES (_uid, 'admin_grant', 'Cấp credit chạy thử tính năng hồ sơ nhân sự', 500 - COALESCE(_bal, 0));
    RAISE NOTICE 'Đã nâng số dư credit lên 500 (trước đó %)', COALESCE(_bal, 0);
  END IF;

  RAISE NOTICE 'Seed xong 7 đấu giá viên cho tổ chức %', _org_id;
END $$;
