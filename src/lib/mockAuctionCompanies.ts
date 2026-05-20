export interface AuctionCompany {
  id: string;
  name: string;
  taxCode: string;
  address: string;
  province: string;
  phone: string;
  linkedAccountId: string | null; // non-null = already registered
}

export const MOCK_AUCTION_COMPANIES: AuctionCompany[] = [
  {
    id: "cty-001",
    name: "Công ty Đấu giá Hợp danh Nam Việt",
    taxCode: "0314567890",
    address: "123 Nguyễn Huệ, Phường Bến Nghé, Quận 1",
    province: "TP. Hồ Chí Minh",
    phone: "028 3825 1111",
    linkedAccountId: null,
  },
  {
    id: "cty-002",
    name: "Công ty Đấu giá Hợp danh Minh Đức",
    taxCode: "0101234567",
    address: "45 Tràng Tiền, Phường Tràng Tiền, Hoàn Kiếm",
    province: "Hà Nội",
    phone: "024 3936 2222",
    linkedAccountId: "user-existing-001", // ALREADY LINKED
  },
  {
    id: "cty-003",
    name: "Công ty Đấu giá Hợp danh Quốc Tế Á Châu",
    taxCode: "0315678901",
    address: "88 Lê Lợi, Phường Bến Thành, Quận 1",
    province: "TP. Hồ Chí Minh",
    phone: "028 3821 3333",
    linkedAccountId: null,
  },
  {
    id: "cty-004",
    name: "Trung tâm Dịch vụ Bán đấu giá Tài sản Hà Nội",
    taxCode: "0100198765",
    address: "17 Lý Thái Tổ, Phường Lý Thái Tổ, Hoàn Kiếm",
    province: "Hà Nội",
    phone: "024 3825 4444",
    linkedAccountId: null,
  },
  {
    id: "cty-005",
    name: "Công ty Đấu giá Hợp danh Phương Đông",
    taxCode: "0600567890",
    address: "32 Trần Phú, Phường Mỹ Thạnh, TP. Thủ Dầu Một",
    province: "Bình Dương",
    phone: "0274 3827 5555",
    linkedAccountId: null,
  },
  {
    id: "cty-006",
    name: "Công ty Đấu giá Hợp danh Sao Việt",
    taxCode: "0315901234",
    address: "200 Điện Biên Phủ, Phường 22, Bình Thạnh",
    province: "TP. Hồ Chí Minh",
    phone: "028 3845 6666",
    linkedAccountId: "user-existing-002", // ALREADY LINKED
  },
  {
    id: "cty-007",
    name: "Công ty Đấu giá Hợp danh Thiên Phú",
    taxCode: "0200345678",
    address: "56 Lê Hồng Phong, Phường Đông Khê, Ngô Quyền",
    province: "Hải Phòng",
    phone: "0225 3825 7777",
    linkedAccountId: null,
  },
  {
    id: "cty-008",
    name: "Công ty Đấu giá Hợp danh Toàn Cầu",
    taxCode: "0500789012",
    address: "99 Hùng Vương, Phường Thuận Hưng, Thốt Nốt",
    province: "Cần Thơ",
    phone: "0292 3822 8888",
    linkedAccountId: null,
  },
  {
    id: "cty-009",
    name: "Công ty Đấu giá Hợp danh Đại Việt",
    taxCode: "0400123456",
    address: "12 Bạch Đằng, Phường Thạch Thang, Hải Châu",
    province: "Đà Nẵng",
    phone: "0236 3826 9999",
    linkedAccountId: null,
  },
  {
    id: "cty-010",
    name: "Công ty Đấu giá Hợp danh Bắc Nam",
    taxCode: "0700456789",
    address: "78 Nguyễn Tất Thành, Phường An Mỹ, TP. Tam Kỳ",
    province: "Quảng Nam",
    phone: "0235 3827 0000",
    linkedAccountId: null,
  },
  {
    id: "cty-011",
    name: "Công ty Đấu giá Hợp danh Phú Quý",
    taxCode: "0300234567",
    address: "34 Trường Chinh, Phường Tây Thạnh, Tân Phú",
    province: "TP. Hồ Chí Minh",
    phone: "028 3861 1234",
    linkedAccountId: null,
  },
  {
    id: "cty-012",
    name: "Công ty Đấu giá Hợp danh Bảo Long",
    taxCode: "0106789012",
    address: "67 Giải Phóng, Phường Phương Liệt, Thanh Xuân",
    province: "Hà Nội",
    phone: "024 3641 2345",
    linkedAccountId: null,
  },
  {
    id: "cty-013",
    name: "Công ty Đấu giá Hợp danh Kim Cương",
    taxCode: "0800567890",
    address: "15 Nguyễn Văn Cừ, Phường Nguyễn Cư Trinh, Quận 1",
    province: "TP. Hồ Chí Minh",
    phone: "028 3923 3456",
    linkedAccountId: null,
  },
  {
    id: "cty-014",
    name: "Công ty Đấu giá Hợp danh Vĩnh Lộc",
    taxCode: "0900345678",
    address: "22 Đinh Tiên Hoàng, Phường Đa Kao, Quận 1",
    province: "TP. Hồ Chí Minh",
    phone: "028 3910 4567",
    linkedAccountId: null,
  },
  {
    id: "cty-015",
    name: "Trung tâm Bán đấu giá Tài sản tỉnh Đồng Nai",
    taxCode: "0600123789",
    address: "1 Nguyễn Ái Quốc, Phường Quyết Thắng, TP. Biên Hòa",
    province: "Đồng Nai",
    phone: "0251 3827 5678",
    linkedAccountId: null,
  },
];
