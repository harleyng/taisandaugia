-- Add more auction organizations and redistribute listings
INSERT INTO public.auction_organizations (id, name, org_type, address, phone, email, logo_url) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Trung tâm Dịch vụ Đấu giá Tài sản TP. Hồ Chí Minh', 0, '19 Pasteur, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', '028 3829 1234', 'lienhe@dgts-hcm.gov.vn', NULL),
  ('a2222222-2222-2222-2222-222222222222', 'Công ty Đấu giá Hợp danh Bảo Tín', 1, '88 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh', '028 3822 5566', 'contact@baotin-auction.vn', NULL),
  ('a3333333-3333-3333-3333-333333333333', 'Công ty Đấu giá Hợp danh Miền Nam', 2, '215 Nguyễn Văn Cừ, Phường An Hòa, Quận Ninh Kiều, Cần Thơ', '0292 3838 999', 'info@dgmn.com.vn', NULL),
  ('a4444444-4444-4444-4444-444444444444', 'Trung tâm Dịch vụ Đấu giá Tài sản Hà Nội', 0, '2 Lê Thái Tổ, Phường Hàng Trống, Quận Hoàn Kiếm, Hà Nội', '024 3825 7788', 'ttdg@hanoi.gov.vn', NULL),
  ('a5555555-5555-5555-5555-555555555555', 'Công ty Đấu giá Hợp danh Đông Dương', 1, '125 Hùng Vương, Phường Vĩnh Trung, Quận Thanh Khê, Đà Nẵng', '0236 3654 321', 'info@dongduong-auction.vn', NULL),
  ('a6666666-6666-6666-6666-666666666666', 'Chi nhánh Công ty Đấu giá Hợp danh Việt Nam tại Hải Phòng', 11, '12 Trần Phú, Phường Máy Tơ, Quận Ngô Quyền, Hải Phòng', '0225 3745 678', 'haiphong@dgvn.com.vn', NULL);

-- Redistribute listings across all 7 organizations using deterministic hash on id
WITH orgs AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 AS idx
  FROM public.auction_organizations
),
assigned AS (
  SELECT l.id AS listing_id,
         (SELECT id FROM orgs WHERE idx = (('x' || substr(md5(l.id::text), 1, 8))::bit(32)::int % (SELECT COUNT(*) FROM orgs))) AS new_org_id
  FROM public.listings l
  WHERE l.status IN ('ACTIVE','SOLD_RENTED')
)
UPDATE public.listings l
SET auction_org_id = a.new_org_id
FROM assigned a
WHERE l.id = a.listing_id;