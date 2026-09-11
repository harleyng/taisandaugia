-- Dữ liệu demo XUYÊN LUỒNG: số hoá tài sản → RFQ & báo giá → hợp đồng dịch vụ →
-- phiên đấu giá → tiếp thị phiên → hỗ trợ khách hàng (hỏi đáp / Zalo).
--
-- Sinh tự động bởi script (engine thật của app: generateOutreach, composeDirectMessage,
-- answerCaseQuestion) — ĐỪNG sửa tay văn bản tiếp thị/trích dẫn: chữ ký input_signature
-- và câu trả lời AI phải khớp với engine, sửa tay là trang Tiếp thị báo "bản nháp đã cũ".
-- File đính kèm (ảnh, PDF) nạp bằng scripts/seed-flow-demo-assets.py — đường dẫn khớp tuyệt đối.
--
-- Vai trò: chủ tài sản secsosoo@gmail.com · tổ chức harleyngx@gmail.com (Bảo Tín + 4 tổ chức
-- demo) · người mua 09123456789 / 09123456788. Phiên PDG000012 ĐÃ CÔNG BỐ, tiêu đề "[DEMO]".
-- Không sinh doanh thu: không có orders, cơ hội CRM ở stage 'selling'.
--
-- Mọi dòng mới có id tiền tố f10d. Gỡ bộ demo (chạy tay):
--   DELETE FROM public.chat_conversations        WHERE id::text LIKE 'f10d000a-%';
--   DELETE FROM public.auction_bidding_contracts WHERE id::text LIKE 'f10d0008-%';
--   DELETE FROM public.auction_sessions          WHERE id = 'f10d0006-0000-4000-8000-000000000001';
--   DELETE FROM public.user_verified_identities  WHERE user_id = '957b8823-9a29-424d-a0fb-6f859590e236' AND id_number = '079088001234';
--   DELETE FROM public.consignment_contracts     WHERE id = 'f10d0004-0000-4000-8000-000000000001';
--   DELETE FROM public.opportunities             WHERE id = 'f10d0005-0000-4000-8000-000000000002';
--   DELETE FROM public.leads                     WHERE id = 'f10d0005-0000-4000-8000-000000000001';
--   DELETE FROM public.asset_broker_requests     WHERE id::text LIKE 'f10d0003-%';
--   DELETE FROM public.asset_service_requests    WHERE id::text LIKE 'f10d0002-%';
--   DELETE FROM public.asset_postings            WHERE id::text LIKE 'f10d0001-%';
--   rồi: python3 scripts/seed-flow-demo-assets.py --teardown
--
-- Bẫy đã né (xem .agents/knowledge/common-pitfalls.md):
--   • asset_postings chỉ INSERT (review guard nuốt UPDATE của caller không có quyền approve).
--   • Yêu cầu anh em chèn TRƯỚC yêu cầu 'selected' (trigger chặn chèn sau khi chốt).
--   • Hợp đồng chèn thẳng 'signed' (guard khoá hợp đồng đã ký).
--   • Mã phiên cố định vì chữ ký tiếp thị chứa mã phiên ⇒ tắt auction_sessions_fill lúc chèn.
--   • RPC tiếp thị / hỏi đáp được gọi THẬT dưới danh tính người dùng (request.jwt.claims),
--     sau đó lùi mốc thời gian.

DO $seed$
DECLARE
  v_pack UUID;
  v_esc  UUID;
  v_segs TEXT[];
  v_bad  INT;
