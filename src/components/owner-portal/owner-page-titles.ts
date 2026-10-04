/** Tên trang trên tab trình duyệt (`<trang> · <tên cổng>`) — route mới cần một dòng ở đây. */
const OWNER_PAGE_TITLES: Record<string, string> = {
  '/chu-tai-san/dashboard': 'Tổng quan',
  '/chu-tai-san/chi-tieu': 'Chỉ tiêu',
  '/chu-tai-san/tai-san': 'Tài sản',
  '/chu-tai-san/ket-qua': 'Kết quả phiên',
  '/chu-tai-san/dong-tien': 'Dòng tiền',
  '/chu-tai-san/thu-tien': 'Thu tiền',
  '/chu-tai-san/dang-tai-san': 'Số hoá tài sản',
  '/chu-tai-san/ky-gui-dau-gia': 'Ký gửi đấu giá',
  '/chu-tai-san/hop-dong': 'Hợp đồng',
  '/chu-tai-san/truyen-thong/du-lieu': 'Dữ liệu đi đâu',
  '/chu-tai-san/bao-cao': 'Phân tích danh mục',
  '/chu-tai-san/hieu-qua-quang-cao': 'Hiệu quả quảng cáo',
  '/chu-tai-san/bao-cao-dinh-ky': 'Báo cáo định kỳ',
  '/chu-tai-san/chi-nhanh-amc': 'Chi nhánh',
  '/chu-tai-san/thanh-vien': 'Thành viên',
  '/chu-tai-san/vai-tro': 'Vai trò',
  '/chu-tai-san/lien-ket': 'Liên kết',
  '/chu-tai-san/nhat-ky': 'Nhật ký hoạt động',
  '/chu-tai-san/credits': 'Credit & Thanh toán',
}

/** Khớp đường dẫn tĩnh trước, rồi tới các route có tham số (trang chi tiết). */
export function ownerPageTitle(pathname: string): string | undefined {
  if (OWNER_PAGE_TITLES[pathname]) return OWNER_PAGE_TITLES[pathname]
  if (pathname.startsWith('/chu-tai-san/dang-tai-san/')) return 'Chi tiết hồ sơ'
  if (pathname.startsWith('/chu-tai-san/ky-gui-dau-gia/')) return 'Chi tiết ký gửi'
  if (pathname.startsWith('/chu-tai-san/hop-dong/')) return 'Chi tiết hợp đồng'
  if (pathname.startsWith('/chu-tai-san/bao-cao-dinh-ky/')) return 'Chi tiết báo cáo'
  if (pathname.startsWith('/chu-tai-san/chi-tieu/')) return 'Chi tiết chỉ tiêu'
  if (pathname.startsWith('/chu-tai-san/vai-tro/')) return 'Chi tiết vai trò'
  return undefined
}
