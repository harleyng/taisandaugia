-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DEMO — lịch sử đấu giá cho tài khoản harleyngx@gmail.com
--
-- Chuyển 30 cuộc từ seed localStorage sang bảng thật, liên kết người điều hành
-- bằng FK auctioneer_id thay vì khớp chuỗi họ tên.
-- KHÔNG tạo tin rao giả: đây là việc cũ, không thuộc sàn.
--
-- Idempotent: xoá bản ghi demo cũ (nhận diện qua auction_number tiền tố 'ĐG-')
-- rồi nạp lại. Guard theo tài khoản nên chạy môi trường khác là no-op.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  _uid UUID; _org UUID; _aorg UUID; _r RECORD; _aid UUID; _n INT := 0;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = 'harleyngx@gmail.com';
  IF _uid IS NULL THEN RAISE NOTICE 'Bỏ qua seed: không có tài khoản'; RETURN; END IF;

  SELECT o.id, (o.license_info->>'auction_org_id')::uuid INTO _org, _aorg
    FROM public.organizations o WHERE o.owner_id = _uid
   ORDER BY o.created_at DESC LIMIT 1;
  IF _org IS NULL THEN RAISE NOTICE 'Bỏ qua seed: chưa có tổ chức'; RETURN; END IF;

  DELETE FROM public.org_auction_records
   WHERE organization_id = _org AND auction_number LIKE 'ĐG-%';

  FOR _r IN
    SELECT * FROM (VALUES
    ('Nguyễn Quang Đại', 14, 'ĐG-2026/087', 'Quyền sử dụng 1.250 m² đất ở tại phường Anh Dũng, quận Dương Kinh', 'LAND_USE_RIGHT', 'Ngân hàng TMCP Công Thương Việt Nam - CN Hải Phòng', 7800000000, 9150000000, true, 11, 24, NULL),
    ('Nguyễn Quang Đại', 96, 'ĐG-2026/049', 'Quyền sử dụng đất và tài sản gắn liền tại xã Lê Lợi, huyện An Dương', 'SECURED_ASSET', 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam - CN Hải Phòng', 12400000000, 13850000000, true, 14, 31, NULL),
    ('Nguyễn Quang Đại', 168, 'ĐG-2025/341', 'Khu đất sản xuất kinh doanh 3.400 m² tại KCN Đình Vũ', 'LAND_USE_RIGHT', 'Ban Quản lý Khu kinh tế Hải Phòng', 21500000000, 24900000000, true, 9, 22, NULL),
    ('Nguyễn Quang Đại', 247, 'ĐG-2025/276', 'Toà nhà văn phòng 5 tầng tại số 88 Điện Biên Phủ, quận Hồng Bàng', 'SECURED_ASSET', 'Ngân hàng TMCP Kỹ Thương Việt Nam', 34800000000, 38200000000, true, 7, 15, NULL),
    ('Nguyễn Quang Đại', 322, 'ĐG-2025/198', 'Quyền sử dụng đất nông nghiệp 8.700 m² tại huyện Vĩnh Bảo', 'LAND_USE_RIGHT', 'UBND huyện Vĩnh Bảo', 3150000000, NULL, false, 0, 0, 'Không có người đăng ký tham gia đấu giá'),
    ('Nguyễn Quang Đại', 415, 'ĐG-2025/104', 'Quyền sử dụng đất ở đô thị 210 m² tại phường Lạch Tray', 'LAND_USE_RIGHT', 'Cục Thi hành án dân sự thành phố Hải Phòng', 5600000000, 6720000000, true, 16, 38, NULL),
    ('Trần Thị Bích Ngọc', 28, 'ĐG-2026/081', 'Nhà ở riêng lẻ 3 tầng, sàn 180 m² tại phường Hàng Kênh, quận Lê Chân', 'REAL_ESTATE', 'Cục Thi hành án dân sự thành phố Hải Phòng', 4200000000, 4980000000, true, 8, 17, NULL),
    ('Trần Thị Bích Ngọc', 139, 'ĐG-2025/298', 'Quyền khai thác mặt bằng kinh doanh tầng 1 chợ Ga trong 5 năm', 'OTHER', 'UBND quận Ngô Quyền', 1850000000, 2260000000, true, 7, 15, NULL),
    ('Trần Thị Bích Ngọc', 205, 'ĐG-2025/312', 'Căn hộ chung cư 92 m² tại toà HH2 khu đô thị Waterfront', 'REAL_ESTATE', 'Ngân hàng TMCP Á Châu - CN Hải Phòng', 2950000000, 3480000000, true, 12, 26, NULL),
    ('Trần Thị Bích Ngọc', 288, 'ĐG-2025/231', 'Nhà xưởng và quyền thuê đất 1.800 m² tại huyện An Dương', 'SECURED_ASSET', 'Ngân hàng TMCP Quân đội - CN Hải Phòng', 9700000000, 10450000000, true, 5, 11, NULL),
    ('Trần Thị Bích Ngọc', 366, 'ĐG-2025/152', 'Biệt thự song lập 240 m² tại khu đô thị Vinhomes Imperia', 'REAL_ESTATE', 'Ngân hàng TMCP Ngoại thương Việt Nam', 15200000000, NULL, false, 0, 0, 'Không có người đăng ký tham gia đấu giá'),
    ('Lê Văn Hùng', 41, 'ĐG-2026/074', 'Xe ô tô con nhãn hiệu Toyota Camry 2.5Q, biển 15A-123.45', 'VEHICLE', 'Cục Thi hành án dân sự thành phố Hải Phòng', 820000000, 985000000, true, 6, 12, NULL),
    ('Lê Văn Hùng', 118, 'ĐG-2025/312', 'Lô 12 xe máy các loại là tang vật tịch thu sung công quỹ nhà nước', 'ENFORCEMENT', 'Công an thành phố Hải Phòng', 268000000, 341000000, true, 22, 48, NULL),
    ('Lê Văn Hùng', 192, 'ĐG-2025/264', 'Xe tải thùng Hyundai HD210 tải trọng 13,5 tấn, biển 15C-678.90', 'VEHICLE', 'Chi cục Thi hành án dân sự quận Hải An', 1140000000, 1372000000, true, 9, 21, NULL),
    ('Lê Văn Hùng', 271, 'ĐG-2025/211', 'Tàu cá vỏ gỗ công suất 420 CV kèm ngư cụ', 'ENFORCEMENT', 'Chi cục Thuỷ sản Hải Phòng', 1980000000, 2245000000, true, 6, 14, NULL),
    ('Lê Văn Hùng', 344, 'ĐG-2025/167', 'Xe ô tô con Mercedes-Benz C200 đã qua sử dụng, biển 15A-888.99', 'VEHICLE', 'Cục Thi hành án dân sự thành phố Hải Phòng', 1450000000, NULL, false, 0, 0, 'Không có người đăng ký tham gia đấu giá'),
    ('Phạm Minh Tuấn', 57, 'ĐG-2026/066', 'Dây chuyền thiết bị cơ khí đã qua sử dụng của Nhà máy đóng tàu Bạch Đằng', 'MACHINERY', 'Tổng công ty Công nghiệp tàu thuỷ', 2350000000, NULL, false, 0, 0, 'Không có người đăng ký tham gia đấu giá'),
    ('Phạm Minh Tuấn', 131, 'ĐG-2025/305', 'Hệ thống máy dệt kim tròn 24 kim và phụ kiện đồng bộ', 'MACHINERY', 'Công ty CP Dệt may Hải Phòng', 4650000000, 5320000000, true, 8, 19, NULL),
    ('Phạm Minh Tuấn', 224, 'ĐG-2025/247', 'Cần trục bánh xích Kobelco 55 tấn sản xuất năm 2016', 'MACHINERY', 'Công ty CP Xây lắp và Thương mại Hải Phòng', 6800000000, 7990000000, true, 10, 25, NULL),
    ('Phạm Minh Tuấn', 301, 'ĐG-2025/189', 'Lô tài sản thi hành án gồm máy phát điện và thiết bị phụ trợ', 'ENFORCEMENT', 'Chi cục Thi hành án dân sự quận Kiến An', 890000000, 1105000000, true, 13, 29, NULL),
    ('Đỗ Thị Hồng Nhung', 73, 'ĐG-2026/058', 'Tang vật vi phạm hành chính: 3.200 kg phế liệu kim loại màu', 'ADMIN_VIOLATION', 'Cục Hải quan thành phố Hải Phòng', 615000000, 742000000, true, 9, 19, NULL),
    ('Đỗ Thị Hồng Nhung', 156, 'ĐG-2025/289', 'Lô hàng điện tử nhập lậu bị tịch thu gồm 480 thiết bị các loại', 'ADMIN_VIOLATION', 'Cục Quản lý thị trường Hải Phòng', 1230000000, 1584000000, true, 18, 41, NULL),
    ('Đỗ Thị Hồng Nhung', 238, 'ĐG-2025/238', 'Tang vật vi phạm: 15 tấn đường kính trắng không rõ nguồn gốc', 'ADMIN_VIOLATION', 'Cục Hải quan thành phố Hải Phòng', 340000000, 428000000, true, 11, 24, NULL),
    ('Đỗ Thị Hồng Nhung', 329, 'ĐG-2025/174', 'Quyền sử dụng kho bãi 600 m² tại phường Đông Hải trong 3 năm', 'OTHER', 'UBND quận Hải An', 780000000, NULL, false, 0, 0, 'Không có người đăng ký tham gia đấu giá'),
    ('Vũ Đình Khánh', 35, 'ĐG-2026/079', 'Quyền thuê ki-ốt kinh doanh số 24 chợ Hàng trong 3 năm', 'OTHER', 'Ban Quản lý chợ Hàng', 420000000, 536000000, true, 14, 30, NULL),
    ('Vũ Đình Khánh', 121, 'ĐG-2025/301', 'Xe ô tô tải Thaco Ollin 3,5 tấn, biển 15C-234.56', 'VEHICLE', 'Chi cục Thi hành án dân sự huyện Thuỷ Nguyên', 385000000, 452000000, true, 7, 16, NULL),
    ('Vũ Đình Khánh', 203, 'ĐG-2025/243', 'Lô thiết bị văn phòng thanh lý của đơn vị hành chính sự nghiệp', 'OTHER', 'Sở Tài chính thành phố Hải Phòng', 168000000, NULL, false, 0, 0, 'Không có người đăng ký tham gia đấu giá'),
    ('Hoàng Thị Lan Anh', 268, 'ĐG-2025/216', 'Nhà ở riêng lẻ 2 tầng tại phường Trại Chuối, quận Hồng Bàng', 'REAL_ESTATE', 'Cục Thi hành án dân sự thành phố Hải Phòng', 2680000000, 3120000000, true, 10, 23, NULL),
    ('Hoàng Thị Lan Anh', 355, 'ĐG-2025/161', 'Căn hộ chung cư 68 m² tại toà A khu tái định cư Đồng Quốc Bình', 'REAL_ESTATE', 'UBND quận Ngô Quyền', 1420000000, 1698000000, true, 15, 34, NULL),
    ('Hoàng Thị Lan Anh', 442, 'ĐG-2025/088', 'Quyền sử dụng đất ở 145 m² tại phường Quán Toan', 'LAND_USE_RIGHT', 'Ngân hàng TMCP Sài Gòn - Hà Nội', 3250000000, NULL, false, 0, 0, 'Không có người đăng ký tham gia đấu giá')
    ) AS t(auctioneer_name, days_ago, auction_number, asset_description,
           asset_category, owner_name, starting_price, winning_price,
           is_successful, participants, bids, failure_reason)
  LOOP
    SELECT id INTO _aid FROM public.org_auctioneers
     WHERE organization_id = _org AND full_name = _r.auctioneer_name LIMIT 1;

    INSERT INTO public.org_auction_records (
      organization_id, auction_org_id, auctioneer_id, source,
      auction_date, auction_number, asset_description, asset_category,
      asset_location, owner_name, contract_number, contract_signed_date,
      starting_price, winning_price, is_successful, failure_reason,
      number_of_participants, number_of_bids
    ) VALUES (
      _org, _aorg, _aid, 'MANUAL',
      CURRENT_DATE - _r.days_ago, _r.auction_number, _r.asset_description,
      _r.asset_category, 'Thành phố Hải Phòng', _r.owner_name,
      'HĐ-' || replace(_r.auction_number, 'ĐG-', ''),
      CURRENT_DATE - _r.days_ago - 30,
      _r.starting_price, _r.winning_price, _r.is_successful, _r.failure_reason,
      _r.participants, _r.bids
    );
    _n := _n + 1;
  END LOOP;

  -- Tin rao đang có trên sàn của chính tổ chức này cũng là lịch sử đấu giá.
  -- Gắn listing_id để không nhân đôi khi import lại.
  INSERT INTO public.org_auction_records (
    organization_id, auction_org_id, listing_id, source,
    auction_date, asset_description, asset_category, owner_name,
    starting_price, winning_price, is_successful
  )
  SELECT _org, _aorg, l.id, 'LISTING',
         COALESCE(l.created_at::date, CURRENT_DATE), l.title, 'OTHER', '',
         l.price, CASE WHEN l.status = 'SOLD_RENTED' THEN l.price END,
         l.status = 'SOLD_RENTED'
    FROM public.listings l
   WHERE l.auction_org_id = _aorg
  ON CONFLICT (organization_id, listing_id) DO NOTHING;

  -- Cho phép khoe chỉ số ở bản công khai với những người đã bật công khai.
  UPDATE public.org_auctioneers
     SET show_public_stats = true
   WHERE organization_id = _org AND is_public_profile;

  RAISE NOTICE 'Đã nạp % cuộc đấu giá lịch sử', _n;
END $$;
