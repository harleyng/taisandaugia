-- Fix: the previous migration used 'cty-001' as UUID values which are invalid.
-- This migration ensures the columns exist and inserts the seed companies
-- with proper UUID values.

ALTER TABLE auction_organizations
  ADD COLUMN IF NOT EXISTS tax_code TEXT,
  ADD COLUMN IF NOT EXISTS province  TEXT;

INSERT INTO auction_organizations (id, name, tax_code, address, province, phone)
VALUES
  ('f07f9ec0-44c5-40a4-b8b0-cb1452ae1ca2', 'Công ty Đấu giá Hợp danh Nam Việt',           '0314567890', '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1',              'TP. Hồ Chí Minh', '028 3825 1111'),
  ('db4df616-759a-4d2b-88fd-8e9f8f502e20', 'Công ty Đấu giá Hợp danh Minh Đức',            '0101234567', '45 Tràng Tiền, Phường Tràng Tiền, Hoàn Kiếm',          'Hà Nội',           '024 3936 2222'),
  ('502cc117-3869-4c35-a1ae-97e4b71eda14', 'Công ty Đấu giá Hợp danh Quốc Tế Á Châu',     '0315678901', '88 Lê Lợi, Phường Bến Thành, Quận 1',                  'TP. Hồ Chí Minh', '028 3821 3333'),
  ('3d8be4b9-ff9b-4603-b1bc-b478d5dbe848', 'Trung tâm Dịch vụ Bán đấu giá Tài sản Hà Nội','0100198765', '17 Lý Thái Tổ, Phường Lý Thái Tổ, Hoàn Kiếm',         'Hà Nội',           '024 3825 4444'),
  ('1984dbb2-f58f-47fd-9590-528cf8e100ca', 'Công ty Đấu giá Hợp danh Phương Đông',         '0600567890', '32 Trần Phú, Phường Mỹ Thạnh, TP. Thủ Dầu Một',        'Bình Dương',       '0274 3827 5555'),
  ('3e95291a-2d0b-4244-b523-07717dc54518', 'Công ty Đấu giá Hợp danh Sao Việt',            '0315901234', '200 Điện Biên Phủ, Phường 22, Bình Thạnh',             'TP. Hồ Chí Minh', '028 3845 6666'),
  ('bb41dc07-046e-4ba0-9887-ac9797831317', 'Công ty Đấu giá Hợp danh Thiên Phú',           '0200345678', '56 Lê Hồng Phong, Phường Đông Khê, Ngô Quyền',         'Hải Phòng',        '0225 3825 7777'),
  ('df36f3bf-76d7-460a-b99d-d3ab701439d1', 'Công ty Đấu giá Hợp danh Toàn Cầu',            '0500789012', '99 Hùng Vương, Phường Thuận Hưng, Thốt Nốt',           'Cần Thơ',          '0292 3822 8888'),
  ('967b0871-9caf-4bf5-bc4e-617af382f02b', 'Công ty Đấu giá Hợp danh Đại Việt',            '0400123456', '12 Bạch Đằng, Phường Thạch Thang, Hải Châu',           'Đà Nẵng',          '0236 3826 9999'),
  ('12c60078-bcad-4865-be9a-6085fa9bb4a2', 'Công ty Đấu giá Hợp danh Bắc Nam',             '0700456789', '78 Nguyễn Tất Thành, Phường An Mỹ, TP. Tam Kỳ',        'Quảng Nam',        '0235 3827 0000'),
  ('61c46c06-bf77-4027-b7d9-d228cc78966f', 'Công ty Đấu giá Hợp danh Phú Quý',             '0300234567', '34 Trường Chinh, Phường Tây Thạnh, Tân Phú',           'TP. Hồ Chí Minh', '028 3861 1234'),
  ('68efc838-c9ee-46f9-954a-704205842960', 'Công ty Đấu giá Hợp danh Bảo Long',            '0106789012', '67 Giải Phóng, Phường Phương Liệt, Thanh Xuân',        'Hà Nội',           '024 3641 2345'),
  ('da0be411-ffa1-4615-8637-d970eb242794', 'Công ty Đấu giá Hợp danh Kim Cương',            '0800567890', '15 Nguyễn Văn Cừ, Phường Nguyễn Cư Trinh, Quận 1',    'TP. Hồ Chí Minh', '028 3923 3456'),
  ('88dbfaa9-de34-4f34-9e83-3db0c5d2f4e0', 'Công ty Đấu giá Hợp danh Vĩnh Lộc',            '0900345678', '22 Đinh Tiên Hoàng, Phường Đa Kao, Quận 1',            'TP. Hồ Chí Minh', '028 3910 4567'),
  ('7be50f74-ac9c-4c1c-a9f2-59352690eaf2', 'Trung tâm Bán đấu giá Tài sản tỉnh Đồng Nai', '0600123789', '1 Nguyễn Ái Quốc, Phường Quyết Thắng, TP. Biên Hòa',  'Đồng Nai',         '0251 3827 5678')
ON CONFLICT (id) DO NOTHING;
