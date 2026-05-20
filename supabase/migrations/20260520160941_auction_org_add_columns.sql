ALTER TABLE auction_organizations
  ADD COLUMN IF NOT EXISTS tax_code TEXT,
  ADD COLUMN IF NOT EXISTS province  TEXT;

INSERT INTO auction_organizations (id, name, tax_code, address, province, phone)
VALUES
  ('cty-001', 'Công ty Đấu giá Hợp danh Nam Việt',           '0314567890', '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1',              'TP. Hồ Chí Minh', '028 3825 1111'),
  ('cty-002', 'Công ty Đấu giá Hợp danh Minh Đức',            '0101234567', '45 Tràng Tiền, Phường Tràng Tiền, Hoàn Kiếm',          'Hà Nội',           '024 3936 2222'),
  ('cty-003', 'Công ty Đấu giá Hợp danh Quốc Tế Á Châu',     '0315678901', '88 Lê Lợi, Phường Bến Thành, Quận 1',                  'TP. Hồ Chí Minh', '028 3821 3333'),
  ('cty-004', 'Trung tâm Dịch vụ Bán đấu giá Tài sản Hà Nội','0100198765', '17 Lý Thái Tổ, Phường Lý Thái Tổ, Hoàn Kiếm',         'Hà Nội',           '024 3825 4444'),
  ('cty-005', 'Công ty Đấu giá Hợp danh Phương Đông',         '0600567890', '32 Trần Phú, Phường Mỹ Thạnh, TP. Thủ Dầu Một',        'Bình Dương',       '0274 3827 5555'),
  ('cty-006', 'Công ty Đấu giá Hợp danh Sao Việt',            '0315901234', '200 Điện Biên Phủ, Phường 22, Bình Thạnh',             'TP. Hồ Chí Minh', '028 3845 6666'),
  ('cty-007', 'Công ty Đấu giá Hợp danh Thiên Phú',           '0200345678', '56 Lê Hồng Phong, Phường Đông Khê, Ngô Quyền',         'Hải Phòng',        '0225 3825 7777'),
  ('cty-008', 'Công ty Đấu giá Hợp danh Toàn Cầu',            '0500789012', '99 Hùng Vương, Phường Thuận Hưng, Thốt Nốt',           'Cần Thơ',          '0292 3822 8888'),
  ('cty-009', 'Công ty Đấu giá Hợp danh Đại Việt',            '0400123456', '12 Bạch Đằng, Phường Thạch Thang, Hải Châu',           'Đà Nẵng',          '0236 3826 9999'),
  ('cty-010', 'Công ty Đấu giá Hợp danh Bắc Nam',             '0700456789', '78 Nguyễn Tất Thành, Phường An Mỹ, TP. Tam Kỳ',        'Quảng Nam',        '0235 3827 0000'),
  ('cty-011', 'Công ty Đấu giá Hợp danh Phú Quý',             '0300234567', '34 Trường Chinh, Phường Tây Thạnh, Tân Phú',           'TP. Hồ Chí Minh', '028 3861 1234'),
  ('cty-012', 'Công ty Đấu giá Hợp danh Bảo Long',            '0106789012', '67 Giải Phóng, Phường Phương Liệt, Thanh Xuân',        'Hà Nội',           '024 3641 2345'),
  ('cty-013', 'Công ty Đấu giá Hợp danh Kim Cương',            '0800567890', '15 Nguyễn Văn Cừ, Phường Nguyễn Cư Trinh, Quận 1',    'TP. Hồ Chí Minh', '028 3923 3456'),
  ('cty-014', 'Công ty Đấu giá Hợp danh Vĩnh Lộc',            '0900345678', '22 Đinh Tiên Hoàng, Phường Đa Kao, Quận 1',            'TP. Hồ Chí Minh', '028 3910 4567'),
  ('cty-015', 'Trung tâm Bán đấu giá Tài sản tỉnh Đồng Nai', '0600123789', '1 Nguyễn Ái Quốc, Phường Quyết Thắng, TP. Biên Hòa',  'Đồng Nai',         '0251 3827 5678')
ON CONFLICT (id) DO NOTHING;
