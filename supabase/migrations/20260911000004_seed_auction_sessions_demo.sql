-- Seed demo cho Phiên đấu giá — CHỈ dữ liệu RIÊNG TƯ, không đẩy gì ra sàn công khai.
--
-- Tổ chức demo: Công ty Đấu giá Hợp danh Bảo Tín (organizations c9d00002-…-0001,
-- auction_organizations a2222222-…) — đã có 4 tin ACTIVE thật để thử tab "Tin
-- đấu giá công khai", nhưng CHƯA có yêu cầu ký gửi `selected` nào nên tab "Tài sản
-- ký gửi đã trúng" sẽ trống. File này bù đúng chỗ đó:
--   • 1 hồ sơ asset_postings đã duyệt (chủ tài sản demo ae9bfef5-…)
--   • 1 asset_service_requests `selected` gửi Bảo Tín, có quote_plan để prefill
--     bước giá / tiền đặt trước / địa điểm.
--
-- KHÔNG seed phiên đã công bố: project này là môi trường thật, một phiên bịa sẽ
-- hiện ở /sessions cho mọi người. Phiên do người thử tự tạo trong /portal.
--
-- Ghi thẳng `selected` (không qua owner_select_service_quote) nên KHÔNG sinh
-- lead/cơ hội CRM — đúng ý: đây không phải doanh thu thật.
-- INSERT only: guard duyệt asset_postings là BEFORE UPDATE nên không nuốt dòng này.

INSERT INTO public.asset_postings (
  id, user_id, parent_slug, child_slug, title, description,
  province, district, pricing_mode, starting_price, auction_format,
  status, review_status, reviewed_at, submitted_at
) VALUES (
  'a5e5d001-0000-4000-8000-000000000001',
  'ae9bfef5-2694-466f-a97e-5efdf138ac43',
  'bat-dong-san', 'nha-pho',
  'Nhà phố 4 tầng hẻm xe hơi, Quận 5 (demo phiên đấu giá)',
  'Hồ sơ mẫu phục vụ thử luồng đưa tài sản ký gửi đã trúng vào phiên đấu giá.',
  'TP. Hồ Chí Minh', 'Quận 5', 'self', 12500000000, 'truc_tiep',
  'active', 'approved', now() - interval '12 days', now() - interval '14 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.asset_service_requests (
  id, asset_posting_id, auction_org_id, organization_id, user_id, status, origin,
  message, seen_at, quoted_at,
  quote_commission_pct, quote_service_fee, quote_starting_price, quote_lead_time_days,
  quote_note, quote_plan
) VALUES (
  'a5e5d001-0000-4000-8000-000000000002',
  'a5e5d001-0000-4000-8000-000000000001',
  'a2222222-2222-2222-2222-222222222222',
  'c9d00002-0000-4000-8000-000000000001',
  'ae9bfef5-2694-466f-a97e-5efdf138ac43',
  'selected', 'owner',
  'Mong tổ chức sớm đưa tài sản ra đấu giá.',
  now() - interval '11 days', now() - interval '9 days',
  1.5, 45000000, 12500000000, 30,
  'Báo giá mẫu (demo).',
  jsonb_build_object(
    'auction_format', 'truc_tiep',
    'price_step', 100000000,
    'deposit_mode', 'percent',
    'deposit_value', 10,
    'venue', 'Trụ sở Công ty Đấu giá Hợp danh Bảo Tín',
    'channels', '[]'::jsonb,
    'channels_other', NULL,
    'milestones', '{}'::jsonb,
    'scope_included', '[]'::jsonb,
    'scope_excluded', '[]'::jsonb
  )
) ON CONFLICT (id) DO NOTHING;