BEGIN
  IF EXISTS (SELECT 1 FROM public.asset_postings WHERE id = 'f10d0001-0000-4000-8000-000000000001') THEN
    RAISE NOTICE 'Bộ demo luồng đã có — bỏ qua.';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = 'c9d00002-0000-4000-8000-000000000001' AND kyc_status = 'APPROVED') THEN
    RAISE NOTICE 'Không có tổ chức Bảo Tín — bỏ qua seed.';
    RETURN;
  END IF;

  -- ── 0. Gỡ phiên thử nghiệm cũ PDG000010 (chưa có hồ sơ/hội thoại/gói tiếp thị bám vào) ──
  DELETE FROM public.auction_sessions WHERE id = 'af5b80fd-f5bf-4e92-a8df-b5bf7c9f2432';

  -- ── 0b. Dữ liệu bên của hợp đồng ──
  UPDATE public.asset_owner_kyc
     SET full_name = 'Nguyễn Hoàng Long', phone = '0903456789', phone_verified = true,
         contact_email = 'secsosoo@gmail.com', id_type = 'cccd', id_number = '079085012345',
         address = '45 Nguyễn Văn Thủ', ward = 'Phường Đa Kao', province = 'TP. Hồ Chí Minh'
   WHERE user_id = 'ae9bfef5-2694-466f-a97e-5efdf138ac43';
  UPDATE public.profiles SET name = 'Nguyễn Hoàng Long' WHERE id = 'ae9bfef5-2694-466f-a97e-5efdf138ac43' AND COALESCE(name, '') IN ('', '123');

  -- Bảo Tín: dòng thông tin chung đang chép nhầm của chi nhánh Hải Phòng.
  UPDATE public.org_general_info
     SET name = 'Công ty Đấu giá Hợp danh Bảo Tín', address = '88 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
         province = 'TP. Hồ Chí Minh', phone = '028 3822 5566', email = 'contact@baotin-auction.vn',
         tax_code = '0316789012', legal_rep_name = 'Lâm Gia Tín', legal_rep_position = 'Giám đốc'
   WHERE organization_id = 'c9d00002-0000-4000-8000-000000000001';
  INSERT INTO public.org_general_info (organization_id, name, org_type, address, province, phone, email, legal_rep_name, legal_rep_position)
  SELECT o.id, a.name, 'CONG_TY_HOP_DANH', COALESCE(a.address, ''), COALESCE(a.province, ''), COALESCE(a.phone, ''), COALESCE(a.email, ''), 'Đỗ Minh Khang', 'Giám đốc'
    FROM public.organizations o JOIN public.auction_organizations a ON a.id = o.auction_org_id
   WHERE o.id = 'c9d00002-0000-4000-8000-000000000002'
  ON CONFLICT (organization_id) DO UPDATE
    SET legal_rep_name     = COALESCE(NULLIF(public.org_general_info.legal_rep_name, ''), EXCLUDED.legal_rep_name),
        legal_rep_position = COALESCE(NULLIF(public.org_general_info.legal_rep_position, ''), EXCLUDED.legal_rep_position);
  INSERT INTO public.org_general_info (organization_id, name, org_type, address, province, phone, email, legal_rep_name, legal_rep_position)
  SELECT o.id, a.name, 'CONG_TY_HOP_DANH', COALESCE(a.address, ''), COALESCE(a.province, ''), COALESCE(a.phone, ''), COALESCE(a.email, ''), 'Vũ Thành Đạt', 'Giám đốc'
    FROM public.organizations o JOIN public.auction_organizations a ON a.id = o.auction_org_id
   WHERE o.id = 'c9d00002-0000-4000-8000-000000000010'
  ON CONFLICT (organization_id) DO UPDATE
    SET legal_rep_name     = COALESCE(NULLIF(public.org_general_info.legal_rep_name, ''), EXCLUDED.legal_rep_name),
        legal_rep_position = COALESCE(NULLIF(public.org_general_info.legal_rep_position, ''), EXCLUDED.legal_rep_position);
  INSERT INTO public.org_general_info (organization_id, name, org_type, address, province, phone, email, legal_rep_name, legal_rep_position)
  SELECT o.id, a.name, 'DN_TU_NHAN', COALESCE(a.address, ''), COALESCE(a.province, ''), COALESCE(a.phone, ''), COALESCE(a.email, ''), 'Hồ Phú Quý', 'Chủ doanh nghiệp'
    FROM public.organizations o JOIN public.auction_organizations a ON a.id = o.auction_org_id
   WHERE o.id = 'c9d00002-0000-4000-8000-000000000016'
  ON CONFLICT (organization_id) DO UPDATE
    SET legal_rep_name     = COALESCE(NULLIF(public.org_general_info.legal_rep_name, ''), EXCLUDED.legal_rep_name),
        legal_rep_position = COALESCE(NULLIF(public.org_general_info.legal_rep_position, ''), EXCLUDED.legal_rep_position);
  INSERT INTO public.org_general_info (organization_id, name, org_type, address, province, phone, email, legal_rep_name, legal_rep_position)
  SELECT o.id, a.name, 'DN_TU_NHAN', COALESCE(a.address, ''), COALESCE(a.province, ''), COALESCE(a.phone, ''), COALESCE(a.email, ''), 'Đặng Trường An', 'Chủ doanh nghiệp'
    FROM public.organizations o JOIN public.auction_organizations a ON a.id = o.auction_org_id
   WHERE o.id = 'c9d00002-0000-4000-8000-000000000005'
  ON CONFLICT (organization_id) DO UPDATE
    SET legal_rep_name     = COALESCE(NULLIF(public.org_general_info.legal_rep_name, ''), EXCLUDED.legal_rep_name),
        legal_rep_position = COALESCE(NULLIF(public.org_general_info.legal_rep_position, ''), EXCLUDED.legal_rep_position);

  -- ── 1. Số hoá tài sản ──
  INSERT INTO public.asset_postings (
    id, user_id, parent_slug, child_slug, title, description, province, district, ward, address,
    pricing_mode, starting_price, auction_format, expected_timeline, ownership_proof_urls,
    has_dispute, has_mortgage, is_seized, right_to_sell, legal_notes, delta_fields, image_urls,
    status, review_status, reviewed_at, reviewed_by, submitted_at, ownership_declaration, created_at, updated_at
  ) VALUES (
    'f10d0001-0000-4000-8000-000000000001', 'ae9bfef5-2694-466f-a97e-5efdf138ac43', 'bat-dong-san', 'nha-pho', 'Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10', 'Nhà phố 4 tầng kết cấu bê tông cốt thép, mặt tiền đường Tô Hiến Thành rộng 12 m, cách Vạn Hạnh Mall 600 m. Tầng trệt đang cho thuê kinh doanh (hợp đồng thuê đến 31/12/2026), 3 tầng trên để ở, sân thượng rộng. Sổ hồng riêng, hoàn công đầy đủ.', 'TP. Hồ Chí Minh', 'Quận 10', 'Phường 15', '312 Tô Hiến Thành',
    'self', 12800000000, 'truc_tiep', 'normal', ARRAY['ae9bfef5-2694-466f-a97e-5efdf138ac43/ownership/f10d000c-0000-4000-8000-000000000001.pdf']::text[],
    false, false, false, true, 'Tầng trệt đang cho thuê; bên thuê cam kết bàn giao mặt bằng trước ngày 31/12/2026 nếu người mua không tiếp nhận hợp đồng thuê.', '{"land_area":72,"floor_area":268,"floors":4,"bedrooms":5,"direction":"dong-nam","legal_book":"so-hong"}'::jsonb, ARRAY['https://vewtnkewyawmkpeymdot.supabase.co/storage/v1/object/public/asset-media/ae9bfef5-2694-466f-a97e-5efdf138ac43/f10d000d-0000-4000-8000-000000000001.png', 'https://vewtnkewyawmkpeymdot.supabase.co/storage/v1/object/public/asset-media/ae9bfef5-2694-466f-a97e-5efdf138ac43/f10d000d-0000-4000-8000-000000000002.png', 'https://vewtnkewyawmkpeymdot.supabase.co/storage/v1/object/public/asset-media/ae9bfef5-2694-466f-a97e-5efdf138ac43/f10d000d-0000-4000-8000-000000000003.png']::text[],
    'active', 'approved', '2026-08-18T07:00:00+00:00'::timestamptz, '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-08-17T02:40:00+00:00'::timestamptz,
    '{"name":"Nguyễn Hoàng Long","accepted_at":"2026-08-17T02:40:00+00:00","version":"2026-09-06"}'::jsonb, '2026-08-17T02:12:00+00:00'::timestamptz, '2026-08-18T07:00:00+00:00'::timestamptz
  );
  INSERT INTO public.asset_postings (
    id, user_id, parent_slug, child_slug, title, description, province, district, ward, address,
    pricing_mode, starting_price, auction_format, expected_timeline, ownership_proof_urls,
    has_dispute, has_mortgage, is_seized, right_to_sell, legal_notes, delta_fields, image_urls,
    status, review_status, reviewed_at, reviewed_by, submitted_at, ownership_declaration, created_at, updated_at
  ) VALUES (
    'f10d0001-0000-4000-8000-000000000002', 'ae9bfef5-2694-466f-a97e-5efdf138ac43', 'xe-co', 'o-to', 'Mercedes-Benz GLC 300 4MATIC 2021, màu trắng', 'Xe chính chủ, đi 38.500 km, bảo dưỡng định kỳ tại hãng, không đâm đụng, không ngập nước. Đăng kiểm còn hạn đến 03/2027.', 'TP. Hồ Chí Minh', 'Quận 7', NULL, NULL,
    'self', 1650000000, 'truc_tuyen', 'urgent', ARRAY['ae9bfef5-2694-466f-a97e-5efdf138ac43/ownership/f10d000c-0000-4000-8000-000000000002.pdf']::text[],
    false, false, false, true, NULL, '{"brand":"Mercedes-Benz GLC 300 4MATIC","year":2021,"odo":38500,"transmission":"so-tu-dong","color":"Trắng"}'::jsonb, ARRAY['https://vewtnkewyawmkpeymdot.supabase.co/storage/v1/object/public/asset-media/ae9bfef5-2694-466f-a97e-5efdf138ac43/f10d000d-0000-4000-8000-000000000004.png', 'https://vewtnkewyawmkpeymdot.supabase.co/storage/v1/object/public/asset-media/ae9bfef5-2694-466f-a97e-5efdf138ac43/f10d000d-0000-4000-8000-000000000005.png']::text[],
    'active', 'approved', '2026-09-08T08:00:00+00:00'::timestamptz, '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-08T03:45:00+00:00'::timestamptz,
    '{"name":"Nguyễn Hoàng Long","accepted_at":"2026-09-08T03:45:00+00:00","version":"2026-09-06"}'::jsonb, '2026-09-08T03:20:00+00:00'::timestamptz, '2026-09-08T08:00:00+00:00'::timestamptz
  );
  INSERT INTO public.asset_postings (
    id, user_id, parent_slug, child_slug, title, description, province, district, ward, address,
    pricing_mode, starting_price, auction_format, expected_timeline, ownership_proof_urls,
    has_dispute, has_mortgage, is_seized, right_to_sell, legal_notes, delta_fields, image_urls,
    status, review_status, reviewed_at, reviewed_by, submitted_at, ownership_declaration, created_at, updated_at
  ) VALUES (
    'f10d0001-0000-4000-8000-000000000003', 'ae9bfef5-2694-466f-a97e-5efdf138ac43', 'bat-dong-san', 'dat-o', 'Đất ở 120 m² hẻm xe hơi Long Trường, TP. Thủ Đức', 'Lô đất vuông vức 6 x 20 m, hẻm xe hơi 5 m thông ra đường Nguyễn Duy Trinh, khu dân cư hiện hữu. Chủ tài sản muốn thẩm định giá trước khi đấu giá.', 'TP. Hồ Chí Minh', 'TP. Thủ Đức', 'Phường Long Trường', NULL,
    'appraisal', 5400000000, 'truc_tiep', 'flexible', ARRAY['ae9bfef5-2694-466f-a97e-5efdf138ac43/ownership/f10d000c-0000-4000-8000-000000000003.pdf']::text[],
    false, false, false, true, NULL, '{"area":120,"frontage":6,"road_width":5,"direction":"nam","legal_book":"so-hong"}'::jsonb, '{}'::text[],
    'active', 'approved', '2026-09-09T04:00:00+00:00'::timestamptz, '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-09T02:00:00+00:00'::timestamptz,
    '{"name":"Nguyễn Hoàng Long","accepted_at":"2026-09-09T02:00:00+00:00","version":"2026-09-06"}'::jsonb, '2026-09-09T01:30:00+00:00'::timestamptz, '2026-09-09T04:00:00+00:00'::timestamptz
  );
  INSERT INTO public.asset_postings (
    id, user_id, parent_slug, child_slug, title, description, province, district, ward, address,
    pricing_mode, starting_price, auction_format, expected_timeline, ownership_proof_urls,
    has_dispute, has_mortgage, is_seized, right_to_sell, legal_notes, delta_fields, image_urls,
    status, review_status, reviewed_at, reviewed_by, submitted_at, ownership_declaration, created_at, updated_at
  ) VALUES (
    'f10d0001-0000-4000-8000-000000000004', 'ae9bfef5-2694-466f-a97e-5efdf138ac43', 'may-moc', 'may-cong-trinh', 'Máy xúc bánh xích Komatsu PC200-8 đời 2016', 'Máy hoạt động bình thường, 14.200 giờ vận hành, gầu 0,8 m³, đã thay dàn xích năm 2025. Đang để tại bãi ở Thuận An, Bình Dương.', 'Bình Dương', 'TP. Thuận An', NULL, NULL,
    'self', 1150000000, 'truc_tuyen', 'normal', ARRAY['ae9bfef5-2694-466f-a97e-5efdf138ac43/ownership/f10d000c-0000-4000-8000-000000000004.pdf']::text[],
    false, false, false, true, NULL, '{"machine_type":"Máy xúc bánh xích","brand":"Komatsu","year":2016,"op_hours":14200,"condition":"da-qua-su-dung"}'::jsonb, ARRAY['https://vewtnkewyawmkpeymdot.supabase.co/storage/v1/object/public/asset-media/ae9bfef5-2694-466f-a97e-5efdf138ac43/f10d000d-0000-4000-8000-000000000006.png']::text[],
    'active', 'pending', NULL, NULL, '2026-09-10T14:30:00+00:00'::timestamptz,
    '{"name":"Nguyễn Hoàng Long","accepted_at":"2026-09-10T14:30:00+00:00","version":"2026-09-06"}'::jsonb, '2026-09-10T14:00:00+00:00'::timestamptz, '2026-09-10T14:30:00+00:00'::timestamptz
  );

  -- ── 2. Nhờ sàn chọn giúp (tài sản C) ──
  INSERT INTO public.asset_broker_requests (id, asset_posting_id, user_id, status, note, admin_note, assigned_admin_id, created_at, updated_at)
  VALUES ('f10d0003-0000-4000-8000-000000000001', 'f10d0001-0000-4000-8000-000000000003', 'ae9bfef5-2694-466f-a97e-5efdf138ac43', 'sourcing', 'Tôi chưa rõ nên chọn tổ chức nào, nhờ sàn tư vấn giúp.',
          'Đã gửi 2 tổ chức có kinh nghiệm đất ở TP. Hồ Chí Minh, chờ báo giá.', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-09T04:30:00+00:00'::timestamptz, '2026-09-09T07:00:00+00:00'::timestamptz);

  -- ── 2b. Yêu cầu & báo giá (fee/lead time suy ra đúng công thức của org_respond_service_request) ──
  INSERT INTO public.asset_service_requests (
    id, asset_posting_id, auction_org_id, organization_id, user_id, status, origin, broker_request_id, message, match_score,
    seen_at, responded_by, decline_reason, quote_commission_pct, quote_service_fee, quote_starting_price, quote_lead_time_days,
    quote_note, quote_plan, quote_fee_items, quoted_at, created_at, updated_at
  ) VALUES (
    'f10d0002-0000-4000-8000-000000000001', 'f10d0001-0000-4000-8000-000000000001', 'a0d90002-0000-4000-8000-000000000002', 'c9d00002-0000-4000-8000-000000000002', 'ae9bfef5-2694-466f-a97e-5efdf138ac43', 'declined', 'owner', NULL, 'Nhờ quý công ty báo giá dịch vụ tổ chức đấu giá căn nhà phố Tô Hiến Thành. Tôi mong phiên được tổ chức trong khoảng 45–60 ngày.', 71.5,
    '2026-08-19T02:10:00+00:00'::timestamptz, '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', 'Hiện đã kín lịch tổ chức phiên tại TP. Hồ Chí Minh đến hết tháng 10/2026.', NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, '2026-08-18T09:05:00+00:00'::timestamptz, '2026-08-19T02:30:00+00:00'::timestamptz
  );
  INSERT INTO public.asset_service_requests (
    id, asset_posting_id, auction_org_id, organization_id, user_id, status, origin, broker_request_id, message, match_score,
    seen_at, responded_by, decline_reason, quote_commission_pct, quote_service_fee, quote_starting_price, quote_lead_time_days,
    quote_note, quote_plan, quote_fee_items, quoted_at, created_at, updated_at
  ) VALUES (
    'f10d0002-0000-4000-8000-000000000002', 'f10d0001-0000-4000-8000-000000000001', 'a0d90002-0000-4000-8000-000000000016', 'c9d00002-0000-4000-8000-000000000016', 'ae9bfef5-2694-466f-a97e-5efdf138ac43', 'seen', 'owner', NULL, 'Nhờ quý công ty báo giá dịch vụ tổ chức đấu giá căn nhà phố Tô Hiến Thành. Tôi mong phiên được tổ chức trong khoảng 45–60 ngày.', 68,
    '2026-08-19T07:00:00+00:00'::timestamptz, NULL, NULL, NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, '2026-08-18T09:05:00+00:00'::timestamptz, '2026-08-24T03:30:00+00:00'::timestamptz
  );
  INSERT INTO public.asset_service_requests (
    id, asset_posting_id, auction_org_id, organization_id, user_id, status, origin, broker_request_id, message, match_score,
    seen_at, responded_by, decline_reason, quote_commission_pct, quote_service_fee, quote_starting_price, quote_lead_time_days,
    quote_note, quote_plan, quote_fee_items, quoted_at, created_at, updated_at
  ) VALUES (
    'f10d0002-0000-4000-8000-000000000003', 'f10d0001-0000-4000-8000-000000000001', 'a0d90002-0000-4000-8000-000000000010', 'c9d00002-0000-4000-8000-000000000010', 'ae9bfef5-2694-466f-a97e-5efdf138ac43', 'quoted', 'owner', NULL, 'Nhờ quý công ty báo giá dịch vụ tổ chức đấu giá căn nhà phố Tô Hiến Thành. Tôi mong phiên được tổ chức trong khoảng 45–60 ngày.', 82.4,
    '2026-08-20T02:00:00+00:00'::timestamptz, '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', NULL, 1, 55000000, 12800000000, 50,
    'Đề xuất đấu giá kết hợp trực tuyến để mở rộng người tham gia ngoài TP. Hồ Chí Minh.', '{"auction_format":"ca_hai","price_step":150000000,"deposit_mode":"percent","deposit_value":15,"venue":"Khách sạn Riverside, 18 Tôn Đức Thắng, Quận 1, TP. Hồ Chí Minh","channels":["cong_tsdg","bao_in","website_tc","mxh"],"channels_other":null,"milestones":{"tham_dinh":7,"niem_yet":12,"ban_ho_so":15,"mo_phien":50},"scope_included":["ho_so","niem_yet","dau_gia_vien","thu_tuc"],"scope_excluded":["tham_dinh_gia","van_chuyen"]}'::jsonb, '[{"key":"phi_ho_so","label":"Phí lập hồ sơ","amount":8000000,"optional":false},{"key":"phi_niem_yet","label":"Phí niêm yết & thông báo","amount":12000000,"optional":false},{"key":"phi_to_chuc","label":"Phí tổ chức phiên","amount":35000000,"optional":false},{"key":"phi_tham_dinh","label":"Phí thẩm định giá","amount":18000000,"optional":true}]'::jsonb, '2026-08-21T03:20:00+00:00'::timestamptz, '2026-08-18T09:05:00+00:00'::timestamptz, '2026-08-24T03:30:00+00:00'::timestamptz
  );
  INSERT INTO public.asset_service_requests (
    id, asset_posting_id, auction_org_id, organization_id, user_id, status, origin, broker_request_id, message, match_score,
    seen_at, responded_by, decline_reason, quote_commission_pct, quote_service_fee, quote_starting_price, quote_lead_time_days,
    quote_note, quote_plan, quote_fee_items, quoted_at, created_at, updated_at
  ) VALUES (
    'f10d0002-0000-4000-8000-000000000004', 'f10d0001-0000-4000-8000-000000000001', 'a2222222-2222-2222-2222-222222222222', 'c9d00002-0000-4000-8000-000000000001', 'ae9bfef5-2694-466f-a97e-5efdf138ac43', 'quoted', 'owner', NULL, 'Nhờ quý công ty báo giá dịch vụ tổ chức đấu giá căn nhà phố Tô Hiến Thành. Tôi mong phiên được tổ chức trong khoảng 45–60 ngày.', 88.6,
    '2026-08-19T01:45:00+00:00'::timestamptz, '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', NULL, 0.8, 60000000, 12800000000, 45,
    'Đã bao gồm thẩm định giá độc lập. Bảo Tín tổ chức 32 phiên nhà phố tại TP. Hồ Chí Minh trong năm 2025.', '{"auction_format":"truc_tiep","price_step":100000000,"deposit_mode":"percent","deposit_value":10,"venue":"Hội trường Công ty Đấu giá Hợp danh Bảo Tín, 88 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh","channels":["cong_tsdg","bao_in","website_tc","san_tsdg"],"channels_other":null,"milestones":{"tham_dinh":5,"niem_yet":10,"ban_ho_so":12,"mo_phien":45},"scope_included":["ho_so","niem_yet","dau_gia_vien","thu_tuc","tham_dinh_gia"],"scope_excluded":["van_chuyen"]}'::jsonb, '[{"key":"phi_ho_so","label":"Phí lập hồ sơ","amount":6000000,"optional":false},{"key":"phi_niem_yet","label":"Phí niêm yết & thông báo","amount":9000000,"optional":false},{"key":"phi_tham_dinh","label":"Phí thẩm định giá","amount":15000000,"optional":false},{"key":"phi_to_chuc","label":"Phí tổ chức phiên","amount":30000000,"optional":false},{"key":"khac","label":"Chụp ảnh, quay video tài sản","amount":4000000,"optional":true}]'::jsonb, '2026-08-20T08:45:00+00:00'::timestamptz, '2026-08-18T09:05:00+00:00'::timestamptz, '2026-08-24T03:30:00+00:00'::timestamptz
  );
  INSERT INTO public.asset_service_requests (
    id, asset_posting_id, auction_org_id, organization_id, user_id, status, origin, broker_request_id, message, match_score,
    seen_at, responded_by, decline_reason, quote_commission_pct, quote_service_fee, quote_starting_price, quote_lead_time_days,
    quote_note, quote_plan, quote_fee_items, quoted_at, created_at, updated_at
  ) VALUES (
    'f10d0002-0000-4000-8000-000000000005', 'f10d0001-0000-4000-8000-000000000002', 'a0d90002-0000-4000-8000-000000000010', 'c9d00002-0000-4000-8000-000000000010', 'ae9bfef5-2694-466f-a97e-5efdf138ac43', 'quoted', 'owner', NULL, 'Xe cần bán gấp trong tháng 10, nhờ quý công ty báo giá đấu giá trực tuyến.', 84,
    '2026-09-09T01:30:00+00:00'::timestamptz, '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', NULL, 1.5, 19000000, 1650000000, 25,
    'Phiên trực tuyến 100%, người mua xem xe theo lịch hẹn tại Quận 7.', '{"auction_format":"truc_tuyen","price_step":20000000,"deposit_mode":"percent","deposit_value":10,"venue":"Trực tuyến tại website đấu giá của Thành Đạt","channels":["cong_tsdg","website_tc","mxh"],"channels_other":null,"milestones":{"niem_yet":5,"ban_ho_so":7,"mo_phien":25},"scope_included":["ho_so","niem_yet","dau_gia_vien","thu_tuc"],"scope_excluded":["van_chuyen","tham_dinh_gia"]}'::jsonb, '[{"key":"phi_ho_so","label":"Phí lập hồ sơ","amount":3000000,"optional":false},{"key":"phi_niem_yet","label":"Phí niêm yết & thông báo","amount":4000000,"optional":false},{"key":"phi_to_chuc","label":"Phí tổ chức phiên","amount":12000000,"optional":false}]'::jsonb, '2026-09-09T09:00:00+00:00'::timestamptz, '2026-09-08T09:00:00+00:00'::timestamptz, '2026-09-09T09:00:00+00:00'::timestamptz
  );
  INSERT INTO public.asset_service_requests (
    id, asset_posting_id, auction_org_id, organization_id, user_id, status, origin, broker_request_id, message, match_score,
    seen_at, responded_by, decline_reason, quote_commission_pct, quote_service_fee, quote_starting_price, quote_lead_time_days,
    quote_note, quote_plan, quote_fee_items, quoted_at, created_at, updated_at
  ) VALUES (
    'f10d0002-0000-4000-8000-000000000006', 'f10d0001-0000-4000-8000-000000000002', 'a0d90002-0000-4000-8000-000000000016', 'c9d00002-0000-4000-8000-000000000016', 'ae9bfef5-2694-466f-a97e-5efdf138ac43', 'quoted', 'owner', NULL, 'Xe cần bán gấp trong tháng 10, nhờ quý công ty báo giá đấu giá trực tuyến.', 76.3,
    '2026-09-09T03:00:00+00:00'::timestamptz, '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', NULL, NULL, 19500000, 1600000000, 30,
    'Đề xuất hạ giá khởi điểm còn 1,6 tỷ theo mặt bằng giá GLC 2021 để tăng số người đăng ký.', '{"auction_format":"ca_hai","price_step":25000000,"deposit_mode":"amount","deposit_value":200000000,"venue":"Văn phòng Phú Quý tại TP. Hồ Chí Minh, 25 Nguyễn Hữu Thọ, Quận 7","channels":["cong_tsdg","bao_in","san_tsdg"],"channels_other":null,"milestones":{"tham_dinh":4,"niem_yet":8,"ban_ho_so":10,"mo_phien":30},"scope_included":["ho_so","niem_yet","dau_gia_vien","thu_tuc","tham_dinh_gia"],"scope_excluded":[]}'::jsonb, '[{"key":"phi_ho_so","label":"Phí lập hồ sơ","amount":3500000,"optional":false},{"key":"phi_tham_dinh","label":"Phí thẩm định giá","amount":6000000,"optional":false},{"key":"phi_to_chuc","label":"Phí tổ chức phiên","amount":10000000,"optional":false},{"key":"khac","label":"Lưu bãi xe đến ngày đấu giá","amount":3000000,"optional":true}]'::jsonb, '2026-09-10T02:30:00+00:00'::timestamptz, '2026-09-08T09:00:00+00:00'::timestamptz, '2026-09-10T02:30:00+00:00'::timestamptz
  );
  INSERT INTO public.asset_service_requests (
    id, asset_posting_id, auction_org_id, organization_id, user_id, status, origin, broker_request_id, message, match_score,
    seen_at, responded_by, decline_reason, quote_commission_pct, quote_service_fee, quote_starting_price, quote_lead_time_days,
    quote_note, quote_plan, quote_fee_items, quoted_at, created_at, updated_at
  ) VALUES (
    'f10d0002-0000-4000-8000-000000000007', 'f10d0001-0000-4000-8000-000000000002', 'a0d90002-0000-4000-8000-000000000005', 'c9d00002-0000-4000-8000-000000000005', 'ae9bfef5-2694-466f-a97e-5efdf138ac43', 'quoted', 'owner', NULL, 'Xe cần bán gấp trong tháng 10, nhờ quý công ty báo giá đấu giá trực tuyến.', 69.8,
    '2026-09-10T01:00:00+00:00'::timestamptz, '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', NULL, 2, 15000000, 1650000000, 21,
    'Trụ sở ở Hải Phòng, tổ chức trực tuyến nên không phát sinh chi phí đi lại.', '{"auction_format":"truc_tuyen","price_step":15000000,"deposit_mode":"percent","deposit_value":20,"venue":"Trực tuyến","channels":["cong_tsdg","website_tc"],"channels_other":null,"milestones":{"niem_yet":7,"ban_ho_so":10,"mo_phien":21},"scope_included":["ho_so","niem_yet","dau_gia_vien"],"scope_excluded":["thu_tuc","van_chuyen","tham_dinh_gia"]}'::jsonb, '[{"key":"phi_to_chuc","label":"Phí tổ chức phiên","amount":15000000,"optional":false}]'::jsonb, '2026-09-10T10:10:00+00:00'::timestamptz, '2026-09-08T09:00:00+00:00'::timestamptz, '2026-09-10T10:10:00+00:00'::timestamptz
  );
  INSERT INTO public.asset_service_requests (
    id, asset_posting_id, auction_org_id, organization_id, user_id, status, origin, broker_request_id, message, match_score,
    seen_at, responded_by, decline_reason, quote_commission_pct, quote_service_fee, quote_starting_price, quote_lead_time_days,
    quote_note, quote_plan, quote_fee_items, quoted_at, created_at, updated_at
  ) VALUES (
    'f10d0002-0000-4000-8000-000000000008', 'f10d0001-0000-4000-8000-000000000003', 'a2222222-2222-2222-2222-222222222222', 'c9d00002-0000-4000-8000-000000000001', 'ae9bfef5-2694-466f-a97e-5efdf138ac43', 'seen', 'platform', 'f10d0003-0000-4000-8000-000000000001', NULL, 80.2,
    '2026-09-10T01:45:00+00:00'::timestamptz, NULL, NULL, NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, '2026-09-09T07:00:00+00:00'::timestamptz, '2026-09-10T01:45:00+00:00'::timestamptz
  );
  INSERT INTO public.asset_service_requests (
    id, asset_posting_id, auction_org_id, organization_id, user_id, status, origin, broker_request_id, message, match_score,
    seen_at, responded_by, decline_reason, quote_commission_pct, quote_service_fee, quote_starting_price, quote_lead_time_days,
    quote_note, quote_plan, quote_fee_items, quoted_at, created_at, updated_at
  ) VALUES (
    'f10d0002-0000-4000-8000-000000000009', 'f10d0001-0000-4000-8000-000000000003', 'a0d90002-0000-4000-8000-000000000010', NULL, 'ae9bfef5-2694-466f-a97e-5efdf138ac43', 'sent', 'platform', 'f10d0003-0000-4000-8000-000000000001', NULL, 77.9,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, '2026-09-09T07:00:00+00:00'::timestamptz, '2026-09-09T07:00:00+00:00'::timestamptz
  );
  -- Chủ tài sản chốt Bảo Tín: đóng anh em còn sống (như owner_select_service_quote).
  UPDATE public.asset_service_requests
     SET status_before_close = status, closed_by_request_id = 'f10d0002-0000-4000-8000-000000000004', status = 'not_selected', updated_at = '2026-08-24T03:30:00+00:00'::timestamptz
   WHERE id IN ('f10d0002-0000-4000-8000-000000000002', 'f10d0002-0000-4000-8000-000000000003');
  UPDATE public.asset_service_requests SET status = 'selected', updated_at = '2026-08-24T03:30:00+00:00'::timestamptz WHERE id = 'f10d0002-0000-4000-8000-000000000004';

  -- ── 2c. Lead + cơ hội CRM (nhánh fallback: Bảo Tín chưa có hợp đồng hợp tác) ──
  INSERT INTO public.leads (id, name, contact_name, phone, email, lead_type, source, status, note, created_by, asset_posting_id, created_at, updated_at)
  VALUES ('f10d0005-0000-4000-8000-000000000001', 'Nguyễn Hoàng Long', 'Nguyễn Hoàng Long', NULL, 'secsosoo@gmail.com', 'asset_owner', 'asset_brokerage', 'new',
          'Chốt ký gửi "Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10" với Công ty Đấu giá Hợp danh Bảo Tín', 'ae9bfef5-2694-466f-a97e-5efdf138ac43', 'f10d0001-0000-4000-8000-000000000001', '2026-08-24T03:30:00+00:00'::timestamptz, '2026-08-24T03:30:00+00:00'::timestamptz);
  INSERT INTO public.opportunities (id, name, lead_id, opportunity_type, stage, service_id, service_variant_id, amount, gross_amount, created_by, asset_posting_id, created_at, updated_at)
  SELECT 'f10d0005-0000-4000-8000-000000000002', 'Ký gửi: Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10', 'f10d0005-0000-4000-8000-000000000001', 'new_business', 'selling', v.service_id, v.id, 0, r.quote_service_fee, 'ae9bfef5-2694-466f-a97e-5efdf138ac43', 'f10d0001-0000-4000-8000-000000000001', '2026-08-24T03:30:00+00:00'::timestamptz, '2026-08-24T03:30:00+00:00'::timestamptz
    FROM public.service_variants v, public.asset_service_requests r
   WHERE v.variant_key = 'broker_consignment' AND r.id = 'f10d0002-0000-4000-8000-000000000004';

  -- ── 2d. Hợp đồng dịch vụ đã ký 2 bên ──
  INSERT INTO public.consignment_contracts (
    id, contract_no, service_request_id, asset_posting_id, auction_org_id, organization_id, owner_user_id, opportunity_id,
    status, source, terms, owner_party, org_party, asset_snapshot,
    draft_doc_path, draft_source, draft_uploaded_by, draft_uploaded_at,
    signed_doc_path, signed_uploaded_by, signed_uploaded_side, signed_uploaded_at, signed_date,
    owner_confirmed_at, owner_confirmed_by, org_confirmed_at, org_confirmed_by, signed_at, created_at, updated_at
  )
  SELECT 'f10d0004-0000-4000-8000-000000000001', 'HĐDV-BT/2026/087', r.id, r.asset_posting_id, r.auction_org_id, 'c9d00002-0000-4000-8000-000000000001', 'ae9bfef5-2694-466f-a97e-5efdf138ac43', 'f10d0005-0000-4000-8000-000000000002',
         'signed', 'platform',
         jsonb_build_object('commission_pct', r.quote_commission_pct, 'service_fee', r.quote_service_fee,
                            'starting_price', r.quote_starting_price, 'lead_time_days', r.quote_lead_time_days,
                            'plan', r.quote_plan, 'fee_items', r.quote_fee_items, 'note', r.quote_note,
                            'quote_doc_path', r.quote_doc_path, 'quoted_at', r.quoted_at),
         -- Dựng tay nhánh 'individual' của consignment_owner_party: tài khoản này còn một hồ sơ
         -- KYC TỔ CHỨC rác ("ngân hàng") được helper ưu tiên, không phải bên ký của hồ sơ này.
         (SELECT jsonb_build_object('kind', 'individual', 'full_name', k.full_name, 'id_type', k.id_type,
                                    'id_number', k.id_number, 'phone', k.phone, 'email', k.contact_email,
                                    'address', k.address, 'ward', k.ward, 'province', k.province)
            FROM public.asset_owner_kyc k WHERE k.user_id = 'ae9bfef5-2694-466f-a97e-5efdf138ac43'),
         public.consignment_org_party(r.auction_org_id, 'c9d00002-0000-4000-8000-000000000001'),
         public.consignment_asset_snapshot(r.asset_posting_id),
         'c9d00002-0000-4000-8000-000000000001/f10d0004-0000-4000-8000-000000000001/draft-1756113600000-Du_thao_HDDV_Bao_Tin.pdf', 'uploaded', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-08-25T08:00:00+00:00'::timestamptz,
         'c9d00002-0000-4000-8000-000000000001/f10d0004-0000-4000-8000-000000000001/signed-1756353600000-HDDV_da_ky_2_ben.pdf', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', 'org', '2026-08-28T04:00:00+00:00'::timestamptz, DATE '2026-08-27',
         '2026-08-29T01:20:00+00:00'::timestamptz, 'ae9bfef5-2694-466f-a97e-5efdf138ac43', '2026-08-28T04:00:00+00:00'::timestamptz, '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-08-29T01:20:00+00:00'::timestamptz,
         '2026-08-24T03:30:00+00:00'::timestamptz, '2026-08-29T01:20:00+00:00'::timestamptz
    FROM public.asset_service_requests r WHERE r.id = 'f10d0002-0000-4000-8000-000000000004';
  INSERT INTO public.consignment_contract_events (contract_id, action, side, actor_id, data, created_at) VALUES
    ('f10d0004-0000-4000-8000-000000000001', 'created',         'owner', 'ae9bfef5-2694-466f-a97e-5efdf138ac43',   '{"request_id":"f10d0002-0000-4000-8000-000000000004"}'::jsonb, '2026-08-24T03:30:00+00:00'::timestamptz),
    ('f10d0004-0000-4000-8000-000000000001', 'draft_shared',    'org',   '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '{"path":"c9d00002-0000-4000-8000-000000000001/f10d0004-0000-4000-8000-000000000001/draft-1756113600000-Du_thao_HDDV_Bao_Tin.pdf","generated":false,"cleared_signed":false,"previous_signed_path":null}'::jsonb, '2026-08-25T08:00:00+00:00'::timestamptz),
    ('f10d0004-0000-4000-8000-000000000001', 'signed_uploaded', 'org',   '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '{"path":"c9d00002-0000-4000-8000-000000000001/f10d0004-0000-4000-8000-000000000001/signed-1756353600000-HDDV_da_ky_2_ben.pdf","signed_date":"2026-08-27","previous_signed_path":null}'::jsonb, '2026-08-28T04:00:00+00:00'::timestamptz),
    ('f10d0004-0000-4000-8000-000000000001', 'confirmed',       'org',   '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '{"path":"c9d00002-0000-4000-8000-000000000001/f10d0004-0000-4000-8000-000000000001/signed-1756353600000-HDDV_da_ky_2_ben.pdf"}'::jsonb, '2026-08-28T04:00:00+00:00'::timestamptz),
    ('f10d0004-0000-4000-8000-000000000001', 'confirmed',       'owner', 'ae9bfef5-2694-466f-a97e-5efdf138ac43',   '{"path":"c9d00002-0000-4000-8000-000000000001/f10d0004-0000-4000-8000-000000000001/signed-1756353600000-HDDV_da_ky_2_ben.pdf"}'::jsonb, '2026-08-29T01:20:00+00:00'::timestamptz),
    ('f10d0004-0000-4000-8000-000000000001', 'signed',          'owner', 'ae9bfef5-2694-466f-a97e-5efdf138ac43',   '{"path":"c9d00002-0000-4000-8000-000000000001/f10d0004-0000-4000-8000-000000000001/signed-1756353600000-HDDV_da_ky_2_ben.pdf","signed_date":"2026-08-27"}'::jsonb, '2026-08-29T01:20:00+00:00'::timestamptz);

  -- ── 3. Phiên đấu giá (mã cố định: tắt trigger cấp mã, tự điền đúng những gì trigger điền) ──
  IF EXISTS (SELECT 1 FROM public.auction_sessions WHERE code = 'PDG000012') THEN
    RAISE EXCEPTION 'Mã phiên PDG000012 đã bị dùng — sinh lại seed với mã khác.';
  END IF;
  ALTER TABLE public.auction_sessions DISABLE TRIGGER auction_sessions_fill;
  INSERT INTO public.auction_sessions (
    id, organization_id, auction_org_id, code, title, description, auction_format, venue, province,
    registration_start_at, registration_end_at, viewing_start_at, viewing_end_at, starts_at, ends_at,
    max_registrants, dossier_fee, status, created_by, created_at, updated_at
  ) VALUES (
    'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'a2222222-2222-2222-2222-222222222222', 'PDG000012', '[DEMO] Nhà phố Tô Hiến Thành, Quận 10 và nhà riêng 750 m² Đường số 65', 'Phiên DỮ LIỆU MẪU phục vụ trình diễn luồng ký gửi → phiên đấu giá → tiếp thị → hỗ trợ khách hàng. Không phải phiên đấu giá thật.', 'truc_tiep', 'Hội trường Công ty Đấu giá Hợp danh Bảo Tín, 88 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh', 'TP. Hồ Chí Minh',
    '2026-09-03T01:00:00+00:00', '2026-10-13T10:00:00+00:00', '2026-09-22T01:00:00+00:00', '2026-09-24T10:00:00+00:00', '2026-10-16T02:00:00+00:00', '2026-10-16T04:30:00+00:00',
    50, 500000, 'draft', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-01T03:00:00+00:00'::timestamptz, '2026-09-01T03:00:00+00:00'::timestamptz
  );
  ALTER TABLE public.auction_sessions ENABLE TRIGGER auction_sessions_fill;
  PERFORM setval('public.auction_session_code_seq', GREATEST((SELECT last_value FROM public.auction_session_code_seq), 12));

  INSERT INTO public.auction_session_items (id, session_id, source, listing_id, asset_posting_id, title, category_slug, province, district, image_url, starting_price, deposit_amount, bid_step, created_at, updated_at)
  VALUES ('f10d0006-0000-4000-8000-000000000011', 'f10d0006-0000-4000-8000-000000000001', 'posting', NULL, 'f10d0001-0000-4000-8000-000000000001', 'Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10', 'nha-pho', 'TP. Hồ Chí Minh', 'Quận 10', 'https://vewtnkewyawmkpeymdot.supabase.co/storage/v1/object/public/asset-media/ae9bfef5-2694-466f-a97e-5efdf138ac43/f10d000d-0000-4000-8000-000000000001.png', 12800000000, 1280000000, 100000000, '2026-09-01T03:10:00+00:00'::timestamptz, '2026-09-01T03:10:00+00:00'::timestamptz);
  INSERT INTO public.auction_session_items (id, session_id, source, listing_id, asset_posting_id, title, category_slug, province, district, image_url, starting_price, deposit_amount, bid_step, created_at, updated_at)
  VALUES ('f10d0006-0000-4000-8000-000000000012', 'f10d0006-0000-4000-8000-000000000001', 'listing', '4263c04f-4a5d-47d4-9c12-631a8cea38aa', NULL, 'Nhà riêng 750 m² Đường số 65, Phường 6, TP. Hồ Chí Minh', 'bat-dong-san', 'TP. Hồ Chí Minh', NULL, NULL, 37650000000, 3765000000, 200000000, '2026-09-01T03:10:00+00:00'::timestamptz, '2026-09-01T03:10:00+00:00'::timestamptz);

  -- ── 3b. Tài liệu phiên + điều khoản (danh tính người tổ chức để confirmed_by đúng) ──
  PERFORM set_config('request.jwt.claims', '{"sub":"95d7e29c-f1f5-4361-a3af-e9aeaf792f3f","role":"authenticated"}', true);
  INSERT INTO public.case_documents (id, session_id, organization_id, doc_type, title, storage_path, original_filename, mime_type, extraction_status, extraction_engine, extracted_at, review_status, uploaded_by, created_at, updated_at)
  VALUES ('f10d0007-0000-4000-8000-000000000001', 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'notice', 'Thông báo đấu giá tài sản số 087/2026/TB-BT (PDG000012)', 'c9d00002-0000-4000-8000-000000000001/f10d0006-0000-4000-8000-000000000001/f10d0007-0000-4000-8000-000000000001/1756710000000-thong-bao-dau-gia-PDG000012.pdf', 'thong-bao-dau-gia-PDG000012.pdf', 'application/pdf', 'extracted', 'mock-v1', '2026-09-01T03:30:00+00:00'::timestamptz, 'draft', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-01T03:30:00+00:00'::timestamptz, '2026-09-01T03:30:00+00:00'::timestamptz);
  INSERT INTO public.case_documents (id, session_id, organization_id, doc_type, title, storage_path, original_filename, mime_type, extraction_status, extraction_engine, extracted_at, review_status, uploaded_by, created_at, updated_at)
  VALUES ('f10d0007-0000-4000-8000-000000000002', 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'deposit_terms', 'Quy định về tiền đặt trước – phiên PDG000012', 'c9d00002-0000-4000-8000-000000000001/f10d0006-0000-4000-8000-000000000001/f10d0007-0000-4000-8000-000000000002/1756710300000-quy-dinh-tien-dat-truoc-PDG000012.pdf', 'quy-dinh-tien-dat-truoc-PDG000012.pdf', 'application/pdf', 'extracted', 'mock-v1', '2026-09-01T03:35:00+00:00'::timestamptz, 'draft', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-01T03:35:00+00:00'::timestamptz, '2026-09-01T03:35:00+00:00'::timestamptz);
  INSERT INTO public.case_documents (id, session_id, organization_id, doc_type, title, storage_path, original_filename, mime_type, extraction_status, extraction_engine, extracted_at, review_status, uploaded_by, created_at, updated_at)
  VALUES ('f10d0007-0000-4000-8000-000000000003', 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'clarification', 'Làm rõ thông tin tài sản lô 1 (bổ sung ngày 07/09/2026)', NULL, NULL, NULL, 'none', NULL, NULL, 'draft', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-07T03:10:00+00:00'::timestamptz, '2026-09-07T03:10:00+00:00'::timestamptz);
  INSERT INTO public.case_document_clauses (id, document_id, session_id, organization_id, clause_ref, heading, body, topics, sort_order, status, source, created_by, created_at, updated_at)
  VALUES ('f10d0007-0000-4000-8000-000000000101', 'f10d0007-0000-4000-8000-000000000001', 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'Mục 1', 'Tài sản đấu giá và giá khởi điểm', 'Lô 1 – Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10: giá khởi điểm 12,800,000,000₫.
Lô 2 – Nhà riêng 750 m² Đường số 65, Phường 6, TP. Hồ Chí Minh: giá khởi điểm 37,650,000,000₫.', ARRAY['starting_price']::text[], 10, 'confirmed', 'extracted', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-01T03:30:00+00:00'::timestamptz, '2026-09-01T03:30:00+00:00'::timestamptz);
  INSERT INTO public.case_document_clauses (id, document_id, session_id, organization_id, clause_ref, heading, body, topics, sort_order, status, source, created_by, created_at, updated_at)
  VALUES ('f10d0007-0000-4000-8000-000000000102', 'f10d0007-0000-4000-8000-000000000001', 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'Mục 2', 'Bước giá', 'Lô 1: bước giá 100,000,000₫.
Lô 2: bước giá 200,000,000₫.', ARRAY['bid_step']::text[], 20, 'confirmed', 'extracted', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-01T03:30:00+00:00'::timestamptz, '2026-09-01T03:30:00+00:00'::timestamptz);
  INSERT INTO public.case_document_clauses (id, document_id, session_id, organization_id, clause_ref, heading, body, topics, sort_order, status, source, created_by, created_at, updated_at)
  VALUES ('f10d0007-0000-4000-8000-000000000103', 'f10d0007-0000-4000-8000-000000000001', 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'Mục 3', 'Thời gian, địa điểm xem tài sản', 'Người có nhu cầu xem tài sản trực tiếp tại nơi có tài sản từ 08:00 ngày 22/09/2026 đến 17:00 ngày 24/09/2026. Đăng ký lịch xem trước qua số điện thoại 028 3822 5566.', ARRAY['viewing']::text[], 30, 'confirmed', 'extracted', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-01T03:30:00+00:00'::timestamptz, '2026-09-01T03:30:00+00:00'::timestamptz);
  INSERT INTO public.case_document_clauses (id, document_id, session_id, organization_id, clause_ref, heading, body, topics, sort_order, status, source, created_by, created_at, updated_at)
  VALUES ('f10d0007-0000-4000-8000-000000000104', 'f10d0007-0000-4000-8000-000000000001', 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'Mục 4', 'Thời gian, địa điểm bán hồ sơ tham gia đấu giá', 'Thời gian bán hồ sơ tham gia đấu giá: từ 08:00 ngày 03/09/2026 đến 17:00 ngày 13/10/2026.
Địa điểm bán hồ sơ: Công ty Đấu giá Hợp danh Bảo Tín, 88 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh.', ARRAY['document_sale']::text[], 40, 'confirmed', 'extracted', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-01T03:30:00+00:00'::timestamptz, '2026-09-01T03:30:00+00:00'::timestamptz);
  INSERT INTO public.case_document_clauses (id, document_id, session_id, organization_id, clause_ref, heading, body, topics, sort_order, status, source, created_by, created_at, updated_at)
  VALUES ('f10d0007-0000-4000-8000-000000000105', 'f10d0007-0000-4000-8000-000000000001', 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'Mục 5', 'Tiền mua hồ sơ tham gia đấu giá', 'Tiền mua hồ sơ tham gia đấu giá là 500,000₫/hồ sơ.', ARRAY['document_fee']::text[], 50, 'confirmed', 'extracted', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-01T03:30:00+00:00'::timestamptz, '2026-09-01T03:30:00+00:00'::timestamptz);
  INSERT INTO public.case_document_clauses (id, document_id, session_id, organization_id, clause_ref, heading, body, topics, sort_order, status, source, created_by, created_at, updated_at)
  VALUES ('f10d0007-0000-4000-8000-000000000106', 'f10d0007-0000-4000-8000-000000000001', 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'Mục 6', 'Hạn đăng ký tham gia đấu giá', 'Hạn chót nộp hồ sơ đăng ký tham gia đấu giá là 17:00 ngày 13/10/2026.', ARRAY['registration_deadline']::text[], 60, 'confirmed', 'extracted', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-01T03:30:00+00:00'::timestamptz, '2026-09-01T03:30:00+00:00'::timestamptz);
  INSERT INTO public.case_document_clauses (id, document_id, session_id, organization_id, clause_ref, heading, body, topics, sort_order, status, source, created_by, created_at, updated_at)
  VALUES ('f10d0007-0000-4000-8000-000000000107', 'f10d0007-0000-4000-8000-000000000001', 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'Mục 7', 'Điều kiện và hồ sơ đăng ký', 'Cá nhân, tổ chức đăng ký tham gia đấu giá phải có đủ năng lực hành vi dân sự và không thuộc trường hợp không được đăng ký tham gia đấu giá theo quy định của pháp luật về đấu giá tài sản. Hồ sơ gồm: đơn đăng ký tham gia đấu giá theo mẫu, bản sao CCCD hoặc giấy chứng nhận đăng ký doanh nghiệp, chứng từ nộp tiền đặt trước.', ARRAY['eligibility', 'documents_required']::text[], 70, 'confirmed', 'extracted', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-01T03:30:00+00:00'::timestamptz, '2026-09-01T03:30:00+00:00'::timestamptz);
  INSERT INTO public.case_document_clauses (id, document_id, session_id, organization_id, clause_ref, heading, body, topics, sort_order, status, source, created_by, created_at, updated_at)
  VALUES ('f10d0007-0000-4000-8000-000000000108', 'f10d0007-0000-4000-8000-000000000001', 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'Mục 8', 'Thời gian tổ chức cuộc đấu giá', 'Thời gian tổ chức cuộc đấu giá: 09:00 ngày 16/10/2026.', ARRAY['schedule']::text[], 80, 'confirmed', 'extracted', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-01T03:30:00+00:00'::timestamptz, '2026-09-01T03:30:00+00:00'::timestamptz);
  INSERT INTO public.case_document_clauses (id, document_id, session_id, organization_id, clause_ref, heading, body, topics, sort_order, status, source, created_by, created_at, updated_at)
  VALUES ('f10d0007-0000-4000-8000-000000000109', 'f10d0007-0000-4000-8000-000000000001', 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'Mục 9', 'Địa điểm tổ chức cuộc đấu giá', 'Địa điểm tổ chức cuộc đấu giá: Hội trường Công ty Đấu giá Hợp danh Bảo Tín, 88 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh.', ARRAY['venue']::text[], 90, 'confirmed', 'extracted', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-01T03:30:00+00:00'::timestamptz, '2026-09-01T03:30:00+00:00'::timestamptz);
  INSERT INTO public.case_document_clauses (id, document_id, session_id, organization_id, clause_ref, heading, body, topics, sort_order, status, source, created_by, created_at, updated_at)
  VALUES ('f10d0007-0000-4000-8000-000000000110', 'f10d0007-0000-4000-8000-000000000001', 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'Mục 10', 'Hình thức, phương thức đấu giá', 'Hình thức đấu giá: đấu giá trực tiếp bằng lời nói tại cuộc đấu giá.
Phương thức đấu giá: trả giá lên.', ARRAY['format']::text[], 100, 'confirmed', 'extracted', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-01T03:30:00+00:00'::timestamptz, '2026-09-01T03:30:00+00:00'::timestamptz);
  INSERT INTO public.case_document_clauses (id, document_id, session_id, organization_id, clause_ref, heading, body, topics, sort_order, status, source, created_by, created_at, updated_at)
  VALUES ('f10d0007-0000-4000-8000-000000000111', 'f10d0007-0000-4000-8000-000000000002', 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'Khoản 1', 'Khoản tiền đặt trước', 'Lô 1 – Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10: tiền đặt trước là 1,280,000,000₫.
Lô 2 – Nhà riêng 750 m² Đường số 65, Phường 6, TP. Hồ Chí Minh: tiền đặt trước là 3,765,000,000₫.', ARRAY['deposit']::text[], 110, 'confirmed', 'extracted', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-01T03:35:00+00:00'::timestamptz, '2026-09-01T03:35:00+00:00'::timestamptz);
  INSERT INTO public.case_document_clauses (id, document_id, session_id, organization_id, clause_ref, heading, body, topics, sort_order, status, source, created_by, created_at, updated_at)
  VALUES ('f10d0007-0000-4000-8000-000000000112', 'f10d0007-0000-4000-8000-000000000002', 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'Khoản 2', 'Thời hạn nộp tiền đặt trước', 'Người đăng ký nộp tiền đặt trước từ 08:00 ngày 10/10/2026 đến 17:00 ngày 13/10/2026.', ARRAY['deposit_deadline']::text[], 120, 'confirmed', 'extracted', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-01T03:35:00+00:00'::timestamptz, '2026-09-01T03:35:00+00:00'::timestamptz);
  INSERT INTO public.case_document_clauses (id, document_id, session_id, organization_id, clause_ref, heading, body, topics, sort_order, status, source, created_by, created_at, updated_at)
  VALUES ('f10d0007-0000-4000-8000-000000000113', 'f10d0007-0000-4000-8000-000000000002', 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'Khoản 3', 'Phương thức nộp tiền đặt trước', 'Tiền đặt trước nộp bằng chuyển khoản vào tài khoản số DEMO-0000-1111 (tài khoản dữ liệu mẫu) của Công ty Đấu giá Hợp danh Bảo Tín, nội dung chuyển khoản: mã phiên PDG000012, số lô, họ tên, số CCCD.', ARRAY['deposit_method']::text[], 130, 'confirmed', 'extracted', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-01T03:35:00+00:00'::timestamptz, '2026-09-01T03:35:00+00:00'::timestamptz);
  INSERT INTO public.case_document_clauses (id, document_id, session_id, organization_id, clause_ref, heading, body, topics, sort_order, status, source, created_by, created_at, updated_at)
  VALUES ('f10d0007-0000-4000-8000-000000000114', 'f10d0007-0000-4000-8000-000000000002', 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'Khoản 4', 'Hoàn trả tiền đặt trước', 'Tiền đặt trước của người không trúng đấu giá được hoàn trả trong thời hạn 03 ngày làm việc kể từ ngày kết thúc cuộc đấu giá.', ARRAY['deposit_refund']::text[], 140, 'confirmed', 'extracted', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-01T03:35:00+00:00'::timestamptz, '2026-09-01T03:35:00+00:00'::timestamptz);
  INSERT INTO public.case_document_clauses (id, document_id, session_id, organization_id, clause_ref, heading, body, topics, sort_order, status, source, created_by, created_at, updated_at)
  VALUES ('f10d0007-0000-4000-8000-000000000115', 'f10d0007-0000-4000-8000-000000000002', 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'Khoản 5', 'Các trường hợp không được nhận lại tiền đặt trước', 'Người tham gia đấu giá không được nhận lại tiền đặt trước trong các trường hợp: đã nộp tiền đặt trước nhưng không tham gia cuộc đấu giá mà không có lý do chính đáng; bị truất quyền tham gia đấu giá; từ chối ký biên bản đấu giá; rút lại giá đã trả.', ARRAY['deposit_forfeit']::text[], 150, 'confirmed', 'extracted', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-01T03:35:00+00:00'::timestamptz, '2026-09-01T03:35:00+00:00'::timestamptz);
  INSERT INTO public.case_document_clauses (id, document_id, session_id, organization_id, clause_ref, heading, body, topics, sort_order, status, source, created_by, created_at, updated_at)
  VALUES ('f10d0007-0000-4000-8000-000000000116', 'f10d0007-0000-4000-8000-000000000003', 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'Làm rõ 1', 'Tình trạng thế chấp và cho thuê của lô 1', 'Tài sản lô 1 (nhà phố Tô Hiến Thành, Quận 10) không đang thế chấp tại tổ chức tín dụng nào và không bị kê biên. Tầng trệt đang cho thuê theo hợp đồng đến hết ngày 31/12/2026; người trúng đấu giá được tiếp nhận hợp đồng thuê hoặc nhận bàn giao mặt bằng trống trước ngày 31/12/2026.', '{}'::text[], 160, 'confirmed', 'manual', '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-07T03:10:00+00:00'::timestamptz, '2026-09-07T03:10:00+00:00'::timestamptz);
  UPDATE public.case_documents SET review_status = 'confirmed' WHERE session_id = 'f10d0006-0000-4000-8000-000000000001';
  UPDATE public.case_documents d SET confirmed_at = d.created_at + interval '25 minutes' WHERE d.session_id = 'f10d0006-0000-4000-8000-000000000001';
  UPDATE public.case_document_clauses c SET confirmed_at = c.created_at + interval '20 minutes' WHERE c.session_id = 'f10d0006-0000-4000-8000-000000000001';
  PERFORM set_config('request.jwt.claims', '', true);

  -- ── 3c. Công bố (qua cổng thật của guard), rồi lùi published_at ──
  UPDATE public.auction_sessions SET status = 'published' WHERE id = 'f10d0006-0000-4000-8000-000000000001';
  ALTER TABLE public.auction_sessions DISABLE TRIGGER auction_sessions_guard;
  UPDATE public.auction_sessions SET published_at = '2026-09-02T02:00:00+00:00'::timestamptz WHERE id = 'f10d0006-0000-4000-8000-000000000001';
  ALTER TABLE public.auction_sessions ENABLE TRIGGER auction_sessions_guard;

  -- ── 3d. Hồ sơ tham gia (không gắn orders ⇒ không vào doanh thu) ──
  INSERT INTO public.user_verified_identities (user_id, source, full_name, id_number, id_issued_on, date_of_birth, gender, address, verified_at, created_at, updated_at)
  VALUES ('957b8823-9a29-424d-a0fb-6f859590e236', 'vneid', 'Phạm Quốc Bảo', '079088001234', DATE '2021-06-15', DATE '1988-04-12', 'male',
          '27 Nguyễn Thị Minh Khai, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', '2026-09-05T13:57:00+00:00'::timestamptz, '2026-09-05T13:57:00+00:00'::timestamptz, '2026-09-05T13:57:00+00:00'::timestamptz)
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.auction_bidding_contracts (
    id, code, session_id, organization_id, user_id, full_name, id_type, id_number, date_of_birth, gender, phone, email, address, identity_source,
    fee_amount, status, paid_at, payment_txn_ref, deposit_status, deposit_amount_received, deposit_received_at, deposit_status_changed_at,
    deposit_updated_by, bidder_no, bidder_no_assigned_at, created_at, updated_at
  ) VALUES (
    'f10d0008-0000-4000-8000-000000000001', 'HSDG' || lpad(nextval('public.auction_bidding_contract_code_seq')::text, 6, '0'), 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', '957b8823-9a29-424d-a0fb-6f859590e236', 'Phạm Quốc Bảo', 'cccd', '079088001234', DATE '1988-04-12', 'male', '0912345678', 'quocbao.demo@example.com', '27 Nguyễn Thị Minh Khai, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 'vneid',
    500000, 'paid', '2026-09-05T14:02:00+00:00'::timestamptz, 'DEMO-VNP-PDG12-0001', 'received', 1280000000, '2026-09-08T03:15:00+00:00'::timestamptz, '2026-09-08T03:15:00+00:00'::timestamptz,
    '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', 1, '2026-09-08T03:15:00+00:00'::timestamptz + interval '1 minute', '2026-09-05T13:58:00+00:00'::timestamptz, '2026-09-08T03:15:00+00:00'::timestamptz
  );
  INSERT INTO public.auction_bidding_contracts (
    id, code, session_id, organization_id, user_id, full_name, id_type, id_number, date_of_birth, gender, phone, email, address, identity_source,
    fee_amount, status, paid_at, payment_txn_ref, deposit_status, deposit_amount_received, deposit_received_at, deposit_status_changed_at,
    deposit_updated_by, bidder_no, bidder_no_assigned_at, created_at, updated_at
  ) VALUES (
    'f10d0008-0000-4000-8000-000000000002', 'HSDG' || lpad(nextval('public.auction_bidding_contract_code_seq')::text, 6, '0'), 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', '0d4ff00a-ac13-4652-90cc-94f7760bc936', 'Lê Thị Thu Trang', 'cccd', '001190004567', DATE '1990-11-03', 'female', '0987123456', 'thutrang.demo@example.com', '118 Trần Não, Phường An Khánh, TP. Thủ Đức, TP. Hồ Chí Minh', 'manual',
    500000, 'paid', '2026-09-06T02:40:00+00:00'::timestamptz, 'DEMO-VNP-PDG12-0002', 'received', 3765000000, '2026-09-09T08:30:00+00:00'::timestamptz, '2026-09-09T08:30:00+00:00'::timestamptz,
    '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', 2, '2026-09-09T08:30:00+00:00'::timestamptz + interval '1 minute', '2026-09-06T02:35:00+00:00'::timestamptz, '2026-09-09T08:30:00+00:00'::timestamptz
  );
  INSERT INTO public.auction_bidding_contracts (
    id, code, session_id, organization_id, user_id, full_name, id_type, id_number, date_of_birth, gender, phone, email, address, identity_source,
    fee_amount, status, paid_at, payment_txn_ref, deposit_status, deposit_amount_received, deposit_received_at, deposit_status_changed_at,
    deposit_updated_by, bidder_no, bidder_no_assigned_at, created_at, updated_at
  ) VALUES (
    'f10d0008-0000-4000-8000-000000000003', 'HSDG' || lpad(nextval('public.auction_bidding_contract_code_seq')::text, 6, '0'), 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', NULL, 'Bùi Văn Minh', 'cccd', '074082009876', DATE '1982-02-20', 'male', '0900000108', 'minh.bui@example.com', 'Khu phố 3, Phường Lái Thiêu, TP. Thuận An, Bình Dương', 'manual',
    500000, 'paid', '2026-09-09T09:20:00+00:00'::timestamptz, 'DEMO-TAIQUAY-PDG12-0003', 'pending', NULL, NULL, NULL,
    NULL, NULL, NULL, '2026-09-09T09:10:00+00:00'::timestamptz, '2026-09-09T09:20:00+00:00'::timestamptz
  );
  INSERT INTO public.auction_bidding_contracts (
    id, code, session_id, organization_id, user_id, full_name, id_type, id_number, date_of_birth, gender, phone, email, address, identity_source,
    fee_amount, status, paid_at, payment_txn_ref, deposit_status, deposit_amount_received, deposit_received_at, deposit_status_changed_at,
    deposit_updated_by, bidder_no, bidder_no_assigned_at, created_at, updated_at
  ) VALUES (
    'f10d0008-0000-4000-8000-000000000004', 'HSDG' || lpad(nextval('public.auction_bidding_contract_code_seq')::text, 6, '0'), 'f10d0006-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', NULL, 'Nguyễn Văn An', 'cccd', '079095003210', DATE '1995-07-09', 'male', '0900000101', 'an.nguyen@example.com', '56 Cao Thắng, Phường 4, Quận 3, TP. Hồ Chí Minh', 'manual',
    500000, 'paid', '2026-09-10T13:05:00+00:00'::timestamptz, 'DEMO-TAIQUAY-PDG12-0004', 'pending', NULL, NULL, NULL,
    NULL, NULL, NULL, '2026-09-10T12:55:00+00:00'::timestamptz, '2026-09-10T13:05:00+00:00'::timestamptz
  );

  -- ── 4. Tiếp thị phiên: RPC thật dưới danh tính chủ tổ chức ──
  PERFORM set_config('request.jwt.claims', '{"sub":"95d7e29c-f1f5-4361-a3af-e9aeaf792f3f","role":"authenticated"}', true);
  SELECT COALESCE(array_agg(DISTINCT a.segment_key ORDER BY a.segment_key), '{}') INTO v_segs
    FROM public.org_session_audience('f10d0006-0000-4000-8000-000000000001') a WHERE a.eligible;
  IF v_segs IS DISTINCT FROM ARRAY['lot:f10d0006-0000-4000-8000-000000000011', 'multi']::text[] THEN
    RAISE EXCEPTION 'Phân khúc người nhận lệch với lúc sinh bản nháp: %', v_segs;
  END IF;
  SELECT count(*) INTO v_bad FROM public.org_session_audience('f10d0006-0000-4000-8000-000000000001') a
   WHERE a.eligible AND a.contact_id <> ALL (ARRAY['c0a70000-0000-4000-8000-000000000001', 'c0a70000-0000-4000-8000-000000000002', 'c0a70000-0000-4000-8000-000000000008']::uuid[]);
  IF v_bad > 0 OR (SELECT count(*) FROM public.org_session_audience('f10d0006-0000-4000-8000-000000000001') a WHERE a.eligible) <> 3 THEN
    RAISE EXCEPTION 'Danh sách khách đủ điều kiện lệch với dự kiến.';
  END IF;

  PERFORM public.outreach_ensure_pack('f10d0006-0000-4000-8000-000000000001', '2026-09-12');
  SELECT id INTO v_pack FROM public.session_outreach_packs WHERE session_id = 'f10d0006-0000-4000-8000-000000000001';
  PERFORM public.outreach_save_case_file(v_pack, '{"owner_info":"Lô 1: cá nhân chủ sở hữu, đã ký hợp đồng dịch vụ đấu giá với Bảo Tín. Lô 2: Ngân hàng TMCP Ngoại thương Việt Nam – Chi nhánh Hà Nội (tài sản bảo đảm).","asset_location":"Lô 1: 312 Tô Hiến Thành, Phường 15, Quận 10, TP. Hồ Chí Minh. Lô 2: Đường số 65, Phường 6, TP. Hồ Chí Minh.","ownership_papers":"Lô 1: Giấy chứng nhận quyền sử dụng đất, quyền sở hữu nhà ở (sổ hồng) cấp năm 2018. Lô 2: Sổ hồng do ngân hàng quản lý.","viewing_place":"Tại nơi có tài sản, đăng ký lịch trước qua hotline 028 3822 5566.","registration_place":"Văn phòng Bảo Tín, 88 Lê Lợi, Phường Bến Thành, Quận 1, hoặc mua hồ sơ trực tuyến trên sàn.","registration_conditions":"Cá nhân, tổ chức đủ năng lực hành vi dân sự; nộp đủ hồ sơ và tiền đặt trước đúng hạn.","auction_method":"Đấu giá trực tiếp bằng lời nói, phương thức trả giá lên.","contact_person":"Chị Ngô Thu Hà — chuyên viên phiên, 0900 000 199","lots":{"f10d0006-0000-4000-8000-000000000011":{"description":"Nhà phố 4 tầng kết cấu bê tông cốt thép, mặt tiền đường Tô Hiến Thành rộng 12 m, cách Vạn Hạnh Mall 600 m. Tầng trệt đang cho thuê kinh doanh (hợp đồng thuê đến 31/12/2026), 3 tầng trên để ở, sân thượng rộng. Sổ hồng riêng, hoàn công đầy đủ.","condition":"Nhà đang sử dụng bình thường, tầng trệt cho thuê kinh doanh, các tầng trên còn nội thất cơ bản","legal_summary":"Theo khai báo của chủ tài sản: không có tranh chấp, không thế chấp, không bị kê biên.","photo_urls":["https://vewtnkewyawmkpeymdot.supabase.co/storage/v1/object/public/asset-media/ae9bfef5-2694-466f-a97e-5efdf138ac43/f10d000d-0000-4000-8000-000000000001.png","https://vewtnkewyawmkpeymdot.supabase.co/storage/v1/object/public/asset-media/ae9bfef5-2694-466f-a97e-5efdf138ac43/f10d000d-0000-4000-8000-000000000002.png","https://vewtnkewyawmkpeymdot.supabase.co/storage/v1/object/public/asset-media/ae9bfef5-2694-466f-a97e-5efdf138ac43/f10d000d-0000-4000-8000-000000000003.png"]},"f10d0006-0000-4000-8000-000000000012":{"description":"Tài sản bảo đảm do Ngân hàng TMCP Ngoại thương Việt Nam - Chi nhánh Hà Nội phát mại theo quy định pháp luật. Nhà riêng trên khu đất 750 m², hai mặt tiền đường nội bộ.","condition":"Nhà bỏ trống, cần cải tạo trước khi sử dụng","legal_summary":"Sổ hồng","photo_urls":[]}}}'::jsonb);
  PERFORM public.outreach_apply_generation(v_pack, '{"channel:listing":"[DEMO] Nhà phố Tô Hiến Thành, Quận 10 và nhà riêng 750 m² Đường số 65 — mã phiên PDG000012\n\nPhiên đấu giá công khai 2 tài sản do Công ty Đấu giá Hợp danh Bảo Tín tổ chức.\n\nTài sản đấu giá:\n• Lô 1: Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10 (Quận 10, TP. Hồ Chí Minh) — giá khởi điểm 12,800,000,000₫\n• Lô 2: Nhà riêng 750 m² Đường số 65, Phường 6, TP. Hồ Chí Minh (TP. Hồ Chí Minh) — giá khởi điểm 37,650,000,000₫\n\nĐiểm nổi bật:\n• Lô 1: Nhà phố 4 tầng kết cấu bê tông cốt thép, mặt tiền đường Tô Hiến Thành rộng 12 m, cách Vạn Hạnh Mall 600 m. Tầng trệt đang cho thuê kinh doanh (hợp đồng thuê đến 31/12/2026), 3 tầng trên để ở, sân thượng rộng. Sổ hồng ri…\n• Lô 2: Tài sản bảo đảm do Ngân hàng TMCP Ngoại thương Việt Nam - Chi nhánh Hà Nội phát mại theo quy định pháp luật. Nhà riêng trên khu đất 750 m², hai mặt tiền đường nội bộ.\n\nLịch phiên:\n• Xem tài sản: Từ 08:00 ngày 22/09/2026 đến 17:00 ngày 24/09/2026\n• Nhận hồ sơ: Từ 08:00 ngày 03/09/2026 đến 17:00 ngày 13/10/2026\n• Tổ chức đấu giá: 09:00 ngày 16/10/2026 tại Hội trường Công ty Đấu giá Hợp danh Bảo Tín, 88 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh\n\nTham gia:\n• Tiền đặt trước: Lô 1 1,280,000,000₫; Lô 2 3,765,000,000₫\n• Tiền mua hồ sơ: 500,000₫\n• Hình thức: Đấu giá trực tiếp tại cuộc đấu giá\n\nVị trí, pháp lý và hiện trạng được công bố trong hồ sơ phiên; nên xem tài sản thực tế trước khi đăng ký.\n\nThông tin pháp lý chính thức theo thông báo đấu giá của Công ty Đấu giá Hợp danh Bảo Tín (mã phiên PDG000012).\n\nChi tiết & đăng ký: http://localhost:8080/sessions/f10d0006-0000-4000-8000-000000000001\n\nLiên hệ: Công ty Đấu giá Hợp danh Bảo Tín — Hotline 028 3822 5566 — Chị Ngô Thu Hà — chuyên viên phiên, 0900 000 199","channel:zalo":"📣 Cơ hội sở hữu 2 tài sản qua đấu giá công khai\n\n[DEMO] Nhà phố Tô Hiến Thành, Quận 10 và nhà riêng 750 m² Đường số 65 (mã PDG000012)\n\n• Lô 1: Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10 — 12,800,000,000₫\n• Lô 2: Nhà riêng 750 m² Đường số 65, Phường 6, TP. Hồ Chí Minh — 37,650,000,000₫\n\n🗓 Xem tài sản từ 08:00 ngày 22/09/2026\n📝 Nhận hồ sơ đến 17:00 ngày 13/10/2026\n🔨 Đấu giá 09:00 ngày 16/10/2026\n\n👉 Chi tiết & đăng ký: http://localhost:8080/sessions/f10d0006-0000-4000-8000-000000000001\n\n☎️ Công ty Đấu giá Hợp danh Bảo Tín — 028 3822 5566\n\nĐăng ký sớm để kịp xem tài sản trước phiên.","channel:facebook":"🔔 Công ty Đấu giá Hợp danh Bảo Tín mở phiên đấu giá 2 tài sản\n\nVị trí, pháp lý và hiện trạng được công bố trong hồ sơ phiên; nên xem tài sản thực tế trước khi đăng ký.\n\nTài sản đấu giá:\n• Lô 1: Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10 (Quận 10, TP. Hồ Chí Minh) — giá khởi điểm 12,800,000,000₫\n• Lô 2: Nhà riêng 750 m² Đường số 65, Phường 6, TP. Hồ Chí Minh (TP. Hồ Chí Minh) — giá khởi điểm 37,650,000,000₫\n\nĐiểm nổi bật:\n• Lô 1: Nhà phố 4 tầng kết cấu bê tông cốt thép, mặt tiền đường Tô Hiến Thành rộng 12 m, cách Vạn Hạnh Mall 600 m. Tầng trệt đang cho thuê kinh doanh (hợp đồng thuê đến 31/12/2026), 3 tầng trên để ở, sân thượng rộng. Sổ hồng ri…\n• Lô 2: Tài sản bảo đảm do Ngân hàng TMCP Ngoại thương Việt Nam - Chi nhánh Hà Nội phát mại theo quy định pháp luật. Nhà riêng trên khu đất 750 m², hai mặt tiền đường nội bộ.\n\nLịch phiên:\n• Xem tài sản: Từ 08:00 ngày 22/09/2026 đến 17:00 ngày 24/09/2026\n• Nhận hồ sơ: Từ 08:00 ngày 03/09/2026 đến 17:00 ngày 13/10/2026\n• Tổ chức đấu giá: 09:00 ngày 16/10/2026 tại Hội trường Công ty Đấu giá Hợp danh Bảo Tín, 88 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh\n\nTham gia:\n• Tiền đặt trước: Lô 1 1,280,000,000₫; Lô 2 3,765,000,000₫\n• Tiền mua hồ sơ: 500,000₫\n• Hình thức: Đấu giá trực tiếp tại cuộc đấu giá\n\nThông tin pháp lý chính thức theo thông báo đấu giá của Công ty Đấu giá Hợp danh Bảo Tín (mã phiên PDG000012).\n\nChi tiết & đăng ký: http://localhost:8080/sessions/f10d0006-0000-4000-8000-000000000001\n\nLiên hệ: Công ty Đấu giá Hợp danh Bảo Tín — Hotline 028 3822 5566 — Chị Ngô Thu Hà — chuyên viên phiên, 0900 000 199\n\nBình luận hoặc nhắn tin cho trang để được hướng dẫn thủ tục tham gia.\n\n#daugiataisan #batdongsan #tphochiminh","channel:sms":"[Bao Tin] PDG000012: 2 tai san gia KD tu 12,800,000,000d xem TS 22/09 DG 16/10 http://localhost:8080/sessions/f10d0006-0000-4000-8000-000000000001","channel:flyer":"CÔNG TY ĐẤU GIÁ HỢP DANH BẢO TÍN\nPHIÊN ĐẤU GIÁ PDG000012\n[DEMO] Nhà phố Tô Hiến Thành, Quận 10 và nhà riêng 750 m² Đường số 65\n\nTÀI SẢN\n• Lô 1: Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10 (Quận 10, TP. Hồ Chí Minh) — giá khởi điểm 12,800,000,000₫\n  Nhà phố 4 tầng kết cấu bê tông cốt thép, mặt tiền đường Tô Hiến Thành rộng 12 m, cách Vạn Hạnh Mall 600 m. Tầng trệt đang cho thuê kinh doanh (hợp đồng thuê đế…\n• Lô 2: Nhà riêng 750 m² Đường số 65, Phường 6, TP. Hồ Chí Minh (TP. Hồ Chí Minh) — giá khởi điểm 37,650,000,000₫\n  Tài sản bảo đảm do Ngân hàng TMCP Ngoại thương Việt Nam - Chi nhánh Hà Nội phát mại theo quy định pháp luật. Nhà riêng trên khu đất 750 m², hai mặt tiền đường…\n\nLỊCH PHIÊN\n• Xem tài sản: Từ 08:00 ngày 22/09/2026 đến 17:00 ngày 24/09/2026\n• Nhận hồ sơ: Từ 08:00 ngày 03/09/2026 đến 17:00 ngày 13/10/2026\n• Tổ chức đấu giá: 09:00 ngày 16/10/2026 tại Hội trường Công ty Đấu giá Hợp danh Bảo Tín, 88 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh\n\nTHAM GIA\n• Tiền đặt trước: Lô 1 1,280,000,000₫; Lô 2 3,765,000,000₫\n• Tiền mua hồ sơ: 500,000₫\n• Hình thức: Đấu giá trực tiếp tại cuộc đấu giá\n\nLIÊN HỆ\n• Công ty Đấu giá Hợp danh Bảo Tín\n• 88 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh\n• Hotline 028 3822 5566 — Chị Ngô Thu Hà — chuyên viên phiên, 0900 000 199\n\nThông tin pháp lý chính thức theo thông báo đấu giá của Công ty Đấu giá Hợp danh Bảo Tín (mã phiên PDG000012).\nXem chi tiết: http://localhost:8080/sessions/f10d0006-0000-4000-8000-000000000001","notice:asset_description":"Lô 1: Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10 (nhà phố). Nhà phố 4 tầng kết cấu bê tông cốt thép, mặt tiền đường Tô Hiến Thành rộng 12 m, cách Vạn Hạnh Mall 600 m. Tầng trệt đang cho thuê kinh doanh (hợp đồng thuê đến 31/12/2026), 3 tầng trên để ở, sân thượng rộng. Sổ hồng riêng, hoàn công đầy đủ.\nLô 2: Nhà riêng 750 m² Đường số 65, Phường 6, TP. Hồ Chí Minh (bất động sản). Tài sản bảo đảm do Ngân hàng TMCP Ngoại thương Việt Nam - Chi nhánh Hà Nội phát mại theo quy định pháp luật. Nhà riêng trên khu đất 750 m², hai mặt tiền đường nội bộ.","notice:asset_condition":"Lô 1: Nhà đang sử dụng bình thường, tầng trệt cho thuê kinh doanh, các tầng trên còn nội thất cơ bản.\nLô 2: Nhà bỏ trống, cần cải tạo trước khi sử dụng.","pitch:lot:f10d0006-0000-4000-8000-000000000011":"Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10 tại Quận 10, TP. Hồ Chí Minh lên phiên đấu giá ngày 16/10, giá khởi điểm 12,800,000,000₫ — đúng nhu cầu nhà phố anh/chị đã chia sẻ.","pitch:multi":"Phiên PDG000012 có nhiều tài sản khớp nhu cầu của anh/chị, giá khởi điểm từ 12,800,000,000₫, đấu giá ngày 16/10."}'::jsonb, 'Trình soạn mẫu v1 — mô phỏng, chưa gọi mô hình AI', 'bdb548ff', '{}'::text[]);
  PERFORM public.outreach_edit_field(v_pack, 'channel:zalo', '📣 Cơ hội sở hữu 2 tài sản qua đấu giá công khai

[DEMO] Nhà phố Tô Hiến Thành, Quận 10 và nhà riêng 750 m² Đường số 65 (mã PDG000012)

• Lô 1: Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10 — 12,800,000,000₫
• Lô 2: Nhà riêng 750 m² Đường số 65, Phường 6, TP. Hồ Chí Minh — 37,650,000,000₫

🗓 Xem tài sản từ 08:00 ngày 22/09/2026
📝 Nhận hồ sơ đến 17:00 ngày 13/10/2026
🔨 Đấu giá 09:00 ngày 16/10/2026

👉 Chi tiết & đăng ký: http://localhost:8080/sessions/f10d0006-0000-4000-8000-000000000001

☎️ Công ty Đấu giá Hợp danh Bảo Tín — 028 3822 5566

Đăng ký sớm để kịp xem tài sản trước phiên.

📌 Nhắn lại để Bảo Tín giữ lịch xem nhà ngày 22–24/09, mỗi khung giờ nhận tối đa 5 khách.');
  PERFORM public.outreach_edit_field(v_pack, 'pitch:multi', 'Phiên PDG000012 có nhiều tài sản khớp nhu cầu của anh/chị, giá khởi điểm từ 12,800,000,000₫, đấu giá ngày 16/10. Bên em hỗ trợ đặt lịch xem cả hai căn trong cùng một buổi.');
  PERFORM public.outreach_mark_sent(v_pack, 'listing', '[DEMO] Nhà phố Tô Hiến Thành, Quận 10 và nhà riêng 750 m² Đường số 65 — mã phiên PDG000012

Phiên đấu giá công khai 2 tài sản do Công ty Đấu giá Hợp danh Bảo Tín tổ chức.

Tài sản đấu giá:
• Lô 1: Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10 (Quận 10, TP. Hồ Chí Minh) — giá khởi điểm 12,800,000,000₫
• Lô 2: Nhà riêng 750 m² Đường số 65, Phường 6, TP. Hồ Chí Minh (TP. Hồ Chí Minh) — giá khởi điểm 37,650,000,000₫

Điểm nổi bật:
• Lô 1: Nhà phố 4 tầng kết cấu bê tông cốt thép, mặt tiền đường Tô Hiến Thành rộng 12 m, cách Vạn Hạnh Mall 600 m. Tầng trệt đang cho thuê kinh doanh (hợp đồng thuê đến 31/12/2026), 3 tầng trên để ở, sân thượng rộng. Sổ hồng ri…
• Lô 2: Tài sản bảo đảm do Ngân hàng TMCP Ngoại thương Việt Nam - Chi nhánh Hà Nội phát mại theo quy định pháp luật. Nhà riêng trên khu đất 750 m², hai mặt tiền đường nội bộ.

Lịch phiên:
• Xem tài sản: Từ 08:00 ngày 22/09/2026 đến 17:00 ngày 24/09/2026
• Nhận hồ sơ: Từ 08:00 ngày 03/09/2026 đến 17:00 ngày 13/10/2026
• Tổ chức đấu giá: 09:00 ngày 16/10/2026 tại Hội trường Công ty Đấu giá Hợp danh Bảo Tín, 88 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh

Tham gia:
• Tiền đặt trước: Lô 1 1,280,000,000₫; Lô 2 3,765,000,000₫
• Tiền mua hồ sơ: 500,000₫
• Hình thức: Đấu giá trực tiếp tại cuộc đấu giá

Vị trí, pháp lý và hiện trạng được công bố trong hồ sơ phiên; nên xem tài sản thực tế trước khi đăng ký.

Thông tin pháp lý chính thức theo thông báo đấu giá của Công ty Đấu giá Hợp danh Bảo Tín (mã phiên PDG000012).

Chi tiết & đăng ký: http://localhost:8080/sessions/f10d0006-0000-4000-8000-000000000001

Liên hệ: Công ty Đấu giá Hợp danh Bảo Tín — Hotline 028 3822 5566 — Chị Ngô Thu Hà — chuyên viên phiên, 0900 000 199', NULL, 'Đăng trên Cổng Đấu giá tài sản quốc gia');
  UPDATE public.session_outreach_sends SET marked_at = '2026-09-03T01:30:00+00:00'::timestamptz WHERE pack_id = v_pack AND channel = 'listing';
  PERFORM public.outreach_mark_sent(v_pack, 'facebook', '🔔 Công ty Đấu giá Hợp danh Bảo Tín mở phiên đấu giá 2 tài sản

Vị trí, pháp lý và hiện trạng được công bố trong hồ sơ phiên; nên xem tài sản thực tế trước khi đăng ký.

Tài sản đấu giá:
• Lô 1: Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10 (Quận 10, TP. Hồ Chí Minh) — giá khởi điểm 12,800,000,000₫
• Lô 2: Nhà riêng 750 m² Đường số 65, Phường 6, TP. Hồ Chí Minh (TP. Hồ Chí Minh) — giá khởi điểm 37,650,000,000₫

Điểm nổi bật:
• Lô 1: Nhà phố 4 tầng kết cấu bê tông cốt thép, mặt tiền đường Tô Hiến Thành rộng 12 m, cách Vạn Hạnh Mall 600 m. Tầng trệt đang cho thuê kinh doanh (hợp đồng thuê đến 31/12/2026), 3 tầng trên để ở, sân thượng rộng. Sổ hồng ri…
• Lô 2: Tài sản bảo đảm do Ngân hàng TMCP Ngoại thương Việt Nam - Chi nhánh Hà Nội phát mại theo quy định pháp luật. Nhà riêng trên khu đất 750 m², hai mặt tiền đường nội bộ.

Lịch phiên:
• Xem tài sản: Từ 08:00 ngày 22/09/2026 đến 17:00 ngày 24/09/2026
• Nhận hồ sơ: Từ 08:00 ngày 03/09/2026 đến 17:00 ngày 13/10/2026
• Tổ chức đấu giá: 09:00 ngày 16/10/2026 tại Hội trường Công ty Đấu giá Hợp danh Bảo Tín, 88 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh

Tham gia:
• Tiền đặt trước: Lô 1 1,280,000,000₫; Lô 2 3,765,000,000₫
• Tiền mua hồ sơ: 500,000₫
• Hình thức: Đấu giá trực tiếp tại cuộc đấu giá

Thông tin pháp lý chính thức theo thông báo đấu giá của Công ty Đấu giá Hợp danh Bảo Tín (mã phiên PDG000012).

Chi tiết & đăng ký: http://localhost:8080/sessions/f10d0006-0000-4000-8000-000000000001

Liên hệ: Công ty Đấu giá Hợp danh Bảo Tín — Hotline 028 3822 5566 — Chị Ngô Thu Hà — chuyên viên phiên, 0900 000 199

Bình luận hoặc nhắn tin cho trang để được hướng dẫn thủ tục tham gia.

#daugiataisan #batdongsan #tphochiminh', NULL, 'Fanpage Bảo Tín');
  UPDATE public.session_outreach_sends SET marked_at = '2026-09-03T02:00:00+00:00'::timestamptz WHERE pack_id = v_pack AND channel = 'facebook';
  PERFORM public.outreach_mark_sent(v_pack, 'zalo', '📣 Cơ hội sở hữu 2 tài sản qua đấu giá công khai

[DEMO] Nhà phố Tô Hiến Thành, Quận 10 và nhà riêng 750 m² Đường số 65 (mã PDG000012)

• Lô 1: Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10 — 12,800,000,000₫
• Lô 2: Nhà riêng 750 m² Đường số 65, Phường 6, TP. Hồ Chí Minh — 37,650,000,000₫

🗓 Xem tài sản từ 08:00 ngày 22/09/2026
📝 Nhận hồ sơ đến 17:00 ngày 13/10/2026
🔨 Đấu giá 09:00 ngày 16/10/2026

👉 Chi tiết & đăng ký: http://localhost:8080/sessions/f10d0006-0000-4000-8000-000000000001

☎️ Công ty Đấu giá Hợp danh Bảo Tín — 028 3822 5566

Đăng ký sớm để kịp xem tài sản trước phiên.

📌 Nhắn lại để Bảo Tín giữ lịch xem nhà ngày 22–24/09, mỗi khung giờ nhận tối đa 5 khách.', NULL, 'Nhóm Zalo Nhà đầu tư BĐS HCM');
  UPDATE public.session_outreach_sends SET marked_at = '2026-09-03T02:15:00+00:00'::timestamptz WHERE pack_id = v_pack AND channel = 'zalo';
  PERFORM public.outreach_mark_sent(v_pack, NULL, NULL, '[{"contact_id":"c0a70000-0000-4000-8000-000000000001","method":"zalo","segment_key":"multi","text":"Chào anh/chị Nguyễn Văn An,\n\nPhiên PDG000012 có nhiều tài sản khớp nhu cầu của anh/chị, giá khởi điểm từ 12,800,000,000₫, đấu giá ngày 16/10. Bên em hỗ trợ đặt lịch xem cả hai căn trong cùng một buổi.\n\n• Lô 1: Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10 — giá khởi điểm 12,800,000,000₫\n• Lô 2: Nhà riêng 750 m² Đường số 65, Phường 6, TP. Hồ Chí Minh — giá khởi điểm 37,650,000,000₫\n\nĐấu giá: 09:00 ngày 16/10/2026. Nhận hồ sơ đến 17:00 ngày 13/10/2026.\n\nChi tiết: http://localhost:8080/sessions/f10d0006-0000-4000-8000-000000000001\n\nCông ty Đấu giá Hợp danh Bảo Tín — 028 3822 5566"}]'::jsonb, NULL);
  UPDATE public.session_outreach_sends SET marked_at = '2026-09-04T02:30:00+00:00'::timestamptz WHERE pack_id = v_pack AND contact_id = 'c0a70000-0000-4000-8000-000000000001';
  PERFORM public.outreach_mark_sent(v_pack, NULL, NULL, '[{"contact_id":"c0a70000-0000-4000-8000-000000000002","method":"sms","segment_key":"lot:f10d0006-0000-4000-8000-000000000011","text":"[Bao Tin] PDG000012: Nha pho 4 tang mat tien To Hien Thanh, Quan 10 tai Quan 10, TP. Ho Ch.. http://localhost:8080/sessions/f10d0006-0000-4000-8000-000000000001"}]'::jsonb, NULL);
  UPDATE public.session_outreach_sends SET marked_at = '2026-09-04T02:32:00+00:00'::timestamptz WHERE pack_id = v_pack AND contact_id = 'c0a70000-0000-4000-8000-000000000002';
  PERFORM public.outreach_mark_sent(v_pack, NULL, NULL, '[{"contact_id":"c0a70000-0000-4000-8000-000000000008","method":"email","segment_key":"multi","text":"Chào anh/chị Bùi Văn Minh,\n\nPhiên PDG000012 có nhiều tài sản khớp nhu cầu của anh/chị, giá khởi điểm từ 12,800,000,000₫, đấu giá ngày 16/10. Bên em hỗ trợ đặt lịch xem cả hai căn trong cùng một buổi.\n\n• Lô 1: Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10 — giá khởi điểm 12,800,000,000₫\n• Lô 2: Nhà riêng 750 m² Đường số 65, Phường 6, TP. Hồ Chí Minh — giá khởi điểm 37,650,000,000₫\n\nĐấu giá: 09:00 ngày 16/10/2026. Nhận hồ sơ đến 17:00 ngày 13/10/2026.\n\nChi tiết: http://localhost:8080/sessions/f10d0006-0000-4000-8000-000000000001\n\nCông ty Đấu giá Hợp danh Bảo Tín — 028 3822 5566"}]'::jsonb, NULL);
  UPDATE public.session_outreach_sends SET marked_at = '2026-09-04T02:35:00+00:00'::timestamptz WHERE pack_id = v_pack AND contact_id = 'c0a70000-0000-4000-8000-000000000008';
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.session_outreach_packs SET created_at = '2026-09-02T02:30:00+00:00'::timestamptz, generated_at = '2026-09-02T02:42:00+00:00'::timestamptz, updated_at = '2026-09-02T03:12:00+00:00'::timestamptz WHERE id = v_pack;
  UPDATE public.session_outreach_edits SET created_at = CASE
      WHEN kind = 'case_file' THEN '2026-09-02T02:40:00+00:00'::timestamptz
      WHEN kind = 'generate'  THEN '2026-09-02T02:42:00+00:00'::timestamptz
      WHEN field_key = 'channel:zalo' THEN '2026-09-02T03:05:00+00:00'::timestamptz
      ELSE '2026-09-02T03:12:00+00:00'::timestamptz END
   WHERE pack_id = v_pack;
  UPDATE public.session_outreach_fields SET updated_at = CASE field_key
      WHEN 'channel:zalo' THEN '2026-09-02T03:05:00+00:00'::timestamptz WHEN 'pitch:multi' THEN '2026-09-02T03:12:00+00:00'::timestamptz ELSE '2026-09-02T02:42:00+00:00'::timestamptz END
   WHERE pack_id = v_pack;

  -- ── 5. Hỗ trợ khách hàng: cấu hình + hội thoại; AI trả lời qua case_qa_apply_proposal THẬT ──
  INSERT INTO public.org_chat_settings (organization_id, marketplace_mode, zalo_mode, min_confidence, updated_by, created_at, updated_at)
  VALUES ('c9d00002-0000-4000-8000-000000000001', 'auto_send', 'draft', 0.75, '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f', '2026-09-02T03:30:00+00:00'::timestamptz, '2026-09-02T03:30:00+00:00'::timestamptz)
  ON CONFLICT (organization_id) DO NOTHING;
  INSERT INTO public.chat_conversations (id, organization_id, channel, contact_name, contact_phone, bidder_user_id, external_thread_id, is_simulated, last_session_id, status, created_at, updated_at)
  VALUES ('f10d000a-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'marketplace', 'Phạm Quốc Bảo', NULL, '957b8823-9a29-424d-a0fb-6f859590e236', NULL, false, 'f10d0006-0000-4000-8000-000000000001', 'open', '2026-09-06T13:14:00+00:00'::timestamptz, '2026-09-06T13:14:00+00:00'::timestamptz);
  INSERT INTO public.chat_conversations (id, organization_id, channel, contact_name, contact_phone, bidder_user_id, external_thread_id, is_simulated, last_session_id, status, created_at, updated_at)
  VALUES ('f10d000a-0000-4000-8000-000000000002', 'c9d00002-0000-4000-8000-000000000001', 'marketplace', 'Lê Thị Thu Trang', NULL, '0d4ff00a-ac13-4652-90cc-94f7760bc936', NULL, false, 'f10d0006-0000-4000-8000-000000000001', 'open', '2026-09-09T07:30:00+00:00'::timestamptz, '2026-09-09T07:30:00+00:00'::timestamptz);
  INSERT INTO public.chat_conversations (id, organization_id, channel, contact_name, contact_phone, bidder_user_id, external_thread_id, is_simulated, last_session_id, status, created_at, updated_at)
  VALUES ('f10d000a-0000-4000-8000-000000000003', 'c9d00002-0000-4000-8000-000000000001', 'zalo', 'Nguyễn Văn An', '0900000101', NULL, 'sim:0900000101', true, 'f10d0006-0000-4000-8000-000000000001', 'open', '2026-09-10T12:45:00+00:00'::timestamptz, '2026-09-10T12:45:00+00:00'::timestamptz);
  INSERT INTO public.chat_conversations (id, organization_id, channel, contact_name, contact_phone, bidder_user_id, external_thread_id, is_simulated, last_session_id, status, created_at, updated_at)
  VALUES ('f10d000a-0000-4000-8000-000000000004', 'c9d00002-0000-4000-8000-000000000001', 'zalo', 'Anh Hùng', '0987654321', NULL, 'sim:0987654321', true, 'f10d0006-0000-4000-8000-000000000001', 'open', '2026-09-10T14:10:00+00:00'::timestamptz, '2026-09-10T14:10:00+00:00'::timestamptz);
  -- "Cho em hỏi tiền đặt trước lô 1 là bao nhiêu ạ?" → engine: answer (0.77)
  INSERT INTO public.chat_messages (id, conversation_id, organization_id, session_id, direction, author_kind, body, qa_state, external_message_id, created_at)
  VALUES ('f10d000a-0000-4000-8000-000000000011', 'f10d000a-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'f10d0006-0000-4000-8000-000000000001', 'inbound', 'bidder', 'Cho em hỏi tiền đặt trước lô 1 là bao nhiêu ạ?', 'pending', NULL, '2026-09-06T13:14:00+00:00'::timestamptz);
  PERFORM public.case_qa_apply_proposal('f10d000a-0000-4000-8000-000000000011', '{"outcome":"answer","topics":["deposit"],"confidence":0.77,"citations":[{"clause_id":"f10d0007-0000-4000-8000-000000000111","quote":"Lô 1 – Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10: tiền đặt trước là 1,280,000,000₫."}],"engine":"mock-v1"}'::jsonb, true);
  UPDATE public.chat_messages
     SET created_at = '2026-09-06T13:14:00+00:00'::timestamptz + interval '3 seconds',
         sent_at    = CASE WHEN sent_at IS NOT NULL THEN '2026-09-06T13:14:00+00:00'::timestamptz + interval '3 seconds' END
   WHERE in_reply_to = 'f10d000a-0000-4000-8000-000000000011' AND author_kind IN ('ai', 'system');
  UPDATE public.case_question_escalations SET created_at = '2026-09-06T13:14:00+00:00'::timestamptz + interval '2 seconds' WHERE message_id = 'f10d000a-0000-4000-8000-000000000011';
  -- "Căn nhà lô 1 có đang thế chấp ngân hàng không ạ?" → engine: escalate / no_match
  INSERT INTO public.chat_messages (id, conversation_id, organization_id, session_id, direction, author_kind, body, qa_state, external_message_id, created_at)
  VALUES ('f10d000a-0000-4000-8000-000000000012', 'f10d000a-0000-4000-8000-000000000001', 'c9d00002-0000-4000-8000-000000000001', 'f10d0006-0000-4000-8000-000000000001', 'inbound', 'bidder', 'Căn nhà lô 1 có đang thế chấp ngân hàng không ạ?', 'pending', NULL, '2026-09-07T02:02:00+00:00'::timestamptz);
  PERFORM public.case_qa_apply_proposal('f10d000a-0000-4000-8000-000000000012', '{"outcome":"escalate","reason":"no_match","topics":[],"confidence":0,"citations":[],"engine":"mock-v1"}'::jsonb, true);
  UPDATE public.chat_messages
     SET created_at = '2026-09-07T02:02:00+00:00'::timestamptz + interval '3 seconds',
         sent_at    = CASE WHEN sent_at IS NOT NULL THEN '2026-09-07T02:02:00+00:00'::timestamptz + interval '3 seconds' END
   WHERE in_reply_to = 'f10d000a-0000-4000-8000-000000000012' AND author_kind IN ('ai', 'system');
  UPDATE public.case_question_escalations SET created_at = '2026-09-07T02:02:00+00:00'::timestamptz + interval '2 seconds' WHERE message_id = 'f10d000a-0000-4000-8000-000000000012';
  PERFORM set_config('request.jwt.claims', '{"sub":"95d7e29c-f1f5-4361-a3af-e9aeaf792f3f","role":"authenticated"}', true);
  PERFORM public.org_send_staff_reply('f10d000a-0000-4000-8000-000000000001', 'Chào anh Bảo, căn nhà lô 1 hiện không thế chấp ngân hàng và không bị kê biên. Tầng trệt đang cho thuê đến hết 31/12/2026, người trúng đấu giá được tiếp nhận hợp đồng thuê hoặc nhận mặt bằng trống. Bảo Tín đã bổ sung nội dung này vào tài liệu làm rõ của phiên ạ.', 'f10d000a-0000-4000-8000-000000000012', ARRAY['f10d0007-0000-4000-8000-000000000116']::uuid[]);
  SELECT id INTO v_esc FROM public.case_question_escalations WHERE message_id = 'f10d000a-0000-4000-8000-000000000012';
  IF v_esc IS NULL THEN RAISE EXCEPTION 'Câu hỏi thế chấp lẽ ra phải bị chuyển chuyên viên.'; END IF;
  PERFORM public.org_resolve_case_escalation(v_esc, 'added_to_case', 'Đã bổ sung tài liệu làm rõ tình trạng thế chấp / cho thuê của lô 1.', 'f10d0007-0000-4000-8000-000000000116');
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.chat_messages SET created_at = '2026-09-07T03:15:00+00:00'::timestamptz, sent_at = '2026-09-07T03:15:00+00:00'::timestamptz
   WHERE in_reply_to = 'f10d000a-0000-4000-8000-000000000012' AND author_kind = 'staff';
  UPDATE public.case_question_escalations SET resolved_at = '2026-09-07T03:16:00+00:00'::timestamptz WHERE id = v_esc;
  -- "Khi nào được đi xem nhà vậy ạ?" → engine: answer (0.69)
  INSERT INTO public.chat_messages (id, conversation_id, organization_id, session_id, direction, author_kind, body, qa_state, external_message_id, created_at)
  VALUES ('f10d000a-0000-4000-8000-000000000013', 'f10d000a-0000-4000-8000-000000000002', 'c9d00002-0000-4000-8000-000000000001', 'f10d0006-0000-4000-8000-000000000001', 'inbound', 'bidder', 'Khi nào được đi xem nhà vậy ạ?', 'pending', NULL, '2026-09-09T07:30:00+00:00'::timestamptz);
  PERFORM public.case_qa_apply_proposal('f10d000a-0000-4000-8000-000000000013', '{"outcome":"answer","topics":["viewing"],"confidence":0.69,"citations":[{"clause_id":"f10d0007-0000-4000-8000-000000000103","quote":"Người có nhu cầu xem tài sản trực tiếp tại nơi có tài sản từ 08:00 ngày 22/09/2026 đến 17:00 ngày 24/09/2026."}],"engine":"mock-v1"}'::jsonb, true);
  UPDATE public.chat_messages
     SET created_at = '2026-09-09T07:30:00+00:00'::timestamptz + interval '3 seconds',
         sent_at    = CASE WHEN sent_at IS NOT NULL THEN '2026-09-09T07:30:00+00:00'::timestamptz + interval '3 seconds' END
   WHERE in_reply_to = 'f10d000a-0000-4000-8000-000000000013' AND author_kind IN ('ai', 'system');
  UPDATE public.case_question_escalations SET created_at = '2026-09-09T07:30:00+00:00'::timestamptz + interval '2 seconds' WHERE message_id = 'f10d000a-0000-4000-8000-000000000013';
  -- "Hạn nộp tiền đặt trước là ngày nào?" → engine: answer (0.95)
  INSERT INTO public.chat_messages (id, conversation_id, organization_id, session_id, direction, author_kind, body, qa_state, external_message_id, created_at)
  VALUES ('f10d000a-0000-4000-8000-000000000014', 'f10d000a-0000-4000-8000-000000000002', 'c9d00002-0000-4000-8000-000000000001', 'f10d0006-0000-4000-8000-000000000001', 'inbound', 'bidder', 'Hạn nộp tiền đặt trước là ngày nào?', 'pending', NULL, '2026-09-09T07:32:00+00:00'::timestamptz);
  PERFORM public.case_qa_apply_proposal('f10d000a-0000-4000-8000-000000000014', '{"outcome":"answer","topics":["deposit_deadline"],"confidence":0.95,"citations":[{"clause_id":"f10d0007-0000-4000-8000-000000000112","quote":"Người đăng ký nộp tiền đặt trước từ 08:00 ngày 10/10/2026 đến 17:00 ngày 13/10/2026."}],"engine":"mock-v1"}'::jsonb, true);
  UPDATE public.chat_messages
     SET created_at = '2026-09-09T07:32:00+00:00'::timestamptz + interval '3 seconds',
         sent_at    = CASE WHEN sent_at IS NOT NULL THEN '2026-09-09T07:32:00+00:00'::timestamptz + interval '3 seconds' END
   WHERE in_reply_to = 'f10d000a-0000-4000-8000-000000000014' AND author_kind IN ('ai', 'system');
  UPDATE public.case_question_escalations SET created_at = '2026-09-09T07:32:00+00:00'::timestamptz + interval '2 seconds' WHERE message_id = 'f10d000a-0000-4000-8000-000000000014';
  -- "Bước giá lô 2 bao nhiêu vậy em?" → engine: answer (0.73)
  INSERT INTO public.chat_messages (id, conversation_id, organization_id, session_id, direction, author_kind, body, qa_state, external_message_id, created_at)
  VALUES ('f10d000a-0000-4000-8000-000000000015', 'f10d000a-0000-4000-8000-000000000003', 'c9d00002-0000-4000-8000-000000000001', 'f10d0006-0000-4000-8000-000000000001', 'inbound', 'bidder', 'Bước giá lô 2 bao nhiêu vậy em?', 'pending', 'sim:f10d000a-0000-4000-8000-000000000015', '2026-09-10T12:45:00+00:00'::timestamptz);
  PERFORM public.case_qa_apply_proposal('f10d000a-0000-4000-8000-000000000015', '{"outcome":"answer","topics":["bid_step"],"confidence":0.73,"citations":[{"clause_id":"f10d0007-0000-4000-8000-000000000102","quote":"Lô 2: bước giá 200,000,000₫."}],"engine":"mock-v1"}'::jsonb, true);
  UPDATE public.chat_messages
     SET created_at = '2026-09-10T12:45:00+00:00'::timestamptz + interval '3 seconds',
         sent_at    = CASE WHEN sent_at IS NOT NULL THEN '2026-09-10T12:45:00+00:00'::timestamptz + interval '3 seconds' END
   WHERE in_reply_to = 'f10d000a-0000-4000-8000-000000000015' AND author_kind IN ('ai', 'system');
  UPDATE public.case_question_escalations SET created_at = '2026-09-10T12:45:00+00:00'::timestamptz + interval '2 seconds' WHERE message_id = 'f10d000a-0000-4000-8000-000000000015';
  -- "Bên mình có hỗ trợ vay ngân hàng để mua căn nhà này không?" → engine: escalate / out_of_scope
  INSERT INTO public.chat_messages (id, conversation_id, organization_id, session_id, direction, author_kind, body, qa_state, external_message_id, created_at)
  VALUES ('f10d000a-0000-4000-8000-000000000016', 'f10d000a-0000-4000-8000-000000000004', 'c9d00002-0000-4000-8000-000000000001', 'f10d0006-0000-4000-8000-000000000001', 'inbound', 'bidder', 'Bên mình có hỗ trợ vay ngân hàng để mua căn nhà này không?', 'pending', 'sim:f10d000a-0000-4000-8000-000000000016', '2026-09-10T14:10:00+00:00'::timestamptz);
  PERFORM public.case_qa_apply_proposal('f10d000a-0000-4000-8000-000000000016', '{"outcome":"escalate","reason":"out_of_scope","topics":[],"confidence":0,"citations":[],"engine":"mock-v1"}'::jsonb, true);
  UPDATE public.chat_messages
     SET created_at = '2026-09-10T14:10:00+00:00'::timestamptz + interval '3 seconds',
         sent_at    = CASE WHEN sent_at IS NOT NULL THEN '2026-09-10T14:10:00+00:00'::timestamptz + interval '3 seconds' END
   WHERE in_reply_to = 'f10d000a-0000-4000-8000-000000000016' AND author_kind IN ('ai', 'system');
  UPDATE public.case_question_escalations SET created_at = '2026-09-10T14:10:00+00:00'::timestamptz + interval '2 seconds' WHERE message_id = 'f10d000a-0000-4000-8000-000000000016';
  UPDATE public.chat_conversations c
     SET last_message_at = m.last_at, updated_at = m.last_at,
         status = CASE WHEN c.id = 'f10d000a-0000-4000-8000-000000000001' THEN 'resolved' ELSE 'open' END
    FROM (SELECT conversation_id, max(COALESCE(sent_at, created_at)) AS last_at FROM public.chat_messages GROUP BY conversation_id) m
   WHERE m.conversation_id = c.id AND c.id::text LIKE 'f10d000a-%';

  -- ── Kiểm tra cuối: mọi trích dẫn AI phải hợp lệ, phiên đúng trạng thái ──
  SELECT count(*) INTO v_bad FROM public.chat_messages m
   WHERE m.session_id = 'f10d0006-0000-4000-8000-000000000001' AND m.author_kind = 'ai' AND public.case_qa_validate_citations(m.session_id, m.citations) IS NULL;
  IF v_bad > 0 THEN RAISE EXCEPTION '% câu trả lời AI có trích dẫn không hợp lệ.', v_bad; END IF;
  IF (SELECT count(*) FROM public.chat_messages WHERE session_id = 'f10d0006-0000-4000-8000-000000000001' AND author_kind = 'ai') <> 4 THEN
    RAISE EXCEPTION 'Số câu trả lời AI lệch với engine.';
  END IF;
  IF (SELECT status FROM public.auction_sessions WHERE id = 'f10d0006-0000-4000-8000-000000000001') <> 'published'
     OR (SELECT count(*) FROM public.auction_session_items WHERE session_id = 'f10d0006-0000-4000-8000-000000000001') <> 2 THEN
    RAISE EXCEPTION 'Phiên demo không ở trạng thái công bố với 2 lô.';
  END IF;
END
$seed$;
