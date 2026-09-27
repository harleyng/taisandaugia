/**
 * Sổ tay hướng dẫn (dev/tester) theo trang của Trạm Điều Hành — mỗi nhóm menu một tài liệu.
 * Mỗi tính năng là một mục của tài liệu nhóm mình, mở thẳng bằng `#neo`.
 * Đổi mã neo ở đây thì phải đổi cả trong tài liệu (và ngược lại).
 */
export const OWNER_GUIDES = {
  dieuHanh: 'https://claude.ai/artifact/DSZcT3Lnh6JAvYt4MP5Tnt',
  tacNghiep: 'https://claude.ai/artifact/JqbGJTdsSw3PZq7DbHnbp5',
  phanTich: 'https://claude.ai/artifact/W9gxQPfLxcNAX9sUJi41a4',
  thietLap: 'https://claude.ai/artifact/Us131v5NjEuDTf8SeXkffQ',
} as const

/** Gốc route → [tài liệu, mã neo]. Trang con (chi tiết, form, trang in) dùng chung neo với trang gốc. */
const OWNER_GUIDE_ANCHORS: Record<string, readonly [string, string]> = {
  dashboard: [OWNER_GUIDES.dieuHanh, 'tong-quan'],
  'chi-tieu': [OWNER_GUIDES.dieuHanh, 'chi-tieu'],
  'tai-san': [OWNER_GUIDES.dieuHanh, 'tai-san'],
  'ket-qua': [OWNER_GUIDES.dieuHanh, 'ket-qua'],
  'dang-tai-san': [OWNER_GUIDES.tacNghiep, 'so-hoa'],
  'ky-gui-dau-gia': [OWNER_GUIDES.tacNghiep, 'ky-gui'],
  'hop-dong': [OWNER_GUIDES.tacNghiep, 'hop-dong'],
  'thu-tien': [OWNER_GUIDES.tacNghiep, 'thu-tien'],
  'bao-cao': [OWNER_GUIDES.phanTich, 'phan-tich'],
  'dong-tien': [OWNER_GUIDES.phanTich, 'dong-tien'],
  'bao-cao-dinh-ky': [OWNER_GUIDES.phanTich, 'bao-cao-dinh-ky'],
  'chi-nhanh-amc': [OWNER_GUIDES.thietLap, 'chi-nhanh'],
  'thanh-vien': [OWNER_GUIDES.thietLap, 'thanh-vien'],
  'vai-tro': [OWNER_GUIDES.thietLap, 'vai-tro'],
  'lien-ket': [OWNER_GUIDES.thietLap, 'lien-ket'],
  'goi-thue-bao': [OWNER_GUIDES.thietLap, 'goi-thue-bao'],
  credits: [OWNER_GUIDES.thietLap, 'credit'],
}

/** Link hướng dẫn cho trang đang mở; undefined nếu trang chưa có mục hướng dẫn. */
export function ownerGuideUrl(pathname: string): string | undefined {
  const [, root, first] = pathname.split('/')
  if (root !== 'chu-tai-san' || !first) return undefined
  const entry = OWNER_GUIDE_ANCHORS[first]
  return entry ? `${entry[0]}#${entry[1]}` : undefined
}
