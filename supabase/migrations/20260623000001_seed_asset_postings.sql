-- Seed dữ liệu mẫu cho asset_postings + asset_service_requests.
-- Gắn vào tài khoản secsosoo@gmail.com để dữ liệu hiển thị trong cổng /chu-tai-san/tai-san.
-- Idempotent: bỏ qua nếu user đã có hồ sơ.
-- Chạy với quyền migration (bypass RLS) nên insert được cho user bất kỳ.

DO $$
DECLARE
  v_user uuid;
  v_org_hcm uuid;
  v_org_hn  uuid;
  v_p1 uuid;
  v_p2 uuid;
  v_p3 uuid;
BEGIN
  -- 1) Chủ tài sản mục tiêu = secsosoo@gmail.com (profiles.id là FK của asset_postings.user_id)
  SELECT id INTO v_user FROM public.profiles WHERE email = 'secsosoo@gmail.com' LIMIT 1;

  IF v_user IS NULL THEN
    RAISE NOTICE 'seed_asset_postings: không tìm thấy profile secsosoo@gmail.com — bỏ qua.';
    RETURN;
  END IF;

  -- Đảm bảo tài khoản là chủ tài sản cá nhân ĐÃ DUYỆT để qua cổng KYC của portal
  -- (OwnerAssetsPage chặn nếu chưa approved → dữ liệu seed sẽ không hiển thị).
  INSERT INTO public.asset_owner_kyc (user_id, status, full_name, submitted_at, reviewed_at)
  VALUES (
    v_user, 'approved',
    COALESCE((SELECT name FROM public.profiles WHERE id = v_user), 'Chủ tài sản demo'),
    now(), now()
  )
  ON CONFLICT (user_id) DO UPDATE SET status = 'approved', reviewed_at = now();

  -- Idempotent
  IF EXISTS (SELECT 1 FROM public.asset_postings WHERE user_id = v_user) THEN
    RAISE NOTICE 'seed_asset_postings: user đã có hồ sơ — bỏ qua.';
    RETURN;
  END IF;

  -- 2) Hai tổ chức để gắn yêu cầu (theo địa bàn)
  SELECT id INTO v_org_hcm FROM public.auction_organizations
    WHERE province = 'TP. Hồ Chí Minh' ORDER BY name LIMIT 1;
  SELECT id INTO v_org_hn FROM public.auction_organizations
    WHERE province = 'Hà Nội' ORDER BY name LIMIT 1;
  -- fallback nếu thiếu
  IF v_org_hcm IS NULL THEN SELECT id INTO v_org_hcm FROM public.auction_organizations ORDER BY name LIMIT 1; END IF;
  IF v_org_hn IS NULL THEN v_org_hn := v_org_hcm; END IF;

  -- 3) Hồ sơ 1 — BĐS / Nhà phố — đã chọn tổ chức (matched)
  INSERT INTO public.asset_postings (
    user_id, parent_slug, child_slug, title, description, province, district, ward, address,
    pricing_mode, starting_price, auction_format, commission_pct, expected_timeline,
    ownership_proof_urls, has_dispute, has_mortgage, is_seized, right_to_sell, legal_notes,
    delta_fields, image_urls, doc_urls, chosen_org_id, status, submitted_at
  ) VALUES (
    v_user, 'bat-dong-san', 'nha-pho',
    'Nhà phố 3 tầng mặt tiền Lê Văn Sỹ, Quận 3',
    'Nhà phố hiện trạng tốt, sổ hồng riêng, vị trí kinh doanh sầm uất.',
    'TP. Hồ Chí Minh', 'Quận 3', 'Phường 12', '215 Lê Văn Sỹ',
    'self', 8500000000, 'ca_hai', 2, 'normal',
    ARRAY['seed/ownership/nha-pho-so-hong.pdf'], false, false, false, true, NULL,
    '{"land_area":68,"floor_area":180,"floors":3,"bedrooms":4,"direction":"dong-nam","legal_book":"so-hong"}'::jsonb,
    '{}', '{}', v_org_hcm, 'matched', now() - interval '5 days'
  ) RETURNING id INTO v_p1;

  INSERT INTO public.asset_service_requests (asset_posting_id, auction_org_id, user_id, status, message, match_score)
  VALUES (v_p1, v_org_hcm, v_user, 'sent', 'Mong tổ chức tư vấn lộ trình đấu giá trong quý này.', 88.50);

  -- 4) Hồ sơ 2 — Xe cộ / Ô tô — đã ký hợp đồng (contracted)
  INSERT INTO public.asset_postings (
    user_id, parent_slug, child_slug, title, description, province, district, ward, address,
    pricing_mode, starting_price, auction_format, commission_pct, expected_timeline,
    ownership_proof_urls, has_dispute, has_mortgage, is_seized, right_to_sell, legal_notes,
    delta_fields, image_urls, doc_urls, chosen_org_id, status, submitted_at
  ) VALUES (
    v_user, 'xe-co', 'o-to',
    'Ô tô Toyota Camry 2.5Q đời 2020',
    'Xe gia đình sử dụng, bảo dưỡng hãng đầy đủ, giấy tờ chính chủ.',
    'TP. Hồ Chí Minh', 'Quận Bình Thạnh', 'Phường 22', '200 Điện Biên Phủ',
    'self', 950000000, 'truc_tiep', 1.5, 'flexible',
    ARRAY['seed/ownership/o-to-dang-ky-xe.pdf'], false, false, false, true, NULL,
    '{"brand":"Toyota Camry 2.5Q","year":2020,"odo":45000,"transmission":"so-tu-dong","color":"Đen"}'::jsonb,
    '{}', '{}', v_org_hcm, 'contracted', now() - interval '12 days'
  ) RETURNING id INTO v_p2;

  INSERT INTO public.asset_service_requests (asset_posting_id, auction_org_id, user_id, status, message, match_score)
  VALUES (v_p2, v_org_hcm, v_user, 'accepted', NULL, 81.00);

  -- 5) Hồ sơ 3 — Hàng hóa / Sắt thép — đã chọn tổ chức (matched), khác địa bàn
  INSERT INTO public.asset_postings (
    user_id, parent_slug, child_slug, title, description, province, district, ward, address,
    pricing_mode, starting_price, auction_format, commission_pct, expected_timeline,
    ownership_proof_urls, has_dispute, has_mortgage, is_seized, right_to_sell, legal_notes,
    delta_fields, image_urls, doc_urls, chosen_org_id, status, submitted_at
  ) VALUES (
    v_user, 'hang-hoa', 'sat-thep',
    'Lô thép xây dựng CB300 tồn kho 120 tấn',
    'Thép thanh vằn CB300, hàng tồn kho cần thanh lý nhanh.',
    'Hà Nội', 'Quận Hoàng Mai', 'Phường Thịnh Liệt', 'KCN Vĩnh Tuy',
    'appraisal', NULL, 'truc_tuyen', 3, 'urgent',
    ARRAY['seed/ownership/sat-thep-hoa-don.pdf'], false, true, false, true, 'Đang trong quá trình giải chấp một phần.',
    '{"steel_grade":"CB300","weight_tons":120,"form":"thanh"}'::jsonb,
    '{}', '{}', v_org_hn, 'matched', now() - interval '2 days'
  ) RETURNING id INTO v_p3;

  INSERT INTO public.asset_service_requests (asset_posting_id, auction_org_id, user_id, status, message, match_score)
  VALUES (v_p3, v_org_hn, v_user, 'seen', 'Ưu tiên đấu giá trực tuyến do cần thanh lý gấp.', 76.25);

  RAISE NOTICE 'seed_asset_postings: đã tạo 3 hồ sơ mẫu cho user %.', v_user;
END $$;
