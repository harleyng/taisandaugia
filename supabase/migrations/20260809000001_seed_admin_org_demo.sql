-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DEMO — công ty đấu giá "full option" cho tài khoản admin@gmail.com
--
-- Dựng một tổ chức có dữ liệu ở TẤT CẢ các module của /portal, tương đương (và
-- đầy hơn) bộ demo đang có của harleyngx@gmail.com:
--
--   Thông tin chung      org_general_info + org_bank_accounts + org_branches
--   Cơ sở vật chất       org_infrastructure + org_infrastructure_photos
--   Đấu giá viên         org_auctioneers + _documents + _events (+ CPD, miễn)
--   Lịch sử đấu giá      org_auction_records
--   Tài chính            org_tax_records
--   Tủ tài liệu          org_document_folders + org_documents (+ versions/links)
--   Hồ sơ nhân sự        personnel_dossier_exports
--   Hồ sơ dự tuyển       org_applications
--   Hồ sơ năng lực       org_capacity_profile (tổng hợp, TÍNH TỪ dữ liệu trên)
--   Credit               user_credits + credit_transactions
--
-- Công ty: Công ty Đấu giá Hợp danh Minh Đức (Hà Nội) — một dòng CHƯA ai nhận
-- trong danh bạ auction_organizations, nên không đụng bộ demo của Hải Phòng.
--
-- AN TOÀN: nằm trọn trong guard — không có tài khoản thì lặng lẽ bỏ qua, chạy ở
-- môi trường khác vô hại. Idempotent: xoá tổ chức demo theo UUID cố định (con
-- xoá theo CASCADE) rồi nạp lại.
--
-- FILE ĐÍNH KÈM: mọi storage_path/file_paths dưới đây đều là đường dẫn TIỀN
-- ĐỊNH trong bucket personnel-docs / personnel-portraits / org-documents. Ảnh
-- placeholder được nạp riêng bằng scripts/seed-admin-org-assets.py (chạy với
-- SUPABASE_SERVICE_ROLE_KEY trong .env.local).
-- Thiếu file thì bản ghi vẫn hiện, chỉ không xem/tải được.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  _uid          UUID;
  _org          UUID := 'ad000001-0000-4000-8000-000000000001';
  _auction_org  UUID := 'db4df616-759a-4d2b-88fd-8e9f8f502e20';  -- CTĐG Hợp danh Minh Đức
  _infra        UUID := 'ad000003-0000-4000-8000-000000000001';
  _folder_infra UUID;
  _folder_legal UUID;
  _folder_tax   UUID;
  _p            RECORD;
  _pid          UUID;
  _seq          INT;
  _doc          UUID;
  _photo        UUID;
  _sec          RECORD;
  _rec          RECORD;
  _start        NUMERIC;
  _win          NUMERIC;
  _ok           BOOLEAN;
  _dgv          UUID[] := ARRAY[]::uuid[];
  -- Danh mục bồi dưỡng (master data, seed sẵn ở 20260806000040)
  _t_course     UUID := 'e47e02fb-0adc-404d-bf02-3cba19e51572';
  _t_seminar    UUID := '71745c76-5047-4cdd-8715-f00292e37a89';
  _t_teaching   UUID := 'bef5d664-3546-466e-9bc7-895e0d0fc3e5';
  _t_publish    UUID := '8ec26c55-59cb-44e9-804d-a9e4e8b81b4c';
  _t_overseas   UUID := 'a0a00ebc-019c-4d2c-a941-df19ebee90ec';
  _r_attendee   UUID := 'e5565265-aafd-42c6-b56f-7125b7e336fc';
  _r_speaker    UUID := '989609f4-f3e3-4d7e-9b69-be9ad49edbb4';
  _x_maternity  UUID := 'ca63e3b1-22d8-45b7-8138-772eeb9be404';
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = 'admin@gmail.com';
  IF _uid IS NULL THEN
    RAISE NOTICE 'Bỏ qua seed: không có tài khoản admin@gmail.com';
    RETURN;
  END IF;

  -- Dọn bản demo cũ. Bảng con đều CASCADE theo organizations, RIÊNG membership
  -- phải xoá trước: organization_memberships.role_id → org_roles là ON DELETE
  -- RESTRICT, cascade xoá org_roles trước sẽ vướng ràng buộc đó.
  DELETE FROM public.organization_memberships WHERE organization_id = _org;
  DELETE FROM public.organizations WHERE id = _org;

  -- ─── Chủ tài khoản ─────────────────────────────────────────────────────────
  -- KYC đã duyệt: chính sách INSERT organizations đòi hồ sơ cá nhân APPROVED,
  -- và một số màn hình đọc cờ này để quyết định có cho thao tác hay không.
  --
  -- Tắt tạm validate_profile_kyc_update_trigger: nó chỉ cho ADMIN đổi kyc_status
  -- và đọc quyền qua auth.uid(), mà trong migration auth.uid() là NULL nên mọi
  -- lần chạy đều bị chặn. Chỉ tắt ĐÚNG trigger đó — session_replication_role sẽ
  -- tắt luôn create_owner_membership mà seed này đang dựa vào.
  ALTER TABLE public.profiles DISABLE TRIGGER validate_profile_kyc_update_trigger;

  UPDATE public.profiles
     SET kyc_status = 'APPROVED',
         name       = COALESCE(NULLIF(name, ''), 'Nguyễn Minh Đức'),
         activated  = true,
         updated_at = now()
   WHERE id = _uid;

  ALTER TABLE public.profiles ENABLE TRIGGER validate_profile_kyc_update_trigger;

  -- ─── Tổ chức ───────────────────────────────────────────────────────────────
  -- Trigger create_owner_membership tự seed org_roles mặc định + gán chủ sở hữu
  -- vào vai trò Owner, nên không chèn tay hai bảng đó.
  INSERT INTO public.organizations (id, name, owner_id, kyc_status, license_info, created_at)
  VALUES (
    _org,
    'Công ty Đấu giá Hợp danh Minh Đức',
    _uid,
    'APPROVED',
    jsonb_build_object('auction_org_id', _auction_org::text),
    now() - INTERVAL '400 days'
  );

  -- ─── Thông tin chung ───────────────────────────────────────────────────────
  INSERT INTO public.org_general_info (
    organization_id, name, short_name, org_type, tax_code, registration_code,
    logo_initials, brand_color, address, ward, district, province,
    phone, alternative_phone, fax, email, alternative_email, website,
    legal_rep_name, legal_rep_position, legal_rep_id_number,
    legal_rep_id_issued_date, legal_rep_id_issued_place,
    founded_date, establishment_decision_number, establishment_decision_date,
    establishment_decision_issuer, business_license_number, business_license_date,
    business_license_issuer, is_listed_in_moj_directory, moj_listing_notes,
    last_updated_by
  ) VALUES (
    _org, 'Công ty Đấu giá Hợp danh Minh Đức', 'Minh Đức', 'CONG_TY_HOP_DANH',
    '0101234567', '0101234567',
    'MĐ', '#1F6F54',
    '45 Tràng Tiền', 'Phường Tràng Tiền', 'Quận Hoàn Kiếm', 'Hà Nội',
    '024 3936 2222', '024 3936 2223', '024 3936 2224',
    'info@minhduc-auction.vn', 'hopdong@minhduc-auction.vn', 'https://minhduc-auction.vn',
    'Nguyễn Minh Đức', 'Giám đốc', '001075012345',
    DATE '2021-04-16', 'Cục Cảnh sát QLHC về TTXH',
    DATE '2009-03-18', '412/QĐ-STP', DATE '2009-03-18', 'Sở Tư pháp thành phố Hà Nội',
    '0101234567', DATE '2009-03-25', 'Sở Kế hoạch và Đầu tư thành phố Hà Nội',
    true, 'Có tên trong Danh sách tổ chức đấu giá tài sản do Bộ Tư pháp công bố, cập nhật quý II/2026.',
    _uid
  );

  INSERT INTO public.org_bank_accounts
    (organization_id, bank_name, account_number, account_holder, branch, is_primary, sort_order)
  VALUES
    (_org, 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)', '0011000123456',
     'CÔNG TY ĐẤU GIÁ HỢP DANH MINH ĐỨC', 'Chi nhánh Hà Nội', true, 0),
    (_org, 'Ngân hàng TMCP Công Thương Việt Nam (VietinBank)', '102876543210',
     'CÔNG TY ĐẤU GIÁ HỢP DANH MINH ĐỨC', 'Chi nhánh Hoàn Kiếm', false, 1),
    (_org, 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)', '12010009988776',
     'CÔNG TY ĐẤU GIÁ HỢP DANH MINH ĐỨC — TK tiền đặt trước', 'Chi nhánh Tràng An', false, 2);

  INSERT INTO public.org_branches
    (organization_id, name, type, address, province, district, ward, phone, email,
     manager_name, established_date, is_active)
  VALUES
    (_org, 'Chi nhánh Công ty Đấu giá Hợp danh Minh Đức tại TP. Hồ Chí Minh', 'BRANCH',
     '118 Nguyễn Thị Minh Khai', 'TP. Hồ Chí Minh', 'Quận 3', 'Phường Võ Thị Sáu',
     '028 3930 5566', 'hcm@minhduc-auction.vn', 'Trần Quốc Bảo', DATE '2016-07-01', true),
    (_org, 'Chi nhánh Công ty Đấu giá Hợp danh Minh Đức tại Đà Nẵng', 'BRANCH',
     '215 Nguyễn Văn Linh', 'Đà Nẵng', 'Quận Thanh Khê', 'Phường Vĩnh Trung',
     '0236 3888 234', 'danang@minhduc-auction.vn', 'Phạm Thanh Tùng', DATE '2020-10-15', true),
    (_org, 'Văn phòng đại diện Minh Đức tại Bắc Ninh', 'REP_OFFICE',
     '88 Lý Thái Tổ', 'Bắc Ninh', 'TP. Bắc Ninh', 'Phường Suối Hoa',
     '0222 3877 099', 'bacninh@minhduc-auction.vn', 'Ngô Thị Mai Phương', DATE '2023-03-08', false);

  -- ─── Tủ tài liệu ───────────────────────────────────────────────────────────
  -- Bảy thư mục mặc định giống hệt seedDefaultFolders() phía client.
  INSERT INTO public.org_document_folders (organization_id, name, sort_order)
  SELECT _org, name, ord - 1
    FROM unnest(ARRAY[
      'Pháp lý công ty','Nhân sự','Cơ sở vật chất','Thuế & Tài chính',
      'Hợp đồng đấu giá','Biên bản & Kết quả','Khác'
    ]) WITH ORDINALITY AS t(name, ord);

  SELECT id INTO _folder_infra FROM public.org_document_folders
   WHERE organization_id = _org AND name = 'Cơ sở vật chất';
  SELECT id INTO _folder_legal FROM public.org_document_folders
   WHERE organization_id = _org AND name = 'Pháp lý công ty';
  SELECT id INTO _folder_tax FROM public.org_document_folders
   WHERE organization_id = _org AND name = 'Thuế & Tài chính';

  -- ─── Cơ sở vật chất ────────────────────────────────────────────────────────
  -- Khai đủ 7 mục để đạt trọn 19 điểm Mục II (1.5+1.5+2+2+4+4+4).
  INSERT INTO public.org_infrastructure (
    id, organization_id,
    hq_address, hq_ward, hq_district, hq_province, hq_phone, hq_email,
    hq_working_area, hq_floor_count, hq_is_owned, hq_last_updated_at,
    rp_is_at_headquarters, rp_working_hours, rp_working_days,
    rp_public_notice_method, rp_last_updated_at,
    cam_office_has_system, cam_office_locations, cam_office_can_extract_recording,
    cam_office_can_store_with_case, cam_office_technical_notes, cam_office_last_updated_at,
    cam_auction_has_system, cam_auction_is_same_as_office, cam_auction_locations,
    cam_auction_can_extract_recording, cam_auction_can_store_with_case,
    cam_auction_technical_notes, cam_auction_last_updated_at,
    web_type, web_url, web_is_reachable, web_last_checked,
    web_has_regular_updates, web_last_content_update_date, web_last_updated_at,
    oap_qualification_type, oap_approval_document_number, oap_approval_date,
    oap_approved_by, oap_approval_document, oap_url, oap_is_own_platform,
    oap_platform_provider, oap_last_year_auction_count, oap_last_updated_at,
    ar_is_at_headquarters, ar_address, ar_area, ar_storage_type,
    ar_security_measures, ar_last_updated_at,
    total_score, score_ii_1_1, score_ii_1_2, score_ii_2_1, score_ii_2_2,
    score_ii_3, score_ii_4, score_ii_5,
    completion_percentage, sections_needing_update
  ) VALUES (
    _infra, _org,
    '45 Tràng Tiền', 'Phường Tràng Tiền', 'Quận Hoàn Kiếm', 'Hà Nội',
    '024 3936 2222', 'info@minhduc-auction.vn',
    420, 3, true, now() - INTERVAL '12 days',
    true, '08:00 – 17:00 (nghỉ trưa 12:00 – 13:30)',
    ARRAY['MON','TUE','WED','THU','FRI','SAT'],
    'Niêm yết tại trụ sở, đăng Cổng Đấu giá tài sản quốc gia và website công ty; thông báo trên báo in địa phương nơi có tài sản.',
    now() - INTERVAL '12 days',
    true, ARRAY['Sảnh tiếp dân tầng 1','Phòng tiếp nhận hồ sơ tầng 2','Hành lang kho lưu trữ tầng 3'],
    true, true,
    'Hệ thống 12 mắt Hikvision ColorVu, đầu ghi 8TB, lưu tối thiểu 90 ngày, trích xuất được ra USB kèm mã băm.',
    now() - INTERVAL '20 days',
    true, false, ARRAY['Hội trường đấu giá tầng 2 (2 mắt toàn cảnh + 1 mắt bàn điều hành)'],
    true, true,
    'Ghi hình liên tục toàn bộ cuộc đấu giá, xuất file kèm biên bản và lưu chung hồ sơ cuộc đấu giá theo Điều 45 Luật ĐGTS.',
    now() - INTERVAL '20 days',
    'OWN_DOMAIN', 'https://minhduc-auction.vn', true, now() - INTERVAL '2 days',
    true, CURRENT_DATE - 3, now() - INTERVAL '2 days',
    'APPROVED', '187/QĐ-BTP', DATE '2023-05-11', 'Bộ Tư pháp',
    _org || '/tu-tai-lieu/ad000005-0000-4000-8000-000000000003.pdf',
    'https://daugia.minhduc-auction.vn', true, NULL, 46,
    now() - INTERVAL '30 days',
    true, '45 Tràng Tiền, Phường Tràng Tiền, Quận Hoàn Kiếm, Hà Nội (kho lưu trữ tầng 3)',
    65, 'HYBRID',
    ARRAY['Cửa thép khoá từ','Camera giám sát 24/7','Báo cháy tự động','Giá kệ chống ẩm','Sổ theo dõi mượn/trả hồ sơ'],
    now() - INTERVAL '45 days',
    19, 1.5, 1.5, 2, 2, 4, 4, 4,
    100, ARRAY[]::text[]
  );

  -- Mỗi mục một ảnh minh chứng. Ảnh vừa nằm trong org_infrastructure_photos
  -- (để chấm điểm) vừa được đăng ký trong Tủ tài liệu — đúng như luồng
  -- PhotoUpload dựng ra khi người dùng tải ảnh lên.
  _seq := 0;
  FOR _sec IN
    SELECT * FROM (VALUES
      ('headquarters',     'II.1.1', 'Trụ sở làm việc',            'tru-so-tang-1.png'),
      ('reception_point',  'II.1.2', 'Địa điểm tiếp người tham gia','quay-tiep-nhan-ho-so.png'),
      ('camera_at_office', 'II.2.1', 'Camera tại trụ sở',           'camera-sanh-tang-1.png'),
      ('camera_at_auction','II.2.2', 'Camera tại nơi đấu giá',      'camera-hoi-truong.png'),
      ('website',          'II.3',   'Trang thông tin điện tử',     'anh-chup-website.png'),
      ('online_platform',  'II.4',   'Trang đấu giá trực tuyến',    'anh-chup-trang-dgtt.png'),
      ('archive',          'II.5',   'Kho lưu trữ hồ sơ',           'kho-luu-tru-tang-3.png')
    ) AS s(section, section_id, label, file_name)
  LOOP
    _seq  := _seq + 1;
    _photo := ('ad000004-0000-4000-8000-' || lpad(_seq::text, 12, '0'))::uuid;
    _doc   := ('ad000005-0000-4000-8000-' || lpad((100 + _seq)::text, 12, '0'))::uuid;

    INSERT INTO public.org_documents (
      id, organization_id, folder_id, display_name, description, tags,
      mime_category, original_filename, size_bytes, storage_path, current_version
    ) VALUES (
      _doc, _org, _folder_infra, _sec.file_name,
      'Ảnh minh chứng mục ' || _sec.section_id || ' — ' || _sec.label,
      ARRAY['Cơ sở vật chất'], 'IMAGE', _sec.file_name, 184320,
      _org || '/infrastructure/' || _sec.section_id || '/' || _photo || '.png', 1
    );

    INSERT INTO public.org_document_versions (document_id, version, storage_path, size_bytes, uploaded_by)
    VALUES (_doc, 1, _org || '/infrastructure/' || _sec.section_id || '/' || _photo || '.png', 184320, _uid);

    INSERT INTO public.org_document_links (document_id, entity_type, entity_id, label)
    VALUES (_doc, 'INFRASTRUCTURE_SECTION', _sec.section_id, _sec.label);

    INSERT INTO public.org_infrastructure_photos (
      id, infrastructure_id, section, document_id, storage_path,
      file_name, file_size, caption, width, height, sort_order
    ) VALUES (
      _photo, _infra, _sec.section, _doc::text,
      _org || '/infrastructure/' || _sec.section_id || '/' || _photo || '.png',
      _sec.file_name, 184320, _sec.label, 1200, 800, 0
    );
  END LOOP;

  -- Vài tài liệu pháp lý / thuế cho tủ tài liệu đỡ trống.
  FOR _rec IN
    SELECT * FROM (VALUES
      (1, 'giay-chung-nhan-dkkd.pdf',  'Giấy chứng nhận đăng ký doanh nghiệp', 'PDF',  'Pháp lý công ty',  DATE '2009-03-25', NULL::date,        true),
      (2, 'quyet-dinh-thanh-lap.pdf',  'Quyết định thành lập 412/QĐ-STP',      'PDF',  'Pháp lý công ty',  DATE '2009-03-18', NULL::date,        false),
      (3, 'quyet-dinh-187-btp.pdf',    'Quyết định 187/QĐ-BTP phê duyệt trang đấu giá trực tuyến', 'PDF', 'Pháp lý công ty', DATE '2023-05-11', NULL::date, true),
      (4, 'dieu-le-cong-ty.pdf',       'Điều lệ công ty (bản sửa đổi lần 3)',  'PDF',  'Pháp lý công ty',  DATE '2022-11-30', NULL::date,        false),
      (5, 'bao-hiem-trach-nhiem.pdf',  'Hợp đồng bảo hiểm trách nhiệm nghề nghiệp 2026', 'PDF', 'Pháp lý công ty', DATE '2026-01-05', DATE '2027-01-04', true),
      (6, 'quyet-toan-thue-2025.pdf',  'Tờ khai quyết toán thuế TNDN năm 2025','PDF',  'Thuế & Tài chính', DATE '2026-03-28', NULL::date,        false),
      (7, 'quyet-toan-thue-2024.pdf',  'Tờ khai quyết toán thuế TNDN năm 2024','PDF',  'Thuế & Tài chính', DATE '2025-03-26', NULL::date,        false),
      (8, 'bao-cao-tai-chinh-2025.xlsx','Báo cáo tài chính năm 2025',          'EXCEL','Thuế & Tài chính', DATE '2026-03-28', NULL::date,        false)
    ) AS d(i, file_name, title, mime, folder, created_on, expiry, starred)
  LOOP
    _doc := ('ad000005-0000-4000-8000-' || lpad(_rec.i::text, 12, '0'))::uuid;

    INSERT INTO public.org_documents (
      id, organization_id, folder_id, display_name, description, tags,
      expiry_date, is_starred, mime_category, original_filename, size_bytes,
      storage_path, current_version, created_at, updated_at
    ) VALUES (
      _doc, _org,
      CASE _rec.folder WHEN 'Pháp lý công ty' THEN _folder_legal ELSE _folder_tax END,
      _rec.title, NULL, ARRAY[_rec.folder],
      _rec.expiry, _rec.starred,
      _rec.mime, _rec.file_name, 262144,
      _org || '/tu-tai-lieu/' || _doc || CASE WHEN _rec.mime = 'EXCEL' THEN '.xlsx' ELSE '.pdf' END,
      1, _rec.created_on, _rec.created_on
    );

    INSERT INTO public.org_document_versions (document_id, version, storage_path, size_bytes, uploaded_at, uploaded_by)
    VALUES (_doc, 1,
      _org || '/tu-tai-lieu/' || _doc || CASE WHEN _rec.mime = 'EXCEL' THEN '.xlsx' ELSE '.pdf' END,
      262144, _rec.created_on, _uid);
  END LOOP;

  -- ─── Tài chính (Mục IV.9) ──────────────────────────────────────────────────
  -- Năm mục tiêu tính điểm ở thời điểm hiện tại là 2025 (T4+ ⇒ N-1). Một bản
  -- ghi mỗi năm: calcMucIV9 lấy bản ghi ĐẦU TIÊN khớp năm, hai dòng cùng năm sẽ
  -- làm số điểm phụ thuộc thứ tự trả về.
  INSERT INTO public.org_tax_records
    (organization_id, year, record_type, amount, vat_excluded, is_finalized, finalized_date, notes, score_contribution)
  VALUES
    (_org, 2023, 'CIT', 620000000,  true, true, DATE '2024-03-27',
     'Đã quyết toán, có xác nhận của Chi cục Thuế khu vực Hoàn Kiếm.', 3),
    (_org, 2024, 'CIT', 890000000,  true, true, DATE '2025-03-26',
     'Đã quyết toán.', 3),
    (_org, 2025, 'CIT', 1240000000, true, true, DATE '2026-03-28',
     'Đã quyết toán — số liệu dùng chấm điểm Mục IV.9 hồ sơ dự tuyển năm 2026.', 3);

  -- ─── Đấu giá viên ──────────────────────────────────────────────────────────
  -- Roster đạt trọn 13/13 điểm Mục IV.6-8 (TT 19/2024/TT-BTP):
  --   IV.6  6 ĐGV đang hành nghề (≥5)                      → 4đ
  --   IV.7  Giám đốc có thẻ từ 2010 (16 năm, ≥10)          → 4đ
  --   IV.8  5 người hành nghề ≥5 năm (≥4)                  → 5đ
  -- Kèm 1 cộng tác viên thẻ sắp hết hạn (cảnh báo <60 ngày) và 1 người đã nghỉ.
  _seq := 0;
  FOR _p IN
    SELECT * FROM (VALUES
      ('Nguyễn Minh Đức','DIRECTOR','OFFICIAL','HN-DEMO-0088','2010-05-12'::date,NULL::date,'2009-03-18'::date,true,true,
       '001075012345','1975-01-22'::date,'MALE','Từ Liêm, Hà Nội','45 Tràng Tiền, Hoàn Kiếm, Hà Nội','Thạc sĩ','Luật Kinh tế','Đại học Luật Hà Nội','CCHN-2010-0088'),
      ('Lê Thị Thu Hà','DEPUTY_DIRECTOR','OFFICIAL','HN-DEMO-0219','2015-09-04'::date,NULL::date,'2015-10-01'::date,true,true,
       '001181023456','1981-08-14'::date,'FEMALE','Thanh Trì, Hà Nội','128 Bà Triệu, Hai Bà Trưng, Hà Nội','Thạc sĩ','Luật Dân sự','Đại học Luật Hà Nội','CCHN-2015-0219'),
      ('Trần Quốc Bảo','AUCTIONEER','OFFICIAL','HN-DEMO-0356','2017-03-20'::date,NULL::date,'2017-04-10'::date,true,true,
       '001184034567','1984-05-30'::date,'MALE','Đông Anh, Hà Nội','9 Nguyễn Chí Thanh, Đống Đa, Hà Nội','Cử nhân','Luật','Đại học Luật Hà Nội','CCHN-2017-0356'),
      ('Phạm Thanh Tùng','AUCTIONEER','OFFICIAL','HN-DEMO-0472','2019-06-17'::date,NULL::date,'2019-07-01'::date,true,true,
       '001187045678','1987-12-05'::date,'MALE','Hoài Đức, Hà Nội','233 Xuân Thuỷ, Cầu Giấy, Hà Nội','Cử nhân','Tài chính - Ngân hàng','Học viện Ngân hàng','CCHN-2019-0472'),
      ('Ngô Thị Mai Phương','AUCTIONEER','OFFICIAL','HN-DEMO-0588','2020-11-09'::date,NULL::date,'2020-12-01'::date,true,true,
       '001190056789','1990-03-27'::date,'FEMALE','Gia Lâm, Hà Nội','56 Kim Mã, Ba Đình, Hà Nội','Cử nhân','Luật Kinh tế','Đại học Kinh tế Quốc dân','CCHN-2020-0588'),
      -- Thẻ hết hạn sau ~45 ngày ⇒ hiện cảnh báo "sắp hết hạn"
      ('Bùi Đức Thắng','AUCTIONEER','COLLABORATOR','HN-DEMO-0741','2024-02-26'::date,(CURRENT_DATE + 45),'2024-03-15'::date,true,false,
       '001193067890','1993-09-11'::date,'MALE','Sóc Sơn, Hà Nội','17 Trần Duy Hưng, Cầu Giấy, Hà Nội','Cử nhân','Luật','Đại học Mở Hà Nội','CCHN-2024-0741'),
      -- Đã nghỉ ⇒ badge "Ngừng", không tính vào điểm
      ('Đặng Thị Kim Oanh','AUCTIONEER','OFFICIAL','HN-DEMO-0603','2018-08-13'::date,NULL::date,'2018-09-04'::date,false,false,
       '001189078901','1989-06-19'::date,'FEMALE','Thường Tín, Hà Nội','74 Láng Hạ, Đống Đa, Hà Nội','Cử nhân','Luật','Đại học Luật Hà Nội','CCHN-2018-0603')
    ) AS t(full_name, position, contract_type, license_number, license_issued, license_expiry,
           joined, is_active, is_public, id_number, dob, gender, hometown, address,
           education, major, alma_mater, cchn)
  LOOP
    _seq := _seq + 1;
    _pid := ('ad000002-0000-4000-8000-' || lpad(_seq::text, 12, '0'))::uuid;

    INSERT INTO public.org_auctioneers (
      id, organization_id, auction_org_id, source, is_verified_by_public_source,
      full_name, date_of_birth, permanent_address,
      professional_cert_number, professional_cert_issued_date,
      license_number, license_issued_date, license_expiry_date, joined_date,
      ended_date, position, contract_type, email, phone, internal_notes, is_active,
      id_number, id_type, id_issued_date, id_issued_place, hometown, ethnicity,
      nationality, gender, education_level, major, alma_mater, public_title,
      portrait_url, is_public_profile, show_public_stats,
      practice_start_date, management_start_date, dossier_updated_at
    ) VALUES (
      _pid, _org, _auction_org, 'MANUAL', true,
      _p.full_name, _p.dob, _p.address,
      _p.cchn, _p.license_issued - INTERVAL '2 months',
      _p.license_number, _p.license_issued, _p.license_expiry, _p.joined,
      CASE WHEN _p.is_active THEN NULL ELSE DATE '2026-01-31' END,
      _p.position, _p.contract_type,
      'dgv' || lower(right(_p.license_number, 4)) || '@minhduc-auction.vn',
      '09' || lpad((abs(hashtext(_p.license_number)) % 100000000)::text, 8, '0'),
      CASE WHEN _p.is_active THEN NULL ELSE 'Chuyển công tác sang tổ chức khác từ 02/2026.' END,
      _p.is_active,
      _p.id_number, 'CCCD', _p.license_issued - INTERVAL '3 years',
      'Cục Cảnh sát QLHC về TTXH', _p.hometown, 'Kinh',
      'Việt Nam', _p.gender, _p.education, _p.major, _p.alma_mater,
      CASE _p.position WHEN 'DIRECTOR' THEN 'Giám đốc'
                       WHEN 'DEPUTY_DIRECTOR' THEN 'Phó Giám đốc'
                       ELSE 'Đấu giá viên' END,
      'https://dvdpfjprncvkhfwcvqmp.supabase.co/storage/v1/object/public/personnel-portraits/'
        || _org || '/' || _pid || '/portrait.png',
      _p.is_public, _p.is_public,
      _p.license_issued,
      CASE WHEN _p.position IN ('DIRECTOR','DEPUTY_DIRECTOR') THEN _p.joined ELSE NULL END,
      now()
    );

    IF _p.is_active THEN
      _dgv := _dgv || _pid;
    END IF;

    -- ─── Giấy tờ hành nghề ───────────────────────────────────────────────────
    -- file_paths BẮT BUỘC ≥1 phần tử (check org_auctioneer_documents_scan_required).
    INSERT INTO public.org_auctioneer_documents
      (auctioneer_id, organization_id, doc_type, title, doc_number, issuer,
       issued_date, expiry_date, file_paths, sort_order)
    VALUES
      (_pid, _org, 'DGV_CARD', 'Thẻ đấu giá viên', _p.license_number, 'Bộ Tư pháp',
       _p.license_issued, _p.license_expiry, ARRAY[_org || '/' || _pid || '/the-dgv.png'], 1),
      (_pid, _org, 'CCHN', 'Chứng chỉ hành nghề đấu giá', _p.cchn, 'Bộ Tư pháp',
       _p.license_issued - INTERVAL '2 months', NULL, ARRAY[_org || '/' || _pid || '/cchn.png'], 2),
      (_pid, _org, 'DEGREE', 'Bằng ' || _p.education || ' ' || _p.major, NULL, _p.alma_mater,
       _p.license_issued - INTERVAL '5 years', NULL, ARRAY[_org || '/' || _pid || '/bang-cap.png'], 3),
      (_pid, _org, 'CRIMINAL_RECORD', 'Phiếu lý lịch tư pháp số 1', NULL, 'Sở Tư pháp thành phố Hà Nội',
       CURRENT_DATE - 90, CURRENT_DATE + 275, ARRAY[_org || '/' || _pid || '/lltp.png'], 4),
      (_pid, _org, 'LABOR_CONTRACT',
       CASE WHEN _p.contract_type = 'COLLABORATOR' THEN 'Hợp đồng cộng tác viên'
            ELSE 'Hợp đồng lao động không xác định thời hạn' END,
       NULL, 'Công ty Đấu giá Hợp danh Minh Đức', _p.joined, NULL,
       ARRAY[_org || '/' || _pid || '/hop-dong.png'], 5),
      (_pid, _org, 'PORTRAIT', 'Ảnh chân dung 4x6', NULL, NULL, _p.joined, NULL,
       ARRAY[_org || '/' || _pid || '/portrait.png'], 6);

    -- ─── Quá trình công tác / khen thưởng ────────────────────────────────────
    INSERT INTO public.org_auctioneer_events
      (auctioneer_id, organization_id, event_type, title, organization_name, role,
       started_on, ended_on, notes, attachments, sort_order)
    VALUES
      (_pid, _org, 'WORK', 'Chuyên viên pháp chế', 'Công ty Luật TNHH Tràng An', 'Chuyên viên',
       _p.license_issued - INTERVAL '5 years', _p.joined - INTERVAL '1 month',
       'Tư vấn pháp lý hợp đồng, xử lý tài sản bảo đảm.', ARRAY[]::text[], 1),
      (_pid, _org,'WORK',
       CASE _p.position WHEN 'DIRECTOR' THEN 'Giám đốc'
                        WHEN 'DEPUTY_DIRECTOR' THEN 'Phó Giám đốc'
                        ELSE 'Đấu giá viên' END,
       'Công ty Đấu giá Hợp danh Minh Đức',
       CASE _p.position WHEN 'DIRECTOR' THEN 'Người đại diện theo pháp luật'
                        WHEN 'DEPUTY_DIRECTOR' THEN 'Phụ trách nghiệp vụ'
                        ELSE 'Điều hành cuộc đấu giá' END,
       _p.joined, CASE WHEN _p.is_active THEN NULL ELSE DATE '2026-01-31' END,
       NULL, ARRAY[]::text[], 2);

    IF _seq IN (1, 3) THEN
      INSERT INTO public.org_auctioneer_events
        (auctioneer_id, organization_id, event_type, title, organization_name,
         started_on, reference_no, outcome, notes, attachments, sort_order)
      VALUES (_pid, _org, 'REWARD',
        'Bằng khen của Bộ trưởng Bộ Tư pháp', 'Bộ Tư pháp',
        DATE '2024-11-08', '2145/QĐ-BTP', 'Đã nhận',
        'Thành tích xuất sắc trong công tác đấu giá tài sản giai đoạn 2020–2024.',
        ARRAY[]::text[], 3);
    END IF;
  END LOOP;

  -- ─── Bồi dưỡng chuyên môn (TT 19/2024/TT-BTP) ──────────────────────────────
  -- Cố ý trải đủ các trạng thái kết luận của engine cpd.ts:
  --   Đạt (hoạt động cả năm), Đạt (đủ 8 giờ quy đổi), Chưa đủ, Quá hạn, Được miễn.
  INSERT INTO public.org_auctioneer_events
    (auctioneer_id, organization_id, event_type, title, organization_name,
     started_on, outcome, hours, cpd_year, cpd_kind, is_accredited_provider,
     cpd_activity_type_id, cpd_activity_role_id, attachments, sort_order)
  VALUES
    -- ĐGV 1 — Giám đốc: khoá bồi dưỡng 2025 (đạt cả năm) + giảng dạy 2026
    (_dgv[1], _org, 'TRAINING', 'Bồi dưỡng nghiệp vụ đấu giá tài sản năm 2025',
     'Học viện Tư pháp - Bộ Tư pháp', DATE '2025-09-15', 'Đạt', 32, 2025, 'COURSE', true,
     _t_course, NULL, ARRAY[_org || '/' || _dgv[1] || '/bd-2025.png'], 10),
    (_dgv[1], _org, 'TRAINING', 'Giảng chuyên đề "Đấu giá quyền sử dụng đất" lớp nghiệp vụ khoá 12',
     'Học viện Tư pháp - Bộ Tư pháp', DATE '2026-04-22', 'Hoàn thành', 12, 2026, 'TEACHING', true,
     _t_teaching, NULL, ARRAY[_org || '/' || _dgv[1] || '/bd-2026.png'], 11),
    -- ĐGV 2 — Phó Giám đốc: khoá 2025 + hai hội thảo 2026 (4+4 = 8 giờ)
    (_dgv[2], _org, 'TRAINING', 'Bồi dưỡng nghiệp vụ đấu giá tài sản năm 2025',
     'Học viện Tư pháp - Bộ Tư pháp', DATE '2025-09-15', 'Đạt', 32, 2025, 'COURSE', true,
     _t_course, NULL, ARRAY[_org || '/' || _dgv[2] || '/bd-2025.png'], 10),
    (_dgv[2], _org, 'TRAINING', 'Toạ đàm "Vướng mắc thi hành Luật Đấu giá tài sản sửa đổi 2024"',
     'Sở Tư pháp thành phố Hà Nội', DATE '2026-03-19', 'Tham dự', 4, 2026, NULL, false,
     _t_seminar, _r_attendee, ARRAY[_org || '/' || _dgv[2] || '/bd-2026.png'], 11),
    (_dgv[2], _org, 'TRAINING', 'Hội thảo "Đấu giá trực tuyến — thực tiễn và kiến nghị"',
     'Hiệp hội Đấu giá viên Việt Nam', DATE '2026-06-11', 'Tham dự', 4, 2026, NULL, false,
     _t_seminar, _r_attendee, ARRAY[]::text[], 12),
    -- ĐGV 3: đủ 8 giờ năm 2025; 2026 mới được 4 giờ ⇒ "Chưa đủ"
    (_dgv[3], _org, 'TRAINING', 'Toạ đàm "Xác định giá khởi điểm tài sản thi hành án"',
     'Sở Tư pháp thành phố Hà Nội', DATE '2025-05-14', 'Tham dự', 4, 2025, NULL, false,
     _t_seminar, _r_attendee, ARRAY[_org || '/' || _dgv[3] || '/bd-2025.png'], 10),
    (_dgv[3], _org, 'TRAINING', 'Diễn đàn "Minh bạch hoá thông tin đấu giá tài sản công"',
     'Cục Bổ trợ tư pháp - Bộ Tư pháp', DATE '2025-10-23', 'Tham dự', 4, 2025, NULL, false,
     _t_seminar, _r_attendee, ARRAY[]::text[], 11),
    (_dgv[3], _org, 'TRAINING', 'Toạ đàm "Chống thông đồng dìm giá trong đấu giá tài sản"',
     'Hiệp hội Đấu giá viên Việt Nam', DATE '2026-05-28', 'Tham dự', 4, 2026, NULL, false,
     _t_seminar, _r_attendee, ARRAY[]::text[], 12),
    -- ĐGV 4: bài viết công bố 2025 (đạt cả năm) + khoá bồi dưỡng 2026
    (_dgv[4], _org, 'TRAINING', 'Bài "Bàn về tiền đặt trước trong đấu giá quyền sử dụng đất" — Tạp chí Dân chủ & Pháp luật số 8/2025',
     'Tạp chí Dân chủ và Pháp luật', DATE '2025-08-01', 'Đã công bố', NULL, 2025, 'PUBLICATION', false,
     _t_publish, NULL, ARRAY[_org || '/' || _dgv[4] || '/bd-2025.png'], 10),
    (_dgv[4], _org, 'TRAINING', 'Bồi dưỡng nghiệp vụ đấu giá tài sản năm 2026',
     'Học viện Tư pháp - Bộ Tư pháp', DATE '2026-07-06', 'Đạt', 32, 2026, 'COURSE', true,
     _t_course, NULL, ARRAY[_org || '/' || _dgv[4] || '/bd-2026.png'], 11),
    -- ĐGV 5: khoá ở nước ngoài 2025 (đạt cả năm); 2026 chưa khai ⇒ "Chưa đủ"
    (_dgv[5], _org, 'TRAINING', 'Khoá bồi dưỡng "Public Asset Auction Practices" tại Singapore',
     'Singapore Academy of Law', DATE '2025-11-03', 'Hoàn thành', 24, 2025, 'OVERSEAS_COURSE', false,
     _t_overseas, NULL, ARRAY[_org || '/' || _dgv[5] || '/bd-2025.png'], 10),
    -- ĐGV 1: thêm vai trò báo cáo viên năm 2026 (hình thức có phân vai trò)
    (_dgv[1], _org, 'TRAINING', 'Báo cáo viên hội thảo "10 năm thi hành Luật Đấu giá tài sản"',
     'Bộ Tư pháp', DATE '2026-02-27', 'Hoàn thành', 6, 2026, 'SPEAKER', false,
     _t_seminar, _r_speaker, ARRAY[]::text[], 12);
  -- ĐGV 6 (cộng tác viên) cố ý KHÔNG có bản ghi 2025 ⇒ "Quá hạn" (năm đã đóng).

  -- Người đã nghỉ được miễn nghĩa vụ năm 2025.
  INSERT INTO public.org_auctioneer_cpd_exemptions
    (auctioneer_id, organization_id, year, reason_id, reason, note, filed_at, attachments)
  VALUES (
    'ad000002-0000-4000-8000-000000000007', _org, 2025, _x_maternity,
    'Mang thai hoặc nuôi con dưới 12 tháng tuổi',
    'Nghỉ thai sản từ 03/2025 đến 09/2025, đã nộp giấy tờ cho Sở Tư pháp trước 15/12/2025.',
    DATE '2025-12-08', ARRAY[]::text[]
  );

  -- ─── Lịch sử đấu giá ───────────────────────────────────────────────────────
  -- Năm chấm điểm hiện tại là 2025. Bộ 2025 được dựng để đạt 13/16 điểm
  -- Mục IV.1-4: 24 cuộc (3đ) / 18 thành / 18 vượt giá khởi điểm (3+3đ) /
  -- 14 cuộc chênh ≥10% (4đ).
  FOR _rec IN
    SELECT
      y.year,
      g.i AS i,
      -- Rải đều trong năm
      (make_date(y.year, 1, 6) + ((g.i - 1) * (CASE y.year WHEN 2025 THEN 14 WHEN 2026 THEN 21 ELSE 40 END)))::date AS d,
      g.i % 6 AS tpl
    FROM (VALUES (2024, 8), (2025, 24), (2026, 10)) AS y(year, n)
    CROSS JOIN LATERAL generate_series(1, y.n) AS g(i)
  LOOP
    -- Thành/không thành: 2025 ⇒ 18/24, 2024 ⇒ 6/8, 2026 ⇒ 7/10
    _ok := CASE _rec.year
             WHEN 2025 THEN _rec.i <= 18
             WHEN 2024 THEN _rec.i <= 6
             ELSE _rec.i <= 7
           END;

    _start := (CASE _rec.tpl
                 WHEN 0 THEN 6800000000
                 WHEN 1 THEN 3950000000
                 WHEN 2 THEN 780000000
                 WHEN 3 THEN 1450000000
                 WHEN 4 THEN 265000000
                 ELSE 2150000000
               END) + (_rec.i * 35000000);

    -- 14 cuộc đầu của mỗi năm chênh ≥10%, phần còn lại chênh ~4%
    _win := CASE
              WHEN NOT _ok THEN NULL
              WHEN _rec.i <= 14 THEN round(_start * (1.10 + (_rec.i % 5) * 0.03), -6)
              ELSE round(_start * 1.04, -6)
            END;

    INSERT INTO public.org_auction_records (
      organization_id, auction_org_id, auctioneer_id, source,
      auction_date, auction_number, asset_description, asset_category, asset_location,
      owner_name, contract_number, contract_signed_date,
      starting_price, winning_price, is_successful, failure_reason,
      number_of_participants, number_of_bids, internal_notes, details,
      created_at, updated_at
    ) VALUES (
      _org, _auction_org, _dgv[1 + (_rec.i % 6)], 'MANUAL',
      _rec.d,
      'ĐG-' || _rec.year || '/' || lpad(_rec.i::text, 3, '0'),
      CASE _rec.tpl
        WHEN 0 THEN 'Quyền sử dụng ' || (900 + _rec.i * 37) || ' m² đất ở tại phường Phú Lương, quận Hà Đông, Hà Nội'
        WHEN 1 THEN 'Nhà ở riêng lẻ 4 tầng, diện tích sàn ' || (150 + _rec.i * 4) || ' m² tại phường Khương Đình, quận Thanh Xuân'
        WHEN 2 THEN 'Xe ô tô con Toyota Camry 2.5Q, BKS 30G-' || lpad((100 + _rec.i)::text, 3, '0') || '.66'
        WHEN 3 THEN 'Dây chuyền máy in offset Heidelberg SM74 (đã qua sử dụng) cùng phụ kiện đồng bộ'
        WHEN 4 THEN 'Lô tang vật vi phạm hành chính: ' || (200 + _rec.i * 13) || ' kiện hàng tiêu dùng bị tịch thu'
        ELSE 'Quyền sử dụng đất và tài sản gắn liền với đất tại Cụm công nghiệp Ngọc Hồi, huyện Thanh Trì'
      END,
      CASE _rec.tpl
        WHEN 0 THEN 'LAND_USE_RIGHT'
        WHEN 1 THEN 'REAL_ESTATE'
        WHEN 2 THEN 'VEHICLE'
        WHEN 3 THEN 'MACHINERY'
        WHEN 4 THEN 'ADMIN_VIOLATION'
        ELSE 'SECURED_ASSET'
      END,
      CASE _rec.tpl WHEN 2 THEN 'Hà Nội' WHEN 4 THEN 'Hà Nội' ELSE 'Thành phố Hà Nội' END,
      CASE _rec.i % 4
        WHEN 0 THEN 'Ngân hàng TMCP Công Thương Việt Nam - Chi nhánh Hà Nội'
        WHEN 1 THEN 'Cục Thi hành án dân sự thành phố Hà Nội'
        WHEN 2 THEN 'Trung tâm Phát triển quỹ đất quận Hà Đông'
        ELSE 'Cục Quản lý thị trường thành phố Hà Nội'
      END,
      'HĐ-' || _rec.year || '/' || lpad(_rec.i::text, 3, '0'),
      _rec.d - 30,
      _start, _win, _ok,
      CASE WHEN _ok THEN NULL
           WHEN _rec.i % 3 = 0 THEN 'Không có người đăng ký tham gia đấu giá'
           WHEN _rec.i % 3 = 1 THEN 'Chỉ có 01 người đăng ký, không đủ điều kiện tổ chức'
           ELSE 'Người trúng đấu giá từ chối kết quả, không nộp tiền đúng hạn'
      END,
      CASE WHEN _ok THEN 4 + (_rec.i % 9) ELSE _rec.i % 2 END,
      CASE WHEN _ok THEN 9 + (_rec.i % 17) ELSE 0 END,
      NULL,
      jsonb_build_object(
        'auctionFormat',      CASE _rec.i % 3 WHEN 0 THEN 'ONLINE' WHEN 1 THEN 'DIRECT_VOICE' ELSE 'DIRECT_PAPER' END,
        'biddingMethod',      'ASCENDING',
        'bidStepPercentage',  CASE _rec.i % 3 WHEN 0 THEN 1 WHEN 1 THEN 2 ELSE 5 END,
        'depositPercentage',  CASE _rec.i % 2 WHEN 0 THEN 15 ELSE 20 END,
        'actualRounds',       CASE WHEN _ok THEN 2 + (_rec.i % 6) ELSE 0 END,
        'isVerifiedByUser',   true,
        'tags',               to_jsonb(ARRAY['Hồ sơ demo'])
      ),
      _rec.d + INTERVAL '3 days', _rec.d + INTERVAL '3 days'
    );
  END LOOP;

  -- ─── Hồ sơ năng lực tổng hợp ───────────────────────────────────────────────
  -- Điểm II / IV.6-8 là hằng số của bộ demo; các con số đếm được TÍNH THẲNG từ
  -- dữ liệu vừa nạp, để không bao giờ lệch với màn hình.
  INSERT INTO public.org_capacity_profile (
    organization_id, company_name, on_ministry_list,
    score_ii, score_iv_1_to_4, auctions_completed, auctions_missing_price,
    score_iv_5, years_active, score_iv_6_to_8, auctioneer_count,
    score_iv_9, tax_paid_previous_year, total_capacity_score, warnings
  )
  SELECT
    _org, 'Công ty Đấu giá Hợp danh Minh Đức', true,
    19, 13,
    (SELECT count(*) FROM public.org_auction_records WHERE organization_id = _org),
    (SELECT count(*) FROM public.org_auction_records
      WHERE organization_id = _org AND winning_price IS NULL),
    4, 17, 13,
    (SELECT count(*) FROM public.org_auctioneers
      WHERE organization_id = _org AND is_active),
    3, 1240000000,
    19 + 13 + 4 + 13 + 3,
    ARRAY[]::text[];

  -- ─── Hồ sơ nhân sự đã kết xuất ─────────────────────────────────────────────
  INSERT INTO public.personnel_dossier_exports
    (organization_id, auctioneer_id, auctioneer_name, license_number, template, format,
     file_path, file_size_bytes, credits_charged, generated_by, generated_at)
  VALUES
    (_org, _dgv[1], 'Nguyễn Minh Đức', 'HN-DEMO-0088', 'FULL', 'PDF',
     _org || '/exports/ho-so-nguyen-minh-duc.pdf', 486912, 1, _uid, now() - INTERVAL '9 days'),
    (_org, _dgv[2], 'Lê Thị Thu Hà', 'HN-DEMO-0219', 'FULL', 'DOCX',
     _org || '/exports/ho-so-le-thi-thu-ha.docx', 312448, 1, _uid, now() - INTERVAL '4 days'),
    (_org, _dgv[3], 'Trần Quốc Bảo', 'HN-DEMO-0356', 'FULL', 'PDF',
     _org || '/exports/ho-so-tran-quoc-bao.pdf', 441344, 1, _uid, now() - INTERVAL '1 day');

  -- ─── Hồ sơ dự tuyển ────────────────────────────────────────────────────────
  INSERT INTO public.org_applications (
    organization_id, name, status,
    ann_owner_name, ann_asset_description, ann_asset_category, ann_starting_price,
    ann_asset_location, ann_province, ann_deadline, ann_url, ann_number, ann_date,
    cap_score_i, cap_score_ii, cap_score_iv_1_to_4, cap_score_iv_5,
    cap_score_iv_6_to_8, cap_score_iv_9, cap_total_score, cap_warnings, cap_snapshot_at,
    plan_format, plan_reception_plan, plan_participant_conditions,
    plan_anti_collusion_measures, plan_score, section_v_score, total_score,
    export_format, created_at, updated_at
  ) VALUES
  (
    _org, 'Đấu giá QSDĐ 12 thửa Khu đô thị Thanh Hà — đợt 3/2026', 'WON',
    'Trung tâm Phát triển quỹ đất huyện Thanh Oai',
    'Quyền sử dụng đất 12 thửa đất ở tại Khu đô thị Thanh Hà, huyện Thanh Oai, tổng diện tích 1.480 m²',
    'LAND_USE_RIGHT', 96500000000,
    'Khu đô thị Thanh Hà, huyện Thanh Oai', 'Hà Nội',
    DATE '2026-04-10', 'https://dgts.moj.gov.vn/thong-bao/2026-0412', 'TB-2026/0412', DATE '2026-03-27',
    5, 19, 13, 4, 13, 3, 52, ARRAY[]::text[], now() - INTERVAL '120 days',
    'Đấu giá trực tiếp bằng lời nói tại cuộc đấu giá, vòng đấu không hạn chế, bước giá 1% giá khởi điểm.',
    'Tiếp nhận hồ sơ trong giờ hành chính tại trụ sở và chi nhánh; bố trí 02 quầy riêng, có phiếu hẹn và sổ theo dõi; hồ sơ nộp qua bưu điện tính theo dấu bưu cục.',
    'Người tham gia phải nộp tiền đặt trước 20% giá khởi điểm, không thuộc các trường hợp không được đăng ký theo Điều 38 Luật ĐGTS; cam kết về nguồn vốn.',
    'Bốc thăm số báo danh ngay trước cuộc đấu giá; niêm phong điện thoại; ghi hình toàn bộ; công bố kết quả từng vòng; kiểm tra chéo mối quan hệ nhân thân giữa những người tham gia.',
    16, 6, 74,
    'INTEGRATED', now() - INTERVAL '120 days', now() - INTERVAL '96 days'
  ),
  (
    _org, 'Đấu giá tài sản thi hành án — Nhà xưởng Cụm CN Ngọc Hồi', 'SUBMITTED',
    'Cục Thi hành án dân sự thành phố Hà Nội',
    'Quyền sử dụng 3.200 m² đất thuê và nhà xưởng gắn liền với đất tại Cụm công nghiệp Ngọc Hồi, huyện Thanh Trì',
    'ENFORCEMENT', 42800000000,
    'Cụm công nghiệp Ngọc Hồi, huyện Thanh Trì', 'Hà Nội',
    CURRENT_DATE + 12, 'https://dgts.moj.gov.vn/thong-bao/2026-1188', 'TB-2026/1188', CURRENT_DATE - 6,
    5, 19, 13, 4, 13, 3, 52, ARRAY[]::text[], now() - INTERVAL '6 days',
    'Đấu giá trực tuyến trên trang https://daugia.minhduc-auction.vn, thời gian 03 ngày, bước giá 2%.',
    'Nhận hồ sơ trực tiếp tại trụ sở và trực tuyến qua tài khoản trên trang đấu giá; hỗ trợ kỹ thuật qua hotline trong toàn bộ thời gian nhận hồ sơ.',
    'Tiền đặt trước 15% giá khởi điểm nộp vào tài khoản riêng tại BIDV; người tham gia phải có tài khoản đã định danh trên hệ thống.',
    'Hệ thống ẩn danh người trả giá tới khi kết thúc; nhật ký hệ thống lưu vết IP và thiết bị; hậu kiểm mối quan hệ giữa các tài khoản cùng trả giá.',
    16, 6, 74,
    'SEPARATED', now() - INTERVAL '6 days', now() - INTERVAL '2 days'
  ),
  (
    _org, 'Đấu giá 05 xe ô tô thanh lý — Sở Tài chính Hà Nội', 'DRAFT',
    'Sở Tài chính thành phố Hà Nội',
    'Thanh lý 05 xe ô tô công đã hết niên hạn sử dụng',
    'VEHICLE', 1850000000,
    'Kho tài sản công, quận Nam Từ Liêm', 'Hà Nội',
    CURRENT_DATE + 25, NULL, NULL, NULL,
    5, 19, 13, 4, 13, 3, 52, ARRAY['Chưa nhập số thông báo và ngày thông báo mời tham gia'], now() - INTERVAL '1 day',
    '', '', '', '', 0, 0, 52,
    NULL, now() - INTERVAL '1 day', now() - INTERVAL '1 day'
  );

  -- ─── Credit ────────────────────────────────────────────────────────────────
  -- Dùng loại 'admin_grant': trigger credit_transactions_create_order chỉ bắn
  -- với type='purchase', nên seed KHÔNG đẻ ra đơn hàng ảo trong báo cáo doanh thu.
  INSERT INTO public.user_credits (user_id, balance, updated_at)
  VALUES (_uid, 3000, now())
  ON CONFLICT (user_id) DO UPDATE SET balance = 3000, updated_at = now();

  DELETE FROM public.credit_transactions
   WHERE user_id = _uid AND description LIKE '[DEMO]%';

  INSERT INTO public.credit_transactions (user_id, type, description, credit_delta, created_at)
  VALUES
    (_uid, 'admin_grant', '[DEMO] Cấp credit khởi tạo tài khoản demo tổ chức đấu giá', 3003, now() - INTERVAL '10 days'),
    (_uid, 'export_personnel_dossier', '[DEMO] Kết xuất hồ sơ nhân sự — Nguyễn Minh Đức', -1, now() - INTERVAL '9 days'),
    (_uid, 'export_personnel_dossier', '[DEMO] Kết xuất hồ sơ nhân sự — Lê Thị Thu Hà', -1, now() - INTERVAL '4 days'),
    (_uid, 'export_personnel_dossier', '[DEMO] Kết xuất hồ sơ nhân sự — Trần Quốc Bảo', -1, now() - INTERVAL '1 day');

  RAISE NOTICE 'Đã seed tổ chức demo % cho admin@gmail.com', _org;
END $$;
